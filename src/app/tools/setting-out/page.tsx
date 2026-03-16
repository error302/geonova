'use client'

import { useState } from 'react'

import SolutionStepsRenderer from '@/components/SolutionStepsRenderer'
import type { SolutionStep } from '@/lib/engine/solution/solutionBuilder'
import { pegFromStationSolved, bearingDistanceSolved } from '@/lib/engine/solution/wrappers/settingOut'

export default function SettingOutCalculator() {
  const [mode, setMode] = useState<'coords' | 'bearing'>('coords')

  const [station, setStation] = useState({ e: '', n: '' })
  const [bearing, setBearing] = useState({ d: '', m: '', s: '' })
  const [distance, setDistance] = useState('')
  const [target, setTarget] = useState({ e: '', n: '' })

  const [steps, setSteps] = useState<SolutionStep[] | null>(null)
  const [solutionTitle, setSolutionTitle] = useState<string | undefined>(undefined)

  const calculatePegCoords = () => {
    const e1 = parseFloat(station.e)
    const n1 = parseFloat(station.n)
    const d = parseFloat(distance)
    const bd = parseInt(bearing.d) || 0
    const bm = parseInt(bearing.m) || 0
    const bs = parseFloat(bearing.s) || 0
    if (!Number.isFinite(e1) || !Number.isFinite(n1) || !Number.isFinite(d)) return

    const s = pegFromStationSolved({ stationE: e1, stationN: n1, bearingD: bd, bearingM: bm, bearingS: bs, distance: d })
    setSteps(s.steps)
    setSolutionTitle(s.solution.title)
  }

  const calculateBearingDistance = () => {
    const e1 = parseFloat(station.e)
    const n1 = parseFloat(station.n)
    const e2 = parseFloat(target.e)
    const n2 = parseFloat(target.n)
    if (!Number.isFinite(e1) || !Number.isFinite(n1) || !Number.isFinite(e2) || !Number.isFinite(n2)) return

    const s = bearingDistanceSolved({ stationE: e1, stationN: n1, targetE: e2, targetN: n2 })
    setSteps(s.steps)
    setSolutionTitle(s.solution.title)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Setting Out (Stakeout)</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Blueprint format: Given → To Find → Solution → Check → Result</p>

      <div className="flex gap-4 mb-6 flex-wrap">
        <button onClick={() => { setMode('coords'); setSteps(null); setSolutionTitle(undefined) }} className={`btn ${mode === 'coords' ? 'btn-primary' : 'btn-secondary'}`}>
          Station + Bearing → Peg
        </button>
        <button onClick={() => { setMode('bearing'); setSteps(null); setSolutionTitle(undefined) }} className={`btn ${mode === 'bearing' ? 'btn-primary' : 'btn-secondary'}`}>
          Station → Target
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {mode === 'coords' ? (
          <div className="card">
            <div className="card-header">
              <span className="label">Station & Direction</span>
            </div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Station Easting (m)</label>
                  <input className="input" value={station.e} onChange={(e) => setStation({ ...station, e: e.target.value })} placeholder="500000.0000" />
                </div>
                <div>
                  <label className="label">Station Northing (m)</label>
                  <input className="input" value={station.n} onChange={(e) => setStation({ ...station, n: e.target.value })} placeholder="9500000.0000" />
                </div>
              </div>

              <div>
                <label className="label">Bearing (WCB) — DMS</label>
                <div className="grid grid-cols-3 gap-2">
                  <input className="input font-mono" value={bearing.d} onChange={(e) => setBearing({ ...bearing, d: e.target.value })} placeholder="082" />
                  <input className="input font-mono" value={bearing.m} onChange={(e) => setBearing({ ...bearing, m: e.target.value })} placeholder="12" />
                  <input className="input font-mono" value={bearing.s} onChange={(e) => setBearing({ ...bearing, s: e.target.value })} placeholder="00.000" />
                </div>
              </div>

              <div>
                <label className="label">Distance (m)</label>
                <input className="input font-mono" inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="100.000" />
              </div>

              <button onClick={calculatePegCoords} className="btn btn-primary w-full">Compute</button>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-header">
              <span className="label">Station → Target</span>
            </div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Station Easting (m)</label>
                  <input className="input" value={station.e} onChange={(e) => setStation({ ...station, e: e.target.value })} placeholder="500000.0000" />
                </div>
                <div>
                  <label className="label">Station Northing (m)</label>
                  <input className="input" value={station.n} onChange={(e) => setStation({ ...station, n: e.target.value })} placeholder="9500000.0000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Target Easting (m)</label>
                  <input className="input" value={target.e} onChange={(e) => setTarget({ ...target, e: e.target.value })} placeholder="500025.0000" />
                </div>
                <div>
                  <label className="label">Target Northing (m)</label>
                  <input className="input" value={target.n} onChange={(e) => setTarget({ ...target, n: e.target.value })} placeholder="9500018.0000" />
                </div>
              </div>
              <button onClick={calculateBearingDistance} className="btn btn-primary w-full">Compute</button>
            </div>
          </div>
        )}

        {steps ? (
          <SolutionStepsRenderer title={solutionTitle} steps={steps} />
        ) : (
          <div className="card">
            <div className="card-header">
              <span className="label">Solution</span>
            </div>
            <div className="card-body text-sm text-[var(--text-muted)]">
              Enter observations and press Compute.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
