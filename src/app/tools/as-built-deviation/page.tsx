'use client'

import { useState, useCallback } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import {
  checkDeviations,
  interpolateDesignElevation,
  KENHA_TOLERANCES,
  getStatusColor,
  getStatusLabel,
  type DesignStation,
  type AsBuiltPoint,
  type DeviationReport,
} from '@/lib/compute/asBuiltDeviation'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// Sample: 200m road section with design levels
const SAMPLE_DESIGN: DesignStation[] = [
  { chainage: 0, elevation: 1520.000 },
  { chainage: 20, elevation: 1520.150 },
  { chainage: 40, elevation: 1520.300 },
  { chainage: 60, elevation: 1520.450 },
  { chainage: 80, elevation: 1520.600 },
  { chainage: 100, elevation: 1520.750 },
  { chainage: 120, elevation: 1520.900 },
  { chainage: 140, elevation: 1521.050 },
  { chainage: 160, elevation: 1521.200 },
  { chainage: 180, elevation: 1521.350 },
  { chainage: 200, elevation: 1521.500 },
]

const SAMPLE_AS_BUILT: AsBuiltPoint[] = [
  { id: 'AB1', chainage: 0, elevation: 1520.002, description: 'CL 0+000' },
  { id: 'AB2', chainage: 20, elevation: 1520.148, description: 'CL 0+020' },
  { id: 'AB3', chainage: 40, elevation: 1520.312, description: 'CL 0+040' },
  { id: 'AB4', chainage: 60, elevation: 1520.441, description: 'CL 0+060' },
  { id: 'AB5', chainage: 80, elevation: 1520.615, description: 'CL 0+080' },
  { id: 'AB6', chainage: 100, elevation: 1520.758, description: 'CL 0+100' },
  { id: 'AB7', chainage: 120, elevation: 1520.918, description: 'CL 0+120' },
  { id: 'AB8', chainage: 140, elevation: 1521.043, description: 'CL 0+140' },
  { id: 'AB9', chainage: 160, elevation: 1521.222, description: 'CL 0+160' },
  { id: 'AB10', chainage: 180, elevation: 1521.348, description: 'CL 0+180' },
  { id: 'AB11', chainage: 200, elevation: 1521.498, description: 'CL 0+200' },
]

interface DesignRow {
  id: number
  chainage: string
  elevation: string
}

interface AsBuiltRow {
  id: number
  pointId: string
  chainage: string
  elevation: string
  description: string
}

