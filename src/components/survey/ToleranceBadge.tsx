'use client'

/**
 * ToleranceBadge — persistent field-side closure status indicator
 *
 * Shows a green/yellow/red badge with the current closure status.
 * When red, displays the worst-leg recommendation ("Recheck setup at station X").
 *
 * This is the "no stress" UI element: the surveyor glances at it after
 * every shot and knows immediately whether to continue or recheck.
 *
 * Usage:
 *   <ToleranceBadge result={toleranceResult} />
 *
 * Or with a compact variant for the field toolbar:
 *   <ToleranceBadge result={toleranceResult} compact />
 */

import React, { memo, useState } from 'react'
import {
  getToleranceBadgeColor,
  getToleranceBadgeLabel,
  getToleranceIcon,
  type ToleranceCheckResult,
} from '@/lib/survey/liveToleranceChecker'

interface ToleranceBadgeProps {
  result: ToleranceCheckResult | null
  compact?: boolean
}

export const ToleranceBadge = memo(function ToleranceBadge({
  result,
  compact = false,
}: ToleranceBadgeProps) {
  const [showDetails, setShowDetails] = useState(false)

  if (!result) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-500/10 border border-gray-500/20 text-gray-400 text-xs font-mono">
        <span className="text-base">···</span>
        {!compact && <span>No data</span>}
      </div>
    )
  }

  const color = getToleranceBadgeColor(result.status)
  const label = getToleranceBadgeLabel(result.status)
  const icon = getToleranceIcon(result.status)

  // Color classes
  const colorClasses: Record<string, string> = {
    green: 'bg-green-500/15 border-green-500/30 text-green-400',
    yellow: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400',
    red: 'bg-red-500/15 border-red-500/30 text-red-400',
    gray: 'bg-gray-500/10 border-gray-500/20 text-gray-400',
  }

  const cls = colorClasses[color] || colorClasses.gray

  if (compact) {
    // Compact: just icon + status label, expandable on click
    return (
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${cls} text-[10px] font-mono font-bold transition-all hover:scale-105`}
        title={result.summary}
      >
        <span className="text-sm leading-none">{icon}</span>
        <span>{label}</span>
        {result.precisionRatio && (
          <span className="text-[9px] opacity-70">1:{Math.round(result.precisionRatio).toLocaleString()}</span>
        )}
        {showDetails && result.worstLeg && (
          <div className="absolute top-full mt-1 left-0 right-0 bg-[#0d0d14]/95 border border-red-500/30 rounded-lg p-2 text-[9px] text-left z-50 shadow-xl">
            <div className="text-red-400 font-bold mb-0.5">WORST LEG</div>
            <div className="text-gray-300">{result.worstLeg.diagnosis}</div>
            <div className="text-yellow-400 mt-1">{result.worstLeg.recommendation}</div>
          </div>
        )}
      </button>
    )
  }

  // Full: detailed badge with summary + expandable details
  return (
    <div className={`rounded-lg border ${cls} overflow-hidden transition-all`}>
      {/* Header row */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <span className="text-lg leading-none">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold font-mono">{label}</div>
          <div className="text-[10px] opacity-80 truncate">{result.summary}</div>
        </div>
        {showDetails && <span className="text-xs opacity-50">▲</span>}
        {!showDetails && <span className="text-xs opacity-50">▼</span>}
      </button>

      {/* Expandable details */}
      {showDetails && (
        <div className="px-3 pb-3 pt-1 space-y-2 text-[10px] border-t border-current/10">
          {/* Metrics */}
          <div className="grid grid-cols-2 gap-2 font-mono">
            <div>
              <span className="opacity-60">Precision:</span>{' '}
              <span className="font-bold">
                {result.precisionRatio ? `1:${Math.round(result.precisionRatio).toLocaleString()}` : '—'}
              </span>
            </div>
            <div>
              <span className="opacity-60">Required:</span>{' '}
              <span className="font-bold">{result.requiredOrder}</span>
            </div>
            <div>
              <span className="opacity-60">Misclosure:</span>{' '}
              <span className="font-bold">{result.linearMisclosureMm.toFixed(1)}mm</span>
            </div>
            <div>
              <span className="opacity-60">Perimeter:</span>{' '}
              <span className="font-bold">{result.perimeterKm.toFixed(3)}km</span>
            </div>
            <div>
              <span className="opacity-60">Achieved:</span>{' '}
              <span className="font-bold">{result.achievedOrder ?? '—'}</span>
            </div>
            {result.lsaGlobalTest && (
              <div>
                <span className="opacity-60">LSA test:</span>{' '}
                <span className={`font-bold ${result.lsaGlobalTest.passed ? 'text-green-400' : 'text-red-400'}`}>
                  {result.lsaGlobalTest.passed ? 'PASS' : 'FAIL'}
                </span>
              </div>
            )}
          </div>

          {/* Worst leg */}
          {result.worstLeg && (
            <div className="p-2 rounded-md bg-red-500/10 border border-red-500/20">
              <div className="text-red-400 font-bold mb-0.5">⚠ WORST LEG: {result.worstLeg.from} → {result.worstLeg.to}</div>
              <div className="text-gray-300">{result.worstLeg.diagnosis}</div>
              <div className="text-yellow-400 mt-1 font-medium">→ {result.worstLeg.recommendation}</div>
            </div>
          )}

          {/* Recommendations */}
          <div className="space-y-1">
            {result.recommendations.map((rec, i) => (
              <div key={i} className="text-gray-300 flex gap-1.5">
                <span className="opacity-50">•</span>
                <span>{rec}</span>
              </div>
            ))}
          </div>

          {/* RDM 1.1 checks */}
          {result.rdmChecks.checks.length > 0 && (
            <div className="pt-1 border-t border-current/10">
              <div className="opacity-60 font-bold mb-1">RDM 1.1 Checks</div>
              {result.rdmChecks.checks.map((check, i) => (
                <div key={i} className="flex items-start gap-1.5 mb-0.5">
                  <span className={check.passed ? 'text-green-400' : 'text-red-400'}>
                    {check.passed ? '✓' : '✗'}
                  </span>
                  <div className="flex-1">
                    <span className="opacity-70">{check.rule}:</span>{' '}
                    <span className="font-mono">{check.value}</span>
                    <span className="opacity-50"> (limit: {check.limit})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
})
