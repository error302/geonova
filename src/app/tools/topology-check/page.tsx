'use client'

import { useState, useCallback } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { validateCadastralBoundary, type ValidationResult, type ValidationIssue } from '@/lib/compute/topologyValidator'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface CoordRow {
  id: number
  easting: string
  northing: string
}

const EMPTY_ROW: CoordRow = { id: 0, easting: '', northing: '' }

const KENYA_MIN_AREAS = [
  { label: 'Urban plot (commercial)', area: 100 },
  { label: 'Residential plot', area: 250 },
  { label: 'Agricultural plot', area: 500 },
  { label: 'Agricultural (large scale)', area: 2000 },
  { label: 'Custom', area: 0 },
]

export default function TopologyCheckPage() {
  const { t } = useLanguage()
  const [rows, setRows] = useState<CoordRow[]>([
    { id: 1, easting: '274812.403', northing: '9856214.778' },
    { id: 2, easting: '274937.108', northing: '9856220.336' },
    { id: 3, easting: '274943.291', northing: '9856098.105' },
    { id: 4, easting: '274818.586', northing: '9856092.547' },
  ])
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [minAreaSelection, setMinAreaSelection] = useState(0) // index into KENYA_MIN_AREAS
  const [customArea, setCustomArea] = useState('100')

  const addRow = () => {
    setRows(prev => [...prev, { id: prev.length + 1, easting: '', northing: '' }])
  }

  const removeRow = (id: number) => {
    setRows(prev => prev.filter(r => r.id !== id))
  }

  const updateRow = (id: number, field: 'easting' | 'northing', value: string) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)))
  }

  const runValidation = useCallback(() => {
    const coords: [number, number][] = rows
      .filter(r => r.easting && r.northing)
      .map(r => [parseFloat(r.easting), parseFloat(r.northing)])

    if (coords.length < 3) {
      setResult(null)
      return
    }

    const minArea = minAreaSelection === KENYA_MIN_AREAS.length - 1
      ? parseFloat(customArea) || 100
      : KENYA_MIN_AREAS[minAreaSelection].area

    const res = validateCadastralBoundary(coords, {
      minAreaSqM: minArea,
      sliverThresholdSqM: 5,
      sliverRatioThreshold: 0.01,
      minVertices: 4,
    })
    setResult(res)
  }, [rows, minAreaSelection, customArea])

  const loadFromProject = async () => {
    const projectId = prompt('Enter project ID:')
    if (!projectId) return
    try {
      const res = await fetch(`/api/project/${projectId}/points`)
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      const points = json.data || []
      const newRows: CoordRow[] = points.map((p: any, i: number) => ({
        id: i + 1,
        easting: String(p.easting),
        northing: String(p.northing),
      }))
      if (newRows.length > 0) {
        setRows(newRows)
      }
    } catch {
      alert('Could not load project points. Check the project ID.')
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-6 md:py-10">
      <PageHeader
        title="Topology pre-flight check"
        subtitle="Validate cadastral boundary geometry before NLIMS / ArdhiSasa submission. Catches self-intersections, sliver polygons, area violations, and winding-order issues."
        reference="Survey Act Cap 299 · NLIMS submission requirements · GeoJSON spec (RFC 7946)"
        badge="ArdhiSasa"
      />

      <div className="grid lg:grid-cols-[1fr_1fr] gap-6">
        {/* Left: input */}
        <div>
          <div className="card mb-4">
            <div className="card-header">
              <span className="label">Boundary coordinates</span>
              <button
                onClick={loadFromProject}
                className="font-mono text-[10px] text-[var(--accent)] hover:opacity-80 tracking-[0.06em] uppercase"
              >
                Load from project →
              </button>
            </div>
            <div className="card-body">
              <p className="text-xs text-[var(--text-muted)] mb-4 font-mono">
                Enter boundary vertices in UTM (Easting, Northing). Order matters — go clockwise or counter-clockwise around the parcel.
              </p>
              <div className="space-y-2">
                <div className="grid grid-cols-[40px_1fr_1fr_32px] gap-2 items-center font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase">
                  <span>#</span>
                  <span>Easting (m)</span>
                  <span>Northing (m)</span>
                  <span></span>
                </div>
                {rows.map((row) => (
                  <div key={row.id} className="grid grid-cols-[40px_1fr_1fr_32px] gap-2 items-center">
                    <span className="font-mono text-xs text-[var(--text-muted)]">{row.id}</span>
                    <input
                      className="input font-mono text-sm"
                      value={row.easting}
                      onChange={(e) => updateRow(row.id, 'easting', e.target.value)}
                      aria-label="274812.403" placeholder="274812.403"
                    />
                    <input
                      className="input font-mono text-sm"
                      value={row.northing}
                      onChange={(e) => updateRow(row.id, 'northing', e.target.value)}
                      aria-label="9856214.778" placeholder="9856214.778"
                    />
                    <button
                      onClick={() => removeRow(row.id)}
                      className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors text-sm"
                      aria-label="Remove row"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addRow}
                className="mt-3 font-mono text-[11px] text-[var(--accent)] hover:opacity-80 tracking-[0.04em]"
              >
                + Add vertex
              </button>
            </div>
          </div>

          {/* Minimum area selector */}
          <div className="card mb-4">
            <div className="card-header">
              <span className="label">Minimum statutory area</span>
            </div>
            <div className="card-body">
              <select
                value={minAreaSelection}
                onChange={(e) => setMinAreaSelection(parseInt(e.target.value))}
                className="input text-sm mb-2"
              >
                {KENYA_MIN_AREAS.map((opt, i) => (
                  <option key={opt.label} value={i}>
                    {opt.label} {opt.area > 0 ? `(${opt.area} m²)` : ''}
                  </option>
                ))}
              </select>
              {minAreaSelection === KENYA_MIN_AREAS.length - 1 && (
                <input
                  className="input font-mono text-sm"
                  type="number"
                  value={customArea}
                  onChange={(e) => setCustomArea(e.target.value)}
                  aria-label="100" placeholder="100"
                />
              )}
            </div>
          </div>

          <button onClick={runValidation} className="btn btn-primary w-full">
            Run pre-flight check
          </button>
        </div>

        {/* Right: results */}
        <div>
          {!result ? (
            <div className="card">
              <div className="card-body text-center py-16">
                <p className="text-sm text-[var(--text-muted)]">
                  Enter boundary coordinates and run the check.
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-2 font-mono">
                  Results will appear here.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Verdict */}
              <div className={`card ${result.isValid ? 'border-[var(--success)]' : 'border-[var(--error)]'}`}>
                <div className="card-body">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 flex items-center justify-center ${result.isValid ? 'bg-[var(--success)]/15' : 'bg-[var(--error)]/15'}`}>
                      {result.isValid ? (
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
                      <h2 className={`font-display text-xl tracking-[-0.015em] ${result.isValid ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                        {result.isValid ? 'Ready for submission' : 'Will be rejected'}
                      </h2>
                      <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                        {result.errors.length} error{result.errors.length !== 1 ? 's' : ''} · {result.warnings.length} warning{result.warnings.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="card">
                <div className="card-header">
                  <span className="label">Geometry stats</span>
                </div>
                <div className="card-body grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase mb-1">Area</div>
                    <div className="font-display text-xl text-[var(--text-primary)]">{result.stats.areaSqM.toFixed(2)} <span className="text-sm text-[var(--text-muted)]">m²</span></div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)]">{(result.stats.areaSqM / 10000).toFixed(4)} ha</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase mb-1">Perimeter</div>
                    <div className="font-display text-xl text-[var(--text-primary)]">{result.stats.perimeterM.toFixed(2)} <span className="text-sm text-[var(--text-muted)]">m</span></div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase mb-1">Vertices</div>
                    <div className="font-display text-xl text-[var(--text-primary)]">{result.stats.vertexCount}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase mb-1">Ring closed</div>
                    <div className="font-display text-xl text-[var(--text-primary)]">{result.stats.isClosed ? 'Yes' : 'No'}</div>
                  </div>
                </div>
              </div>

              {/* Errors */}
              {result.errors.length > 0 && (
                <div className="card border-[var(--error)]/40">
                  <div className="card-header bg-[var(--error)]/5">
                    <span className="label text-[var(--error)]">Blocking errors</span>
                  </div>
                  <div className="card-body space-y-3">
                    {result.errors.map((err, i) => (
                      <IssueItem key={err.id} issue={err} index={i} />
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="card border-[var(--warning)]/40">
                  <div className="card-header bg-[var(--warning)]/5">
                    <span className="label text-[var(--warning)]">Warnings</span>
                  </div>
                  <div className="card-body space-y-3">
                    {result.warnings.map((warn, i) => (
                      <IssueItem key={warn.id} issue={warn} index={i} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function IssueItem({ issue, index }: { issue: ValidationIssue; index: number }) {
  const color = issue.severity === 'error' ? 'var(--error)' : 'var(--warning)'
  return (
    <div className="flex items-start gap-3">
      <div className={`shrink-0 w-6 h-6 border flex items-center justify-center mt-0.5`} style={{ borderColor: color, color }}>
        <span className="font-mono text-[10px]">{issue.severity === 'error' ? 'E' : 'W'}{index + 1}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-primary)] leading-snug">{issue.message}</p>
        {issue.detail && (
          <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">{issue.detail}</p>
        )}
        {issue.location && (
          <p className="font-mono text-[10px] text-[var(--text-muted)] mt-1">
            Location: [{issue.location[0].toFixed(3)}, {issue.location[1].toFixed(3)}]
          </p>
        )}
      </div>
    </div>
  )
}