export default function AsBuiltDeviationPage() {
  const { t } = useLanguage()
  const [toleranceIdx, setToleranceIdx] = useState(1) // Subbase default
  const [customPass, setCustomPass] = useState('10')
  const [customMarginal, setCustomMarginal] = useState('15')
  const [report, setReport] = useState<DeviationReport | null>(null)

  const [designRows, setDesignRows] = useState<DesignRow[]>(
    SAMPLE_DESIGN.map((s, i) => ({ id: i + 1, chainage: String(s.chainage), elevation: s.elevation.toFixed(3) })),
  )
  const [asBuiltRows, setAsBuiltRows] = useState<AsBuiltRow[]>(
    SAMPLE_AS_BUILT.map((p, i) => ({ id: i + 1, pointId: p.id, chainage: String(p.chainage), elevation: p.elevation.toFixed(3), description: p.description || '' })),
  )

  const tolerance = toleranceIdx === KENHA_TOLERANCES.length - 1
    ? { label: 'Custom', passLimit: parseFloat(customPass) || 10, marginalLimit: parseFloat(customMarginal) || 15 }
    : KENHA_TOLERANCES[toleranceIdx]

  const addDesignRow = () => setDesignRows(prev => [...prev, { id: prev.length + 1, chainage: '', elevation: '' }])
  const removeDesignRow = (id: number) => setDesignRows(prev => prev.filter(r => r.id !== id))
  const updateDesignRow = (id: number, field: keyof DesignRow, value: string) =>
    setDesignRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)))

  const addAsBuiltRow = () => setAsBuiltRows(prev => [...prev, { id: prev.length + 1, pointId: '', chainage: '', elevation: '', description: '' }])
  const removeAsBuiltRow = (id: number) => setAsBuiltRows(prev => prev.filter(r => r.id !== id))
  const updateAsBuiltRow = (id: number, field: keyof AsBuiltRow, value: string) =>
    setAsBuiltRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)))

  const runCheck = useCallback(() => {
    const design: DesignStation[] = designRows
      .filter(r => r.chainage && r.elevation)
      .map(r => ({ chainage: parseFloat(r.chainage), elevation: parseFloat(r.elevation) }))

    const asBuilt: AsBuiltPoint[] = asBuiltRows
      .filter(r => r.chainage && r.elevation)
      .map(r => ({
        id: r.pointId || `P${r.id}`,
        chainage: parseFloat(r.chainage),
        elevation: parseFloat(r.elevation),
        description: r.description,
      }))

    if (design.length < 2) {
      alert('Need at least 2 design stations')
      return
    }
    if (asBuilt.length === 0) {
      alert('Need at least 1 as-built point')
      return
    }

    const rep = checkDeviations(design, asBuilt, tolerance)
    setReport(rep)
  }, [designRows, asBuiltRows, tolerance])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-6 md:py-10">
      <PageHeader
        title="As-built deviation guard"
        subtitle="Compare as-built survey elevations against design levels. Flags deviations with green (pass), amber (marginal), red (fail) based on KeNHA tolerances. Catches pavement grade issues before the next layer is cast."
        reference="RDM 1.1 (2025) § 9 · KeNHA Road Design Manual · construction tolerance bands"
        badge="Engineering"
      />

      <div className="grid lg:grid-cols-[1fr_1fr] gap-6">
        {/* Left: input */}
        <div className="space-y-4">
          {/* Tolerance selector */}
          <div className="card">
            <div className="card-header"><span className="label">Tolerance band</span></div>
            <div className="card-body">
              <select value={toleranceIdx} onChange={e => setToleranceIdx(parseInt(e.target.value))} className="input text-sm mb-2">
                {KENHA_TOLERANCES.map((opt, i) => (
                  <option key={opt.label} value={i}>{opt.label}</option>
                ))}
              </select>
              {toleranceIdx === KENHA_TOLERANCES.length - 1 && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase">Pass limit (mm)</label>
                    <input aria-label="Pass limit (mm)" className="input font-mono text-sm" type="number" value={customPass} onChange={e => setCustomPass(e.target.value)} />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase">Marginal limit (mm)</label>
                    <input aria-label="Marginal limit (mm)" className="input font-mono text-sm" type="number" value={customMarginal} onChange={e => setCustomMarginal(e.target.value)} />
                  </div>
                </div>
              )}
              <div className="flex gap-4 mt-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--success)' }} />
                  <span className="text-[var(--text-muted)] font-mono">≤ {tolerance.passLimit}mm</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--warning)' }} />
                  <span className="text-[var(--text-muted)] font-mono">{tolerance.passLimit}–{tolerance.marginalLimit}mm</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--error)' }} />
                  <span className="text-[var(--text-muted)] font-mono">&gt; {tolerance.marginalLimit}mm</span>
                </div>
              </div>
            </div>
          </div>

          {/* Design stations */}
          <div className="card">
            <div className="card-header"><span className="label">Design centerline levels</span></div>
            <div className="card-body">
              <div className="space-y-1">
                <div className="grid grid-cols-[28px_1fr_1fr_28px] gap-2 items-center font-mono text-[9px] text-[var(--text-muted)] tracking-[0.04em] uppercase">
                  <span>#</span><span>Chainage (m)</span><span>Design RL (m)</span><span></span>
                </div>
                {designRows.map(row => (
                  <div key={row.id} className="grid grid-cols-[28px_1fr_1fr_28px] gap-2 items-center">
                    <span className="font-mono text-xs text-[var(--text-muted)]">{row.id}</span>
                    <input className="input font-mono text-xs px-2 py-1" value={row.chainage} onChange={e => updateDesignRow(row.id, 'chainage', e.target.value)} aria-label="0" placeholder="0" />
                    <input className="input font-mono text-xs px-2 py-1" value={row.elevation} onChange={e => updateDesignRow(row.id, 'elevation', e.target.value)} aria-label="1520.000" placeholder="1520.000" />
                    <button onClick={() => removeDesignRow(row.id)} className="text-[var(--text-muted)] hover:text-[var(--error)] text-sm">×</button>
                  </div>
                ))}
              </div>
              <button onClick={addDesignRow} className="mt-2 font-mono text-[11px] text-[var(--accent)] hover:opacity-80 tracking-[0.04em]">+ Add station</button>
            </div>
          </div>

          {/* As-built points */}
          <div className="card">
            <div className="card-header"><span className="label">As-built survey points</span></div>
            <div className="card-body">
              <div className="space-y-1">
                <div className="grid grid-cols-[28px_60px_1fr_1fr_1fr_28px] gap-1 items-center font-mono text-[9px] text-[var(--text-muted)] tracking-[0.04em] uppercase min-w-[400px]">
                  <span>#</span><span>ID</span><span>Chainage</span><span>Measured RL</span><span>Description</span><span></span>
                </div>
                {asBuiltRows.map(row => (
                  <div key={row.id} className="grid grid-cols-[28px_60px_1fr_1fr_1fr_28px] gap-1 items-center min-w-[400px]">
                    <span className="font-mono text-xs text-[var(--text-muted)]">{row.id}</span>
                    <input className="input font-mono text-xs px-1 py-1" value={row.pointId} onChange={e => updateAsBuiltRow(row.id, 'pointId', e.target.value)} aria-label="AB1" placeholder="AB1" />
                    <input className="input font-mono text-xs px-1 py-1" value={row.chainage} onChange={e => updateAsBuiltRow(row.id, 'chainage', e.target.value)} aria-label="0" placeholder="0" />
                    <input className="input font-mono text-xs px-1 py-1" value={row.elevation} onChange={e => updateAsBuiltRow(row.id, 'elevation', e.target.value)} aria-label="1520.002" placeholder="1520.002" />
                    <input className="input text-xs px-1 py-1" value={row.description} onChange={e => updateAsBuiltRow(row.id, 'description', e.target.value)} aria-label="CL 0+000" placeholder="CL 0+000" />
                    <button onClick={() => removeAsBuiltRow(row.id)} className="text-[var(--text-muted)] hover:text-[var(--error)] text-sm">×</button>
                  </div>
                ))}
              </div>
              <button onClick={addAsBuiltRow} className="mt-2 font-mono text-[11px] text-[var(--accent)] hover:opacity-80 tracking-[0.04em]">+ Add point</button>
            </div>
          </div>

          <button onClick={runCheck} className="btn btn-primary w-full">Run deviation check</button>
        </div>

        {/* Right: results */}
        <div>
          {!report ? (
            <div className="card">
              <div className="card-body text-center py-16">
                <p className="text-sm text-[var(--text-muted)]">Enter design and as-built data, then run the check.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary stats */}
              <div className="card">
                <div className="card-header"><span className="label">Compliance summary</span></div>
                <div className="card-body grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase mb-1">Pass</div>
                    <div className="font-display text-3xl text-[var(--success)] tracking-[-0.02em]">{report.stats.pass}</div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase mb-1">Marginal</div>
                    <div className="font-display text-3xl text-[var(--warning)] tracking-[-0.02em]">{report.stats.marginal}</div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase mb-1">Fail</div>
                    <div className="font-display text-3xl text-[var(--error)] tracking-[-0.02em]">{report.stats.fail}</div>
                  </div>
                </div>
                <div className="card-body pt-0 grid grid-cols-3 gap-4 mt-3 border-t border-[var(--border-color)] pt-3">
                  <div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase mb-1">Pass rate</div>
                    <div className={`font-display text-xl tracking-[-0.02em] ${report.stats.passRate >= 95 ? 'text-[var(--success)]' : report.stats.passRate >= 80 ? 'text-[var(--warning)]' : 'text-[var(--error)]'}`}>
                      {report.stats.passRate.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase mb-1">Max dev</div>
                    <div className="font-display text-xl text-[var(--text-primary)] tracking-[-0.02em]">{report.stats.maxDeviationMm.toFixed(1)}mm</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase mb-1">Avg dev</div>
                    <div className="font-display text-xl text-[var(--text-primary)] tracking-[-0.02em]">{report.stats.avgDeviationMm.toFixed(1)}mm</div>
                  </div>
                </div>
              </div>

              {/* Verdict */}
              <div className={`card ${report.stats.passRate >= 95 ? 'border-[var(--success)]' : report.stats.passRate >= 80 ? 'border-[var(--warning)]' : 'border-[var(--error)]'}`}>
                <div className="card-body flex items-center gap-3">
                  <div className={`w-10 h-10 flex items-center justify-center ${report.stats.passRate >= 95 ? 'bg-[var(--success)]/15' : report.stats.passRate >= 80 ? 'bg-[var(--warning)]/15' : 'bg-[var(--error)]/15'}`}>
                    {report.stats.passRate >= 95 ? (
                      <svg className="w-6 h-6 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-[var(--error)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h2 className="font-display text-xl tracking-[-0.015em]" style={{ color: report.stats.passRate >= 95 ? 'var(--success)' : report.stats.passRate >= 80 ? 'var(--warning)' : 'var(--error)' }}>
                      {report.stats.passRate >= 95 ? 'Compliant — ready for next layer' : report.stats.passRate >= 80 ? 'Marginal — review failing points' : 'Non-compliant — re-grade required'}
                    </h2>
                    <p className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.04em] mt-0.5">
                      Tolerance: {report.tolerance.label} · {report.stats.pass}/{report.stats.total} points within spec
                    </p>
                  </div>
                </div>
              </div>

              {/* Point-by-point results */}
              <div className="card">
                <div className="card-header"><span className="label">Point-by-point deviation</span></div>
                <div className="card-body">
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-[var(--bg-card)]">
                        <tr className="text-[var(--text-muted)] border-b border-[var(--border-color)]">
                          <th className="text-left py-2">ID</th>
                          <th className="text-right py-2">Chainage</th>
                          <th className="text-right py-2">As-built</th>
                          <th className="text-right py-2">Design</th>
                          <th className="text-right py-2">ΔZ (mm)</th>
                          <th className="text-center py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.results.map(r => (
                          <tr key={r.pointId} className="border-b border-[var(--border-color)]/50">
                            <td className="py-1.5 font-mono text-[var(--accent)]">{r.pointId}</td>
                            <td className="py-1.5 text-right font-mono text-[var(--text-muted)]">{r.chainage.toFixed(1)}</td>
                            <td className="py-1.5 text-right font-mono text-[var(--text-primary)]">{r.asBuiltElevation.toFixed(3)}</td>
                            <td className="py-1.5 text-right font-mono text-[var(--text-muted)]">{r.designElevation.toFixed(3)}</td>
                            <td className="py-1.5 text-right font-mono" style={{ color: getStatusColor(r.status) }}>
                              {r.deltaZ >= 0 ? '+' : ''}{(r.deltaZ * 1000).toFixed(1)}
                            </td>
                            <td className="py-1.5 text-center">
                              <span
                                className="inline-block px-2 py-0.5 font-mono text-[9px] tracking-[0.06em]"
                                style={{ background: `${getStatusColor(r.status)}20`, color: getStatusColor(r.status) }}
                              >
                                {getStatusLabel(r.status)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
