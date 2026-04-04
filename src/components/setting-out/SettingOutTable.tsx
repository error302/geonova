'use client'

import { type SettingOutResult } from '@/lib/computations/settingOutEngine'

interface Props { result: SettingOutResult }

export default function SettingOutTable({ result }: Props) {
  const { instrumentStation, backsight, bsBearing, rows } = result

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-xs font-mono">
          <div><span className="text-[var(--text-muted)]">Station: </span><span className="text-[var(--text-primary)]">{instrumentStation.e.toFixed(3)}, {instrumentStation.n.toFixed(3)}</span></div>
          <div><span className="text-[var(--text-muted)]">Station RL: </span><span className="text-[var(--text-primary)]">{instrumentStation.rl.toFixed(3)} m</span></div>
          <div><span className="text-[var(--text-muted)]">IH: </span><span className="text-[var(--text-primary)]">{instrumentStation.ih.toFixed(3)} m</span></div>
          <div><span className="text-[var(--text-muted)]">BS: </span><span className="text-[var(--text-primary)]">{backsight.e.toFixed(3)}, {backsight.n.toFixed(3)}</span></div>
          <div><span className="text-[var(--text-muted)]">BS Bearing: </span><span className="text-[var(--text-primary)] font-bold">{bsBearing}</span></div>
          <div><span className="text-[var(--text-muted)]">Points: </span><span className="text-[var(--text-primary)]">{rows.length}</span></div>
        </div>
        <p className="text-[10px] text-[var(--text-muted)] mt-2">Source: Ghilani &amp; Wolf, Elementary Surveying 16th Ed., Chapter 23 | RDM 1.1 Table 5.2</p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono border-collapse">
          <thead>
            <tr className="bg-[var(--bg-tertiary)]">
              {['Point', 'Design E', 'Design N', 'Design RL', 'Hz Angle', 'HD (m)', 'VA', 'SD (m)', 'TH (m)'].map((h: any) => (
                <th key={h} className="px-3 py-2 text-left border border-[var(--border-color)] text-[var(--text-muted)] font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any) => (
              <tr key={row.id} className="hover:bg-[var(--bg-tertiary)]/30 border border-[var(--border-color)]/50">
                <td className="px-3 py-2 text-[var(--text-primary)] font-semibold">{row.id}</td>
                <td className="px-3 py-2 text-[var(--text-primary)] text-right">{row.designE.toFixed(3)}</td>
                <td className="px-3 py-2 text-[var(--text-primary)] text-right">{row.designN.toFixed(3)}</td>
                <td className="px-3 py-2 text-[var(--text-primary)] text-right">{row.designRL.toFixed(3)}</td>
                <td className="px-3 py-2 text-[var(--text-primary)] text-right">{row.HzAngle}"</td>
                <td className="px-3 py-2 text-[var(--text-primary)] text-right">{row.HD.toFixed(3)}</td>
                <td className="px-3 py-2 text-[var(--text-primary)] text-right">{row.VA}</td>
                <td className="px-3 py-2 text-[var(--text-primary)] text-right">{row.SD.toFixed(3)}</td>
                <td className="px-3 py-2 text-[var(--text-secondary)] text-right">{row.TH.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Derivation for first row */}
      {rows[0] && rows[0].steps.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium">Show derivation for {rows[0].id}</summary>
          <div className="mt-2 space-y-1">
            {rows[0].steps.map((step, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto] gap-x-2 font-mono py-1 border-b border-[var(--border-color)]/20">
                <span className="text-[var(--text-secondary)]">{step.description}</span>
                <span className="text-[var(--text-muted)]">=</span>
                <span className="text-[var(--text-primary)]">{step.value}</span>
                <span className="text-[var(--text-muted)] text-right">{step.formula}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
