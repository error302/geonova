'use client';

import { useState } from 'react'

/**
 * CorrectionAuditTrail — Displays the full correction pipeline audit trail
 * for a set of processed observations.
 * 
 * Shows each correction stage (atmospheric, slope reduction, C&R, sea level,
 * grid scale factor, convergence) with input/output values and corrections.
 * Highlights significant corrections and warnings.
 */

export interface CorrectionLogEntry {
  stage: string;
  input: number;
  output: number;
  correction: number;
  unit: string;
}

export interface CorrectionObservationSummary {
  fromStation: string;
  toStation: string;
  rawSlopeDistance: number;
  gridDistance: number;
  correctionLog: CorrectionLogEntry[];
  warnings: string[];
  atmosphericPPM?: number;
  seaLevelPPM?: number;
  lineScaleFactor?: number;
  convergence?: number;
}

interface CorrectionAuditTrailProps {
  observations: CorrectionObservationSummary[];
  title?: string;
  projection?: string;
  defaultOpen?: boolean;
}

export function CorrectionAuditTrail({
  observations,
  title = 'Correction Pipeline Audit Trail',
  projection = 'UTM 37S',
  defaultOpen = false,
}: CorrectionAuditTrailProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [expandedLegs, setExpandedLegs] = useState<Set<number>>(new Set())

  const toggleLeg = (index: number) => {
    setExpandedLegs(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  if (observations.length === 0) return null

  const totalWarnings = observations.reduce((sum, obs) => sum + obs.warnings.length, 0)
  const significantCorrections = observations.filter(obs =>
    obs.correctionLog.some(log => Math.abs(log.correction) > 0.001)
  )

  return (
    <div className="border border-[var(--border-color)] rounded overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-[color-mix(in_srgb,var(--bg-tertiary)_50%,transparent)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--border-hover)] transition-colors"
      >
        <span className="flex items-center gap-2">
          <span>{title}</span>
          <span className="text-[var(--text-muted)] font-normal text-xs">
            ({projection} · IAG/ISO · {observations.length} legs)
          </span>
          {totalWarnings > 0 && (
            <span className="bg-amber-600/30 text-amber-300 text-[10px] px-1.5 py-0.5 rounded-full">
              {totalWarnings} warning{totalWarnings > 1 ? 's' : ''}
            </span>
          )}
          {significantCorrections.length > 0 && (
            <span className="bg-blue-600/30 text-blue-300 text-[10px] px-1.5 py-0.5 rounded-full">
              {significantCorrections.length} significant
            </span>
          )}
        </span>
        <span className="text-[var(--text-muted)]">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="divide-y divide-[color-mix(in_srgb,var(--border-color)_30%,transparent)]">
          {observations.map((obs, i) => {
            const isExpanded = expandedLegs.has(i)
            const hasSignificantCorrections = obs.correctionLog.some(
              log => Math.abs(log.correction) > 0.001
            )

            return (
              <div key={`${obs}-${i}`} className="text-xs">
                <button
                  onClick={() => toggleLeg(i)}
                  className="w-full flex items-center justify-between px-4 py-2 hover:bg-[color-mix(in_srgb,var(--bg-primary)_20%,transparent)] transition-colors"
                >
                  <span className="font-mono flex items-center gap-2">
                    <span className="text-[var(--text-primary)]">{obs.fromStation} → {obs.toStation}</span>
                    <span className="text-[var(--text-muted)]">
                      SD: {obs.rawSlopeDistance.toFixed(3)} → Grid: {obs.gridDistance.toFixed(3)} m
                    </span>
                    {hasSignificantCorrections && (
                      <span className="text-blue-400 text-[10px]">*</span>
                    )}
                    {obs.warnings.length > 0 && (
                      <span className="text-amber-400 text-[10px]">!</span>
                    )}
                  </span>
                  <span className="text-[var(--text-muted)] text-[10px]">
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-3 space-y-2">
                    {/* Correction stages */}
                    <table className="w-full">
                      <thead>
                        <tr className="text-[var(--text-muted)] text-[10px]">
                          <th className="text-left py-1 pr-2">Stage</th>
                          <th className="text-right py-1 px-1">Input</th>
                          <th className="text-right py-1 px-1">Output</th>
                          <th className="text-right py-1 px-1">Correction</th>
                        </tr>
                      </thead>
                      <tbody>
                        {obs.correctionLog.map((log, j) => {
                          const isSignificant = Math.abs(log.correction) > 0.001
                          return (
                            <tr key={j} className={isSignificant ? 'text-blue-300' : 'text-[var(--text-secondary)]'}>
                              <td className="py-0.5 pr-2 font-medium">{log.stage}</td>
                              <td className="py-0.5 px-1 text-right font-mono">{log.input.toFixed(6)}</td>
                              <td className="py-0.5 px-1 text-right font-mono">{log.output.toFixed(6)}</td>
                              <td className="py-0.5 px-1 text-right font-mono">
                                {log.correction >= 0 ? '+' : ''}{log.correction.toFixed(6)} {log.unit}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    {/* Summary metrics */}
                    <div className="flex gap-4 text-[var(--text-muted)]">
                      {obs.atmosphericPPM !== undefined && (
                        <span>Atm: <span className="text-blue-400 font-mono">{obs.atmosphericPPM.toFixed(1)} ppm</span></span>
                      )}
                      {obs.seaLevelPPM !== undefined && (
                        <span>SL: <span className="text-cyan-400 font-mono">{obs.seaLevelPPM.toFixed(1)} ppm</span></span>
                      )}
                      {obs.lineScaleFactor !== undefined && (
                        <span>SF: <span className="text-emerald-400 font-mono">{obs.lineScaleFactor.toFixed(6)}</span></span>
                      )}
                      {obs.convergence !== undefined && (
                        <span>Conv: <span className="text-violet-400 font-mono">{(obs.convergence * 3600).toFixed(1)}&quot;</span></span>
                      )}
                    </div>

                    {/* Warnings */}
                    {obs.warnings.length > 0 && (
                      <div className="space-y-0.5">
                        {obs.warnings.map((w, j) => (
                          <div key={j} className="text-amber-400 text-[10px]">! {w}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
