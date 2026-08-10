import { createClient } from '@/lib/api-client/client'
import type { SubscriptionStatus, SubscriptionTier } from './types'

/**
 * Check if a user can generate professional survey reports.
 * Uses the subscriptionEngine (which has admin email detection) via a
 * lightweight DB query with the same logic.
 */
export async function checkReportAccess(userId: string, email?: string): Promise<SubscriptionStatus> {
  // Admin emails always get full access
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())
  const isFounder = email?.toLowerCase() === 'mohameddosho20@gmail.com'
  const isAdmin = isFounder || (email ? adminEmails.includes(email.toLowerCase()) : false)

  if (isAdmin) {
    return {
      canGenerate: true,
      tier: 'enterprise',
      upgradeRequired: false,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    }
  }

  const dbClient = createClient()

  const { data, error } = await dbClient
    .from('user_subscriptions')
    .select('plan_id, status, current_period_end')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (error || !data) {
    return {
      canGenerate: false,
      tier: 'free',
      upgradeRequired: true,
      expiresAt: null,
    }
  }

  const planId = data.plan_id || 'free'
  const currentPeriodEnd = data.current_period_end
  const expired = typeof currentPeriodEnd === 'string' && new Date(currentPeriodEnd) < new Date()
  const isPro = planId === 'pro' || planId === 'team' || planId === 'firm' || planId === 'enterprise'
  const canGenerate = isPro && !expired

  const tierMap: Record<string, SubscriptionTier> = {
    free: 'free', pro: 'professional', team: 'firm', firm: 'firm', enterprise: 'enterprise',
  }

  return {
    canGenerate,
    tier: tierMap[planId] || 'free',
    upgradeRequired: !canGenerate,
    expiresAt: data.current_period_end,
  }
}

export async function seedProfessionalTier(userId: string): Promise<void> {
  const dbClient = createClient()

  const { data: existing } = await dbClient
    .from('user_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) return

  await dbClient
    .from('user_subscriptions')
    .insert({
      user_id: userId,
      plan_id: 'pro',
      status: 'active',
      current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    })
}

export const SUBSCRIPTION_PLANS = [
  {
    tier: 'professional' as SubscriptionTier,
    name: 'Professional',
    price: 'KES 4,999',
    period: '/month',
    features: [
      'Auto-Generated Survey Reports',
      'PDF export with RDM 1.1 compliance',
      'Up to 10 projects',
      'Email support',
    ],
  },
  {
    tier: 'firm' as SubscriptionTier,
    name: 'Firm',
    price: 'KES 12,999',
    period: '/month',
    features: [
      'Everything in Professional',
      'Unlimited projects',
      'Priority support',
      'Team collaboration (3 seats)',
      'Custom branding',
    ],
  },
  {
    tier: 'enterprise' as SubscriptionTier,
    name: 'Enterprise',
    price: 'KES 29,999',
    period: '/month',
    features: [
      'Everything in Firm',
      'Unlimited team seats',
      'White-label reports',
      'API access',
      'Dedicated account manager',
    ],
  },
]
