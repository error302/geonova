'use client'

import { useState } from 'react'
import { SUBSCRIPTION_PLANS } from '@/lib/reports/surveyReport/subscription'
import type { SubscriptionTier } from '@/lib/reports/surveyReport/types'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  currentTier?: SubscriptionTier
}

export default function UpgradeModal({ isOpen, onClose, currentTier = 'free' }: UpgradeModalProps) {
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('professional')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleUpgrade = () => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      alert(`Thank you for your interest in the ${selectedTier} plan! Payment flow coming soon.`)
    }, 1000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              Upgrade to Generate Survey Reports
            </h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Current tier: <span className="capitalize">{currentTier}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-2xl leading-none">
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {SUBSCRIPTION_PLANS.map(plan => (
            <div
              key={plan.tier}
              onClick={() => setSelectedTier(plan.tier)}
              className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
                selectedTier === plan.tier
                  ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                  : 'border-[var(--border-color)] hover:border-[var(--accent)]/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">{plan.name}</h3>
                {selectedTier === plan.tier && (
                  <div className="w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center">
                    <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="mb-3">
                <span className="text-2xl font-bold text-[var(--accent)]">{plan.price}</span>
                <span className="text-sm text-[var(--text-muted)]">{plan.period}</span>
              </div>
              <ul className="space-y-1.5">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                    <svg className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3 mb-6">
          <p className="text-xs text-amber-300">
            <strong>Survey Reports</strong> are an exclusive Professional-tier feature. Upgrade to unlock RDM 1.1-compliant PDF reports with up to 14 sections including traverse computation, beacon descriptions, and authentication blocks.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Redirecting...' : 'Upgrade Now'}
          </button>
        </div>
      </div>
    </div>
  )
}
