'use client'
import Link from 'next/link'
import type { PlanId } from '@/lib/subscription/catalog'

interface SubscriptionBadgeProps {
  plan: PlanId
  compact?: boolean
  showUpgrade?: boolean
}

const TIER_CONFIG: Record<PlanId, { label: string; bg: string; text: string; border: string }> = {
  free: {
    label: 'FREE',
    bg: 'bg-[var(--bg-tertiary)]',
    text: 'text-[var(--text-secondary)]',
    border: 'border-[var(--border-color)]',
  },
  pro: {
    label: 'PRO',
    bg: 'bg-emerald-900/50',
    text: 'text-emerald-400',
    border: 'border-emerald-700/50',
  },
  team: {
    label: 'TEAM',
    bg: 'bg-blue-900/50',
    text: 'text-blue-400',
    border: 'border-blue-700/50',
  },
  firm: {
    label: 'FIRM',
    bg: 'bg-purple-900/50',
    text: 'text-purple-400',
    border: 'border-purple-700/50',
  },
  enterprise: {
    label: 'ENTERPRISE',
    bg: 'bg-amber-900/50',
    text: 'text-amber-400',
    border: 'border-amber-700/50',
  },
}

export default function SubscriptionBadge({ plan, compact = false, showUpgrade = false }: SubscriptionBadgeProps) {
  const config = TIER_CONFIG[plan]

  if (compact) {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${config.bg} ${config.text}`}
      >
        {config.label}
      </span>
    )
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.bg} ${config.border}`}>
      <span className={`text-sm font-bold ${config.text}`}>{config.label}</span>
      {showUpgrade && plan === 'free' && (
        <Link
          href="/pricing"
          className="text-xs bg-[var(--accent)] text-black px-2 py-0.5 rounded font-semibold hover:bg-[var(--accent-dim)] transition-colors"
        >
          Upgrade
        </Link>
      )}
    </div>
  )
}
