'use client'

/**
 * BowditchApplyButton — One-tap traverse misclosure distribution
 *
 * The Bowditch (Compass) adjustment engine already exists in
 * src/lib/engine/traverse.ts (bowditchAdjustment function).
 *
 * This component provides the UX: a single button that:
 * 1. Reads the current traverse data from the fieldbook
 * 2. Calls the Bowditch adjustment engine
 * 3. Shows the closure statistics (linear error, precision ratio)
 * 4. Applies the corrections to the coordinates
 * 5. Shows a before/after comparison
 *
 * Survey Act Cap 299 requires:
 * - Urban surveys: precision ≥ 1:10,000
 * - Rural surveys: precision ≥ 1:5,000
 * - Topographic: precision ≥ 1:1,000
 */

import { useState, useCallback } from 'react'
import {
  Calculator, Check, AlertTriangle, Loader2,
  TrendingDown, ArrowRight, X,
} from 'lucide-react'
import { bowditchAdjustment, type TraverseInput } from '@/lib/engine/traverse'
import type { TraverseResult } from '@/lib/engine/types'
import { logger } from '@/lib/logger'

interface BowditchApplyButtonProps {
  /** Traverse input data (stations, bearings, distances) */
  traverseInput: TraverseInput
  /** Called when the adjustment is applied — receives adjusted coordinates */
  onApply: (result: TraverseResult) => void
  /** Survey type for precision threshold */
  surveyCategory?: 'urban' | 'rural' | 'topographic'
  /** Compact mode — just the button */
  compact?: boolean
}

const PRECISION_THRESHOLDS = {
  urban: { ratio: 10000, label: '1:10,000 (Urban)' },
  rural: { ratio: 5000, label: '1:5,000 (Rural)' },
  topographic: { ratio: 1000, label: '1:1,000 (Topographic)' },
}

export function BowditchApplyButton({
  traverseInput,
  onApply,
  surveyCategory = 'urban',
  compact = false,
}: BowditchApplyButtonProps) {
  const [result, setResult] = useState<TraverseResult | null>(null)
  const [computing, setComputing] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [applied, setApplied] = useState(false)

  const threshold = PRECISION_THRESHOLDS[surveyCategory]

  const handleCompute = useCallback(() => {
    setComputing(true)
    try {
      const adjResult = bowditchAdjustment(traverseInput)
      setResult(adjResult)
      setShowDetails(true)
    } catch (err) {
      logger.error('[BowditchApplyButton] Adjustment failed:', { error: err })
      alert(`Adjustment failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setComputing(false)
    }
  }, [traverseInput])

  const handleApply = useCallback(() => {
    if (!result) return
    onApply(result)
    setApplied(true)
    setTimeout(() => {
      setShowDetails(false)
      setApplied(false)
    }, 2000)
  }, [result, onApply])

  // Determine if precision is acceptable
  // TraverseResult has precisionRatio (e.g., 10000 for 1:10000) and precisionGrade
  const precisionRatio = result?.precisionRatio ?? null
  const isAcceptable = precisionRatio != null && precisionRatio >= threshold.ratio

  if (compact) {
    return (
      <button
        onClick={handleCompute}
        disabled={computing}
        className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[#D17B47]/10 border border-[#D17B47]/30 text-[#D17B47] text-xs font-medium hover:bg-[#D17B47]/20 transition-colors disabled:opacity-50"
        title="Apply Bowditch adjustment to distribute misclosure"
      >
        {computing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5" />}
        Bowditch
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-[var(--accent)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">Bowditch Adjustment</span>
        </div>
        <button
          onClick={handleCompute}
          disabled={computing}
          className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-[var(--accent)] text-black text-xs font-semibold hover:bg-[var(--accent-dim)] transition-colors disabled:opacity-50"
        >
          {computing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5" />}
          Compute
        </button>
      </div>

      <div className="text-[10px] text-gray-500 mb-2">
        Threshold: {threshold.label} per Survey Act Cap 299
      </div>

      {/* Results */}
      {result && showDetails && (
        <div className="space-y-2 animate-in fade-in duration-200">
          {/* Precision indicator */}
          <div className={`p-2.5 rounded-lg border ${
            isAcceptable
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            <div className="flex items-center gap-2">
              {isAcceptable ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <div className="flex-1">
                <div className={`text-sm font-semibold ${isAcceptable ? 'text-emerald-400' : 'text-red-400'}`}>
                  Precision: 1:{precisionRatio?.toLocaleString()}
                </div>
                <div className="text-[10px] text-gray-500">
                  {isAcceptable
                    ? 'Within statutory tolerance — safe to apply'
                    : `Below ${threshold.label} — check observations for errors`}
                </div>
              </div>
            </div>
          </div>

          {/* Closure statistics */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-[var(--bg-tertiary)]/50">
              <span className="text-[9px] text-gray-500 uppercase tracking-wider">Linear Error</span>
              <div className="font-mono text-gray-300 mt-0.5">
                {result?.linearError != null ? `${result.linearError.toFixed(4)} m` : '—'}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-[var(--bg-tertiary)]/50">
              <span className="text-[9px] text-gray-500 uppercase tracking-wider">Total Distance</span>
              <div className="font-mono text-gray-300 mt-0.5">
                {result?.totalDistance != null ? `${result.totalDistance.toFixed(3)} m` : '—'}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setShowDetails(false)}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-xs text-gray-400 hover:text-gray-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!isAcceptable || applied}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold transition-colors ${
                applied
                  ? 'bg-emerald-500 text-white'
                  : isAcceptable
                    ? 'bg-[var(--accent)] text-black hover:bg-[var(--accent-dim)]'
                    : 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
              }`}
            >
              {applied ? (
                <><Check className="w-3.5 h-3.5" /> Applied</>
              ) : (
                <>Apply Adjustment <ArrowRight className="w-3.5 h-3.5" /></>
              )}
            </button>
          </div>

          {!isAcceptable && (
            <div className="flex items-start gap-1.5 p-2 rounded-lg bg-red-500/5 border border-red-500/20">
              <TrendingDown className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-red-400/80">
                Precision is below the statutory threshold. Applying this adjustment
                may result in registry rejection. Verify your observations first.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
