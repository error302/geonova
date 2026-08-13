'use client';

import { useState } from 'react'
import { superelevationDesign, getFrictionFactor, type SuperelevationInput } from '@/lib/computations/roadDesignEngine'

export default function SuperelevationCalculator() {
  const [designSpeed, setDesignSpeed] = useState('80')
  const [radius, setRadius] = useState('300')
  const [numLanes, setNumLanes] = useState('2')
  const [laneWidth, setLaneWidth] = useState('3.65')
  const [result, setResult] = useState<ReturnType<typeof superelevationDesign> | null>(null)

  function compute() {
    const input: SuperelevationInput = {
      designSpeed: parseInt(designSpeed) || 80,
      radius: parseFloat(radius),
      roadClass: 'DR4',
      numLanes: parseInt(numLanes) || 2,
      laneWidth: parseFloat(laneWidth) || 3.65,
    }
    setResult(superelevationDesign(input))
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1" htmlFor="design-speed-km-h">Design Speed (km/h)</label>
          <input id="design-speed-km-h" aria-label="Design Speed (km/h)" value={designSpeed} onChange={e => setDesignSpeed(e.target.value)} type="number" min="30" max="120"
            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1" htmlFor="curve-radius-r-m">Curve Radius R (m)</label>
          <input id="curve-radius-r-m" aria-label="Curve Radius R (m)" value={radius} onChange={e => setRadius(e.target.value)} type="number" min="1"
            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1" htmlFor="number-of-lanes">Number of Lanes</label>
          <input id="number-of-lanes" aria-label="Number of Lanes" value={numLanes} onChange={e => setNumLanes(e.target.value)} type="number" min="1" max="6"
            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1" htmlFor="lane-width-m">Lane Width (m)</label>
          <input id="lane-width-m" aria-label="Lane Width (m)" value={laneWidth} onChange={e => setLaneWidth(e.target.value)} type="number" step="0.01" min="2"
            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
        </div>
        <div>
          <div className="block text-xs text-[var(--text-muted)] mb-1">Friction Factor f</div>
          <div className="px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm font-mono h-[42px] flex items-center">
            {getFrictionFactor(parseInt(designSpeed) || 80).f.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={compute} className="px-5 py-2 bg-[var(--accent)] text-black rounded text-sm font-medium hover:opacity-90">
          Compute Superelevation
        </button>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ['Required e', `${(result.requiredE * 100).toFixed(4)}%`, 'RDM 1.3 §5.3'],
              ['Design e (capped 8%)', `${(result.designE * 100).toFixed(4)}%${result.isCapped ? ' [CAPPED]' : ''}`, 'RDM 1.3 §5.3'],
              ['Transition Length Ls', `${result.transitionLength.toFixed(4)} m`, 'RDM 1.3 §5.3'],
              ['Rate of Change p', `${result.rateOfChange.toFixed(6)} %/m`, 'RDM 1.3 §5.3'],
            ].map(([label, value, source]) => (
              <div key={label} className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded p-3">
                <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
                <p className={`text-lg font-mono ${result.isCapped && label.includes('Design') ? 'text-yellow-400' : 'text-[var(--text-primary)]'}`}>{value}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">{source}</p>
              </div>
            ))}
          </div>

          <details className="text-xs">
            <summary className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium mb-2">Show Computation Steps</summary>
            <div className="space-y-1">
              {result.steps.map((step) => (
                <div key={step.value} className="grid grid-cols-[1fr_auto_1fr_auto] gap-x-2 font-mono py-1 border-b border-[var(--border-color)]/20">
                  <span className="text-[var(--text-secondary)]">{step.description}</span>
                  <span className="text-[var(--text-muted)]">=</span>
                  <span className="text-[var(--text-primary)]">{step.value}</span>
                  <span className="text-[var(--text-muted)] text-right">{step.formula}</span>
                </div>
              ))}
            </div>
          </details>
        </>
      )}
    </div>
  )
}
