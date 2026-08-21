'use client';

import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { sightDistanceCheck, SSD_TABLE, type SightDistanceInput } from '@/lib/computations/roadDesignEngine'

/**
 * AUDIT FIX (2026-07-03): Replaced the simplified inline formula
 * (ssd = designSpeed * 0.7 * 3, osd = ssd * 3.5) with the real
 * roadDesignEngine.sightDistanceCheck() which uses the RDM 1.3
 * formula: SSD = V²/(254(f+g)) + V×t/3.6 with proper friction
 * factors, gradient correction, and terrain-based minimums.
 *
 * AUDIT FIX (2026-07-05): Added an explicit "Compute" button. Previously
 * the result auto-updated on every keystroke, which made users think
 * nothing was happening. Now the result only updates when the user
 * clicks Compute (or presses Enter).
 */

export default function SightDistancePage() {
  const { t } = useLanguage()
  // Input state
  const [designSpeed, setDesignSpeed] = useState(60)
  const [terrain, setTerrain] = useState<'flat' | 'rolling' | 'mountainous'>('rolling')
  const [gradient, setGradient] = useState(0)
  const [curveRadius, setCurveRadius] = useState(150)
  // Computed result (only updates when the user clicks Compute)
  const [computed, setComputed] = useState<{
    designSpeed: number
    terrain: 'flat' | 'rolling' | 'mountainous'
    gradient: number
    curveRadius: number
  } | null>(null)

  const compute = () => {
    setComputed({ designSpeed, terrain, gradient, curveRadius })
  }

  const input: SightDistanceInput = {
    designSpeed: computed?.designSpeed ?? designSpeed,
    roadClass: 'highway',
    terrain: computed?.terrain ?? terrain,
    gradient: computed?.gradient ?? gradient,
  }

  const result = sightDistanceCheck(input)

  // Check if curve radius provides adequate sight distance
  const effectiveCurveRadius = computed?.curveRadius ?? curveRadius
  const curveAdequate = effectiveCurveRadius >= result.ssdComputed

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <PageHeader
        title={t('tools.sightDistance')}
        subtitle={t('tools.sightDistanceDesc')}
        reference="RDM 1.3 Section 3.3 | AASHTO Green Book 2018"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2" htmlFor="design-speed-km-h">Design Speed (km/h)</label>
              <input id="design-speed-km-h" aria-label="Design Speed (km/h)"
                type="number"
                value={designSpeed}
                onChange={e => setDesignSpeed(Number(e.target.value))}
                onKeyDown={e => { if (e.key === 'Enter') compute() }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white"
                min={20}
                max={120}
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2" htmlFor="gradient">Gradient (%)</label>
              <input id="gradient" aria-label="Gradient (%)"
                type="number"
                value={gradient}
                onChange={e => setGradient(Number(e.target.value))}
                onKeyDown={e => { if (e.key === 'Enter') compute() }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white"
                step="0.5"
                min="-15"
                max="15"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2" htmlFor="terrain">Terrain</label>
            <select id="terrain"
              value={terrain}
              onChange={e => setTerrain(e.target.value as 'flat' | 'rolling' | 'mountainous')}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white"
            >
              <option value="flat">Flat</option>
              <option value="rolling">Rolling</option>
              <option value="mountainous">Mountainous</option>
            </select>
          </div>

          {/* Curve radius input (used in the curve check) */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2" htmlFor="curve-radius-m-for-curve-sight-check">Curve Radius (m) — for curve sight check</label>
            <input  id="curve-radius-m-for-curve-sight-check" aria-label="Curve Radius (m)"
              type="number"
              value={curveRadius}
              onChange={e => setCurveRadius(Number(e.target.value))}
              onKeyDown={e => { if (e.key === 'Enter') compute() }}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white"
              min={30}
              max={5000}
            />
          </div>

          {/* AUDIT FIX (2026-07-05): Explicit Compute button */}
          <button
            onClick={compute}
            className="w-full py-3 bg-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_90%,transparent)] text-black font-semibold rounded-lg transition-colors"
          >
            Compute Sight Distance
          </button>

          {/* Computed results — only shown after clicking Compute */}
          {computed && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-700">
                  <div className="text-sm text-zinc-400 mb-1">Stopping Sight Distance</div>
                  <div className="text-2xl font-bold text-amber-400">{result.ssdComputed.toFixed(1)}m</div>
                  <div className="text-xs text-zinc-500 mt-1">
                    SSD = V²/254(f+g) + Vt/3.6
                  </div>
                  <div className="text-xs text-zinc-600 mt-0.5">
                    f={result.frictionFactor.toFixed(4)}, g={computed.gradient}%, t=2.5s
                  </div>
                  {Math.abs(result.ssdGradeCorrection) > 0.1 && (
                    <div className="text-xs text-blue-400 mt-0.5">
                      Grade correction: +{result.ssdGradeCorrection.toFixed(1)}m
                    </div>
                  )}
                </div>

                <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-700">
                  <div className="text-sm text-zinc-400 mb-1">Min SSD (RDM 1.3)</div>
                  <div className="text-2xl font-bold text-green-400">{result.ssdMin}m</div>
                  <div className="text-xs text-zinc-500 mt-1">
                    Terrain: {computed.terrain}
                  </div>
                  <div className={`text-xs mt-1 ${result.isSSDCompliant ? 'text-green-400' : 'text-red-400'}`}>
                    {result.isSSDCompliant ? ' Compliant' : ' Below minimum'}
                  </div>
                </div>
              </div>

              {/* Curve radius check */}
              <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-700">
                <div className="text-sm text-zinc-400 mb-2">Curve Radius Sight Check</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="zinc-500">Required (≥ SSD):</span>
                    <span className="text-white">{result.ssdComputed.toFixed(0)}m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="zinc-500">Provided radius:</span>
                    <span className="text-white">{effectiveCurveRadius}m</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className="zinc-500">Status:</span>
                    <span className={curveAdequate ? 'text-green-400' : 'text-red-400'}>
                      {curveAdequate ? ' Adequate' : ` Needs ≥ ${result.ssdComputed.toFixed(0)}m`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Computation steps */}
              {result.steps.length > 0 && (
                <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-700">
                  <h3 className="text-sm font-semibold text-white mb-3">Computation Steps</h3>
                  <div className="space-y-2">
                    {result.steps.map((step, i) => (
                      <div key={i} className="text-xs">
                        <div className="text-zinc-400">{step.description}</div>
                        <div className="text-zinc-400 font-mono">{step.formula}</div>
                        <div className="text-white font-mono">→ {step.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Empty state before first compute */}
          {!computed && (
            <div className="p-6 bg-zinc-900 rounded-lg border border-zinc-700 text-center text-sm text-zinc-400">
              Click <span className="text-[var(--accent)] font-semibold">Compute Sight Distance</span> to calculate stopping sight distance, RDM 1.3 compliance, and curve radius adequacy.
            </div>
          )}
        </div>

        {/* Reference table */}
        <div className="border border-zinc-700 rounded-lg p-4">
          <h3 className="font-medium text-white mb-4">Minimum SSD (RDM 1.3 Table 3-5)</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-400 border-b border-zinc-700">
                <th className="text-left py-2">Speed (km/h)</th>
                <th className="text-right py-2">Flat (m)</th>
                <th className="text-right py-2">Rolling (m)</th>
                <th className="text-right py-2">Mountainous (m)</th>
              </tr>
            </thead>
            <tbody>
              {SSD_TABLE.map(row => (
                <tr key={row.speed} className={`border-b border-zinc-800 ${row.speed === designSpeed ? 'bg-amber-900/20' : ''}`}>
                  <td className="py-2 text-zinc-400">{row.speed}</td>
                  <td className="py-2 text-right text-white">{row.flat}</td>
                  <td className="py-2 text-right text-white">{row.rolling}</td>
                  <td className="py-2 text-right text-white">{row.mountainous}</td>
                </tr>
              ))}
            </tbody>
          </table>            <p className="text-xs text-zinc-400 mt-3">Highlighted row matches the current design speed. Values are minimum required SSD per RDM 1.3 — computed SSD must exceed these.
          </p>
        </div>
      </div>
    </div>
  )
}
