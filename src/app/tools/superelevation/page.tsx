'use client';

import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { superelevationDesign, type SuperelevationInput } from '@/lib/computations/roadDesignEngine'

/**
 * AUDIT FIX (2026-07-03): Replaced the simplified inline formula
 * (e = V²/(127R), capped at 10%) with the real
 * roadDesignEngine.superelevationDesign() which uses RDM 1.3:
 *   - e_max = 8% (not 10%)
 *   - e = V²/(127R) - f  (subtracts friction factor)
 *   - Computes transition length Ls = e×w×V/(3.6×p)
 *   - Includes computation steps for transparency
 */

export default function SuperelevationPage() {
  const { t } = useLanguage()
  const [designSpeed, setDesignSpeed] = useState(60)
  const [radius, setRadius] = useState(200)
  const [numLanes, setNumLanes] = useState(2)
  const [laneWidth, setLaneWidth] = useState(3.5)
  const [roadClass, setRoadClass] = useState('DR3')

  const input: SuperelevationInput = {
    designSpeed,
    radius,
    numLanes,
    laneWidth,
    roadClass,
  }

  const result = superelevationDesign(input)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <PageHeader
        title={t('tools.superelevation')}
        subtitle={t('tools.superelevationDesc')}
        reference="RDM 1.3 Section 5.3 | AASHTO Green Book 2018"
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
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white"
                min={20}
                max={120}
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2" htmlFor="curve-radius-m">Curve Radius (m)</label>
              <input id="curve-radius-m" aria-label="Curve Radius (m)"
                type="number"
                value={radius}
                onChange={e => setRadius(Number(e.target.value))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white"
                min={25}
                max={5000}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2" htmlFor="number-of-lanes">Number of Lanes</label>
              <input id="number-of-lanes" aria-label="Number of Lanes"
                type="number"
                value={numLanes}
                onChange={e => setNumLanes(Number(e.target.value))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white"
                min={1}
                max={6}
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2" htmlFor="lane-width-m">Lane Width (m)</label>
              <input  id="lane-width-m" aria-label="Lane Width (m)"
                type="number"
                step="0.1"
                value={laneWidth}
                onChange={e => setLaneWidth(Number(e.target.value))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white"
                min={2.5}
                max={4.0}
              />
            </div>
          </div>

          {/* Results */}
          <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-700">
            <div className="text-sm text-zinc-400 mb-1">Design Superelevation</div>
            <div className="text-3xl font-bold text-amber-400">{(result.designE * 100).toFixed(2)}%</div>              <div className="text-xs text-zinc-400 mt-1">
              Max allowable: 8% per RDM 1.3 (was 10% in old code)
            </div>
            {result.isCapped && (
              <div className="text-xs text-red-400 mt-1">
                ! Required e = {(result.requiredE * 100).toFixed(2)}% exceeds max — capped to 8%
              </div>
            )}
          </div>

          {/* Transition length */}
          <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-700">
            <div className="text-sm text-zinc-400 mb-1">Transition Length (Ls)</div>
            <div className="text-2xl font-bold text-blue-400">{result.transitionLength.toFixed(2)}m</div>              <div className="text-xs text-zinc-400 mt-1">
              Ls = e × w × V / (3.6 × p), where w = {laneWidth}×{numLanes} = {(laneWidth * numLanes).toFixed(1)}m
            </div>
          </div>

          {/* Compliance */}
          <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-700">
            <div className={`text-lg font-medium ${result.isCompliant ? 'text-green-400' : 'text-red-400'}`}>
              {result.isCompliant ? ' Compliant with RDM 1.3' : ' Non-compliant — radius too small for speed'}
            </div>              <div className="text-xs text-zinc-400 mt-1">
              Rate of change p = {(result.rateOfChange * 100).toFixed(2)}%/m (1% per 2.4m per RDM 1.3)
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
        </div>

        {/* Reference table */}
        <div className="border border-zinc-700 rounded-lg p-4">
          <h3 className="font-medium text-white mb-4">Minimum Radius (RDM 1.3)</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-400 border-b border-zinc-700">
                <th className="text-left py-2">Speed (km/h)</th>
                <th className="text-right py-2">Min Radius (m)</th>
                <th className="text-right py-2">Max e (%)</th>
              </tr>
            </thead>
            <tbody>
              {[
                [30, 30, 8], [40, 60, 8], [50, 100, 8], [60, 150, 8],
                [70, 230, 8], [80, 320, 8], [90, 430, 8], [100, 560, 8],
              ].map(([speed, r, e]) => (
                <tr key={speed} className={`border-b border-zinc-800 ${speed === designSpeed ? 'bg-amber-900/20' : ''}`}>
                  <td className="py-2 text-zinc-400">{speed}</td>
                  <td className="py-2 text-right text-white">{r}</td>
                  <td className="py-2 text-right text-zinc-500">{e}</td>
                </tr>
              ))}
            </tbody>
          </table>            <p className="text-xs text-zinc-400 mt-3">
            Highlighted row matches current design speed. R = {radius}m
            {radius < 150 ? ' (below minimum for most speeds — increase radius)' : ' is adequate for current speed.'}
          </p>
        </div>
      </div>
    </div>
  )
}
