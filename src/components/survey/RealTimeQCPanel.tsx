'use client'

/**
 * RealTimeQCPanel — Live quality control during field work.
 *
 * Shows:
 *   - Running closure (live misclosure as each leg is added)
 *   - Precision ratio with color coding (green/amber/red)
 *   - Setup verification checklist
 *   - Redundant observation alerts
 *   - Outlier detection results
 *
 * Wired to src/lib/survey/realTimeQC.ts
 */

import { useState, useCallback, useMemo } from 'react'
import {
  RunningClosureMonitor,
  detectRedundantObservationDiscrepancies,
  verifySetup,
  formatPrecisionIndicator,
  type Observation,
  type SurveyClass,
} from '@/lib/survey/realTimeQC'
import {
  Activity, AlertTriangle, CheckCircle2, XCircle, Gauge,
  TrendingDown, Layers, ShieldCheck,
} from 'lucide-react'

interface RealTimeQCPanelProps {
  /** Observations from the current traverse (for redundant obs detection) */
  observations?: Observation[]
  /** Current survey class */
  surveyClass?: SurveyClass
  /** Compact mode (for embedding in field book sidebar) */
  compact?: boolean
}

export function RealTimeQCPanel({
  observations = [],
  surveyClass = 'urban',
  compact = false,
}: RealTimeQCPanelProps) {
  const [monitor] = useState(() => new RunningClosureMonitor(surveyClass))
  const [legs, setLegs] = useState<Array<{ bearing: number; distance: number }>>([])
  const [setupData, setSetupData] = useState({
    instrumentHeight: 1.5,
    targetHeight: 1.5,
    temperature: 25,
    pressure: 1013,
    isControlPoint: false,
  })

  const state = monitor.getState()

  const addLeg = useCallback((bearing: number, distance: number) => {
    monitor.addLeg(bearing, distance)
    setLegs(prev => [...prev, { bearing, distance }])
  }, [monitor])

  const undoLeg = useCallback(() => {
    monitor.removeLastLeg()
    setLegs(prev => prev.slice(0, -1))
  }, [monitor])

  const reset = useCallback(() => {
    monitor.reset()
    setLegs([])
  }, [monitor])

  // Redundant observation check
  const discrepancies = useMemo(
    () => detectRedundantObservationDiscrepancies(observations),
    [observations]
  )

  // Setup verification
  const setupChecks = useMemo(
    () => verifySetup(setupData),
    [setupData]
  )

  const precisionInfo = formatPrecisionIndicator(state.precisionRatio ?? null, surveyClass)

  if (compact) {
    return (
      <div className="space-y-2">
        {/* Precision indicator */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-muted)] uppercase">Precision</span>
          <span className={`font-mono text-xs font-bold ${
            precisionInfo.color === 'green' ? 'text-emerald-400'
            : precisionInfo.color === 'amber' ? 'text-amber-400'
            : 'text-red-400'
          }`}>
            {precisionInfo.label}
          </span>
        </div>
        {/* Misclosure */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-muted)] uppercase">Misclosure</span>
          <span className="font-mono text-xs text-[var(--text-primary)]">
            {state.linearMisclosure.toFixed(3)}m
          </span>
        </div>
        {/* Warnings */}
        {state.warnings.map((w, i) => (
          <div key={i} className="flex items-start gap-1 text-[10px] text-amber-400">
            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
            <span>{w}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Running Closure Monitor ── */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gauge className="w-4 h-4 text-[var(--accent)]" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Running Closure</h3>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center">
            <p className="text-lg font-bold text-[var(--text-primary)]">{state.legCount}</p>
            <p className="text-[10px] text-[var(--text-muted)] uppercase">Legs</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-[var(--text-primary)]">
              {state.linearMisclosure.toFixed(3)}m
            </p>
            <p className="text-[10px] text-[var(--text-muted)] uppercase">Misclosure</p>
          </div>
          <div className="text-center">
            <p className={`text-lg font-bold ${
              precisionInfo.color === 'green' ? 'text-emerald-400'
              : precisionInfo.color === 'amber' ? 'text-amber-400'
              : 'text-red-400'
            }`}>
              {precisionInfo.label}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] uppercase">Precision</p>
          </div>
        </div>

        {/* Distance bar */}
        <div className="mb-2">
          <div className="flex justify-between text-[10px] text-[var(--text-muted)] mb-1">
            <span>Total: {state.totalDistance.toFixed(1)}m</span>
            <span>Required: 1:{state.minRequired.toLocaleString()}</span>
          </div>
          <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                state.meetsStandard ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              style={{
                width: state.totalDistance > 0 && state.precisionRatio
                  ? `${Math.min(100, (state.precisionRatio / state.minRequired) * 100)}%`
                  : '0%'
              }}
            />
          </div>
        </div>

        {/* Warnings */}
        {state.warnings.map((w, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg p-2 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{w}</span>
          </div>
        ))}

        {/* Quick add leg (for testing/manual entry) */}
        <div className="flex gap-2">
          <button
            onClick={() => addLeg(45, 50)}
            className="text-[10px] px-2 py-1 bg-[var(--bg-tertiary)] rounded text-[var(--text-secondary)] hover:bg-[var(--border-color)]"
          >
            + Test Leg (45°, 50m)
          </button>
          {legs.length > 0 && (
            <button
              onClick={undoLeg}
              className="text-[10px] px-2 py-1 bg-[var(--bg-tertiary)] rounded text-[var(--text-secondary)] hover:bg-[var(--border-color)]"
            >
              ↶ Undo
            </button>
          )}
          {legs.length > 0 && (
            <button
              onClick={reset}
              className="text-[10px] px-2 py-1 bg-red-500/10 text-red-400 rounded hover:bg-red-500/20"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Setup Verification ── */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Setup Check</h3>
        </div>

        <div className="space-y-2">
          {setupChecks.map((check, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              {check.passed
                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              }
              <span className={`flex-1 ${check.passed ? 'text-[var(--text-secondary)]' : 'text-red-400'}`}>
                {check.message}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Redundant Observation Alerts ── */}
      {discrepancies.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              Observation Discrepancies ({discrepancies.length})
            </h3>
          </div>
          <div className="space-y-2">
            {discrepancies.map((d, i) => (
              <div
                key={i}
                className={`text-xs rounded-lg p-2 ${
                  d.severity === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                }`}
              >
                {d.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Survey Class selector ── */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[var(--text-muted)] uppercase">Class:</span>
        {(['control', 'urban', 'rural', 'topographic'] as SurveyClass[]).map(cls => (
          <button
            key={cls}
            onClick={() => monitor.setSurveyClass(cls)}
            className={`text-[10px] px-2 py-1 rounded ${
              surveyClass === cls
                ? 'bg-[var(--accent)] text-black font-semibold'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
            }`}
          >
            {cls}
          </button>
        ))}
      </div>
    </div>
  )
}
