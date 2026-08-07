'use client'
/**
 * CogoToolsPanel — Interactive COGO computation tools for surveyors
 *
 * Provides four SoK-compliant computation methods:
 * 1. Radiation — compute point from station + bearing + distance
 * 2. Bearing Intersection — intersect two rays from known stations
 * 3. Distance Intersection — intersect two circles (trilateration)
 * 4. Resection (Tienstra) — compute position from 3 known points + angles
 *
 * All inputs accept bearings in DDD.MMSS (Kenya field book convention)
 * or decimal degrees. Results displayed in DMS with SoK formatting.
 * Computed points can be added to the map as features.
 *
 * Reads mapInstance from MapReactContext for adding result features.
 */

import React, { useState, useCallback, memo } from 'react'
import { Crosshair, Circle, Triangle, Target, Plus, RotateCcw } from 'lucide-react'
import { useMapContext } from '@/app/map/MapReactContext'
import { radiation } from '@/lib/engine/cogo'
import { bearingIntersection } from '@/lib/engine/cogo'
import { distanceIntersection } from '@/lib/engine/cogo'
import { tienstraResection } from '@/lib/engine/cogo'
import { distanceBearing } from '@/lib/engine/distance'
import { bearingToString, parseFieldAngle } from '@/lib/engine/angles'
import type { Point2D } from '@/lib/engine/types'

// ─── Shared Helpers ──────────────────────────────────────────────────────

/** Parse bearing input — accepts DDD.MMSS, decimal degrees, or DMS string */
function parseBearing(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  return parseFieldAngle(trimmed)
}

/** Format a computed point for display */
function formatPoint(p: Point2D): string {
  return `E ${p.easting.toFixed(3)}  N ${p.northing.toFixed(3)}`
}

/** Input field with label */
function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  const id = React.useId()
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider w-12 shrink-0">
        {label}
      </label>
      <input id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-2 py-1 text-xs font-mono bg-[var(--bg-card)] border border-[var(--border-color)] rounded
                   focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]/30
                   transition-colors"
      />
    </div>
  )
}

/** Compute button */
function ComputeButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-1.5 text-xs font-semibold rounded-lg transition-colors
                 bg-[#1B3A5C] text-[var(--text-primary)] hover:bg-[#142d49]
                 disabled:bg-gray-300 disabled:text-[var(--text-muted)] disabled:cursor-not-allowed"
    >
      Compute
    </button>
  )
}

/** Result display */
function ResultDisplay({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[var(--primary-blue)]/10 border border-blue-100 rounded-lg px-3 py-2 space-y-1">
      {children}
    </div>
  )
}

// ─── Tab Definitions ─────────────────────────────────────────────────────

type TabId = 'radiation' | 'bearing-int' | 'distance-int' | 'resection'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'radiation', label: 'Radiation', icon: <Crosshair className="w-3.5 h-3.5" /> },
  { id: 'bearing-int', label: 'Bearing Int', icon: <Target className="w-3.5 h-3.5" /> },
  { id: 'distance-int', label: 'Dist Int', icon: <Circle className="w-3.5 h-3.5" /> },
  { id: 'resection', label: 'Resection', icon: <Triangle className="w-3.5 h-3.5" /> },
]

// ─── Radiation Panel ─────────────────────────────────────────────────────

