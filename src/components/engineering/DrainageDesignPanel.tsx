'use client';

import React, { useState, useCallback } from 'react'
import { AlertTriangle } from 'lucide-react'
import { manningPipeCapacity, rationalMethodCatchment, manningChannelCapacity, sizePipe, MANNING_N, RUNOFF_COEFFICIENTS, STANDARD_PIPE_SIZES } from '@/lib/engineering/drainageDesign'

type Tab = 'pipe' | 'catchment' | 'channel'

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/** Returns formatted number or "—" when value is NaN / Infinity / negative-where-invalid */
function safeNum(value: number, decimals: number = 4): string {
  if (value === null || value === undefined || !Number.isFinite(value) || Number.isNaN(value)) return '—'
  return value.toFixed(decimals)
}

/** Returns a boolean — true when value is usable for display */
function isValid(v: number): boolean {
  return Number.isFinite(v) && !Number.isNaN(v)
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── INLINE ERROR COMPONENT ───────────────────────────────────────────────────

function FieldError({ message }: { message: string | undefined }) {
  if (!message) return null
  return <p className="text-xs text-red-400 mt-1">{message}</p>
}

// ─── SHARED INPUT CLASSES ─────────────────────────────────────────────────────

const inputCls = 'w-full border border-zinc-700 rounded-lg px-3 py-2 text-sm bg-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const selectCls = 'w-full border border-zinc-700 rounded-lg px-3 py-2 text-sm bg-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

// ─── MAIN PANEL ───────────────────────────────────────────────────────────────

export default function DrainageDesignPanel({ roadLength: _roadLength = 1000 }: { roadLength?: number }) {
  const [tab, setTab] = useState<Tab>('pipe')

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6">
        <h3 className="text-lg font-semibold text-white">Drainage Design</h3>
        <p className="text-sm text-zinc-400 mt-1">Manning&apos;s equation, Rational Method, pipe &amp; channel sizing — RDM 1.3</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-800 rounded-lg p-1">
        {([['pipe', 'Pipe Sizing'], ['catchment', 'Catchment'], ['channel', 'Channel']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${tab === k ? 'bg-zinc-700 shadow text-white' : 'text-zinc-400 hover:text-white'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'pipe' && <PipeSizingTab />}
      {tab === 'catchment' && <CatchmentTab />}
      {tab === 'channel' && <ChannelTab />}
    </div>
  )
}

// ─── PIPE SIZING TAB ──────────────────────────────────────────────────────────

function PipeSizingTab() {
  const [peakFlow, setPeakFlow] = useState(0.5)
  const [slope, setSlope] = useState(0.5)
  const [material, setMaterial] = useState('Concrete pipe')
  const [customDiameter, setCustomDiameter] = useState(300)
  const [showResult, setShowResult] = useState(false)

  const manningN = MANNING_N[material] || 0.013
  const slopeDecimal = slope / 100

  // ── Validation ──
  const errors = {
    peakFlow: peakFlow <= 0 ? 'Peak flow must be > 0' : undefined,
    slope: slope <= 0 ? 'Slope must be > 0' : undefined,
  }

  const hasAnyError = Object.values(errors).some(Boolean)

  // ── Computed results (NaN-safe) ──
  const sizing = peakFlow > 0 && slopeDecimal > 0 ? sizePipe(peakFlow, manningN, slopeDecimal) : null
  const customResult = customDiameter > 0 && slopeDecimal > 0
    ? manningPipeCapacity({ diameter: customDiameter, manningN, slope: slopeDecimal })
    : null
  const minSlopeForCustom = (manningN && customDiameter > 0)
    ? Math.pow(0.6 * manningN / Math.pow((customDiameter / 1000) / 4, 2 / 3), 2) * 100
    : NaN

  const hasWarning = slope <= 0 || peakFlow <= 0 || customDiameter <= 0

  // ── CSV Export ──
  const handleExport = useCallback(() => {
    const rows: string[][] = [
      ['Drainage Design — Pipe Sizing Summary'],
      [],
      ['Parameter', 'Value'],
      ['Peak Flow (m³/s)', String(peakFlow)],
      ['Slope (%)', String(slope)],
      ['Slope (m/m)', String(slopeDecimal)],
      ['Material', material],
      ["Manning's n", String(manningN)],
      ['Custom Diameter (mm)', String(customDiameter)],
      [],
      ['Result', 'Value'],
      ['Full Bore Capacity (m³/s)', customResult ? String(customResult.fullBoreCapacity) : '—'],
      ['Full Bore Velocity (m/s)', customResult ? String(customResult.fullBoreVelocity) : '—'],
      ['Self-Cleansing', customResult ? String(customResult.isSelfCleansing) : '—'],
      ['Velocity Acceptable', customResult ? String(customResult.isVelocityAcceptable) : '—'],
      ['Min Slope for Self-Cleansing (%)', isValid(minSlopeForCustom) ? String(minSlopeForCustom) : '—'],
    ]
    if (sizing) {
      rows.push([], ['Recommended Pipe', 'Value'])
      rows.push(['Diameter (mm)', String(sizing.diameter)])
      rows.push(['Capacity (m³/s)', String(sizing.capacity)])
      rows.push(['Velocity (m/s)', String(sizing.velocity)])
    }
    downloadCsv('drainage_pipe_sizing.csv', rows)
  }, [peakFlow, slope, slopeDecimal, material, manningN, customDiameter, customResult, minSlopeForCustom, sizing])

  return (
    <div className="space-y-6">
      {/* Warning banner */}
      {hasWarning && (
        <div className="bg-amber-950/50 border border-amber-700 rounded-lg p-3 text-sm text-amber-300">
          <AlertTriangle className="w-3.5 h-3.5 inline shrink-0" /> Invalid inputs detected — computed results may be unavailable. Fix highlighted fields below.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Inputs */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6 space-y-4">
          <h4 className="font-medium text-white">Pipe Sizing</h4>
          <div>
            <label className="block text-xs text-zinc-400 mb-1" htmlFor="peak-flow-m-s">Peak Flow (m³/s)</label>
            <input id="peak-flow-m-s" aria-label="Peak Flow (m³/s)" type="number" step="0.01" className={`${inputCls} ${errors.peakFlow ? 'border-red-500' : ''}`}
              value={peakFlow} onChange={e => { setPeakFlow(parseFloat(e.target.value) || 0); setShowResult(false) }} />
            <FieldError message={errors.peakFlow} />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1" htmlFor="pipe-slope">Pipe Slope (%)</label>
            <input id="pipe-slope" aria-label="Pipe Slope (%)" type="number" step="0.1" className={`${inputCls} ${errors.slope ? 'border-red-500' : ''}`}
              value={slope} onChange={e => { setSlope(parseFloat(e.target.value) || 0); setShowResult(false) }} />
            <FieldError message={errors.slope} />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Material (Manning&apos;s n = {manningN})</label>
            <select className={selectCls}
              value={material} onChange={e => setMaterial(e.target.value)}>
              {Object.entries(MANNING_N).map(([name, n]) => (
                <option key={name} value={name}>{name} (n={n})</option>
              ))}
            </select>
          </div>
          <button onClick={() => setShowResult(true)}
            disabled={hasAnyError}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
            Size Pipe
          </button>
        </div>

        {/* Right: Custom Pipe Check */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-white">Custom Pipe Check</h4>
            <button onClick={handleExport}
              className="text-xs px-3 py-1.5 border border-zinc-600 rounded-md text-zinc-300 hover:text-white hover:border-zinc-400 transition-colors">
              ↓ Download CSV
            </button>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1" htmlFor="diameter-mm">Diameter (mm)</label>
            <select id="diameter-mm" className={selectCls}
              value={customDiameter} onChange={e => setCustomDiameter(parseInt(e.target.value))}>
              {STANDARD_PIPE_SIZES.map(d => <option key={d} value={d}>{d} mm</option>)}
            </select>
          </div>
          {customResult ? (
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Full Bore Capacity</span>
                <span className="font-mono font-medium text-white">{safeNum(customResult.fullBoreCapacity)} m³/s</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Full Bore Velocity</span>
                <span className={`font-mono font-medium ${customResult.isSelfCleansing ? 'text-emerald-400' : 'text-red-400'}`}>
                  {safeNum(customResult.fullBoreVelocity, 2)} m/s
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Self-Cleansing (≥0.6 m/s)</span>
                <span className={customResult.isSelfCleansing ? 'text-emerald-400' : 'text-red-400'}>
                  {customResult.isSelfCleansing ? 'YES' : 'NO'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Velocity Acceptable</span>
                <span className={customResult.isVelocityAcceptable ? 'text-emerald-400' : 'text-amber-400'}>
                  {customResult.isVelocityAcceptable ? 'YES' : 'NO (check lining)'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Min Slope for Self-Cleansing</span>
                <span className="font-mono">{safeNum(minSlopeForCustom, 2)}%</span>
              </div>
            </div>
          ) : (
            <div className="pt-2 text-sm text-zinc-500">Enter valid slope and diameter to see results.</div>
          )}
        </div>
      </div>

      {/* Sizing result */}
      {showResult && sizing && (
        <div className={`rounded-xl border-2 p-6 border-emerald-500 bg-emerald-950/30`}>
          <h4 className="font-medium text-white mb-3">Recommended Pipe Size</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-zinc-400">Diameter</div>
              <div className="text-xl font-bold text-white">{sizing.diameter} mm</div>
            </div>
            <div>
              <div className="text-xs text-zinc-400">Capacity</div>
              <div className="text-xl font-bold text-white">{safeNum(sizing.capacity)} m³/s</div>
            </div>
            <div>
              <div className="text-xs text-zinc-400">Velocity</div>
              <div className="text-xl font-bold text-white">{safeNum(sizing.velocity, 2)} m/s</div>
            </div>
          </div>
        </div>
      )}

      {/* No sizing result warning */}
      {showResult && !sizing && (
        <div className="rounded-xl border-2 p-6 border-amber-500 bg-amber-950/30">
          <h4 className="font-medium text-amber-300 mb-2">No Suitable Standard Size Found</h4>
          <p className="text-sm text-zinc-400">No standard pipe size meets both the capacity and self-cleansing requirements. Try increasing slope or using a non-standard diameter.</p>
        </div>
      )}
    </div>
  )
}

// ─── CATCHMENT TAB ────────────────────────────────────────────────────────────

function CatchmentTab() {
  const [area, setArea] = useState(10)
  const [landUse, setLandUse] = useState('Grass/Park')
  const [intensity, setIntensity] = useState(50)

  const C = RUNOFF_COEFFICIENTS[landUse]?.typical || 0.15

  // ── Validation ──
  const errors = {
    area: area <= 0 ? 'Catchment area must be > 0' : undefined,
    intensity: intensity <= 0 ? 'Rainfall intensity must be > 0' : undefined,
  }

  // ── Computed (NaN-safe) ──
  const result = area > 0 && intensity > 0
    ? rationalMethodCatchment({ area, runoffCoefficient: C, rainfallIntensity: intensity, timeOfConcentration: 10 })
    : null

  const hasWarning = area <= 0 || intensity <= 0

  // ── CSV Export ──
  const handleExport = useCallback(() => {
    const rows: string[][] = [
      ['Drainage Design — Catchment Analysis Summary'],
      [],
      ['Parameter', 'Value'],
      ['Catchment Area (ha)', String(area)],
      ['Land Use', landUse],
      ['Runoff Coefficient (C)', String(C)],
      ['Rainfall Intensity (mm/hr)', String(intensity)],
      ['Time of Concentration (min)', '10'],
      [],
      ['Result', 'Value'],
      ['Peak Flow (m³/s)', result ? String(result.peakFlow) : '—'],
      ['Effective Area (ha)', result ? String(result.effectiveArea) : '—'],
      ['Return Period', result ? result.returnPeriod : '—'],
    ]
    downloadCsv('drainage_catchment.csv', rows)
  }, [area, landUse, C, intensity, result])

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6 space-y-6">
      {/* Warning banner */}
      {hasWarning && (
        <div className="bg-amber-950/50 border border-amber-700 rounded-lg p-3 text-sm text-amber-300">
          <AlertTriangle className="w-3.5 h-3.5 inline shrink-0" /> Invalid inputs detected — computed results may be unavailable. Fix highlighted fields below.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Inputs */}
        <div className="space-y-4">
          <h4 className="font-medium text-white">Catchment Analysis (Rational Method)</h4>
          <div>
            <label className="block text-xs text-zinc-400 mb-1" htmlFor="catchment-area-hectares">Catchment Area (hectares)</label>
            <input id="catchment-area-hectares" aria-label="Catchment Area (hectares)" type="number" step="0.1" className={`${inputCls} ${errors.area ? 'border-red-500' : ''}`}
              value={area} onChange={e => setArea(parseFloat(e.target.value) || 0)} />
            <FieldError message={errors.area} />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Land Use (C = {C})</label>
            <select className={selectCls} value={landUse} onChange={e => setLandUse(e.target.value)}>
              {Object.entries(RUNOFF_COEFFICIENTS).map(([name, val]) => (
                <option key={name} value={name}>{name} (C: {val.min}–{val.max}, typical {val.typical})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1" htmlFor="rainfall-intensity-mm-hr">Rainfall Intensity (mm/hr)</label>
            <input id="rainfall-intensity-mm-hr" aria-label="Rainfall Intensity (mm/hr)" type="number" step="1" className={`${inputCls} ${errors.intensity ? 'border-red-500' : ''}`}
              value={intensity} onChange={e => setIntensity(parseFloat(e.target.value) || 0)} />
            <FieldError message={errors.intensity} />
          </div>
        </div>

        {/* Right: Results */}
        <div className="bg-zinc-800 rounded-xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-white">Results</h4>
            <button onClick={handleExport}
              className="text-xs px-3 py-1.5 border border-zinc-600 rounded-md text-zinc-300 hover:text-white hover:border-zinc-400 transition-colors">
              ↓ Download CSV
            </button>
          </div>
          {result ? (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Peak Flow (Q = CIA/360)</span>
                <span className="font-mono font-bold text-blue-400">{safeNum(result.peakFlow)} m³/s</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Catchment Area</span>
                <span className="font-mono text-white">{result.catchmentArea} ha</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Effective Area (C × A)</span>
                <span className="font-mono text-white">{safeNum(result.effectiveArea, 2)} ha</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Recommended Return Period</span>
                <span className="font-medium text-white">{result.returnPeriod}</span>
              </div>
              <div className="mt-4 p-3 bg-zinc-900 rounded-lg border border-zinc-700 text-xs text-zinc-400">
                <strong className="text-white">Formula:</strong> Q = (C × I × A) / 360 = ({C} × {intensity} × {area}) / 360 = {safeNum(result.peakFlow)} m³/s
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-500">Enter valid area and intensity to see results.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── CHANNEL TAB ─────────────────────────────────────────────────────────────

function ChannelTab() {
  const [bedWidth, setBedWidth] = useState(1.0)
  const [sideSlope, setSideSlope] = useState(1.5)
  const [manningN, setManningN] = useState(0.015)
  const [slope, setSlope] = useState(0.5)
  const [flowDepth, setFlowDepth] = useState(0.5)

  const slopeDecimal = slope / 100

  // ── Validation ──
  const errors = {
    bedWidth: bedWidth <= 0 ? 'Bed width must be > 0' : undefined,
    slope: slope <= 0 ? 'Slope must be > 0' : undefined,
    manningN: manningN <= 0 ? "Manning's n must be > 0" : undefined,
    flowDepth: flowDepth <= 0 ? 'Flow depth must be > 0' : undefined,
  }

  const hasAnyError = Object.values(errors).some(Boolean)
  const hasWarning = hasAnyError

  // ── Computed (NaN-safe) ──
  const allValid = bedWidth > 0 && slopeDecimal > 0 && manningN > 0 && flowDepth > 0 && sideSlope > 0
  const result = allValid
    ? manningChannelCapacity({ bedWidth, sideSlope, manningN, slope: slopeDecimal, flowDepth })
    : null

  // ── CSV Export ──
  const handleExport = useCallback(() => {
    const rows: string[][] = [
      ['Drainage Design — Trapezoidal Channel Summary'],
      [],
      ['Parameter', 'Value'],
      ['Bed Width (m)', String(bedWidth)],
      ['Side Slope (H:V)', String(sideSlope)],
      ["Manning's n", String(manningN)],
      ['Slope (%)', String(slope)],
      ['Slope (m/m)', String(slopeDecimal)],
      ['Flow Depth (m)', String(flowDepth)],
      [],
      ['Result', 'Value'],
      ['Flow Area (m²)', result ? String(result.flowArea) : '—'],
      ['Wetted Perimeter (m)', result ? String(result.wettedPerimeter) : '—'],
      ['Hydraulic Radius (m)', result ? String(result.hydraulicRadius) : '—'],
      ['Velocity (m/s)', result ? String(result.velocity) : '—'],
      ['Discharge (m³/s)', result ? String(result.discharge) : '—'],
      ['Top Width (m)', result ? String(result.topWidth) : '—'],
      ['Self-Cleansing', result ? String(result.isSelfCleansing) : '—'],
    ]
    downloadCsv('drainage_channel.csv', rows)
  }, [bedWidth, sideSlope, manningN, slope, slopeDecimal, flowDepth, result])

  return (
    <div className="space-y-6">
      {/* Warning banner */}
      {hasWarning && (
        <div className="bg-amber-950/50 border border-amber-700 rounded-lg p-3 text-sm text-amber-300">
          <AlertTriangle className="w-3.5 h-3.5 inline shrink-0" /> Invalid inputs detected — computed results may be unavailable. Fix highlighted fields below.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Inputs */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6 space-y-4">
          <h4 className="font-medium text-white">Trapezoidal Channel Design</h4>
          <div>
            <label className="block text-xs text-zinc-400 mb-1" htmlFor="bed-width-m">Bed Width (m)</label>
            <input id="bed-width-m" aria-label="Bed Width (m)" type="number" step="0.1" className={`${inputCls} ${errors.bedWidth ? 'border-red-500' : ''}`}
              value={bedWidth} onChange={e => setBedWidth(parseFloat(e.target.value) || 0)} />
            <FieldError message={errors.bedWidth} />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1" htmlFor="side-slope-h-v">Side Slope (H:V)</label>
            <input id="side-slope-h-v" aria-label="Side Slope (H:V)" type="number" step="0.1" className={inputCls}
              value={sideSlope} onChange={e => setSideSlope(parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1" htmlFor="manning-apos-s-n">Manning&apos;s n</label>
            <input id="manning-apos-s-n" aria-label="Mannings n" type="number" step="0.001" className={`${inputCls} ${errors.manningN ? 'border-red-500' : ''}`}
              value={manningN} onChange={e => setManningN(parseFloat(e.target.value) || 0)} />
            <FieldError message={errors.manningN} />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1" htmlFor="slope">Slope (%)</label>
            <input id="slope" aria-label="Slope (%)" type="number" step="0.1" className={`${inputCls} ${errors.slope ? 'border-red-500' : ''}`}
              value={slope} onChange={e => setSlope(parseFloat(e.target.value) || 0)} />
            <FieldError message={errors.slope} />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1" htmlFor="flow-depth-m">Flow Depth (m)</label>
            <input  id="flow-depth-m" aria-label="Flow Depth (m)" type="number" step="0.1" className={`${inputCls} ${errors.flowDepth ? 'border-red-500' : ''}`}
              value={flowDepth} onChange={e => setFlowDepth(parseFloat(e.target.value) || 0)} />
            <FieldError message={errors.flowDepth} />
          </div>
        </div>

        {/* Right: Cross-section SVG + Results */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-white">Channel Cross-Section</h4>
            <button onClick={handleExport}
              className="text-xs px-3 py-1.5 border border-zinc-600 rounded-md text-zinc-300 hover:text-white hover:border-zinc-400 transition-colors">
              ↓ Download CSV
            </button>
          </div>
          <ChannelCrossSectionSvg bedWidth={bedWidth} sideSlope={sideSlope} flowDepth={flowDepth} />
          <div className="mt-4 space-y-2">
            {result ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Flow Area</span>
                  <span className="font-mono text-white">{safeNum(result.flowArea)} m²</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Wetted Perimeter</span>
                  <span className="font-mono text-white">{safeNum(result.wettedPerimeter)} m</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Hydraulic Radius</span>
                  <span className="font-mono text-white">{safeNum(result.hydraulicRadius)} m</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Velocity</span>
                  <span className={`font-mono font-bold ${result.isSelfCleansing ? 'text-emerald-400' : 'text-red-400'}`}>
                    {safeNum(result.velocity, 3)} m/s
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Discharge</span>
                  <span className="font-mono font-bold text-blue-400">{safeNum(result.discharge)} m³/s</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Top Width</span>
                  <span className="font-mono text-white">{safeNum(result.topWidth, 2)} m</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-zinc-500">Enter valid inputs to see computed results.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── CHANNEL CROSS-SECTION SVG ────────────────────────────────────────────────

function ChannelCrossSectionSvg({ bedWidth, sideSlope, flowDepth }: { bedWidth: number; sideSlope: number; flowDepth: number }) {
  const svgW = 350
  const svgH = 200
  const scale = 40 // px per metre
  const cx = svgW / 2
  const groundY = 40
  const channelBottom = groundY + 80

  const bw = Math.max(0, bedWidth) * scale
  const z = Math.max(0, sideSlope)
  const fd = Math.max(0, flowDepth) * scale
  const y = fd

  const leftToeX = cx - bw / 2 - z * y
  const rightToeX = cx + bw / 2 + z * y
  const waterY = channelBottom - y
  const leftWaterX = cx - bw / 2 - z * y
  const rightWaterX = cx + bw / 2 + z * y

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full rounded-lg">
      {/* Ground */}
      <rect x={0} y={groundY} width={svgW} height={svgH - groundY} fill="#27272a" />
      {/* Channel excavation */}
      <polygon points={`${leftToeX},${channelBottom} ${cx - bw / 2},${channelBottom} ${cx + bw / 2},${channelBottom} ${rightToeX},${channelBottom}`} fill="#3f3f46" />
      {/* Channel sides */}
      <line x1={leftToeX} y1={groundY} x2={cx - bw / 2} y2={channelBottom} stroke="#71717a" strokeWidth={2} />
      <line x1={rightToeX} y1={groundY} x2={cx + bw / 2} y2={channelBottom} stroke="#71717a" strokeWidth={2} />
      <line x1={cx - bw / 2} y1={channelBottom} x2={cx + bw / 2} y2={channelBottom} stroke="#71717a" strokeWidth={2} />
      {/* Water */}
      <polygon
        points={`${leftWaterX},${channelBottom} ${cx - bw / 2},${channelBottom} ${cx + bw / 2},${channelBottom} ${rightWaterX},${channelBottom} ${rightWaterX},${waterY} ${cx + bw / 2},${waterY} ${cx - bw / 2},${waterY} ${leftWaterX},${waterY}`}
        fill="rgba(59,130,246,0.2)" stroke="#3b82f6" strokeWidth={1}
      />
      {/* Flow depth arrow */}
      <line x1={cx + bw / 2 + 15} y1={channelBottom} x2={cx + bw / 2 + 15} y2={waterY} stroke="#60a5fa" strokeWidth={1.5} markerEnd="url(#arrowUp)" />
      <text x={cx + bw / 2 + 25} y={(channelBottom + waterY) / 2 + 4} fill="#60a5fa" fontSize="10">{flowDepth.toFixed(2)}m</text>
      {/* Bed width */}
      <text x={cx} y={channelBottom + 15} textAnchor="middle" fill="#a1a1aa" fontSize="10">{bedWidth.toFixed(1)}m</text>
      <defs>
        <marker id="arrowUp" viewBox="0 0 10 10" refX="5" refY="10" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 10 L 5 0 L 10 10" fill="none" stroke="#60a5fa" strokeWidth="1.5" />
        </marker>
      </defs>
    </svg>
  )
}
