import { createClient } from '@/lib/supabase/client'
import { TIERS, canAccess, getLimit, type FeatureKey } from './featureGates'
import type { PlanId } from './catalog'

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

export async function getSubscription(userId: string): Promise<SubscriptionInfo | null> {
  const supabase = createClient()
  const { data: sub } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (!sub) return null

  const planId = (sub.plan_id || 'free') as PlanId
  const tier = TIERS[planId]

  return {
    plan: planId,
    status: sub.status as SubscriptionInfo['status'],
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
  const supabase = createClient()

  const [{ count: projectCount }, { count: memberCount }] = await Promise.all([
    supabase.from('projects').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('project_members').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ])

  return {
    projectCount: projectCount || 0,
    pointsUsage: {},
    memberCount: memberCount || 0,
  }
}

export async function checkFeatureAccess(
  userId: string,
  feature: FeatureKey
): Promise<AccessCheck> {
  const sub = await getSubscription(userId)
  if (!sub) {
    return { allowed: true, upgradeTo: undefined }
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

export async function checkProjectLimit(userId: string): Promise<AccessCheck> {
  const [sub, usage] = await Promise.all([getSubscription(userId), getUsage(userId)])
  if (!sub) return { allowed: true }

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

export async function checkMemberLimit(userId: string): Promise<AccessCheck> {
  const [sub, usage] = await Promise.all([getSubscription(userId), getUsage(userId)])
  if (!sub) return { allowed: true }

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
  const supabase = createClient()
  const { data: sub } = await supabase
    .from('user_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (sub) {
    await supabase
      .from('user_subscriptions')
      .update({ status: 'cancelled' })
      .eq('id', sub.id)
  }
}

export async function reactivateSubscription(userId: string): Promise<void> {
  const supabase = createClient()
  const { data: sub } = await supabase
    .from('user_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (sub) {
    const now = new Date()
    await supabase
      .from('user_subscriptions')
      .update({
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('id', sub.id)
  }
}
