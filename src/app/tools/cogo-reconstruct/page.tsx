'use client'

import { useState, useCallback } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import {
  reconstructBoundary,
  swingAndScale,
  dmsToAzimuth,
  type DeedLeg,
  type ReconstructResult,
  type SwingScaleResult,
  type BearingFormat,
} from '@/lib/compute/cogoReconstruct'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface LegRow extends DeedLeg {}

const SAMPLE_LEGS: LegRow[] = [
  { id: '1', bearingDeg: '87', bearingMin: '14', bearingSec: '22', distance: '124.83', description: 'AB1 → AB2' },
  { id: '2', bearingDeg: '156', bearingMin: '08', bearingSec: '41', distance: '89.40', description: 'AB2 → AB3' },
  { id: '3', bearingDeg: '212', bearingMin: '33', bearingSec: '18', distance: '156.22', description: 'AB3 → AB4' },
  { id: '4', bearingDeg: '278', bearingMin: '51', bearingSec: '09', distance: '98.74', description: 'AB4 → AB5' },
  { id: '5', bearingDeg: '4', bearingMin: '22', bearingSec: '55', distance: '142.10', description: 'AB5 → AB1' },
]

export default function CogoReconstructPage() {
  const { t } = useLanguage()
  const [legs, setLegs] = useState<LegRow[]>(SAMPLE_LEGS)
  const [startE, setStartE] = useState('274812.403')
  const [startN, setStartN] = useState('9856214.778')
  const [format, setFormat] = useState<BearingFormat>('WCB')
  const [result, setResult] = useState<ReconstructResult | null>(null)
  const [swungResult, setSwungResult] = useState<SwingScaleResult | null>(null)

  // Swing & scale controls
  const [anchorIndex, setAnchorIndex] = useState('0')
  const [targetE, setTargetE] = useState('')
  const [targetN, setTargetN] = useState('')
  const [secondIndex, setSecondIndex] = useState('')
  const [secondTargetE, setSecondTargetE] = useState('')
  const [secondTargetN, setSecondTargetN] = useState('')

  const addLeg = () =>
    setLegs(prev => [...prev, { id: String(prev.length + 1), bearingDeg: '', bearingMin: '', bearingSec: '', distance: '', description: '' }])

  const removeLeg = (id: string) => setLegs(prev => prev.filter(l => l.id !== id))

  const updateLeg = (id: string, field: keyof LegRow, value: string) =>
    setLegs(prev => prev.map(l => (l.id === id ? { ...l, [field]: value } : l)))

  const runReconstruction = useCallback(() => {
    const validLegs = legs.filter(l => l.bearingDeg && l.distance)
    if (validLegs.length < 2) {
      alert('Need at least 2 legs to reconstruct a boundary')
      return
    }
    const sE = parseFloat(startE)
    const sN = parseFloat(startN)
    if (isNaN(sE) || isNaN(sN)) {
      alert('Invalid starting coordinates')
      return
    }
    const res = reconstructBoundary(validLegs, sE, sN, format)
    setResult(res)
    setSwungResult(null) // reset swing on re-run
  }, [legs, startE, startN, format])

  const runSwingScale = () => {
    if (!result) return
    const ai = parseInt(anchorIndex)
    const te = parseFloat(targetE)
    const tn = parseFloat(targetN)
    if (isNaN(ai) || isNaN(te) || isNaN(tn)) {
      alert('Enter anchor index and target coordinates')
      return
    }

    const si = secondIndex ? parseInt(secondIndex) : undefined
    const ste = secondTargetE ? parseFloat(secondTargetE) : undefined
    const stn = secondTargetN ? parseFloat(secondTargetN) : undefined

    const swung = swingAndScale(result, {
      anchorIndex: ai,
      targetEasting: te,
      targetNorthing: tn,
      secondPointIndex: si,
      secondTargetEasting: ste,
      secondTargetNorthing: stn,
    })
    setSwungResult(swung)
  }

  const exportCSV = () => {
    const points = swungResult?.points || result?.points
    if (!points) return
    const csv = 'Vertex,Easting,Northing,Bearing,Distance,Description\n' +
      points.map(p => `${p.vertex},${p.easting.toFixed(3)},${p.northing.toFixed(3)},${p.bearingFromPrev.toFixed(6)},${p.distanceFromPrev.toFixed(3)},${p.description || ''}`).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cogo-reconstructed.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-6 md:py-10">
      <PageHeader
        title="COGO deed plan reconstructor"
        subtitle="Reconstruct boundary geometry from historical paper deed plans that list bearings and distances. Trace the boundary, then swing and scale onto known control beacons."
        reference="Basak Ch.10-11 · Survey Regulations 1994 Reg 60-67 · WCB and quadrant bearing conventions"
        badge="COGO"
      />

      <div className="grid lg:grid-cols-[1fr_1fr] gap-6">
        {/* Left: input */}
        <div className="space-y-4">
          {/* Starting point + format */}
          <div className="card">
            <div className="card-header"><span className="label">Starting control point</span></div>
            <div className="card-body grid grid-cols-2 gap-3">
              <div>
                <label className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase">Easting (m)</label>
                <input aria-label="Easting (m)" className="input font-mono text-sm" value={startE} onChange={e => setStartE(e.target.value)} />
              </div>
              <div>
                <label className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase">Northing (m)</label>
                <input aria-label="Northing (m)" className="input font-mono text-sm" value={startN} onChange={e => setStartN(e.target.value)} />
              </div>
            </div>
            <div className="card-body pt-0">
              <label className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase">Bearing format</label>
              <select value={format} onChange={e => setFormat(e.target.value as BearingFormat)} className="input text-sm">
                <option value="WCB">WCB (0-360° clockwise from north)</option>
                <option value="quadrant">Quadrant (N/S ××° E/W)</option>
              </select>
            </div>
          </div>

          {/* Deed legs */}
          <div className="card">
            <div className="card-header"><span className="label">Deed plan legs (bearings + distances)</span></div>
            <div className="card-body">
              <p className="text-xs text-[var(--text-muted)] mb-4 font-mono">
                Enter each leg from the deed plan. For WCB, enter the whole-circle bearing.
                For quadrant, enter the reduced bearing + quadrant letter.
              </p>
              <div className="space-y-2 overflow-x-auto">
                <div className="grid grid-cols-[24px_50px_40px_40px_60px_70px_1fr_28px] gap-1 items-center font-mono text-[9px] text-[var(--text-muted)] tracking-[0.04em] uppercase min-w-[600px]">
                  <span>#</span>
                  <span>Deg</span><span>Min</span><span>Sec</span>
                  <span>Quad</span>
                  <span>Dist (m)</span>
                  <span>Description</span>
                  <span></span>
                </div>
                {legs.map((leg, i) => (
                  <div key={leg.id} className="grid grid-cols-[24px_50px_40px_40px_60px_70px_1fr_28px] gap-1 items-center min-w-[600px]">
                    <span className="font-mono text-xs text-[var(--text-muted)]">{i + 1}</span>
                    <input className="input font-mono text-xs px-1 py-1" value={leg.bearingDeg} onChange={e => updateLeg(leg.id, 'bearingDeg', e.target.value)} aria-label="87" placeholder="87" maxLength={3} />
                    <input className="input font-mono text-xs px-1 py-1" value={leg.bearingMin} onChange={e => updateLeg(leg.id, 'bearingMin', e.target.value)} aria-label="14" placeholder="14" maxLength={2} />
                    <input className="input font-mono text-xs px-1 py-1" value={leg.bearingSec} onChange={e => updateLeg(leg.id, 'bearingSec', e.target.value)} aria-label="22" placeholder="22" maxLength={2} />
                    {format === 'quadrant' ? (
                      <select
                        className="input font-mono text-xs px-1 py-1"
                        value={leg.quadrant || 'NE'}
                        onChange={e => updateLeg(leg.id, 'quadrant', e.target.value as 'NE' | 'NW' | 'SE' | 'SW')}
                      >
                        <option value="NE">NE</option>
                        <option value="NW">NW</option>
                        <option value="SE">SE</option>
                        <option value="SW">SW</option>
                      </select>
                    ) : (
                      <span className="text-[var(--text-muted)] text-xs text-center">—</span>
                    )}
                    <input className="input font-mono text-xs px-1 py-1" value={leg.distance} onChange={e => updateLeg(leg.id, 'distance', e.target.value)} aria-label="124.83" placeholder="124.83" />
                    <input className="input text-xs px-1 py-1" value={leg.description || ''} onChange={e => updateLeg(leg.id, 'description', e.target.value)} aria-label="AB1 → AB2" placeholder="AB1 → AB2" />
                    <button onClick={() => removeLeg(leg.id)} className="text-[var(--text-muted)] hover:text-[var(--error)] text-sm">×</button>
                  </div>
                ))}
              </div>
              <button onClick={addLeg} className="mt-3 font-mono text-[11px] text-[var(--accent)] hover:opacity-80 tracking-[0.04em]">+ Add leg</button>
            </div>
          </div>

          <button onClick={runReconstruction} className="btn btn-primary w-full">
            Reconstruct boundary
          </button>
        </div>

        {/* Right: results */}
        <div className="space-y-4">
          {!result ? (
            <div className="card">
              <div className="card-body text-center py-16">
                <p className="text-sm text-[var(--text-muted)]">Enter deed legs and reconstruct.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Closure stats */}
              <div className="card">
                <div className="card-header"><span className="label">Closure check</span></div>
                <div className="card-body grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase mb-1">Misclose</div>
                    <div className={`font-display text-xl tracking-[-0.02em] ${result.isClosed ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                      {result.miscloseDistance.toFixed(4)} m
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase mb-1">Ratio</div>
                    <div className="font-display text-xl text-[var(--text-primary)] tracking-[-0.02em]">
                      1:{Math.round(1 / result.miscloseRatio).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase mb-1">Perimeter</div>
                    <div className="font-display text-xl text-[var(--text-primary)] tracking-[-0.02em]">{result.perimeter.toFixed(2)} m</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase mb-1">Area</div>
                    <div className="font-display text-xl text-[var(--text-primary)] tracking-[-0.02em]">{result.area.toFixed(2)} m²</div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)]">{(result.area / 10000).toFixed(4)} ha</div>
                  </div>
                </div>
              </div>

              {/* Coordinate table */}
              <div className="card">
                <div className="card-header">
                  <span className="label">Reconstructed coordinates</span>
                  <button onClick={exportCSV} className="font-mono text-[10px] text-[var(--accent)] hover:opacity-80 tracking-[0.06em] uppercase">
                    Export CSV →
                  </button>
                </div>
                <div className="card-body">
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-[var(--bg-card)]">
                        <tr className="text-[var(--text-muted)] border-b border-[var(--border-color)]">
                          <th className="text-left py-2">Vtx</th>
                          <th className="text-right py-2">Easting</th>
                          <th className="text-right py-2">Northing</th>
                          <th className="text-right py-2">Brng</th>
                          <th className="text-right py-2">Dist</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(swungResult?.points || result.points).map(p => (
                          <tr key={p.vertex} className="border-b border-[var(--border-color)]/50">
                            <td className="py-1.5 font-mono text-[var(--accent)]">{p.vertex}</td>
                            <td className="py-1.5 text-right font-mono text-[var(--text-primary)]">{p.easting.toFixed(3)}</td>
                            <td className="py-1.5 text-right font-mono text-[var(--text-primary)]">{p.northing.toFixed(3)}</td>
                            <td className="py-1.5 text-right font-mono text-[var(--text-muted)]">{p.vertex > 1 ? `${p.bearingFromPrev.toFixed(4)}°` : '—'}</td>
                            <td className="py-1.5 text-right font-mono text-[var(--text-muted)]">{p.vertex > 1 ? `${p.distanceFromPrev.toFixed(3)}` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Swing & scale */}
              <div className="card">
                <div className="card-header"><span className="label">Swing & scale to control</span></div>
                <div className="card-body space-y-3">
                  <p className="text-xs text-[var(--text-muted)] font-mono">
                    Anchor one point to a known control beacon. Optionally use a second point to auto-compute rotation and scale.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="font-mono text-[9px] text-[var(--text-muted)] tracking-[0.06em] uppercase">Anchor #</label>
                      <input aria-label="Anchor #" className="input font-mono text-xs px-1 py-1" type="number" value={anchorIndex} onChange={e => setAnchorIndex(e.target.value)} min="0" max={result.points.length - 1} />
                    </div>
                    <div>
                      <label className="font-mono text-[9px] text-[var(--text-muted)] tracking-[0.06em] uppercase">Target E</label>
                      <input className="input font-mono text-xs px-1 py-1" value={targetE} onChange={e => setTargetE(e.target.value)} aria-label="274812.403" placeholder="274812.403" />
                    </div>
                    <div>
                      <label className="font-mono text-[9px] text-[var(--text-muted)] tracking-[0.06em] uppercase">Target N</label>
                      <input className="input font-mono text-xs px-1 py-1" value={targetN} onChange={e => setTargetN(e.target.value)} aria-label="9856214.778" placeholder="9856214.778" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="font-mono text-[9px] text-[var(--text-muted)] tracking-[0.06em] uppercase">2nd pt #</label>
                      <input className="input font-mono text-xs px-1 py-1" type="number" value={secondIndex} onChange={e => setSecondIndex(e.target.value)} aria-label="(optional)" placeholder="(optional)" />
                    </div>
                    <div>
                      <label className="font-mono text-[9px] text-[var(--text-muted)] tracking-[0.06em] uppercase">2nd target E</label>
                      <input className="input font-mono text-xs px-1 py-1" value={secondTargetE} onChange={e => setSecondTargetE(e.target.value)} aria-label="(optional)" placeholder="(optional)" />
                    </div>
                    <div>
                      <label className="font-mono text-[9px] text-[var(--text-muted)] tracking-[0.06em] uppercase">2nd target N</label>
                      <input className="input font-mono text-xs px-1 py-1" value={secondTargetN} onChange={e => setSecondTargetN(e.target.value)} aria-label="(optional)" placeholder="(optional)" />
                    </div>
                  </div>
                  <button onClick={runSwingScale} className="btn btn-secondary w-full text-sm">Apply swing & scale</button>
                  {swungResult && (
                    <div className="border-t border-[var(--border-color)] pt-3 space-y-1">
                      <p className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.04em] uppercase">Transformation applied</p>
                      <p className="font-mono text-xs text-[var(--text-secondary)]">Rotation: {swungResult.rotationApplied.toFixed(6)}°</p>
                      <p className="font-mono text-xs text-[var(--text-secondary)]">Scale: {swungResult.scaleApplied.toFixed(6)}×</p>
                      <p className="font-mono text-xs text-[var(--text-secondary)]">Translation: ΔE {swungResult.translationApplied.dE.toFixed(3)}, ΔN {swungResult.translationApplied.dN.toFixed(3)}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
