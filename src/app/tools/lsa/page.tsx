'use client'

import { useState, useCallback } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { adjustTraverseLSA, type TraverseObservations, type ControlStation, type AngleObservation, type DistanceObservation, type LSAResult } from '@/lib/engine/leastSquaresAdjustment'
import { buildPrintDocument, openPrint } from '@/lib/print/buildPrintDocument'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface StationRow {
  id: string
  name: string
  easting: string
  northing: string
  isControl: boolean
}

interface AngleRow {
  id: string
  fromStation: string
  atStation: string
  toStation: string
  angleDeg: string
  angleMin: string
  angleSec: string
  stdDev: string
}

interface DistRow {
  id: string
  fromStation: string
  toStation: string
  distance: string
  stdDev: string
}

let rowCounter = 0
const nextId = () => `r${++rowCounter}`

export default function LeastSquaresPage() {
  const { t } = useLanguage()
  const [stations, setStations] = useState<StationRow[]>([
    { id: nextId(), name: 'CP1', easting: '5000.000', northing: '10000.000', isControl: true },
    { id: nextId(), name: 'CP2', easting: '5100.000', northing: '10100.000', isControl: true },
    { id: nextId(), name: 'T1', easting: '', northing: '', isControl: false },
    { id: nextId(), name: 'T2', easting: '', northing: '', isControl: false },
  ])
  const [angles, setAngles] = useState<AngleRow[]>([
    { id: nextId(), fromStation: 'CP1', atStation: 'T1', toStation: 'T2', angleDeg: '120', angleMin: '30', angleSec: '15', stdDev: '5' },
    { id: nextId(), fromStation: 'T1', atStation: 'T2', toStation: 'CP2', angleDeg: '95', angleMin: '45', angleSec: '30', stdDev: '5' },
  ])
  const [distances, setDistances] = useState<DistRow[]>([
    { id: nextId(), fromStation: 'CP1', toStation: 'T1', distance: '85.234', stdDev: '0.003' },
    { id: nextId(), fromStation: 'T1', toStation: 'T2', distance: '92.456', stdDev: '0.003' },
    { id: nextId(), fromStation: 'T2', toStation: 'CP2', distance: '78.901', stdDev: '0.003' },
  ])
  const [result, setResult] = useState<LSAResult | null>(null)
  const [error, setError] = useState('')

  const addStation = () => setStations(p => [...p, { id: nextId(), name: '', easting: '', northing: '', isControl: false }])
  const removeStation = (id: string) => setStations(p => p.filter(s => s.id !== id))
  const updateStation = (id: string, field: keyof StationRow, value: string | boolean) =>
    setStations(p => p.map(s => s.id === id ? { ...s, [field]: value } : s))

  const addAngle = () => setAngles(p => [...p, { id: nextId(), fromStation: '', atStation: '', toStation: '', angleDeg: '', angleMin: '', angleSec: '', stdDev: '5' }])
  const removeAngle = (id: string) => setAngles(p => p.filter(a => a.id !== id))
  const updateAngle = (id: string, field: keyof AngleRow, value: string) =>
    setAngles(p => p.map(a => a.id === id ? { ...a, [field]: value } : a))

  const addDist = () => setDistances(p => [...p, { id: nextId(), fromStation: '', toStation: '', distance: '', stdDev: '0.003' }])
  const removeDist = (id: string) => setDistances(p => p.filter(d => d.id !== id))
  const updateDist = (id: string, field: keyof DistRow, value: string) =>
    setDistances(p => p.map(d => d.id === id ? { ...d, [field]: value } : d))

  const runAdjustment = useCallback(() => {
    setError('')
    setResult(null)
    try {
      const controlStations: ControlStation[] = stations
        .filter(s => s.name && s.isControl && s.easting && s.northing)
        .map(s => ({ id: s.name, name: s.name, easting: parseFloat(s.easting), northing: parseFloat(s.northing), isFixed: true }))

      const unknownStations: ControlStation[] = stations
        .filter(s => s.name && !s.isControl)
        .map(s => ({ id: s.name, name: s.name, easting: parseFloat(s.easting) || 0, northing: parseFloat(s.northing) || 0, isFixed: false }))

      if (controlStations.length < 2) {
        setError('Need at least 2 control stations with known coordinates')
        return
      }

      const angleObs: AngleObservation[] = angles
        .filter(a => a.fromStation && a.atStation && a.toStation && a.angleDeg)
        .map(a => ({
          id: a.id,
          fromStationId: a.fromStation,
          // AUDIT FIX (2026-07-03): Pass atStationId so the engine computes
          // a true interior angle θ = α_BC − α_BA instead of a bearing.
          atStationId: a.atStation,
          toStationId: a.toStation,
          angle: parseFloat(a.angleDeg) + parseFloat(a.angleMin || '0') / 60 + parseFloat(a.angleSec || '0') / 3600,
          stdDev: parseFloat(a.stdDev) || 5,
        }))

      const distObs: DistanceObservation[] = distances
        .filter(d => d.fromStation && d.toStation && d.distance)
        .map(d => ({
          id: d.id,
          fromStationId: d.fromStation,
          toStationId: d.toStation,
          distance: parseFloat(d.distance),
          stdDev: parseFloat(d.stdDev) || 0.003,
        }))

      if (angleObs.length === 0 && distObs.length === 0) {
        setError('Need at least one angle or distance observation')
        return
      }

      const observations: TraverseObservations = {
        stations: [...controlStations, ...unknownStations],
        angles: angleObs,
        distances: distObs,
      }

      const res = adjustTraverseLSA(observations)
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Adjustment failed')
    }
  }, [stations, angles, distances])

  const printReport = () => {
    if (!result) return

    const stationRows = result.adjustedStations.map(s => `
      <tr>
        <td>${s.name}</td>
        <td class="right mono">${s.adjustedEasting.toFixed(4)}</td>
        <td class="right mono">${s.adjustedNorthing.toFixed(4)}</td>
        <td class="right mono">${(s.correctionE * 1000).toFixed(2)}</td>
        <td class="right mono">${(s.correctionN * 1000).toFixed(2)}</td>
        <td class="right mono">${(s.stdDevE * 1000).toFixed(2)}</td>
        <td class="right mono">${(s.stdDevN * 1000).toFixed(2)}</td>
        <td class="right mono">${(s.errorEllipse.semiMajor * 1000).toFixed(2)}</td>
        <td class="right mono">${(s.errorEllipse.semiMinor * 1000).toFixed(2)}</td>
        <td class="right mono">${s.errorEllipse.orientation.toFixed(1)}</td>
      </tr>`).join('')

    const residualRows = result.residuals.map(r => `
      <tr>
        <td>${r.observationId}</td>
        <td>${r.type}</td>
        <td class="right mono">${r.observed.toFixed(6)}</td>
        <td class="right mono">${r.computed.toFixed(6)}</td>
        <td class="right mono">${(r.residual * 1000).toFixed(3)}</td>
        <td class="right mono">${r.standardized.toFixed(3)}</td>
      </tr>`).join('')

    const bodyHtml = `
<h2>Adjusted Coordinates</h2>
<table>
  <tr>
    <th>Station</th><th class="right">E (m)</th><th class="right">N (m)</th>
    <th class="right">Corr E (mm)</th><th class="right">Corr N (mm)</th>
    <th class="right">σE (mm)</th><th class="right">σN (mm)</th>
    <th class="right">Semi-major (mm)</th><th class="right">Semi-minor (mm)</th><th class="right">Orient (°)</th>
  </tr>
  ${stationRows}
</table>

<h2>Residuals</h2>
<table>
  <tr><th>ID</th><th>Type</th><th class="right">Observed</th><th class="right">Computed</th><th class="right">Residual (mm)</th><th class="right">Standardized</th></tr>
  ${residualRows}
</table>

<div class="summary-box">
  <h2 style="border:none;margin:0 0 8px">Statistical Summary</h2>
  <div class="summary-row"><span class="summary-label">Reference Variance (σ₀²)</span><span class="summary-value">${result.referenceVariance.toFixed(4)}</span></div>
  <div class="summary-row"><span class="summary-label">Degrees of Freedom</span><span class="summary-value">${result.degreesOfFreedom}</span></div>
  <div class="summary-row"><span class="summary-label">Standard Error (σ₀)</span><span class="summary-value">${result.standardError.toFixed(4)}</span></div>
  <div class="summary-row"><span class="summary-label">Chi-Square Value</span><span class="summary-value">${result.chiSquareValue.toFixed(4)}</span></div>
  <div class="summary-row"><span class="summary-label">Chi-Square Critical</span><span class="summary-value">${result.chiSquareCritical.toFixed(4)}</span></div>
  <div class="summary-row"><span class="summary-label ${result.passed ? 'pass' : 'fail'}">Chi-Square Test</span><span class="summary-value ${result.passed ? 'pass' : 'fail'}">${result.passed ? 'PASS' : 'FAIL'}</span></div>
</div>`

    const doc = buildPrintDocument(bodyHtml, {
      title: 'Least Squares Adjustment Report',
      reference: 'Ghilani & Wolf, Adjustment Computations | Chi-square test at 95% confidence',
    })
    openPrint(doc)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-6 md:py-10">
      <PageHeader
        title="Least squares adjustment"
        subtitle="Parametric adjustment for high-precision control networks. Computes adjusted coordinates, standard errors, error ellipses, and chi-square test."
        reference="Ghilani & Wolf · Chi-square testing · Error ellipses"
        badge="Control"
      />

      {error && (
        <div className="mb-4 p-3 border border-[var(--error)]/30 bg-[var(--error)]/5 rounded-md text-sm text-[var(--error)]">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: input */}
        <div className="space-y-4">
          {/* Stations */}
          <div className="card">
            <div className="card-header"><span className="label">Control stations + unknowns</span></div>
            <div className="card-body">
              <p className="text-xs text-[var(--text-muted)] mb-3 font-mono">Check "Control" for known points. Leave unchecked for unknowns to be adjusted.</p>
              <div className="space-y-1">
                <div className="grid grid-cols-[1fr_1fr_1fr_50px_28px] gap-1 items-center font-mono text-[9px] text-[var(--text-muted)] tracking-[0.04em] uppercase">
                  <span>Name</span><span>Easting</span><span>Northing</span><span>Ctrl</span><span></span>
                </div>
                {stations.map(s => (
                  <div key={s.id} className="grid grid-cols-[1fr_1fr_1fr_50px_28px] gap-1 items-center">
                    <input className="input font-mono text-xs px-2 py-1" value={s.name} onChange={e => updateStation(s.id, 'name', e.target.value)} aria-label="Station name" placeholder="T1" />
                    <input className="input font-mono text-xs px-2 py-1" value={s.easting} onChange={e => updateStation(s.id, 'easting', e.target.value)} aria-label="Easting (m)" placeholder="5000.000" disabled={s.isControl} />
                    <input className="input font-mono text-xs px-2 py-1" value={s.northing} onChange={e => updateStation(s.id, 'northing', e.target.value)} aria-label="Northing (m)" placeholder="10000.000" disabled={s.isControl} />
                    <input type="checkbox" checked={s.isControl} onChange={e => updateStation(s.id, 'isControl', e.target.checked)} className="w-4 h-4" title="Control point (known coordinates)" aria-label="Control point (known coordinates)" />
                    <button onClick={() => removeStation(s.id)} className="text-[var(--text-muted)] hover:text-[var(--error)] text-sm">×</button>
                  </div>
                ))}
              </div>
              <button onClick={addStation} className="mt-2 font-mono text-[11px] text-[var(--accent)] hover:opacity-80">+ Add station</button>
            </div>
          </div>

          {/* Angles */}
          <div className="card">
            <div className="card-header"><span className="label">Angle observations</span></div>
            <div className="card-body">
              <div className="space-y-1 overflow-x-auto">
                <div className="grid grid-cols-[1fr_1fr_1fr_40px_30px_30px_50px_28px] gap-1 items-center font-mono text-[9px] text-[var(--text-muted)] tracking-[0.04em] uppercase min-w-[500px]">
                  <span>From</span><span>At</span><span>To</span><span>Deg</span><span>Min</span><span>Sec</span><span>σ (")</span><span></span>
                </div>
                {angles.map(a => (
                  <div key={a.id} className="grid grid-cols-[1fr_1fr_1fr_40px_30px_30px_50px_28px] gap-1 items-center min-w-[500px]">
                    <input className="input font-mono text-xs px-1 py-1" value={a.fromStation} onChange={e => updateAngle(a.id, 'fromStation', e.target.value)} aria-label="From station" placeholder="CP1" />
                    <input className="input font-mono text-xs px-1 py-1" value={a.atStation} onChange={e => updateAngle(a.id, 'atStation', e.target.value)} aria-label="At station" placeholder="T1" />
                    <input className="input font-mono text-xs px-1 py-1" value={a.toStation} onChange={e => updateAngle(a.id, 'toStation', e.target.value)} aria-label="To station" placeholder="T2" />
                    <input className="input font-mono text-xs px-1 py-1" value={a.angleDeg} onChange={e => updateAngle(a.id, 'angleDeg', e.target.value)} aria-label="Angle (deg)" placeholder="120" />
                    <input className="input font-mono text-xs px-1 py-1" value={a.angleMin} onChange={e => updateAngle(a.id, 'angleMin', e.target.value)} aria-label="Angle (min)" placeholder="30" />
                    <input className="input font-mono text-xs px-1 py-1" value={a.angleSec} onChange={e => updateAngle(a.id, 'angleSec', e.target.value)} aria-label="Angle (sec)" placeholder="15" />
                    <input className="input font-mono text-xs px-1 py-1" value={a.stdDev} onChange={e => updateAngle(a.id, 'stdDev', e.target.value)} aria-label="Std dev (arcsec)" placeholder="5" />
                    <button onClick={() => removeAngle(a.id)} className="text-[var(--text-muted)] hover:text-[var(--error)] text-sm">×</button>
                  </div>
                ))}
              </div>
              <button onClick={addAngle} className="mt-2 font-mono text-[11px] text-[var(--accent)] hover:opacity-80">+ Add angle</button>
            </div>
          </div>

          {/* Distances */}
          <div className="card">
            <div className="card-header"><span className="label">Distance observations</span></div>
            <div className="card-body">
              <div className="space-y-1">
                <div className="grid grid-cols-[1fr_1fr_1fr_1fr_28px] gap-1 items-center font-mono text-[9px] text-[var(--text-muted)] tracking-[0.04em] uppercase">
                  <span>From</span><span>To</span><span>Dist (m)</span><span>σ (m)</span><span></span>
                </div>
                {distances.map(d => (
                  <div key={d.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_28px] gap-1 items-center">
                    <input className="input font-mono text-xs px-2 py-1" value={d.fromStation} onChange={e => updateDist(d.id, 'fromStation', e.target.value)} aria-label="From station" placeholder="CP1" />
                    <input className="input font-mono text-xs px-2 py-1" value={d.toStation} onChange={e => updateDist(d.id, 'toStation', e.target.value)} aria-label="To station" placeholder="T1" />
                    <input className="input font-mono text-xs px-2 py-1" value={d.distance} onChange={e => updateDist(d.id, 'distance', e.target.value)} aria-label="Distance (m)" placeholder="85.234" />
                    <input className="input font-mono text-xs px-2 py-1" value={d.stdDev} onChange={e => updateDist(d.id, 'stdDev', e.target.value)} aria-label="Std dev (m)" placeholder="0.003" />
                    <button onClick={() => removeDist(d.id)} className="text-[var(--text-muted)] hover:text-[var(--error)] text-sm">×</button>
                  </div>
                ))}
              </div>
              <button onClick={addDist} className="mt-2 font-mono text-[11px] text-[var(--accent)] hover:opacity-80">+ Add distance</button>
            </div>
          </div>

          <button onClick={runAdjustment} className="btn btn-primary w-full">Run least squares adjustment</button>
        </div>

        {/* Right: results */}
        <div>
          {!result ? (
            <div className="card">
              <div className="card-body text-center py-16">
                <p className="text-sm text-[var(--text-muted)]">Enter stations, angles, and distances. Run the adjustment.</p>
                <p className="text-xs text-[var(--text-muted)] mt-2 font-mono">Results: adjusted coordinates, error ellipses, residuals, chi-square test.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Chi-square verdict */}
              <div className={`card ${result.passed ? 'border-[var(--success)]' : 'border-[var(--error)]'}`}>
                <div className="card-body flex items-center gap-3">
                  <div className={`w-10 h-10 flex items-center justify-center ${result.passed ? 'bg-[var(--success)]/15' : 'bg-[var(--error)]/15'}`}>
                    {result.passed ? (
                      <svg className="w-6 h-6 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                    ) : (
                      <svg className="w-6 h-6 text-[var(--error)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                    )}
                  </div>
                  <div>
                    <h2 className={`font-display text-xl tracking-[-0.015em] ${result.passed ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                      {result.passed ? 'Chi-square test passed' : 'Chi-square test failed'}
                    </h2>
                    <p className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.04em] mt-0.5">
                      χ² = {result.chiSquareValue.toFixed(4)} · critical = {result.chiSquareCritical.toFixed(4)} · df = {result.degreesOfFreedom} · σ₀ = {result.standardError.toFixed(4)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Adjusted coordinates */}
              <div className="card">
                <div className="card-header">
                  <span className="label">Adjusted coordinates</span>
                  <button onClick={printReport} className="font-mono text-[10px] text-[var(--accent)] hover:opacity-80 tracking-[0.06em] uppercase">Print report →</button>
                </div>
                <div className="card-body">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[var(--text-muted)] border-b border-[var(--border-color)]">
                          <th className="text-left py-2">Station</th>
                          <th className="text-right py-2">E (m)</th>
                          <th className="text-right py-2">N (m)</th>
                          <th className="text-right py-2">σE (mm)</th>
                          <th className="text-right py-2">σN (mm)</th>
                          <th className="text-right py-2">Ellipse</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.adjustedStations.map(s => (
                          <tr key={s.id} className="border-b border-[var(--border-color)]/50">
                            <td className="py-1.5 font-mono text-[var(--accent)]">{s.name}</td>
                            <td className="py-1.5 text-right font-mono text-[var(--text-primary)]">{s.adjustedEasting.toFixed(4)}</td>
                            <td className="py-1.5 text-right font-mono text-[var(--text-primary)]">{s.adjustedNorthing.toFixed(4)}</td>
                            <td className="py-1.5 text-right font-mono text-[var(--text-muted)]">{(s.stdDevE * 1000).toFixed(2)}</td>
                            <td className="py-1.5 text-right font-mono text-[var(--text-muted)]">{(s.stdDevN * 1000).toFixed(2)}</td>
                            <td className="py-1.5 text-right font-mono text-[var(--text-muted)]">{(s.errorEllipse.semiMajor * 1000).toFixed(2)}×{(s.errorEllipse.semiMinor * 1000).toFixed(2)}mm</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Error Ellipses Visualization */}
              <div className="card">
                <div className="card-header">
                  <span className="label">Error ellipses (95% confidence)</span>
                  <span className="font-mono text-[10px] text-[var(--text-muted)]">scale: 1px = 0.1mm</span>
                </div>
                <div className="card-body">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {result.adjustedStations.filter(s => !s.id.startsWith('CP') && !s.id.startsWith('control')).map(s => {
                      const maxR = Math.max(...result.adjustedStations
                        .filter(a => !a.id.startsWith('CP') && !a.id.startsWith('control'))
                        .map(a => a.errorEllipse.semiMajor), 0.001)
                      const scale = 60 / (maxR * 1000) // scale to fit in ~120px box
                      const a = Math.max(s.errorEllipse.semiMajor * 1000 * scale, 4)
                      const b = Math.max(s.errorEllipse.semiMinor * 1000 * scale, 2)
                      const rot = s.errorEllipse.orientation
                      const color = a > 40 ? 'var(--error)' : a > 20 ? 'var(--warning)' : 'var(--success)'

                      return (
                        <div key={s.id} className="flex flex-col items-center p-3 border border-[var(--border-color)] rounded-md">
                          <svg width="80" height="80" viewBox="-40 -40 80 80">
                            {/* North arrow */}
                            <line x1="0" y1="-35" x2="0" y2="-28" stroke="var(--text-muted)" strokeWidth="1" />
                            <text x="0" y="-38" textAnchor="middle" fontSize="7" fill="var(--text-muted)" fontFamily="monospace">N</text>
                            {/* Ellipse */}
                            <ellipse
                              cx="0" cy="0"
                              rx={b} ry={a}
                              transform={`rotate(${rot})`}
                              fill={`${color}20`}
                              stroke={color}
                              strokeWidth="1.5"
                            />
                            {/* Center point */}
                            <circle cx="0" cy="0" r="2" fill={color} />
                            {/* Axes labels */}
                            <text x="0" y="36" textAnchor="middle" fontSize="7" fill="var(--text-secondary)" fontFamily="monospace">
                              {s.name}
                            </text>
                          </svg>
                          <div className="mt-1 text-center">
                            <div className="font-mono text-[10px] text-[var(--text-primary)]">
                              a={(s.errorEllipse.semiMajor * 1000).toFixed(2)}mm
                            </div>
                            <div className="font-mono text-[10px] text-[var(--text-muted)]">
                              b={(s.errorEllipse.semiMinor * 1000).toFixed(2)}mm
                            </div>
                            <div className="font-mono text-[9px] text-[var(--text-muted)]">
                              θ={s.errorEllipse.orientation.toFixed(1)}°
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-4 flex gap-4 text-[10px] font-mono">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ background: 'var(--success)' }} />
                      <span className="text-[var(--text-muted)]">≤ 20mm (pass)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ background: 'var(--warning)' }} />
                      <span className="text-[var(--text-muted)]">20-40mm (marginal)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ background: 'var(--error)' }} />
                      <span className="text-[var(--text-muted)]">&gt; 40mm (fail)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Residuals */}
              <div className="card">
                <div className="card-header"><span className="label">Residuals</span></div>
                <div className="card-body">
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-[var(--bg-card)]">
                        <tr className="text-[var(--text-muted)] border-b border-[var(--border-color)]">
                          <th className="text-left py-2">ID</th>
                          <th className="text-left py-2">Type</th>
                          <th className="text-right py-2">Observed</th>
                          <th className="text-right py-2">Computed</th>
                          <th className="text-right py-2">Residual (mm)</th>
                          <th className="text-right py-2">Std</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.residuals.map(r => (
                          <tr key={r.observationId} className="border-b border-[var(--border-color)]/50">
                            <td className="py-1 font-mono text-[var(--accent)]">{r.observationId}</td>
                            <td className="py-1 font-mono text-[var(--text-muted)]">{r.type}</td>
                            <td className="py-1 text-right font-mono">{r.observed.toFixed(6)}</td>
                            <td className="py-1 text-right font-mono">{r.computed.toFixed(6)}</td>
                            <td className="py-1 text-right font-mono" style={{ color: Math.abs(r.standardized) > 2 ? 'var(--error)' : 'var(--text-primary)' }}>{(r.residual * 1000).toFixed(3)}</td>
                            <td className="py-1 text-right font-mono" style={{ color: Math.abs(r.standardized) > 2 ? 'var(--error)' : 'var(--text-muted)' }}>{r.standardized.toFixed(3)}</td>
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