function RadiationPanel({ onAddPoint }: { onAddPoint: (p: Point2D, label: string) => void }) {
  const [easting, setEasting] = useState('')
  const [northing, setNorthing] = useState('')
  const [bearing, setBearing] = useState('')
  const [distance, setDistance] = useState('')
  const [result, setResult] = useState<{ point: Point2D; bearing: number; distance: number } | null>(null)
  const [error, setError] = useState('')

  const compute = useCallback(() => {
    setError('')
    setResult(null)
    const e = parseFloat(easting)
    const n = parseFloat(northing)
    const b = parseBearing(bearing)
    const d = parseFloat(distance)

    if (isNaN(e) || isNaN(n)) { setError('Invalid station coordinates'); return }
    if (b === null) { setError('Invalid bearing (use DDD.MMSS or decimal)'); return }
    if (isNaN(d) || d <= 0) { setError('Distance must be positive'); return }

    const res = radiation({ easting: e, northing: n }, b, d)
    setResult({ point: res.point, bearing: res.bearing, distance: res.distance })
  }, [easting, northing, bearing, distance])

  return (
    <div className="space-y-2.5">
      <div className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
        Compute a new point from a known station, bearing (WCB), and distance.
      </div>
      <div className="space-y-1.5">
        <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">Station</div>
        <Field label="E" value={easting} onChange={setEasting} placeholder="e.g. 512345.678" />
        <Field label="N" value={northing} onChange={setNorthing} placeholder="e.g. 9834567.890" />
        <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold pt-1">Observation</div>
        <Field label="Brg" value={bearing} onChange={setBearing} placeholder="e.g. 47.2314 or 47.3861" />
        <Field label="Dist" value={distance} onChange={setDistance} placeholder="e.g. 125.450" type="number" />
      </div>
      <ComputeButton onClick={compute} />
      {error && <div className="text-[10px] text-[var(--error)]">{error}</div>}
      {result && (
        <ResultDisplay>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Computed Point</div>
          <div className="text-xs font-mono text-[#1B3A5C]">{formatPoint(result.point)}</div>
          <div className="text-[10px] text-[var(--text-muted)]">
            Bearing: {bearingToString(result.bearing)} &middot; Dist: {result.distance.toFixed(3)} m
          </div>
          <button
            onClick={() => onAddPoint(result.point, 'Rad')}
            className="flex items-center gap-1 mt-1 px-2 py-0.5 text-[10px] font-semibold
                       bg-[#1B3A5C] text-[var(--text-primary)] rounded hover:bg-[#142d49] transition-colors"
          >
            <Plus className="w-3 h-3" /> Add to Map
          </button>
        </ResultDisplay>
      )}
    </div>
  )
}

// ─── Bearing Intersection Panel ──────────────────────────────────────────

function BearingIntersectionPanel({ onAddPoint }: { onAddPoint: (p: Point2D, label: string) => void }) {
  const [eA, setEA] = useState('')
  const [nA, setNA] = useState('')
  const [brgA, setBrgA] = useState('')
  const [eB, setEB] = useState('')
  const [nB, setNB] = useState('')
  const [brgB, setBrgB] = useState('')
  const [result, setResult] = useState<{ point: Point2D; distA: number; distB: number } | null>(null)
  const [error, setError] = useState('')

  const compute = useCallback(() => {
    setError('')
    setResult(null)
    const ea = parseFloat(eA), na = parseFloat(nA), ba = parseBearing(brgA)
    const eb = parseFloat(eB), nb = parseFloat(nB), bb = parseBearing(brgB)

    if ([ea, na, eb, nb].some(isNaN)) { setError('Invalid station coordinates'); return }
    if (ba === null || bb === null) { setError('Invalid bearing (use DDD.MMSS or decimal)'); return }

    const res = bearingIntersection(
      { easting: ea, northing: na }, ba,
      { easting: eb, northing: nb }, bb,
    )
    if (!res) { setError('Bearings are parallel — no intersection'); return }
    setResult({ point: res.point, distA: res.distanceFromA, distB: res.distanceFromB })
  }, [eA, nA, brgA, eB, nB, brgB])

  return (
    <div className="space-y-2.5">
      <div className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
        Intersect two rays defined by station + bearing (WCB). Returns the intersection point.
      </div>
      <div className="space-y-1.5">
        <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">Station A</div>
        <Field label="E" value={eA} onChange={setEA} placeholder="512345.678" />
        <Field label="N" value={nA} onChange={setNA} placeholder="9834567.890" />
        <Field label="Brg" value={brgA} onChange={setBrgA} placeholder="47.2314" />
        <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold pt-1">Station B</div>
        <Field label="E" value={eB} onChange={setEB} placeholder="512500.000" />
        <Field label="N" value={nB} onChange={setNB} placeholder="9834600.000" />
        <Field label="Brg" value={brgB} onChange={setBrgB} placeholder="312.1500" />
      </div>
      <ComputeButton onClick={compute} />
      {error && <div className="text-[10px] text-[var(--error)]">{error}</div>}
      {result && (
        <ResultDisplay>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Intersection</div>
          <div className="text-xs font-mono text-[#1B3A5C]">{formatPoint(result.point)}</div>
          <div className="text-[10px] text-[var(--text-muted)]">
            Dist from A: {result.distA.toFixed(3)} m &middot; Dist from B: {result.distB.toFixed(3)} m
          </div>
          <button
            onClick={() => onAddPoint(result.point, 'Int')}
            className="flex items-center gap-1 mt-1 px-2 py-0.5 text-[10px] font-semibold
                       bg-[#1B3A5C] text-[var(--text-primary)] rounded hover:bg-[#142d49] transition-colors"
          >
            <Plus className="w-3 h-3" /> Add to Map
          </button>
        </ResultDisplay>
      )}
    </div>
  )
}

// ─── Distance Intersection Panel ─────────────────────────────────────────

function DistanceIntersectionPanel({ onAddPoint }: { onAddPoint: (p: Point2D, label: string) => void }) {
  const [eA, setEA] = useState('')
  const [nA, setNA] = useState('')
  const [distA, setDistA] = useState('')
  const [eB, setEB] = useState('')
  const [nB, setNB] = useState('')
  const [distB, setDistB] = useState('')
  const [result, setResult] = useState<[Point2D, Point2D] | null>(null)
  const [selectedIdx, setSelectedIdx] = useState<0 | 1>(0)
  const [error, setError] = useState('')

  const compute = useCallback(() => {
    setError('')
    setResult(null)
    const ea = parseFloat(eA), na = parseFloat(nA), da = parseFloat(distA)
    const eb = parseFloat(eB), nb = parseFloat(nB), db = parseFloat(distB)

    if ([ea, na, da, eb, nb, db].some(isNaN)) { setError('Invalid inputs'); return }
    if (da <= 0 || db <= 0) { setError('Distances must be positive'); return }

    const res = distanceIntersection(
      { easting: ea, northing: na }, da,
      { easting: eb, northing: nb }, db,
    )
    if (!res) { setError('Circles do not intersect'); return }
    setResult(res)
  }, [eA, nA, distA, eB, nB, distB])

  const selected = result ? result[selectedIdx] : null

  return (
    <div className="space-y-2.5">
      <div className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
        Intersect two circles (trilateration). Returns two possible points — select the correct one.
      </div>
      <div className="space-y-1.5">
        <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">Station A</div>
        <Field label="E" value={eA} onChange={setEA} placeholder="512345.678" />
        <Field label="N" value={nA} onChange={setNA} placeholder="9834567.890" />
        <Field label="Dist" value={distA} onChange={setDistA} placeholder="125.450" type="number" />
        <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold pt-1">Station B</div>
        <Field label="E" value={eB} onChange={setEB} placeholder="512500.000" />
        <Field label="N" value={nB} onChange={setNB} placeholder="9834600.000" />
        <Field label="Dist" value={distB} onChange={setDistB} placeholder="98.760" type="number" />
      </div>
      <ComputeButton onClick={compute} />
      {error && <div className="text-[10px] text-[var(--error)]">{error}</div>}
      {result && (
        <ResultDisplay>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Two Solutions</div>
          <div className="flex gap-2">
            {([0, 1] as const).map((idx) => (
              <button
                key={`btn-${idx}`}
                onClick={() => setSelectedIdx(idx)}
                className={`flex-1 px-2 py-1 text-[10px] font-mono rounded border transition-colors ${
                  selectedIdx === idx
                    ? 'border-[#1B3A5C] bg-[#1B3A5C] text-[var(--text-primary)]'
                    : 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:border-gray-300'
                }`}
              >
                P{idx + 1}: {formatPoint(result[idx])}
              </button>
            ))}
          </div>
          {selected && (
            <button
              onClick={() => onAddPoint(selected, 'DistInt')}
              className="flex items-center gap-1 mt-1 px-2 py-0.5 text-[10px] font-semibold
                         bg-[#1B3A5C] text-[var(--text-primary)] rounded hover:bg-[#142d49] transition-colors"
            >
              <Plus className="w-3 h-3" /> Add P{selectedIdx + 1} to Map
            </button>
          )}
        </ResultDisplay>
      )}
    </div>
  )
}

// ─── Resection Panel ─────────────────────────────────────────────────────

function ResectionPanel({ onAddPoint }: { onAddPoint: (p: Point2D, label: string) => void }) {
  const [e1, setE1] = useState(''), [n1, setN1] = useState('')
  const [e2, setE2] = useState(''), [n2, setN2] = useState('')
  const [e3, setE3] = useState(''), [n3, setN3] = useState('')
  const [a12, setA12] = useState(''), [a23, setA23] = useState('')
  const [result, setResult] = useState<{ point: Point2D; d1: number; d2: number; d3: number } | null>(null)
  const [error, setError] = useState('')

  const compute = useCallback(() => {
    setError('')
    setResult(null)
    const pe1 = parseFloat(e1), pn1 = parseFloat(n1)
    const pe2 = parseFloat(e2), pn2 = parseFloat(n2)
    const pe3 = parseFloat(e3), pn3 = parseFloat(n3)
    const ang12 = parseFloat(a12), ang23 = parseFloat(a23)

    if ([pe1, pn1, pe2, pn2, pe3, pn3, ang12, ang23].some(isNaN)) {
      setError('Invalid inputs'); return
    }
    if (ang12 <= 0 || ang23 <= 0 || (ang12 + ang23) >= 360) {
      setError('Angles must be positive and sum < 360°'); return
    }

    const res = tienstraResection(
      { easting: pe1, northing: pn1 },
      { easting: pe2, northing: pn2 },
      { easting: pe3, northing: pn3 },
      ang12, ang23,
    )
    if (!res) { setError('Resection failed — check geometry'); return }
    setResult({ point: res.point, d1: res.distanceToP1, d2: res.distanceToP2, d3: res.distanceToP3 })
  }, [e1, n1, e2, n2, e3, n3, a12, a23])

  return (
    <div className="space-y-2.5">
      <div className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
        Tienstra three-point resection. Angles measured at unknown station between rays to control points.
      </div>
      <div className="space-y-1.5">
        <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">Control P1</div>
        <Field label="E" value={e1} onChange={setE1} placeholder="512345.678" />
        <Field label="N" value={n1} onChange={setN1} placeholder="9834567.890" />
        <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold pt-1">Control P2</div>
        <Field label="E" value={e2} onChange={setE2} placeholder="512500.000" />
        <Field label="N" value={n2} onChange={setN2} placeholder="9834600.000" />
        <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold pt-1">Control P3</div>
        <Field label="E" value={e3} onChange={setE3} placeholder="512600.000" />
        <Field label="N" value={n3} onChange={setN3} placeholder="9834700.000" />
        <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold pt-1">Observed Angles</div>
        <Field label="∠12" value={a12} onChange={setA12} placeholder="e.g. 45.5000 (45°30')" />
        <Field label="∠23" value={a23} onChange={setA23} placeholder="e.g. 52.1500 (52°15')" />
      </div>
      <ComputeButton onClick={compute} />
      {error && <div className="text-[10px] text-[var(--error)]">{error}</div>}
      {result && (
        <ResultDisplay>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Resection Point</div>
          <div className="text-xs font-mono text-[#1B3A5C]">{formatPoint(result.point)}</div>
          <div className="text-[10px] text-[var(--text-muted)] space-y-0.5">
            <div>Dist to P1: {result.d1.toFixed(3)} m</div>
            <div>Dist to P2: {result.d2.toFixed(3)} m</div>
            <div>Dist to P3: {result.d3.toFixed(3)} m</div>
          </div>
          <button
            onClick={() => onAddPoint(result.point, 'Res')}
            className="flex items-center gap-1 mt-1 px-2 py-0.5 text-[10px] font-semibold
                       bg-[#1B3A5C] text-[var(--text-primary)] rounded hover:bg-[#142d49] transition-colors"
          >
            <Plus className="w-3 h-3" /> Add to Map
          </button>
        </ResultDisplay>
      )}
    </div>
  )
}

// ─── Main CogoToolsPanel ─────────────────────────────────────────────────

function CogoToolsPanelInner() {
  const { mapInstance } = useMapContext()
  const [activeTab, setActiveTab] = useState<TabId>('radiation')
  const [expanded, setExpanded] = useState(true)

  // ── Add computed point to map as a vector feature ──
  const handleAddPoint = useCallback(async (point: Point2D, labelPrefix: string) => {
    const map = mapInstance.current
    if (!map) return

    try {
      const { default: Feature } = await import('ol/Feature')
      const { default: Point } = await import('ol/geom/Point')
      const { default: VectorSource } = await import('ol/source/Vector')
      const { default: VectorLayer } = await import('ol/layer/Vector')
      const { default: Style } = await import('ol/style/Style')
      const { default: Circle } = await import('ol/style/Circle')
      const { default: Fill } = await import('ol/style/Fill')
      const { default: Stroke } = await import('ol/style/Stroke')
      const { transform } = await import('ol/proj')
      const { to21037, SRID_21037, SRID_3857 } = await import('@/lib/map/projection')

      // Transform from EPSG:21037 to map projection (3857)
      const coord3857 = transform([point.easting, point.northing], SRID_21037, SRID_3857)

      const feature = new Feature({
        geometry: new Point(coord3857),
        name: `${labelPrefix} ${point.easting.toFixed(1)}/${point.northing.toFixed(1)}`,
        easting: point.easting,
        northing: point.northing,
      })

      // Check if COGO results layer already exists
      const layers = map.getLayers().getArray()
      let cogoLayer = layers.find((l) => l.get('cogoResults') === true) as import('ol/layer/Vector').default<import('ol/source/Vector').default> | undefined

      if (!cogoLayer) {
        const source = new VectorSource({ features: [feature] })
        cogoLayer = new VectorLayer({
          source,
          style: new Style({
            image: new Circle({
              radius: 6,
              fill: new Fill({ color: '#D17B47' }),
              stroke: new Stroke({ color: '#fff', width: 2 }),
            }),
          }),
        })
        cogoLayer.set('cogoResults', true)
        cogoLayer.set('name', 'COGO Results')
        map.addLayer(cogoLayer)
      } else {
        cogoLayer.getSource()?.addFeature(feature)
      }

      // Zoom to the new point
      map.getView().animate({ center: coord3857, zoom: 17, duration: 500 })
    } catch (err) {
      console.error('[CogoToolsPanel] Failed to add point to map:', err)
    }
  }, [mapInstance])

  return (
    <div
      className="bg-[var(--bg-card)] rounded-lg shadow-lg border border-[var(--border-color)] select-none"
      style={{ fontFamily: 'Calibri, sans-serif', width: 300 }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-[#1B3A5C]" />
          <span className="text-sm font-semibold text-[#1B3A5C]">
            COGO Tools
          </span>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="p-1 hover:bg-[var(--bg-secondary)] rounded transition-colors text-[var(--text-muted)]"
          title={expanded ? 'Collapse' : 'Expand'}
        >
          <RotateCcw className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {expanded && (
        <>
          {/* ── Tab bar ── */}
          <div className="flex border-b border-[var(--border-color)]">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1 px-1 py-1.5 text-[9px] font-semibold
                           transition-colors border-b-2 ${
                             activeTab === tab.id
                               ? 'text-[#1B3A5C] border-[#1B3A5C] bg-[var(--primary-blue)]/10/50'
                               : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]'
                           }`}
                title={tab.label}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* ── Tab content ── */}
          <div className="px-3 py-2.5 max-h-[60vh] overflow-y-auto">
            {activeTab === 'radiation' && <RadiationPanel onAddPoint={handleAddPoint} />}
            {activeTab === 'bearing-int' && <BearingIntersectionPanel onAddPoint={handleAddPoint} />}
            {activeTab === 'distance-int' && <DistanceIntersectionPanel onAddPoint={handleAddPoint} />}
            {activeTab === 'resection' && <ResectionPanel onAddPoint={handleAddPoint} />}
          </div>

          {/* ── Footer hint ── */}
          <div className="px-3 py-1.5 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]/50">
            <div className="text-[9px] text-[var(--text-secondary)]">
              Bearings: DDD.MMSS (e.g. 47.2314 = 47° 23' 14") or decimal degrees
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export const CogoToolsPanel = memo(CogoToolsPanelInner)
