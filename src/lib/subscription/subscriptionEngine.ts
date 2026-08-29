import { db } from '@/lib/db'
import { TIERS, canAccess, getLimit, type FeatureKey } from './featureGates'
import type { PlanId } from './catalog'

// Admin emails get free enterprise access - no payment required
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())

function isAdminEmail(email: string | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.toLowerCase())
}

export interface SubscriptionInfo {
  plan: PlanId
  status: 'active' | 'cancelled' | 'expired' | 'trial'
  trialEndsAt: string | null
  periodStart: string
  periodEnd: string
  paymentMethod: string | null
  currency: string
  isUnlimitedProjects: boolean
  isUnlimitedPoints: boolean
  maxTeamMembers: number
}

export interface UsageInfo {
  projectCount: number
  pointsUsage: Record<string, number>
  memberCount: number
}

export interface AccessCheck {
  allowed: boolean
  reason?: string
  upgradeTo?: PlanId
}

export async function getSubscription(userId: string, email?: string): Promise<SubscriptionInfo | null> {
  // Admin emails bypass all subscription checks - free enterprise access
  if (isAdminEmail(email)) {
    const now = new Date().toISOString()
    const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    return {
      plan: 'enterprise',
      status: 'active',
      trialEndsAt: null,
      periodStart: now,
      periodEnd: farFuture,
      paymentMethod: 'admin',
      currency: 'KES',
      isUnlimitedProjects: true,
      isUnlimitedPoints: true,
      maxTeamMembers: -1,
    }
  }

  const { rows } = await db.query<{
    plan_id?: string
    status?: string
    trial_ends_at?: string | null
    current_period_start?: string | null
    current_period_end?: string | null
    payment_method?: string | null
    currency?: string
  }>(
    'SELECT plan_id, status, trial_ends_at, current_period_start, current_period_end, payment_method, currency FROM user_subscriptions WHERE user_id = $1 LIMIT 1',
    [userId]
  )

  if (rows.length === 0) return null

  const sub = rows[0]
  const planId = (sub.plan_id || 'free') as PlanId

  // SECURITY (audit H-04, 2026-08-30): enforce the period. Previously a
  // cancelled or long-expired subscription kept granting its full plan
  // features forever — nothing ever downgraded it. An inactive (cancelled /
  // suspended / expired) subscription or one whose current_period_end has
  // passed now reports as the free tier. Trials downgrade when the trial
  // window ends.
  const now = Date.now()
  const periodEndMs = sub.current_period_end ? Date.parse(sub.current_period_end) : null
  const trialEndMs = sub.trial_ends_at ? Date.parse(sub.trial_ends_at) : null

  let effectivePlan: PlanId = planId
  let effectiveStatus = sub.status as SubscriptionInfo['status']

  if (sub.status === 'trial') {
    if (trialEndMs !== null && trialEndMs < now) {
      effectivePlan = 'free'
      effectiveStatus = 'expired'
    }
  } else if (sub.status !== 'active') {
    // cancelled / suspended / expired → free tier
    effectivePlan = 'free'
  } else if (periodEndMs !== null && periodEndMs < now) {
    effectivePlan = 'free'
    effectiveStatus = 'expired'
  }

  const tier = TIERS[effectivePlan]

  return {
    plan: effectivePlan,
    status: effectiveStatus,
    trialEndsAt: sub.trial_ends_at || null,
    periodStart: sub.current_period_start || new Date().toISOString(),
    periodEnd: sub.current_period_end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    paymentMethod: sub.payment_method || null,
    currency: sub.currency || 'KES',
    isUnlimitedProjects: tier.maxProjects < 0,
    isUnlimitedPoints: tier.maxPointsPerProject < 0,
    maxTeamMembers: tier.maxTeamMembers,
  }
}

export async function getUsage(userId: string): Promise<UsageInfo> {
  const [projectResult, memberResult] = await Promise.all([
    db.query<{ count?: string }>('SELECT COUNT(*) as count FROM projects WHERE user_id = $1', [userId]),
    db.query<{ count?: string }>('SELECT COUNT(*) as count FROM project_members WHERE user_id = $1', [userId]),
  ])

  return {
    projectCount: parseInt(projectResult.rows[0]?.count || '0', 10),
    pointsUsage: {},
    memberCount: parseInt(memberResult.rows[0]?.count || '0', 10),
  }
}

