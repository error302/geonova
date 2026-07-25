'use client'

import { useState, useCallback } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import {
  convertEllipsoidalToOrthometric,
  batchConvertHeights,
  KENYA_GEOID_REFERENCE,
  type HeightConversionResult,
} from '@/lib/geo/geoidHeight'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface BatchRow {
  id: string
  name: string
  lat: string
  lon: string
  h: string
}

let batchId = 0

export default function OrthometricHeightPage() {
  const { t } = useLanguage()
  const [mode, setMode] = useState<'single' | 'batch'>('single')

  // Single mode
  const [latitude, setLatitude] = useState('-1.2864')
  const [longitude, setLongitude] = useState('36.8172')
  const [ellHeight, setEllHeight] = useState('1798.500')
  const [result, setResult] = useState<HeightConversionResult | null>(null)

  // Batch mode
  const [batchRows, setBatchRows] = useState<BatchRow[]>([
    { id: `b${++batchId}`, name: 'CP1', lat: '-1.2864', lon: '36.8172', h: '1798.500' },
    { id: `b${++batchId}`, name: 'CP2', lat: '-1.2900', lon: '36.8200', h: '1799.200' },
    { id: `b${++batchId}`, name: 'CP3', lat: '-1.2850', lon: '36.8150', h: '1800.800' },
  ])
  const [batchResults, setBatchResults] = useState<ReturnType<typeof batchConvertHeights> | null>(null)

  const computeSingle = useCallback(() => {
    const lat = parseFloat(latitude)
    const lon = parseFloat(longitude)
    const h = parseFloat(ellHeight)
    if (isNaN(lat) || isNaN(lon) || isNaN(h)) return

    setResult(convertEllipsoidalToOrthometric({
      latitude: lat,
      longitude: lon,
      ellipsoidalHeight: h,
    }))
  }, [latitude, longitude, ellHeight])

  const computeBatch = useCallback(() => {
    const points = batchRows
      .filter(r => r.lat && r.lon && r.h)
      .map(r => ({
        id: r.name || r.id,
        latitude: parseFloat(r.lat),
        longitude: parseFloat(r.lon),
        ellipsoidalHeight: parseFloat(r.h),
      }))

    if (points.length === 0) return
    setBatchResults(batchConvertHeights(points))
  }, [batchRows])

  const addBatchRow = () => setBatchRows(p => [...p, { id: `b${++batchId}`, name: '', lat: '', lon: '', h: '' }])
  const removeBatchRow = (id: string) => setBatchRows(p => p.filter(r => r.id !== id))
  const updateBatchRow = (id: string, field: keyof BatchRow, value: string) =>
    setBatchRows(p => p.map(r => r.id === id ? { ...r, [field]: value } : r))

  const downloadCSV = () => {
    if (!batchResults) return
    const csv = 'Point,Latitude,Longitude,Ellipsoidal H (m),Geoid N (m),Orthometric H (m)\n' +
      batchResults.map(r => `${r.id},${r.input.latitude},${r.input.longitude},${r.input.ellipsoidalHeight.toFixed(3)},${r.result.geoidUndulation.toFixed(3)},${r.result.orthometricHeight.toFixed(3)}`).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'orthometric-heights.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-6 md:py-10">
      <PageHeader
        title="Orthometric height"
        subtitle="Convert GNSS ellipsoidal heights to orthometric heights (above sea level) using EGM96 geoid undulation. Essential for engineering — water flows by gravity, not ellipsoid."
        reference="EGM96 geoid model | H = h - N | NOAA NGA"
        badge="Geodesy"
      />

      {/* Mode toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('single')}
          className={`px-4 py-2 text-xs font-mono rounded-md transition-colors ${mode === 'single' ? 'bg-[var(--accent)] text-[var(--bg-primary)]' : 'border border-[var(--border-color)] text-[var(--text-secondary)]'}`}
        >
          Single point
        </button>
        <button
          onClick={() => setMode('batch')}
          className={`px-4 py-2 text-xs font-mono rounded-md transition-colors ${mode === 'batch' ? 'bg-[var(--accent)] text-[var(--bg-primary)]' : 'border border-[var(--border-color)] text-[var(--text-secondary)]'}`}
        >
          Batch conversion
        </button>
      </div>

      {mode === 'single' ? (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input */}
          <div className="space-y-4">
            <div className="card">
              <div className="card-header"><span className="label">GNSS position</span></div>
              <div className="card-body space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase">Latitude (°)</label>
                    <input className="input font-mono text-sm" value={latitude} onChange={e => setLatitude(e.target.value)} aria-label="-1.2864" placeholder="-1.2864" />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase">Longitude (°)</label>
                    <input className="input font-mono text-sm" value={longitude} onChange={e => setLongitude(e.target.value)} aria-label="36.8172" placeholder="36.8172" />
                  </div>
                </div>
                <div>
                  <label className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase">Ellipsoidal height h (m)</label>
                  <input className="input font-mono text-sm" value={ellHeight} onChange={e => setEllHeight(e.target.value)} aria-label="1798.500" placeholder="1798.500" />
                  <p className="font-mono text-[10px] text-[var(--text-muted)] mt-1">From GNSS / RTK rover output</p>
                </div>
                <button onClick={computeSingle} className="btn btn-primary w-full">Convert to orthometric</button>
              </div>
            </div>

            {/* Kenya reference */}
            <div className="card">
              <div className="card-header"><span className="label">Kenya geoid reference</span></div>
              <div className="card-body">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[var(--text-muted)] border-b border-[var(--border-color)]">
                      <th className="text-left py-1.5">Location</th>
                      <th className="text-right py-1.5">N (m)</th>
                      <th className="text-left py-1.5 pl-4">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {KENYA_GEOID_REFERENCE.map(ref => (
                      <tr key={ref.name} className="border-b border-[var(--border-color)]/50">
                        <td className="py-1.5 font-mono text-[var(--accent)]">{ref.name}</td>
                        <td className="py-1.5 text-right font-mono text-[var(--text-primary)]">{ref.N}</td>
                        <td className="py-1.5 pl-4 font-mono text-[var(--text-muted)] text-[10px]">{ref.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Result */}
          <div>
            {!result ? (
              <div className="card">
                <div className="card-body text-center py-16">
                  <p className="text-sm text-[var(--text-muted)]">Enter GNSS position and convert.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="card border-[var(--accent)]/40">
                  <div className="card-header bg-[var(--accent)]/5"><span className="label text-[var(--accent)]">Height conversion</span></div>
                  <div className="card-body space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase mb-1">Ellipsoidal h</div>
                        <div className="font-display text-xl text-[var(--text-primary)] tracking-[-0.02em]">{result.ellipsoidalHeight.toFixed(3)} m</div>
                        <div className="font-mono text-[10px] text-[var(--text-muted)]">GNSS raw output</div>
                      </div>
                      <div>
                        <div className="font-mono text-[10px] text-[var(--accent)] tracking-[0.06em] uppercase mb-1">Geoid N</div>
                        <div className="font-display text-xl text-[var(--text-primary)] tracking-[-0.02em]">{result.geoidUndulation.toFixed(3)} m</div>
                        <div className="font-mono text-[10px] text-[var(--text-muted)]">{result.geoidUndulation < 0 ? 'Geoid below ellipsoid' : 'Geoid above ellipsoid'}</div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[var(--border-color)]">
                      <div className="font-mono text-[10px] text-[var(--success)] tracking-[0.06em] uppercase mb-1">Orthometric H = h - N</div>
                      <div className="font-display text-3xl text-[var(--success)] tracking-[-0.02em]">{result.orthometricHeight.toFixed(3)} m</div>
                      <div className="font-mono text-[10px] text-[var(--text-muted)] mt-1">Above mean sea level (geoid)</div>
                    </div>

                    <div className="pt-3 border-t border-[var(--border-color)] space-y-1">
                      <div className="flex justify-between">
                        <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.04em] uppercase">Model</span>
                        <span className="font-mono text-[10px] text-[var(--text-secondary)]">{result.model}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.04em] uppercase">Accuracy</span>
                        <span className="font-mono text-[10px] text-[var(--text-secondary)]">±{result.accuracy} m</span>
                      </div>
                    </div>

                    <div className="p-3 border border-[var(--warning)]/30 bg-[var(--warning)]/5 rounded-md">
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        <span className="font-mono text-[var(--warning)] text-[10px] tracking-[0.06em] uppercase">Engineering note:</span>{' '}
                        Use orthometric H for drainage, road gradients, and runway construction.
                        Ellipsoidal h from GNSS does not represent true sea-level height.
                        At this location, the correction is {result.heightDifference.toFixed(1)} m — significant for any gravity-based design.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Batch mode */
        <div className="space-y-4">
          <div className="card">
            <div className="card-header">
              <span className="label">Batch input</span>
              <span className="font-mono text-[10px] text-[var(--text-muted)]">{batchRows.length} points</span>
            </div>
            <div className="card-body">
              <div className="overflow-x-auto">
                <div className="min-w-[600px] space-y-1">
                  <div className="grid grid-cols-[80px_1fr_1fr_1fr_28px] gap-2 items-center font-mono text-[9px] text-[var(--text-muted)] tracking-[0.04em] uppercase">
                    <span>Name</span><span>Latitude</span><span>Longitude</span><span>Ellipsoidal h (m)</span><span></span>
                  </div>
                  {batchRows.map(r => (
                    <div key={r.id} className="grid grid-cols-[80px_1fr_1fr_1fr_28px] gap-2 items-center">
                      <input className="input font-mono text-xs px-2 py-1" value={r.name} onChange={e => updateBatchRow(r.id, 'name', e.target.value)} aria-label="CP1" placeholder="CP1" />
                      <input className="input font-mono text-xs px-2 py-1" value={r.lat} onChange={e => updateBatchRow(r.id, 'lat', e.target.value)} aria-label="-1.2864" placeholder="-1.2864" />
                      <input className="input font-mono text-xs px-2 py-1" value={r.lon} onChange={e => updateBatchRow(r.id, 'lon', e.target.value)} aria-label="36.8172" placeholder="36.8172" />
                      <input className="input font-mono text-xs px-2 py-1" value={r.h} onChange={e => updateBatchRow(r.id, 'h', e.target.value)} aria-label="1798.500" placeholder="1798.500" />
                      <button onClick={() => removeBatchRow(r.id)} className="text-[var(--text-muted)] hover:text-[var(--error)] text-sm">×</button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 mt-3">
                <button onClick={addBatchRow} className="font-mono text-[11px] text-[var(--accent)] hover:opacity-80">+ Add point</button>
                <button onClick={computeBatch} className="btn btn-primary text-xs ml-auto">Convert all</button>
              </div>
            </div>
          </div>

          {batchResults && (
            <div className="card">
              <div className="card-header">
                <span className="label">Results</span>
                <button onClick={downloadCSV} className="font-mono text-[10px] text-[var(--accent)] hover:opacity-80 tracking-[0.06em] uppercase">Download CSV →</button>
              </div>
              <div className="card-body">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[var(--text-muted)] border-b border-[var(--border-color)]">
                        <th className="text-left py-2">Point</th>
                        <th className="text-right py-2">Ellipsoidal h (m)</th>
                        <th className="text-right py-2">Geoid N (m)</th>
                        <th className="text-right py-2">Orthometric H (m)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchResults.map(r => (
                        <tr key={r.id} className="border-b border-[var(--border-color)]/50">
                          <td className="py-1.5 font-mono text-[var(--accent)]">{r.id}</td>
                          <td className="py-1.5 text-right font-mono text-[var(--text-primary)]">{r.input.ellipsoidalHeight.toFixed(3)}</td>
                          <td className="py-1.5 text-right font-mono text-[var(--text-muted)]">{r.result.geoidUndulation.toFixed(3)}</td>
                          <td className="py-1.5 text-right font-mono text-[var(--success)] font-medium">{r.result.orthometricHeight.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
