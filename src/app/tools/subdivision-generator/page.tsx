'use client'

import { useState, useCallback, useMemo } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import {
  generateSubdivision,
  KENYA_PLOT_PRESETS,
  KENYA_ROAD_PRESETS,
  type SubdivisionResult,
  type SubdividedPlot,
} from '@/lib/compute/subdivisionGenerator'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface CoordRow {
  id: number
  easting: string
  northing: string
}

// Sample: 1-hectare parent parcel in Kenya UTM 37S
const SAMPLE_PARENT: CoordRow[] = [
  { id: 1, easting: '274812.403', northing: '9856214.778' },
  { id: 2, easting: '274912.403', northing: '9856214.778' },
  { id: 3, easting: '274912.403', northing: '9856314.778' },
  { id: 4, easting: '274812.403', northing: '9856314.778' },
]

export default function SubdivisionGeneratorPage() {
  const { t } = useLanguage()
  const [rows, setRows] = useState<CoordRow[]>(SAMPLE_PARENT)
  const [result, setResult] = useState<SubdivisionResult | null>(null)
  const [plotPreset, setPlotPreset] = useState(0) // 50×100 default
  const [customWidth, setCustomWidth] = useState('15')
  const [customDepth, setCustomDepth] = useState('30')
  const [roadPreset, setRoadPreset] = useState(0) // 9m default
  const [roadPlacement, setRoadPlacement] = useState<'center' | 'edge'>('center')
  const [generating, setGenerating] = useState(false)

  const plotWidth = plotPreset === KENYA_PLOT_PRESETS.length - 1
    ? parseFloat(customWidth) || 15
    : KENYA_PLOT_PRESETS[plotPreset].width
  const plotDepth = plotPreset === KENYA_PLOT_PRESETS.length - 1
    ? parseFloat(customDepth) || 30
    : KENYA_PLOT_PRESETS[plotPreset].depth
  const roadWidth = KENYA_ROAD_PRESETS[roadPreset].width

  const addRow = () => setRows(prev => [...prev, { id: prev.length + 1, easting: '', northing: '' }])
  const removeRow = (id: number) => setRows(prev => prev.filter(r => r.id !== id))
  const updateRow = (id: number, field: 'easting' | 'northing', value: string) =>
    setRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)))

  const runSubdivision = useCallback(() => {
    const coords: [number, number][] = rows
      .filter(r => r.easting && r.northing)
      .map(r => [parseFloat(r.easting), parseFloat(r.northing)])

    if (coords.length < 4) {
      alert('Need at least 4 boundary points (3 corners + closing point)')
      return
    }

    setGenerating(true)
    try {
      const res = generateSubdivision({
        parentBoundary: coords,
        plotWidth,
        plotDepth,
        roadWidth,
        roadPlacement,
      })
      setResult(res)
    } catch (err) {
      alert(`Subdivision failed: ${err instanceof Error ? err.message : 'unknown error'}`)
    } finally {
      setGenerating(false)
    }
  }, [rows, plotWidth, plotDepth, roadWidth, roadPlacement])

  const loadFromProject = async () => {
    const projectId = prompt('Enter project ID:')
    if (!projectId) return
    try {
      const res = await fetch(`/api/project/${projectId}/points`)
      if (!res.ok) throw new Error('Failed')
      const json = await res.json()
      const points = json.data || []
      const newRows: CoordRow[] = points.map((p: any, i: number) => ({
        id: i + 1,
        easting: String(p.easting),
        northing: String(p.northing),
      }))
      if (newRows.length > 0) setRows(newRows)
    } catch {
      alert('Could not load project points.')
    }
  }

  const exportBeacons = () => {
    if (!result) return
    const csv = 'Beacon ID,Easting,Northing,Shared by plots\n' +
      result.beacons.map(b => `${b.id},${b.easting.toFixed(3)},${b.northing.toFixed(3)},${b.sharedBy.join(' ')}`).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'subdivision-beacons.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-6 md:py-10">
      <PageHeader
        title="Generative subdivision"
        subtitle="Algorithmically subdivide a parent parcel into standard plots with road reserves. Generates plot polygons and beacon coordinates for stakeout."
        reference="Survey Act Cap 299 § 38 · Land Registration Act § 38 · subdivision regulations"
        badge="Cadastral"
      />

      <div className="grid lg:grid-cols-[1fr_1fr] gap-6">
        {/* Left: input controls */}
        <div className="space-y-4">
          {/* Parent boundary */}
          <div className="card">
            <div className="card-header">
              <span className="label">Parent parcel boundary</span>
              <button onClick={loadFromProject} className="font-mono text-[10px] text-[var(--accent)] hover:opacity-80 tracking-[0.06em] uppercase">
                Load from project →
              </button>
            </div>
            <div className="card-body">
              <p className="text-xs text-[var(--text-muted)] mb-4 font-mono">
                Enter parent parcel vertices in UTM (Easting, Northing). Go around the boundary in order.
              </p>
              <div className="space-y-2">
                <div className="grid grid-cols-[40px_1fr_1fr_32px] gap-2 items-center font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase">
                  <span>#</span><span>Easting (m)</span><span>Northing (m)</span><span></span>
                </div>
                {rows.map(row => (
                  <div key={row.id} className="grid grid-cols-[40px_1fr_1fr_32px] gap-2 items-center">
                    <span className="font-mono text-xs text-[var(--text-muted)]">{row.id}</span>
                    <input className="input font-mono text-sm" value={row.easting} onChange={e => updateRow(row.id, 'easting', e.target.value)} aria-label="274812.403" placeholder="274812.403" />
                    <input className="input font-mono text-sm" value={row.northing} onChange={e => updateRow(row.id, 'northing', e.target.value)} aria-label="9856214.778" placeholder="9856214.778" />
                    <button onClick={() => removeRow(row.id)} className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors text-sm">×</button>
                  </div>
                ))}
              </div>
              <button onClick={addRow} className="mt-3 font-mono text-[11px] text-[var(--accent)] hover:opacity-80 tracking-[0.04em]">+ Add vertex</button>
            </div>
          </div>

          {/* Plot size */}
          <div className="card">
            <div className="card-header"><span className="label">Target plot size</span></div>
            <div className="card-body">
              <select value={plotPreset} onChange={e => setPlotPreset(parseInt(e.target.value))} className="input text-sm mb-3">
                {KENYA_PLOT_PRESETS.map((opt, i) => (
                  <option key={opt.label} value={i}>{opt.label}</option>
                ))}
              </select>
              {plotPreset === KENYA_PLOT_PRESETS.length - 1 && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase">Width (m)</label>
                    <input aria-label="Width (m)" className="input font-mono text-sm" type="number" value={customWidth} onChange={e => setCustomWidth(e.target.value)} />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase">Depth (m)</label>
                    <input aria-label="Depth (m)" className="input font-mono text-sm" type="number" value={customDepth} onChange={e => setCustomDepth(e.target.value)} />
                  </div>
                </div>
              )}
              <p className="text-xs text-[var(--text-muted)] mt-2 font-mono">
                Selected: {plotWidth.toFixed(2)}m × {plotDepth.toFixed(2)}m = {(plotWidth * plotDepth).toFixed(1)}m²
              </p>
            </div>
          </div>

          {/* Road reserve */}
          <div className="card">
            <div className="card-header"><span className="label">Road reserve</span></div>
            <div className="card-body">
              <select value={roadPreset} onChange={e => setRoadPreset(parseInt(e.target.value))} className="input text-sm mb-3">
                {KENYA_ROAD_PRESETS.map((opt, i) => (
                  <option key={opt.label} value={i}>{opt.label}</option>
                ))}
              </select>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <input aria-label="Center" type="radio" checked={roadPlacement === 'center'} onChange={() => setRoadPlacement('center')} />
                  Center spine
                </label>
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <input aria-label="Edge" type="radio" checked={roadPlacement === 'edge'} onChange={() => setRoadPlacement('edge')} />
                  Edge road
                </label>
              </div>
            </div>
          </div>

          <button onClick={runSubdivision} disabled={generating} className="btn btn-primary w-full">
            {generating ? 'Generating...' : 'Generate subdivision'}
          </button>
        </div>

        {/* Right: results */}
        <div>
          {!result ? (
            <div className="card">
              <div className="card-body text-center py-16">
                <p className="text-sm text-[var(--text-muted)]">Configure parameters and generate.</p>
                <p className="text-xs text-[var(--text-muted)] mt-2 font-mono">Plots, road reserve, and beacons will appear here.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Stats */}
              <div className="card">
                <div className="card-header"><span className="label">Yield report</span></div>
                <div className="card-body grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase mb-1">Plots yielded</div>
                    <div className="font-display text-3xl text-[var(--accent)] tracking-[-0.02em]">{result.stats.totalPlots}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase mb-1">Rows</div>
                    <div className="font-display text-3xl text-[var(--text-primary)] tracking-[-0.02em]">{result.stats.rowsCreated}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase mb-1">Plot area</div>
                    <div className="font-display text-xl text-[var(--text-primary)] tracking-[-0.02em]">{result.stats.totalPlotAreaSqM.toFixed(0)} <span className="text-sm text-[var(--text-muted)]">m²</span></div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)]">{(result.stats.totalPlotAreaSqM / 10000).toFixed(2)} ha</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase mb-1">Road area</div>
                    <div className="font-display text-xl text-[var(--text-primary)] tracking-[-0.02em]">{result.stats.totalRoadAreaSqM.toFixed(0)} <span className="text-sm text-[var(--text-muted)]">m²</span></div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase mb-1">Parent area</div>
                    <div className="font-display text-xl text-[var(--text-primary)] tracking-[-0.02em]">{result.stats.parentAreaSqM.toFixed(0)} <span className="text-sm text-[var(--text-muted)]">m²</span></div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase mb-1">Efficiency</div>
                    <div className="font-display text-xl text-[var(--success)] tracking-[-0.02em]">{result.stats.efficiency.toFixed(1)}%</div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)]">plot / parent ratio</div>
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="card border-[var(--warning)]/40">
                  <div className="card-header bg-[var(--warning)]/5"><span className="label text-[var(--warning)]">Warnings</span></div>
                  <div className="card-body space-y-2">
                    {result.warnings.map((w, i) => (
                      <p key={`${w}-${i}`} className="text-xs text-[var(--text-secondary)] font-mono">{w}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Plot list */}
              {result.plots.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <span className="label">Plot schedule</span>
                    <button onClick={exportBeacons} className="font-mono text-[10px] text-[var(--accent)] hover:opacity-80 tracking-[0.06em] uppercase">
                      Export beacons CSV →
                    </button>
                  </div>
                  <div className="card-body">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-[var(--bg-card)]">
                          <tr className="text-[var(--text-muted)] border-b border-[var(--border-color)]">
                            <th className="text-left py-2">Plot</th>
                            <th className="text-right py-2">Area (m²)</th>
                            <th className="text-right py-2">Area (ha)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.plots.map(plot => (
                            <tr key={plot.id} className="border-b border-[var(--border-color)]/50">
                              <td className="py-1.5 font-mono text-[var(--accent)]">{plot.label}</td>
                              <td className="py-1.5 text-right font-mono text-[var(--text-primary)]">{plot.areaSqM.toFixed(1)}</td>
                              <td className="py-1.5 text-right font-mono text-[var(--text-muted)]">{(plot.areaSqM / 10000).toFixed(4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Beacon count */}
              <div className="card">
                <div className="card-body flex items-center justify-between">
                  <div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase mb-1">Beacons generated</div>
                    <div className="font-display text-xl text-[var(--text-primary)] tracking-[-0.02em]">{result.beacons.length} corners</div>
                  </div>
                  <button onClick={exportBeacons} className="btn btn-secondary text-xs">
                    Export CSV
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
