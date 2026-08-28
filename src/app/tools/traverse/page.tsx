'use client';

import { useState, useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { bowditchAdjustment, transitAdjustment } from '@/lib/engine/traverse'
import { trackEvent } from '@/lib/analytics/events'
import SolutionStepsRenderer from '@/components/SolutionStepsRenderer'
import type { SolutionStep } from '@/lib/engine/solution/solutionBuilder'
import { bowditchAdjustmentSolvedFromResult, transitAdjustmentSolvedFromResult } from '@/lib/engine/solution/wrappers/traverse'
import type { TraverseLeg, TraverseResult } from '@/lib/engine/types'
import { computeTraverseAccuracy } from '@/lib/reports/traverseAccuracy'
import { buildPrintDocument, openPrint } from '@/lib/print/buildPrintDocument'
import { PrintMetaPanel, defaultPrintMeta, type PrintMeta } from '@/components/shared/PrintMetaPanel'
import { PageHeader } from '@/components/shared/PageHeader'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { TraverseDiagram } from '@/components/traverse/TraverseDiagram'

// ── Types ──────────────────────────────────────────────────────────────────

interface Leg {
  id: number
  name: string
  n: string
  e: string
  dist: string
  bearingD: string
  bearingM: string
  bearingS: string
}

interface DMS { d: string; m: string; s: string }

interface AzmResult {
  totalMisclosureSec: number
  misclosurePerStationSec: number
  numStations: number
  passes: boolean
  numCourses: number
  coursesWarning: boolean
}

interface ProjectPoint {
  point_name: string
  northing: number
  easting: number
  is_control?: boolean
}

interface MappedLeg extends TraverseLeg {
  departure: number
  latitude: number
  correctedDeparture: number
  correctedLatitude: number
}

// ── Helpers ────────────────────────────────────────────────────────────────

function dmsToDecimal(d: string, m: string, s: string): number {
  return (parseFloat(d) || 0) + (parseFloat(m) || 0) / 60 + (parseFloat(s) || 0) / 3600
}

/**
 * Compute angular (azimuth) misclosure.
 * RDM 1.1 (2025) Table 5.1: ≤ 3.0″ per station, max 15 courses without intermediate check.
 */
function computeAzmMisclosure(
  init: DMS,
  close: DMS,
  numStations: number,
): AzmResult | null {
  const iD = parseFloat(init.d), cD = parseFloat(close.d)
  if (isNaN(iD) || isNaN(cD)) return null

  const initialDeg = dmsToDecimal(init.d, init.m, init.s)
  const closingDeg = dmsToDecimal(close.d, close.m, close.s)

  let diffSec = Math.abs(initialDeg - closingDeg) * 3600
  // Handle 360° wrap-around
  if (diffSec > 648000) diffSec = 1296000 - diffSec

  const perStation = numStations > 0 ? diffSec / numStations : 0

  return {
    totalMisclosureSec:     diffSec,
    misclosurePerStationSec: perStation,
    numStations,
    passes:         perStation <= 3.0,
    numCourses:     numStations,
    coursesWarning: numStations > 15,
  }
}

// ── Component ──────────────────────────────────────────────────────────────

function TraverseCalculatorInner() {
  const { t } = useLanguage()
  // Traverse legs
  const [legs, setLegs] = useState<Leg[]>([
    { id: 1, name: 'A', n: '5000', e: '3000', dist: '250.0',  bearingD: '45',  bearingM: '32', bearingS: '08' },
    { id: 2, name: 'B', n: '',     e: '',     dist: '180.5',  bearingD: '120', bearingM: '07', bearingS: '24' },
    { id: 3, name: 'C', n: '',     e: '',     dist: '220.75', bearingD: '200', bearingM: '20', bearingS: '44' },
    { id: 4, name: 'D', n: '5020', e: '3050', dist: '190.25', bearingD: '290', bearingM: '34', bearingS: '04' },
  ])
  const [method, setMethod]       = useState<'bowditch' | 'transit'>('bowditch')
  const [result, setResult]       = useState<(TraverseResult & { legs: MappedLeg[] }) | null>(null)
  const [steps,  setSteps]        = useState<SolutionStep[] | null>(null)
  const [solutionTitle, setSolutionTitle] = useState<string | undefined>(undefined)
  const [calcError, setCalcError] = useState<string | null>(null)
  const [calculating, setCalculating] = useState(false)

  // Angular misclosure (RDM 1.1 Table 5.1)
  const [initBearing,  setInitBearing]  = useState<DMS>({ d: '', m: '', s: '' })
  const [closeBearing, setCloseBearing] = useState<DMS>({ d: '', m: '', s: '' })
  const [azmResult, setAzmResult]       = useState<AzmResult | null>(null)

  // Print
  const [printMeta, setPrintMeta] = useState<PrintMeta>(defaultPrintMeta)

  // ── Project integration: auto-load survey points as traverse legs ──
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project')
  const [projectLoaded, setProjectLoaded] = useState(false)

  useEffect(() => {
    if (!projectId || projectLoaded) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/project/${projectId}/points`)
        if (!res.ok) return
        const json = await res.json() as { data?: ProjectPoint[] }
        const points = json.data || []
        if (points.length < 2 || cancelled) return

        // Convert survey points to traverse legs
        // First point gets known E/N, rest get empty (to be computed)
        const projectLegs: Leg[] = points.map((p: ProjectPoint, i: number) => ({
          id: i + 1,
          name: p.point_name || String.fromCharCode(65 + i),
          n: i === 0 ? String(p.northing) : '',
          e: i === 0 ? String(p.easting) : '',
          dist: '',
          bearingD: '',
          bearingM: '',
          bearingS: '',
        }))

        // If there's a closing point (last point has same name as first or is_control),
        // give it known coordinates too
        if (points.length > 1) {
          const last = points[points.length - 1]
          if (last.is_control || last.point_name === points[0].point_name) {
            projectLegs[projectLegs.length - 1].n = String(last.northing)
            projectLegs[projectLegs.length - 1].e = String(last.easting)
          }
        }

        if (!cancelled && projectLegs.length >= 2) {
          setLegs(projectLegs)
        }
      } catch {
        // silent fail — user can enter manually
      } finally {
        if (!cancelled) setProjectLoaded(true)
      }
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, projectLoaded])

  // ── Leg management ───────────────────────────────────────────────────────

  const addLeg = () => {
    const nextChar = String.fromCharCode(65 + legs.length)
    setLegs([...legs, { id: Date.now(), name: nextChar, n: '', e: '', dist: '', bearingD: '', bearingM: '', bearingS: '' }])
  }

  const updateLeg = (id: number, field: keyof Leg, value: string) =>
    setLegs(legs.map(l => l.id === id ? { ...l, [field]: value } : l))

  // ── Calculate ────────────────────────────────────────────────────────────

  const calculate = () => {
    setCalcError(null)
    setCalculating(true)
    try {
      const points   = legs.filter(l => l.n && l.e).map(l => ({ name: l.name, northing: parseFloat(l.n), easting: parseFloat(l.e) }))
      const distances = legs.map(l => parseFloat(l.dist)).filter(d => !isNaN(d))
      const bearings  = legs.map(l => dmsToDecimal(l.bearingD, l.bearingM, l.bearingS)).filter(b => !isNaN(b))

      if (points.length < 2 || distances.length < 2 || bearings.length < 2) {
        setCalcError('Enter at least 2 legs with valid distances, bearings, and at least TWO known coordinates (first and last rows N & E). Per Survey Regulations Reg. 60 & 67, a traverse requires both opening and closing control points — swinging/hanging traverses are prohibited.')
        return
      }

      const r = method === 'bowditch'
        ? bowditchAdjustment({ points, distances, bearings })
        : transitAdjustment({ points, distances, bearings })

      // Map engine property names to display property names for compatibility
      const mappedResult = {
        ...r,
        legs: r.legs.map((leg: TraverseLeg) => ({
          ...leg,
          departure: leg.rawDeltaE,
          latitude: leg.rawDeltaN,
          correctedDeparture: leg.adjDeltaE,
          correctedLatitude: leg.adjDeltaN,
        }))
      }
      setResult(mappedResult)
      trackEvent('tool_used', { tool: 'traverse', method })

      try {
        const s = method === 'bowditch'
          ? bowditchAdjustmentSolvedFromResult(r)
          : transitAdjustmentSolvedFromResult(r)
        setSteps(s.steps)
        setSolutionTitle(s.solution.title)
      } catch { setSteps(null); setSolutionTitle(undefined) }

      // Angular misclosure — RDM 1.1 Table 5.1
      if (initBearing.d && closeBearing.d) {
        setAzmResult(computeAzmMisclosure(initBearing, closeBearing, legs.length))
      } else {
        setAzmResult(null)
      }

    } catch (err: unknown) {
      setCalcError(((err as Error)?.message) || 'Calculation failed. Check your inputs.')
      setResult(null); setSteps(null)
    } finally {
      setCalculating(false)
    }
  }

  // ── Print ────────────────────────────────────────────────────────────────

  const handlePrint = () => {
    if (!result) return
    const mLabel = method === 'bowditch' ? 'Bowditch Rule' : 'Transit Rule'

    const table1Rows = result.legs.map((l: MappedLeg) => `
<tr>
  <td class="bold">${l.from} → ${l.to}</td>
  <td class="mono">${l.bearingDMS}</td>
  <td class="right mono">${l.distance.toFixed(4)}</td>
  <td class="right mono">${l.departure >= 0 ? '+' : ''}${l.departure.toFixed(4)}</td>
  <td class="right mono">${l.latitude >= 0 ? '+' : ''}${l.latitude.toFixed(4)}</td>
</tr>`).join('')

    const table2Rows = result.legs.map((l: MappedLeg) => `
<tr>
  <td class="bold">${l.from} → ${l.to}</td>
  <td class="right mono">${l.distance.toFixed(4)}</td>
  <td class="right mono">${(l.correctedDeparture - l.departure).toFixed(4)}</td>
  <td class="right mono">${(l.correctedLatitude  - l.latitude ).toFixed(4)}</td>
  <td class="right mono bold">${l.correctedDeparture.toFixed(4)}</td>
  <td class="right mono bold">${l.correctedLatitude.toFixed(4)}</td>
</tr>`).join('')

    const table3Rows = result.legs.map((l: MappedLeg) => `
<tr>
  <td class="bold">${l.to}</td>
  <td class="right mono bold">${l.adjEasting.toFixed(4)}</td>
  <td class="right mono bold">${l.adjNorthing.toFixed(4)}</td>
</tr>`).join('')

    const acc = computeTraverseAccuracy(result.linearError, result.totalDistance)

    const azmSection = azmResult ? `
<h2>Table 4 — Angular Misclosure — RDM 1.1 (2025) Table 5.1</h2>
<div class="summary-box">
  <div class="summary-row"><span class="summary-label">Number of Stations</span><span class="summary-value">${azmResult.numStations}</span></div>
  <div class="summary-row"><span class="summary-label">Total Misclosure</span><span class="summary-value">${azmResult.totalMisclosureSec.toFixed(1)}&#8243;</span></div>
  <div class="summary-row"><span class="summary-label">Misclosure per Station</span><span class="summary-value">${azmResult.misclosurePerStationSec.toFixed(2)}&#8243;</span></div>
  <div class="summary-row"><span class="summary-label">Allowable (RDM 1.1 Table 5.1)</span><span class="summary-value">&#8804; 3.0&#8243; per station</span></div>
  <div class="summary-row"><span class="summary-label">Maximum Courses Without Check</span><span class="summary-value">15</span></div>
  <div class="summary-row"><span class="summary-label">Status</span><span class="summary-value ${azmResult.passes ? 'pass' : 'fail'}">${azmResult.passes ? 'ACCEPTABLE' : 'EXCEEDS TOLERANCE'}</span></div>
  ${azmResult.coursesWarning ? '<div class="summary-row"><span class="summary-label warn">&#9888; Intermediate azimuth check required (&gt;15 courses)</span></div>' : ''}
</div>` : `
<h2>Angular Misclosure</h2>
<p style="color:#666;font-size:9pt;font-style:italic">No closing azimuth provided. RDM 1.1 (2025) Table 5.1 requires an azimuth check (&#8804;3.0&#8243;/station) for formal survey submissions.</p>`

    const bodyHtml = `
<h2>Table 1 — Traverse Computation (${mLabel})</h2>
<table>
  <tr>
    <th>Line</th>
    <th>WCB</th>
    <th class="right">HD (m)</th>
    <th class="right">Departure (m)</th>
    <th class="right">Latitude (m)</th>
  </tr>
  ${table1Rows}
  <tfoot>
    <tr>
      <td colspan="3" class="right">&#931;</td>
      <td class="right mono">${result.legs.reduce((s: number, l: MappedLeg) => s + l.departure, 0).toFixed(4)}</td>
      <td class="right mono">${result.legs.reduce((s: number, l: MappedLeg) => s + l.latitude,  0).toFixed(4)}</td>
    </tr>
  </tfoot>
</table>

<h2>Table 2 — ${mLabel} Corrections</h2>
<table>
  <tr>
    <th>Line</th>
    <th class="right">HD (m)</th>
    <th class="right">Corr-Dep</th>
    <th class="right">Corr-Lat</th>
    <th class="right">Adj-Dep</th>
    <th class="right">Adj-Lat</th>
  </tr>
  ${table2Rows}
</table>

<h2>Table 3 — Adjusted Coordinates</h2>
<table>
  <tr>
    <th>Point</th>
    <th class="right">Easting (m)</th>
    <th class="right">Northing (m)</th>
  </tr>
  ${table3Rows}
</table>

<div class="summary-box">
  <h2 style="border:none;margin:0 0 8px">Linear Misclosure &amp; Accuracy — RDM 1.1 (2025) Table 5.1</h2>
  <div class="summary-row"><span class="summary-label">Method</span><span class="summary-value">${mLabel}</span></div>
  <div class="summary-row"><span class="summary-label">Total Distance (Perimeter)</span><span class="summary-value">${result.totalDistance.toFixed(4)} m</span></div>
  <div class="summary-row"><span class="summary-label">&#931; Departures</span><span class="summary-value">${result.legs.reduce((s: number, l: MappedLeg) => s + l.departure, 0).toFixed(4)} m</span></div>
  <div class="summary-row"><span class="summary-label">&#931; Latitudes</span><span class="summary-value">${result.legs.reduce((s: number, l: MappedLeg) => s + l.latitude,  0).toFixed(4)} m</span></div>
  <div class="summary-row"><span class="summary-label">Linear Misclosure</span><span class="summary-value">${result.linearError.toFixed(6)} m</span></div>
  <div class="summary-row"><span class="summary-label">Precision Ratio</span><span class="summary-value">1 : ${Math.round(result.precisionRatio)}</span></div>
  <div class="summary-row"><span class="summary-label">Allowable (RDM 1.1 Table 5.1)</span><span class="summary-value">1 : 10 000</span></div>
  ${acc ? `<div class="summary-row"><span class="summary-label">Survey Order</span><span class="summary-value">${acc.order}</span></div>` : ''}
</div>

${azmSection}`

    const doc = buildPrintDocument(bodyHtml, {
      title:     `Traverse Computation — ${mLabel}`,
      reference: 'RDM 1.1 (2025) Table 5.1 &nbsp;|&nbsp; Survey Regulations 1994 &nbsp;|&nbsp; Survey Act Cap 299',
      ...printMeta,
    })
    openPrint(doc)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-8">

      <PageHeader
        title={t('tools.traverse')}
        subtitle={t('tools.traverseDesc')}
        reference="RDM 1.1 (2025) Table 5.1 | Survey Regulations 1994 | Survey Act Cap 299"
      />

      {/* Hint bar */}
      <div className="mb-4 px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-muted)] flex flex-wrap gap-x-6 gap-y-1">
        <span><span className="text-[var(--text-secondary)] font-medium">Bearings</span> — WCB in Degrees°Minutes′Seconds″ as read from instrument</span>
        <span><span className="text-[var(--text-secondary)] font-medium">Distances</span> — horizontal distances in metres</span>
        <span><span className="text-[var(--text-secondary)] font-medium">First row</span> — must have known Northing &amp; Easting</span>
      </div>

      {/* Method buttons */}
      <div className="flex gap-4 mb-6">
        <button onClick={() => { setMethod('bowditch'); setResult(null); setSteps(null); setSolutionTitle(undefined) }}
          className={`btn ${method === 'bowditch' ? 'btn-primary' : 'btn-secondary'}`}>
          Bowditch Rule
        </button>
        <button onClick={() => { setMethod('transit'); setResult(null); setSteps(null); setSolutionTitle(undefined) }}
          className={`btn ${method === 'transit' ? 'btn-primary' : 'btn-secondary'}`}>
          Transit Rule
        </button>
      </div>

      <div className="grid gap-6 mb-6">
        {/* Leg table */}
        <div className="card">
          <div className="card-header">
            <span className="label">Traverse Computation Table — {method === 'bowditch' ? 'Bowditch' : 'Transit'} Adjustment</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[550px] table">
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Dist (m)</th>
                  <th>WCB</th>
                  <th>N (m)</th>
                  <th>E (m)</th>
                </tr>
              </thead>
              <tbody>
                {legs.map((l, i) => (
                  <tr key={l.id}>
                    <td className="text-left font-semibold">{l.name}</td>
                    <td>
                      <input className="input" value={l.dist} aria-label="Distance" placeholder="e.g. 250.00"
                        onChange={e => updateLeg(l.id, 'dist', e.target.value)} />
                    </td>
                    <td>
                      <div className="flex items-center gap-0.5 md:gap-1">
                        <input className="input w-10 md:w-12 text-center text-xs md:text-sm" value={l.bearingD} aria-label="Bearing (Deg)" placeholder="DDD" maxLength={3}
                          onChange={e => updateLeg(l.id, 'bearingD', e.target.value)} />
                        <span className="text-[var(--text-muted)] text-xs">°</span>
                        <input className="input w-8 md:w-10 text-center text-xs md:text-sm" value={l.bearingM} aria-label="Bearing (Min)" placeholder="MM" maxLength={2}
                          onChange={e => updateLeg(l.id, 'bearingM', e.target.value)} />
                        <span className="text-[var(--text-muted)] text-xs">&apos;</span>
                        <input className="input w-10 md:w-12 text-center text-xs md:text-sm" value={l.bearingS} aria-label="Bearing (Sec)" placeholder="SS" maxLength={5}
                          onChange={e => updateLeg(l.id, 'bearingS', e.target.value)} />
                        <span className="text-[var(--text-muted)] text-xs">&quot;</span>
                      </div>
                    </td>
                    <td>
                      <input aria-label="N" className="input" value={l.n} placeholder={i === 0 ? 'required' : 'auto'}
                        onChange={e => updateLeg(l.id, 'n', e.target.value)} />
                    </td>
                    <td>
                      <input aria-label="E" className="input" value={l.e} placeholder={i === 0 ? 'required' : 'auto'}
                        onChange={e => updateLeg(l.id, 'e', e.target.value)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4">
            <button onClick={addLeg} className="btn btn-secondary">+ Add Leg</button>
          </div>
        </div>

        {/* ── Angular Misclosure Check (RDM 1.1 Table 5.1) ─────────────── */}
        <div className="card">
          <div className="card-header">
            <span className="label">Angular Misclosure Check</span>
            <span className="text-xs text-[var(--text-muted)] ml-2">RDM 1.1 Table 5.1 — ≤ 3.0″ per station | max 15 courses</span>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {([
              ['Initial Reference Bearing (WCB)', initBearing,  setInitBearing ] as const,
              ['Computed Closing Bearing (WCB)',  closeBearing, setCloseBearing] as const,
            ]).map(([label, val, setVal]) => (
              <div key={label}>
                <label className="block text-xs text-[var(--text-muted)] mb-1.5">{label}</label>
                <div className="flex items-center gap-1">
                  <input className="input w-12 text-center text-xs" aria-label="Bearing (Deg)" placeholder="DDD" value={val.d}
                    onChange={e => setVal(p => ({ ...p, d: e.target.value }))} />
                  <span className="text-[var(--text-muted)] text-xs">°</span>
                  <input className="input w-10 text-center text-xs" aria-label="Bearing (Min)" placeholder="MM" value={val.m}
                    onChange={e => setVal(p => ({ ...p, m: e.target.value }))} />
                  <span className="text-[var(--text-muted)] text-xs">&apos;</span>
                  <input className="input w-14 text-center text-xs" aria-label="Bearing (Sec)" placeholder="SS.ss" value={val.s}
                    onChange={e => setVal(p => ({ ...p, s: e.target.value }))} />
                  <span className="text-[var(--text-muted)] text-xs">&quot;</span>
                </div>
              </div>
            ))}
          </div>
          <p className="px-4 pb-4 text-xs text-[var(--text-muted)]">
            Enter the initial reference bearing and the bearing computed back to the reference line.
            Leave blank if no closing azimuth check was performed (noted in print output).
          </p>
        </div>

        {/* Calculate button */}
        <button onClick={calculate} disabled={calculating}
          className="btn btn-primary disabled:opacity-60 disabled:cursor-not-allowed">
          {calculating ? (
            <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg> {t('toolUI.calculating')}</>
          ) : 'Calculate Adjustment'}
        </button>
      </div>

      {/* Error */}
      {calcError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 mb-6 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <p className="font-semibold">Error</p>
          <p>{calcError}</p>
        </div>
      )}

      {/* ── Results ────────────────────────────────────────────────────── */}
      {result && (
        <div className="grid md:grid-cols-2 gap-6">

          {/* Traverse Diagram — full width */}
          <div className="md:col-span-2 card">
            <div className="card-header flex justify-between items-center">
              <span className="label">Traverse Diagram — Adjusted vs Raw</span>
              <span className="text-xs text-[var(--text-muted)] font-mono">
                Closing error: {result.linearError.toFixed(4)} m · Precision 1:{Math.round(result.precisionRatio)}
              </span>
            </div>
            <div className="p-4">
              <TraverseDiagram result={result} />
            </div>
          </div>

          {/* Linear Misclosure */}
          <div className="card">
            <div className="card-header flex justify-between items-center">
              <span className="label">Linear Misclosure Analysis</span>
              <span className={`badge ${result.isClosed ? 'badge-success' : 'badge-warning'}`}>
                {result.isClosed ? 'Closed' : 'Not Closed'}
              </span>
            </div>
            <div className="card-body space-y-3">
              <ResultRow label="Method" value={method === 'bowditch' ? 'Bowditch Rule' : 'Transit Rule'} />
              <ResultRow label="Total Distance" value={`${result.totalDistance.toFixed(4)} m`} />
              <ResultRow label="Σ Departures" value={`${result.legs.reduce((s: number, l: MappedLeg) => s + l.departure, 0).toFixed(4)} m`} />
              <ResultRow label="Σ Latitudes"  value={`${result.legs.reduce((s: number, l: MappedLeg) => s + l.latitude,  0).toFixed(4)} m`} />
              <ResultRow label="Linear Misclosure" value={`${result.linearError.toFixed(6)} m`} />
              <ResultRow label="Precision Ratio"   value={`1 : ${Math.round(result.precisionRatio)}`} highlight />
            </div>
          </div>

          {/* RDM 1.1 Accuracy Order */}
          {(() => {
            const acc = computeTraverseAccuracy(result.linearError, result.totalDistance)
            if (!acc) return null
            const badgeClass = acc.order === 'FIRST ORDER CLASS I'  ? 'bg-emerald-700 text-white'
              : acc.order === 'FIRST ORDER CLASS II' ? 'bg-emerald-600 text-white'
              : acc.order === 'SECOND ORDER CLASS I' ? 'bg-amber-500 text-black'
              : acc.order === 'SECOND ORDER CLASS II'? 'bg-orange-600 text-white'
              : 'bg-red-600 text-white'
            return (
              <div className="card">
                <div className="card-header">
                  <span className="label">Traverse Accuracy — RDM 1.1 Table 5.1</span>
                </div>
                <div className="card-body space-y-3">
                  <ResultRow label="Total Perimeter"   value={`${result.totalDistance.toFixed(4)} m`} />
                  <ResultRow label="Linear Misclosure" value={`${result.linearError.toFixed(6)} m`} />
                  <ResultRow label="Precision Ratio"   value={`1 : ${Math.round(result.precisionRatio)}`} />
                  <ResultRow label="Allowable (RDM 1.1 Table 5.1)" value="1 : 10 000" />
                  <div className="mt-3 p-4 rounded-lg text-center">
                    <p className="text-xs text-[var(--text-muted)] mb-2">TRAVERSE ACCURACY ORDER</p>
                    <span className={`inline-block px-4 py-2 rounded-lg font-bold text-sm ${badgeClass}`}>
                      {acc.order}
                    </span>
                    <p className="text-xs text-[var(--text-muted)] mt-2 font-mono">{acc.formula}</p>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ── Angular Misclosure Result ───────────────────────────────── */}
          {azmResult ? (
            <div className="card">
              <div className="card-header flex justify-between items-center">
                <span className="label">Angular Misclosure — RDM 1.1 Table 5.1</span>
                <span className={`badge ${azmResult.passes ? 'badge-success' : 'badge-error'}`}>
                  {azmResult.passes ? 'PASSES' : 'FAILS'}
                </span>
              </div>
              <div className="card-body space-y-3">
                <ResultRow label="Stations"                value={String(azmResult.numStations)} />
                <ResultRow label="Total Misclosure"        value={`${azmResult.totalMisclosureSec.toFixed(1)}″`} />
                <ResultRow label="Misclosure per Station"  value={`${azmResult.misclosurePerStationSec.toFixed(2)}″`} highlight />
                <ResultRow label="Allowable (RDM 1.1)"    value="≤ 3.0″ per station" />
                {azmResult.coursesWarning && (
                  <div className="rounded p-3 bg-amber-900/20 border border-amber-700 text-xs text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5 inline shrink-0" /> {azmResult.numCourses} courses — RDM 1.1 requires an azimuth check every 15 courses maximum.
                  </div>
                )}
                <div className={`mt-1 p-3 rounded-lg text-center ${azmResult.passes
                  ? 'bg-emerald-900/20 border border-emerald-700'
                  : 'bg-red-900/20 border border-red-700'}`}>
                  <p className="text-xs text-[var(--text-muted)] mb-1">RDM 1.1 TABLE 5.1 — AZIMUTH CHECK</p>
                  <p className={`font-bold text-sm ${azmResult.passes ? 'text-emerald-400' : 'text-red-400'}`}>
                    {azmResult.misclosurePerStationSec.toFixed(2)}″/station —{' '}
                    {azmResult.passes ? 'ACCEPTABLE ≤ 3.0″' : 'EXCEEDS 3.0″ LIMIT'}
                  </p>
                </div>
              </div>
            </div>
          ) : result ? (
            <div className="card border-dashed opacity-60">
              <div className="card-body text-center py-6">
                <p className="text-xs text-[var(--text-muted)]">Enter initial and closing bearings above to compute angular misclosure</p>
                <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">RDM 1.1 Table 5.1 — ≤ 3.0″ per station required</p>
              </div>
            </div>
          ) : null}

          {/* Table 1 — Traverse Computation */}
          <div className="card">
            <div className="card-header">
              <span className="label">Table 1 — Traverse Computation</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[550px] table">
                <thead>
                  <tr>
                    <th>Line</th>
                    <th>WCB</th>
                    <th className="text-right">HD</th>
                    <th className="text-right">Departure</th>
                    <th className="text-right">Latitude</th>
                  </tr>
                </thead>
                <tbody>
                  {result.legs.map((l: MappedLeg, i: number) => (
                    <tr key={`item-${i}`}>
                      <td className="font-semibold">{l.from} → {l.to}</td>
                      <td className="font-mono">{l.bearingDMS}</td>
                      <td className="text-right font-mono">{l.distance.toFixed(4)}</td>
                      <td className="text-right font-mono">{l.departure >= 0 ? '+' : ''}{l.departure.toFixed(4)}</td>
                      <td className="text-right font-mono">{l.latitude >= 0 ? '+' : ''}{l.latitude.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold bg-[var(--bg-tertiary)]">
                    <td colSpan={3} className="text-right">Σ</td>
                    <td className="text-right font-mono">{result.legs.reduce((s: number, l: MappedLeg) => s + l.departure, 0).toFixed(4)}</td>
                    <td className="text-right font-mono">{result.legs.reduce((s: number, l: MappedLeg) => s + l.latitude,  0).toFixed(4)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Table 2 — Corrections */}
          <div className="card">
            <div className="card-header">
              <span className="label">Table 2 — {method === 'bowditch' ? 'Bowditch' : 'Transit'} Corrections</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[650px] table">
                <thead>
                  <tr>
                    <th>Line</th>
                    <th className="text-right">HD</th>
                    <th className="text-right">C-Dep</th>
                    <th className="text-right">C-Lat</th>
                    <th className="text-right">A-Dep</th>
                    <th className="text-right">A-Lat</th>
                  </tr>
                </thead>
                <tbody>
                  {result.legs.map((l: MappedLeg, i: number) => (
                    <tr key={`item-${i}`}>
                      <td className="font-semibold">{l.from} → {l.to}</td>
                      <td className="text-right font-mono">{l.distance.toFixed(4)}</td>
                      <td className="text-right font-mono">{(l.correctedDeparture - l.departure).toFixed(4)}</td>
                      <td className="text-right font-mono">{(l.correctedLatitude  - l.latitude ).toFixed(4)}</td>
                      <td className="text-right font-mono font-semibold">{l.correctedDeparture.toFixed(4)}</td>
                      <td className="text-right font-mono font-semibold">{l.correctedLatitude.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 3 — Adjusted Coordinates */}
          <div className="card">
            <div className="card-header">
              <span className="label">Table 3 — Adjusted Coordinates</span>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Point</th>
                    <th className="text-right">Easting (m)</th>
                    <th className="text-right">Northing (m)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.legs.map((l: MappedLeg, i: number) => (
                    <tr key={`item-${i}`}>
                      <td className="font-semibold">{l.to}</td>
                      <td className="text-right font-mono font-semibold text-[var(--accent)]">{l.adjEasting.toFixed(4)}</td>
                      <td className="text-right font-mono font-semibold text-[var(--accent)]">{l.adjNorthing.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Print section */}
          <div className="md:col-span-2">
            <div className="card">
              <div className="card-header">
                <span className="label">Print Computation Sheet</span>
              </div>
              <div className="p-4 space-y-4">
                <PrintMetaPanel meta={printMeta} onChange={setPrintMeta} />
                <div className="text-xs text-[var(--text-muted)] space-y-0.5 mb-2">
                  <p>Sheet includes: standard document header · Tables 1–3 · Linear misclosure · Angular misclosure (RDM 1.1 Table 5.1) · Surveyor's Certificate</p>
                </div>
                <button onClick={handlePrint}
                  className="btn btn-primary w-full md:w-auto">
                  Print Traverse Computation Sheet
                </button>
              </div>
            </div>
          </div>

          {/* Solution steps */}
          {steps && (
            <div className="md:col-span-2">
              <SolutionStepsRenderer title={solutionTitle} steps={steps} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ResultRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-[var(--border-color)]">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      <span className={`font-mono ${highlight ? 'result-accent font-bold' : ''}`}>{value}</span>
    </div>
  )
}

import { Suspense } from 'react'
export default function TraverseCalculator() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[var(--text-muted)]">Loading…</div>}>
      <TraverseCalculatorInner />
    </Suspense>
  )
}