export async function checkFeatureAccess(
  userId: string,
  feature: FeatureKey,
  email?: string
): Promise<AccessCheck> {
  // Admin always has access
  if (isAdminEmail(email)) {
    return { allowed: true }
  }

  const sub = await getSubscription(userId, email)
  if (!sub) {
    // No subscription record — default to free tier access, NOT full access
    if (!canAccess('free', feature)) {
      return { allowed: false, reason: `${feature} requires a paid plan`, upgradeTo: 'pro' }
    }
    return { allowed: true }
  }

  if (sub.plan === 'free') {
    if (!canAccess('free', feature)) {
      return { allowed: false, reason: `${feature} requires a paid plan`, upgradeTo: 'pro' }
    }
    return { allowed: true }
  }

  if (!canAccess(sub.plan, feature)) {
    return { allowed: false, reason: `${feature} requires a higher plan`, upgradeTo: 'team' }
  }
  return { allowed: true }
}

export async function checkProjectLimit(userId: string, email?: string): Promise<AccessCheck> {
  if (isAdminEmail(email)) return { allowed: true }

  const [sub, usage] = await Promise.all([getSubscription(userId, email), getUsage(userId)])
  if (!sub) {
    // No subscription — enforce free tier limits
    const freeLimit = getLimit('free', 'projects')
    if (freeLimit < 0) return { allowed: true }
    if (usage.projectCount >= freeLimit) {
      return { allowed: false, reason: `Project limit reached (${usage.projectCount}/${freeLimit})`, upgradeTo: 'pro' }
    }
    return { allowed: true }
  }

  const limit = getLimit(sub.plan, 'projects')
  if (limit < 0) return { allowed: true }

  if (usage.projectCount >= limit) {
    return {
      allowed: false,
      reason: `Project limit reached (${usage.projectCount}/${limit})`,
      upgradeTo: sub.plan === 'free' ? 'pro' : 'team',
    }
  }
  return { allowed: true }
}

export async function checkMemberLimit(userId: string, email?: string): Promise<AccessCheck> {
  if (isAdminEmail(email)) return { allowed: true }

  const [sub, usage] = await Promise.all([getSubscription(userId, email), getUsage(userId)])
  if (!sub) {
    // No subscription — enforce free tier limits
    const freeLimit = getLimit('free', 'members')
    if (freeLimit < 0) return { allowed: true }
    if (usage.memberCount >= freeLimit) {
      return { allowed: false, reason: `Member limit reached (${usage.memberCount}/${freeLimit})`, upgradeTo: 'pro' }
    }
    return { allowed: true }
  }

  const limit = getLimit(sub.plan, 'members')
  if (limit < 0) return { allowed: true }

  if (usage.memberCount >= limit) {
    return {
      allowed: false,
      reason: `Member limit reached (${usage.memberCount}/${limit})`,
      upgradeTo: 'team',
    }
  }
  return { allowed: true }
}

export function getTrialDaysLeft(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
}

export async function cancelSubscription(userId: string): Promise<void> {
  const { rows } = await db.query<{ id: string }>(
    'SELECT id FROM user_subscriptions WHERE user_id = $1 LIMIT 1',
    [userId]
  )

  if (rows.length > 0) {
    await db.query(
      'UPDATE user_subscriptions SET status = $1 WHERE id = $2',
      ['cancelled', rows[0].id]
    )
  }
}

export async function reactivateSubscription(userId: string): Promise<void> {
  const { rows } = await db.query<{ id: string }>(
    'SELECT id FROM user_subscriptions WHERE user_id = $1 LIMIT 1',
    [userId]
  )

  if (rows.length > 0) {
    const now = new Date()
    await db.query(
      'UPDATE user_subscriptions SET status = $1, current_period_start = $2, current_period_end = $3 WHERE id = $4',
      [
        'active',
        now.toISOString(),
        new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        rows[0].id,
      ]
    )
  }
}
