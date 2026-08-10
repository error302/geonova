'use client';
import Link from 'next/link'

export default function SubscriptionStatus({ subscription }: { subscription: Record<string, unknown> | null }) {
  const plan = (subscription?.plan_id as string | undefined) || 'free'
  const isTrialing = subscription?.status === 'trial'
  const trialEndsAt = subscription?.trial_ends_at

  const trialDaysLeft = isTrialing && typeof trialEndsAt === 'string'
    ? Math.max(0, Math.ceil(
        (new Date(trialEndsAt).getTime() - Date.now()) / 86400000
      ))
    : 0

  const getBadge = () => {
    if (plan === 'enterprise') {
      return (
        <span className="text-xs bg-amber-900/50 text-amber-400 px-2 py-1 rounded font-semibold">
          Enterprise 
        </span>
      )
    }
    if (plan === 'firm') {
      return (
        <span className="text-xs bg-purple-900/50 text-purple-400 px-2 py-1 rounded font-semibold">
          Firm 
        </span>
      )
    }
    if (plan === 'team') {
      return (
        <span className="text-xs bg-blue-900/50 text-blue-400 px-2 py-1 rounded">
          Team 
        </span>
      )
    }
    if (plan === 'pro') {
      return (
        <span className="text-xs bg-green-900/50 text-green-400 px-2 py-1 rounded">
          Pro 
        </span>
      )
    }
    if (isTrialing && trialDaysLeft > 0) {
      return (
        <span className="text-xs bg-amber-900/50 text-amber-400 px-2 py-1 rounded">
          Pro Trial — {trialDaysLeft} days left
        </span>
      )
    }
    return (
      <span className="text-xs bg-[var(--bg-tertiary)] text-[var(--text-secondary)] px-2 py-1 rounded">
        Free Plan
      </span>
    )
  }

  return (
    <div className="flex items-center justify-between mb-6 p-4 bg-[var(--bg-secondary)]/50 rounded-lg border border-[var(--border-color)]">
      <div className="flex items-center gap-3">
        {getBadge()}
      </div>
      {plan === 'free' && (
        <Link
          href="/pricing"
          className="text-sm text-amber-400 hover:text-amber-300"
        >
          Upgrade →
        </Link>
      )}
    </div>
  )
}
