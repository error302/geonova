'use client'

import { useState, useCallback, useMemo } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import {
  computeCombinedScaleFactor,
  convertGridAreaToGround,
  computeAreaWithScaleFactor,
  KENYA_LOCATIONS,
  type ScaleFactorResult,
  type AreaConversionResult,
} from '@/lib/geodesy/scaleFactor'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface CoordRow {
  id: number
  easting: string
  northing: string
}

export default function ScaleFactorPage() {
  const { t } = useLanguage()
  const [latitude, setLatitude] = useState('-1.2864')
  const [longitude, setLongitude] = useState('36.8172')
  const [utmZone, setUtmZone] = useState('37')
  const [elevation, setElevation] = useState('1798')
  const [sfResult, setSfResult] = useState<ScaleFactorResult | null>(null)

  const [gridArea, setGridArea] = useState('100000')
  const [areaResult, setAreaResult] = useState<AreaConversionResult | null>(null)

  // Polygon area mode
  const [mode, setMode] = useState<'simple' | 'polygon'>('simple')
  const [coords, setCoords] = useState<CoordRow[]>([
    { id: 1, easting: '274812.403', northing: '9856214.778' },
    { id: 2, easting: '274912.403', northing: '9856214.778' },
    { id: 3, easting: '274912.403', northing: '9856314.778' },
    { id: 4, easting: '274812.403', northing: '9856314.778' },
  ])

  const computeSF = useCallback(() => {
    const lat = parseFloat(latitude)
    const lon = parseFloat(longitude)
    const zone = parseInt(utmZone)
    const elev = parseFloat(elevation)
    if (isNaN(lat) || isNaN(lon) || isNaN(zone) || isNaN(elev)) return

    setSfResult(computeCombinedScaleFactor({
      latitude: lat,
      longitude: lon,
      utmZone: zone,
      ellipsoidalHeight: elev,
    }))
  }, [latitude, longitude, utmZone, elevation])

  const computeArea = useCallback(() => {
    if (!sfResult) {
      computeSF()
    }
    const csf = sfResult?.combinedScaleFactor || 0.9996

    if (mode === 'simple') {
      const ga = parseFloat(gridArea)
      if (isNaN(ga)) return
      setAreaResult(convertGridAreaToGround(ga, csf))
    } else {
      const utmCoords: [number, number][] = coords
        .filter(c => c.easting && c.northing)
        .map(c => [parseFloat(c.easting), parseFloat(c.northing)])
      if (utmCoords.length < 3) return
      setAreaResult(computeAreaWithScaleFactor(utmCoords, csf))
    }
  }, [sfResult, mode, gridArea, coords, computeSF])

  const loadLocation = (name: string) => {
    const loc = KENYA_LOCATIONS.find(l => l.name === name)
    if (!loc) return
    setLatitude(String(loc.latitude))
    setLongitude(String(loc.longitude))
    setUtmZone(String(loc.utmZone))
    setElevation(String(loc.elevation))
  }

  const addCoord = () => setCoords(p => [...p, { id: p.length + 1, easting: '', northing: '' }])
  const removeCoord = (id: number) => setCoords(p => p.filter(c => c.id !== id))
  const updateCoord = (id: number, field: keyof CoordRow, value: string) =>
    setCoords(p => p.map(c => c.id === id ? { ...c, [field]: value } : c))

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-6 md:py-10">
      <PageHeader
        title="Combined scale factor"
        subtitle="Compute the grid-to-ground scale correction for Kenyan altitudes. Converts grid area to true ground area for deed plan accuracy."
        reference="Survey Regulations 1994 Reg 60 | UTM projection | Clarke 1880 ellipsoid"
        badge="Geodesy"
      />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: inputs */}
        <div className="space-y-4">
          {/* Location presets */}
          <div className="card">
            <div className="card-header"><span className="label">Location</span></div>
            <div className="card-body">
              <div className="flex flex-wrap gap-2 mb-4">
                {KENYA_LOCATIONS.map(loc => (
                  <button
                    key={loc.name}
                    onClick={() => loadLocation(loc.name)}
                    className="px-3 py-1.5 text-xs font-mono border border-[var(--border-color)] rounded-md text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                  >
                    {loc.name}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase">Latitude (°)</label>
                  <input className="input font-mono text-sm" value={latitude} onChange={e => setLatitude(e.target.value)} aria-label="-1.2864" placeholder="-1.2864" />
                </div>
                <div>
                  <label className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase">Longitude (°)</label>
                  <input className="input font-mono text-sm" value={longitude} onChange={e => setLongitude(e.target.value)} aria-label="36.8172" placeholder="36.8172" />
                </div>
                <div>
                  <label className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase">UTM Zone</label>
                  <select className="input text-sm" value={utmZone} onChange={e => setUtmZone(e.target.value)}>
                    <option value="36">36S (western Kenya)</option>
                    <option value="37">37S (eastern Kenya)</option>
                  </select>
                </div>
                <div>
                  <label className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase">Ellipsoidal height (m)</label>
                  <input className="input font-mono text-sm" value={elevation} onChange={e => setElevation(e.target.value)} aria-label="1798" placeholder="1798" />
                </div>
              </div>

              <button onClick={computeSF} className="btn btn-primary w-full mt-4">Compute scale factor</button>
            </div>
          </div>

          {/* Area conversion */}
          <div className="card">
            <div className="card-header"><span className="label">Area conversion</span></div>
            <div className="card-body">
              <div className="flex gap-4 mb-4">
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <input aria-label="Simple" type="radio" checked={mode === 'simple'} onChange={() => setMode('simple')} />
                  Enter area directly
                </label>
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <input aria-label="Polygon" type="radio" checked={mode === 'polygon'} onChange={() => setMode('polygon')} />
                  Enter polygon coordinates
                </label>
              </div>

              {mode === 'simple' ? (
                <div>
                  <label className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase">Grid area (m²)</label>
                  <input className="input font-mono text-sm" value={gridArea} onChange={e => setGridArea(e.target.value)} aria-label="100000" placeholder="100000" />
                  <p className="font-mono text-[10px] text-[var(--text-muted)] mt-1">This is the area from the shoelace formula on UTM coordinates.</p>
                </div>
              ) : (
                <div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {coords.map(c => (
                      <div key={c.id} className="grid grid-cols-[28px_1fr_1fr_28px] gap-1 items-center">
                        <span className="font-mono text-xs text-[var(--text-muted)]">{c.id}</span>
                        <input className="input font-mono text-xs px-2 py-1" value={c.easting} onChange={e => updateCoord(c.id, 'easting', e.target.value)} aria-label="Easting" placeholder="Easting" />
                        <input className="input font-mono text-xs px-2 py-1" value={c.northing} onChange={e => updateCoord(c.id, 'northing', e.target.value)} aria-label="Northing" placeholder="Northing" />
                        <button onClick={() => removeCoord(c.id)} className="text-[var(--text-muted)] hover:text-[var(--error)] text-sm">×</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={addCoord} className="mt-2 font-mono text-[11px] text-[var(--accent)] hover:opacity-80">+ Add vertex</button>
                </div>
              )}

              <button onClick={computeArea} className="btn btn-primary w-full mt-4">
                Convert grid → ground area
              </button>
            </div>
          </div>
        </div>

        {/* Right: results */}
        <div className="space-y-4">
          {/* Scale factor result */}
          {!sfResult ? (
            <div className="card">
              <div className="card-body text-center py-16">
                <p className="text-sm text-[var(--text-muted)]">Enter location and compute.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="card">
                <div className="card-header"><span className="label">Scale factor breakdown</span></div>
                <div className="card-body space-y-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-[var(--text-secondary)]">Grid scale factor (k)</span>
                    <span className="font-mono text-sm text-[var(--text-primary)]">{sfResult.gridScaleFactor.toFixed(8)}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-[var(--text-secondary)]">Elevation factor (Fh)</span>
                    <span className="font-mono text-sm text-[var(--text-primary)]">{sfResult.elevationFactor.toFixed(8)}</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-3 border-t border-[var(--border-color)]">
                    <span className="text-sm font-medium text-[var(--accent)]">Combined scale factor (CSF)</span>
                    <span className="font-display text-xl text-[var(--accent)] tracking-[-0.02em]">{sfResult.combinedScaleFactor.toFixed(8)}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase">Scale ratio</span>
                    <span className="font-mono text-xs text-[var(--text-muted)]">{sfResult.scaleRatio}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase">Distortion</span>
                    <span className="font-mono text-xs text-[var(--text-muted)]">{sfResult.percentDistortion > 0 ? '+' : ''}{sfResult.percentDistortion.toFixed(4)}%</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase">Dist from CM</span>
                    <span className="font-mono text-xs text-[var(--text-muted)]">{sfResult.distanceFromCentralMeridian.toFixed(0)} m</span>
                  </div>
                </div>
              </div>

              {/* Area result */}
              {areaResult && (
                <div className="card border-[var(--accent)]/40">
                  <div className="card-header bg-[var(--accent)]/5"><span className="label text-[var(--accent)]">Area conversion</span></div>
                  <div className="card-body space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase mb-1">Grid area</div>
                        <div className="font-display text-xl text-[var(--text-primary)] tracking-[-0.02em]">{areaResult.gridAreaSqM.toFixed(2)} m²</div>
                        <div className="font-mono text-[10px] text-[var(--text-muted)]">{(areaResult.gridAreaSqM / 10000).toFixed(4)} ha</div>
                      </div>
                      <div>
                        <div className="font-mono text-[10px] text-[var(--accent)] tracking-[0.06em] uppercase mb-1">Ground area (true)</div>
                        <div className="font-display text-xl text-[var(--accent)] tracking-[-0.02em]">{areaResult.groundAreaSqM.toFixed(2)} m²</div>
                        <div className="font-mono text-[10px] text-[var(--text-secondary)]">{areaResult.groundAreaHa.toFixed(4)} ha · {areaResult.groundAreaAcres.toFixed(4)} ac</div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[var(--border-color)]">
                      <div className="flex justify-between items-baseline">
                        <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase">Difference</span>
                        <span className="font-mono text-sm text-[var(--warning)]">{areaResult.differenceSqM > 0 ? '+' : ''}{areaResult.differenceSqM.toFixed(2)} m² ({areaResult.differenceHa.toFixed(4)} ha)</span>
                      </div>
                      <div className="flex justify-between items-baseline mt-1">
                        <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.06em] uppercase">% Difference</span>
                        <span className="font-mono text-sm text-[var(--warning)]">{areaResult.percentDifference.toFixed(4)}%</span>
                      </div>
                    </div>

                    <div className="p-3 border border-[var(--warning)]/30 bg-[var(--warning)]/5 rounded-md">
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        <span className="font-mono text-[var(--warning)] text-[10px] tracking-[0.06em] uppercase">Legal note:</span>{' '}
                        The deed plan must state the ground area, not the grid area. At this location and elevation,
                        the grid area understates the true surface area by {areaResult.percentDifference.toFixed(4)}%.
                        For a 100 ha parcel, this is a {(areaResult.percentDifference * 1).toFixed(2)} ha discrepancy.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
