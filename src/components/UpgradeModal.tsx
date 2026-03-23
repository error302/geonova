'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PLAN_CATALOG } from '@/lib/subscription/catalog'
import type { PlanId } from '@/lib/subscription/catalog'
import type { FeatureKey } from '@/lib/subscription/featureGates'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  currentPlan?: PlanId
  feature?: FeatureKey
}

const PLAN_COLORS: Record<PlanId, { border: string; badge: string; text: string }> = {
  free: { border: 'border-[var(--border-color)]', badge: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]', text: 'text-[var(--text-primary)]' },
  pro: { border: 'border-[var(--accent)]', badge: 'bg-emerald-900/50 text-emerald-400', text: 'text-[var(--text-primary)]' },
  team: { border: 'border-blue-600', badge: 'bg-blue-900/50 text-blue-400', text: 'text-[var(--text-primary)]' },
  firm: { border: 'border-purple-600', badge: 'bg-purple-900/50 text-purple-400', text: 'text-[var(--text-primary)]' },
  enterprise: { border: 'border-amber-500', badge: 'bg-amber-900/50 text-amber-400', text: 'text-[var(--text-primary)]' },
}

export default function UpgradeModal({ isOpen, onClose, currentPlan = 'free', feature }: UpgradeModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('pro')

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              {feature ? `Upgrade to Access Feature` : 'Upgrade Your Plan'}
            </h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Current plan: <span className="capitalize font-semibold">{currentPlan}</span>
              {feature && <span className="ml-2">· {feature.replace(/_/g, ' ')} requires Pro</span>}
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-2xl leading-none">
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {PLAN_CATALOG.filter(p => p.id !== 'free').map(plan => {
            const colors = PLAN_COLORS[plan.id]
            const isSelected = selectedPlan === plan.id
            return (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`cursor-pointer rounded-xl border-2 p-5 transition-all ${
                  isSelected ? `${colors.border} bg-[var(--accent)]/5` : `${colors.border} hover:border-[var(--accent)]/50`
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">{plan.name}</h3>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${colors.badge}`}>{plan.id.toUpperCase()}</span>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center">
                      <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-[var(--accent)]">
                    KES {plan.prices.KES.toLocaleString()}
                  </span>
                  <span className="text-sm text-[var(--text-muted)]">/month</span>
                </div>
                <ul className="space-y-1.5">
                  {plan.features.slice(0, 6).map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                      <svg className="w-3 h-3 text-[var(--accent)] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {f}
                    </li>
                  ))}
                  {plan.features.length > 6 && (
                    <li className="text-xs text-[var(--text-muted)]">+ {plan.features.length - 6} more features</li>
                  )}
                </ul>
              </div>
            )
          })}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <Link
            href={`/checkout?plan=${selectedPlan}&currency=KES`}
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded-lg text-sm transition-colors text-center"
          >
            Upgrade to {selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)}
          </Link>
        </div>
      </div>
    </div>
  )
}
