'use client'

/**
 * DeformationTrackerPanel — Epoch management + displacement visualization
 *
 * Features:
 * - Add monitoring stations (name, baseline X/Y/Z)
 * - Import epoch readings (CSV: station, X, Y, Z, date)
 * - View displacement table with status indicators
 * - Time-series displacement chart
 * - Alert generation for critical stations
 */

import { useState, useCallback, useMemo } from 'react'
import {
  Activity, Plus, AlertTriangle, CheckCircle2,
  TrendingUp, X,
} from 'lucide-react'
import {
  computeDisplacement,
  generateDeformationReport,
  congruenceTest,
  computeDisplacementConfidenceEllipses,
  DEFAULT_THRESHOLDS,
  type MonitoringStation,
  type EpochReading,
  type CongruenceTestResult,
  type DisplacementConfidenceEllipse,
} from '@/lib/engine/deformationTracker'

export function DeformationTrackerPanel() {
  const [stations, setStations] = useState<MonitoringStation[]>([])
  const [readings, setReadings] = useState<EpochReading[]>([])
  const [showAddStation, setShowAddStation] = useState(false)
  const [newStation, setNewStation] = useState({ name: '', x: '', y: '', z: '' })
  const [currentEpoch, setCurrentEpoch] = useState(0)
  const [epochInput, setEpochInput] = useState({ stationId: '', x: '', y: '', z: '' })

  // Pelzer congruence test parameters (AUDIT FIX H11, 2026-07-03)
  const [coordSigmaMm, setCoordSigmaMm] = useState(2.0)  // a priori σ per coordinate, mm
  const [pelzerResult, setPelzerResult] = useState<CongruenceTestResult | null>(null)
  const [ellipses, setEllipses] = useState<DisplacementConfidenceEllipse[]>([])

  const addStation = useCallback(() => {
    if (!newStation.name.trim()) return
    const station: MonitoringStation = {
      id: crypto.randomUUID(),
      stationName: newStation.name,
      baseX: parseFloat(newStation.x) || 0,
      baseY: parseFloat(newStation.y) || 0,
      baseZ: parseFloat(newStation.z) || 0,
    }
    setStations(prev => [...prev, station])
    setNewStation({ name: '', x: '', y: '', z: '' })
    setShowAddStation(false)
  }, [newStation])

  const addEpochReading = useCallback(() => {
    if (!epochInput.stationId) return
    const station = stations.find(s => s.id === epochInput.stationId)
    if (!station) return

    const x = parseFloat(epochInput.x)
    const y = parseFloat(epochInput.y)
    const z = parseFloat(epochInput.z)
    if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return

    const prevReading = readings
      .filter(r => r.stationId === station.id)
      .sort((a, b) => b.epochNumber - a.epochNumber)[0]

    const epochNum = currentEpoch + 1
    const reading = computeDisplacement(station, x, y, z, epochNum, new Date().toISOString(), prevReading)
    setReadings(prev => [...prev, reading])
    setCurrentEpoch(epochNum)
    setEpochInput({ stationId: '', x: '', y: '', z: '' })
  }, [stations, readings, currentEpoch, epochInput])

  const report = useMemo(() => {
    if (readings.length === 0) return null
    return generateDeformationReport(stations, readings)
  }, [stations, readings])

  const flaggedCount = report?.flaggedStations.length ?? 0

  /**
   * Run the Pelzer global congruence test (AUDIT FIX H11, 2026-07-03).
   *
   * Compares epoch 0 (baseline) against the latest epoch for each station
   * that has readings in both epochs. Builds a simplified diagonal cofactor
   * matrix from the a priori coordinate standard deviation (coordSigmaMm),
   * since we don't have the full LSA cofactor matrix from each epoch's
   * network adjustment.
   *
   * For a rigorous Pelzer test, the surveyor should export the cofactor
   * matrices from their LSA software and run the test via the API. This
   * UI implementation gives a practical approximation that's still
   * statistically valid for typical monitoring scenarios.
   */
  const runPelzerTest = useCallback(() => {
    if (stations.length === 0 || readings.length === 0) return

    // Find stations that have BOTH an epoch-0 (baseline) reading and a
    // latest-epoch reading
    const stationDisplacements: number[] = []
    const stationIds: string[] = []

    for (const station of stations) {
      const stationReadings = readings
        .filter(r => r.stationId === station.id)
        .sort((a, b) => a.epochNumber - b.epochNumber)

      if (stationReadings.length < 2) continue

      const latest = stationReadings[stationReadings.length - 1]

      // 2D displacement (E, N) in metres
      const dE = latest.deltaX  // deltaX is the E displacement vs baseline
      const dN = latest.deltaY  // deltaY is the N displacement vs baseline

      stationDisplacements.push(dE, dN)
      stationIds.push(station.id)
    }

    if (stationIds.length === 0) {
      setPelzerResult(null)
      return
    }

    // Build a simplified diagonal cofactor matrix Q_dd = Q₀ + Q₁.
    // Since we don't have the LSA cofactor matrices per epoch, we
    // approximate: each coordinate has variance σ², and the pooled
    // cofactor for the displacement is 2σ² (sum of two epochs).
    const sigma = coordSigmaMm / 1000  // convert mm → metres
    const sigmaSq = sigma * sigma
    const n = stationDisplacements.length  // 2 * numStations
    const cofactorMatrix: number[][] = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 2 * sigmaSq : 0))
    )

    // Reference variance: σ̂₀² = 1 (we're using a priori σ, not a posteriori)
    const referenceVariance = 1.0

    // Degrees of freedom: roughly numStations * 2 (2D displacements)
    const residualDof = stationIds.length * 2

    const result = congruenceTest(
      stationDisplacements,
      cofactorMatrix,
      referenceVariance,
      residualDof,
      0.05,  // α = 0.05 (95% confidence)
    )
    setPelzerResult(result)

    // AUDIT FIX (2026-07-03): Also compute per-station confidence ellipses
    // so the surveyor can see which individual stations have significant
    // displacement (not just the global test).
    const stationIdsForEllipses: string[] = []
    const displacementsFlat: number[] = []
    const cofactorDiagonals: number[][][] = []

    for (const station of stations) {
      const stationReadings = readings
        .filter(r => r.stationId === station.id)
        .sort((a, b) => a.epochNumber - b.epochNumber)

      if (stationReadings.length < 2) continue

      const latest = stationReadings[stationReadings.length - 1]
      const dE = latest.deltaX
      const dN = latest.deltaY

      stationIdsForEllipses.push(station.id)
      displacementsFlat.push(dE, dN)
      // 2×2 cofactor sub-matrix: [[qEE, qEN], [qNE, qNN]]
      // Using the same σ² approximation as the Pelzer test
      cofactorDiagonals.push([
        [2 * sigmaSq, 0],
        [0, 2 * sigmaSq],
      ])
    }

    if (stationIdsForEllipses.length > 0) {
      const ellipseResults = computeDisplacementConfidenceEllipses(
        stationIdsForEllipses,
        displacementsFlat,
        cofactorDiagonals,
        referenceVariance,
        0.95,
      )
      setEllipses(ellipseResults)
    } else {
      setEllipses([])
    }
  }, [stations, readings, coordSigmaMm])

  return (
    <div className="space-y-4">
      {/* Header + summary */}
      <div className="grid grid-cols-4 gap-2">
        <div className="p-2 rounded-lg bg-[var(--bg-tertiary)]/50 text-center">
          <div className="text-lg font-bold text-gray-300">{stations.length}</div>
          <div className="text-[9px] text-gray-400 uppercase">Stations</div>
        </div>
        <div className="p-2 rounded-lg bg-[var(--bg-tertiary)]/50 text-center">
          <div className="text-lg font-bold text-gray-300">{currentEpoch}</div>
          <div className="text-[9px] text-gray-400 uppercase">Epochs</div>
        </div>
        <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/20 text-center">
          <div className="text-lg font-bold text-amber-400">{flaggedCount}</div>
          <div className="text-[9px] text-gray-400 uppercase">Warnings</div>
        </div>
        <div className="p-2 rounded-lg bg-[var(--bg-tertiary)]/50 text-center">
          <div className="text-lg font-bold text-gray-300">{readings.length}</div>
          <div className="text-[9px] text-gray-400 uppercase">Readings</div>
        </div>
      </div>

      {/* Add station */}
      {showAddStation ? (
        <div className="card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-primary)]">Add Monitoring Station</span>
            <button onClick={() => setShowAddStation(false)} className="text-gray-400"><X className="w-3.5 h-3.5" /></button>
          </div>
          <input type="text" value={newStation.name} onChange={e => setNewStation(prev => ({ ...prev, name: e.target.value }))} aria-label="Station name (e.g., Prism_A1)" className="w-full h-8 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-white" />
          <div className="grid grid-cols-3 gap-2">
            <input type="number" value={newStation.x} onChange={e => setNewStation(prev => ({ ...prev, x: e.target.value }))} aria-label="Base X" className="h-8 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-white font-mono" />
            <input type="number" value={newStation.y} onChange={e => setNewStation(prev => ({ ...prev, y: e.target.value }))} aria-label="Base Y" className="h-8 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-white font-mono" />
            <input type="number" value={newStation.z} onChange={e => setNewStation(prev => ({ ...prev, z: e.target.value }))} aria-label="Base Z" className="h-8 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-white font-mono" />
          </div>
          <button onClick={addStation} disabled={!newStation.name} className="w-full h-8 rounded bg-[var(--accent)] text-black text-xs font-semibold disabled:opacity-40">Add Station</button>
        </div>
      ) : (
        <button onClick={() => setShowAddStation(true)} className="w-full flex items-center justify-center gap-1.5 h-9 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-xs text-gray-400 hover:text-gray-200">
          <Plus className="w-3.5 h-3.5" /> Add Monitoring Station
        </button>
      )}

      {/* Add epoch reading */}
      {stations.length > 0 && (
        <div className="card p-3 space-y-2">
          <span className="text-xs font-medium text-[var(--text-primary)]">Add Epoch {currentEpoch + 1} Reading</span>
          <select value={epochInput.stationId} onChange={e => setEpochInput(prev => ({ ...prev, stationId: e.target.value }))} className="w-full h-8 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-white">
            <option value="">Select station...</option>
            {stations.map(s => <option key={s.id} value={s.id}>{s.stationName}</option>)}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <input type="number" value={epochInput.x} onChange={e => setEpochInput(prev => ({ ...prev, x: e.target.value }))} aria-label="Current X" className="h-8 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-white font-mono" />
            <input type="number" value={epochInput.y} onChange={e => setEpochInput(prev => ({ ...prev, y: e.target.value }))} aria-label="Current Y" className="h-8 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-white font-mono" />
            <input type="number" value={epochInput.z} onChange={e => setEpochInput(prev => ({ ...prev, z: e.target.value }))} aria-label="Current Z" className="h-8 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-white font-mono" />
          </div>
          <button onClick={addEpochReading} disabled={!epochInput.stationId} className="w-full h-8 rounded bg-[var(--accent)] text-black text-xs font-semibold disabled:opacity-40">Record Reading</button>
        </div>
      )}

      {/* Displacement table */}
      {readings.length > 0 && (
        <div className="card p-4 overflow-hidden">
          <span className="text-xs font-semibold text-[var(--text-primary)] mb-2 block">Displacement Readings</span>
          <div className="max-h-[300px] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-[var(--bg-card)]">
                <tr className="border-b border-[var(--border-color)]">
                  <th className="px-2 py-1.5 text-left text-[9px] text-gray-400 uppercase">Station</th>
                  <th className="px-2 py-1.5 text-center text-[9px] text-gray-400 uppercase">Epoch</th>
                  <th className="px-2 py-1.5 text-right text-[9px] text-gray-400 uppercase">ΔX (mm)</th>
                  <th className="px-2 py-1.5 text-right text-[9px] text-gray-400 uppercase">ΔY (mm)</th>
                  <th className="px-2 py-1.5 text-right text-[9px] text-gray-400 uppercase">ΔZ (mm)</th>
                  <th className="px-2 py-1.5 text-right text-[9px] text-gray-400 uppercase">Total (mm)</th>
                  <th className="px-2 py-1.5 text-right text-[9px] text-gray-400 uppercase">Vel (mm/wk)</th>
                  <th className="px-2 py-1.5 text-center text-[9px] text-gray-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {readings.map(r => {
                  const station = stations.find(s => s.id === r.stationId)
                  const dispMm = r.totalDisplacement * 1000
                  const dXMm = r.deltaX * 1000
                  const dYMm = r.deltaY * 1000
                  const dZMm = r.deltaZ * 1000
                  return (
                    <tr key={r.id} className="border-b border-[var(--border-color)]/30">
                      <td className="px-2 py-1.5 text-xs font-mono text-[var(--text-primary)]">{station?.stationName || '—'}</td>
                      <td className="px-2 py-1.5 text-center text-xs text-gray-400">{r.epochNumber}</td>
                      <td className="px-2 py-1.5 text-right text-xs font-mono text-gray-400">{dXMm.toFixed(2)}</td>
                      <td className="px-2 py-1.5 text-right text-xs font-mono text-gray-400">{dYMm.toFixed(2)}</td>
                      <td className="px-2 py-1.5 text-right text-xs font-mono text-gray-400">{dZMm.toFixed(2)}</td>
                      <td className={`px-2 py-1.5 text-right text-xs font-mono font-bold ${
                        r.status === 'critical' ? 'text-red-400' :
                        r.status === 'warning' ? 'text-amber-400' : 'text-emerald-400'
                      }`}>{dispMm.toFixed(2)}</td>
                      <td className={`px-2 py-1.5 text-right text-xs font-mono ${
                        r.velocityMmPerWeek >= DEFAULT_THRESHOLDS.criticalVelocity ? 'text-red-400' :
                        r.velocityMmPerWeek >= DEFAULT_THRESHOLDS.warningVelocity ? 'text-amber-400' : 'text-gray-400'
                      }`}>{r.velocityMmPerWeek.toFixed(2)}</td>
                      <td className="px-2 py-1.5 text-center">
                        {r.status === 'critical' ? <AlertTriangle className="w-3.5 h-3.5 text-red-400 inline" /> :
                         r.status === 'warning' ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400 inline" /> :
                         <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline" />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Thresholds info */}
      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
        <Activity className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-[10px] text-blue-300">
          <p>Warning: {DEFAULT_THRESHOLDS.warningDisplacement}mm displacement or {DEFAULT_THRESHOLDS.warningVelocity}mm/week velocity</p>
          <p>Critical: {DEFAULT_THRESHOLDS.criticalDisplacement}mm displacement or {DEFAULT_THRESHOLDS.criticalVelocity}mm/week velocity</p>
        </div>
      </div>

      {/* Pelzer Congruence Test (AUDIT FIX H11, 2026-07-03) */}
      <div className="card p-3 space-y-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-xs font-semibold text-[var(--text-primary)]">Pelzer Congruence Test</span>
          <span className="text-[9px] text-gray-400 ml-auto">Statistical significance (95% confidence)</span>
        </div>
        <div className="text-[10px] text-gray-400">
          Tests whether the observed deformation is statistically significant or can be explained by measurement noise.
          Requires ≥2 epochs of data for at least one station.
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-gray-400 whitespace-nowrap" htmlFor="coord-mm">Coord σ (mm):</label>
          <input
             id="coord-mm" type="number"
            value={coordSigmaMm}
            onChange={e => setCoordSigmaMm(parseFloat(e.target.value) || 2.0)}
            step="0.5"
            min="0.1"
            className="w-16 h-7 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-white font-mono"
          />
          <button
            onClick={runPelzerTest}
            disabled={readings.length === 0}
            className="h-7 px-3 rounded bg-purple-600 text-white text-xs font-semibold disabled:opacity-40 hover:bg-purple-700 transition-colors"
          >
            Run Test
          </button>
        </div>
        {pelzerResult && (
          <div className={`p-2.5 rounded-lg border text-[10px] ${
            pelzerResult.significant
              ? 'bg-red-500/5 border-red-500/20 text-red-300'
              : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
          }`}>
            <div className="flex items-center gap-1.5 mb-1">
              {pelzerResult.significant
                ? <AlertTriangle className="w-3 h-3 text-red-400" />
                : <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
              <span className="font-semibold">
                {pelzerResult.significant ? 'DEFORMATION SIGNIFICANT' : 'No significant deformation'}
              </span>
            </div>
            <div className="font-mono text-[9px] text-gray-400 space-y-0.5">
              <div>T = {pelzerResult.testStatistic.toFixed(4)}  vs  F_crit = {pelzerResult.criticalValue.toFixed(4)}</div>
              <div>Ω = {pelzerResult.quadraticForm.toFixed(6)},  h = {pelzerResult.degreesOfFreedom}</div>
              <div>σ̂₀² = {pelzerResult.referenceVariance.toFixed(6)}</div>
            </div>
            <p className="mt-1 text-[9px] leading-relaxed">{pelzerResult.summary}</p>
          </div>
        )}

        {/* Per-station confidence ellipses (AUDIT FIX 2026-07-03) */}
        {ellipses.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="text-[10px] text-gray-400 font-medium mb-1">Per-Station 95% Confidence Ellipses</div>
            {ellipses.map((el, i) => {
              const station = stations.find(s => s.id === el.stationId)
              return (
                <div key={i} className={`flex items-center gap-2 p-1.5 rounded text-[9px] ${
                  el.significant
                    ? 'bg-red-500/5 border border-red-500/15'
                    : 'bg-[var(--bg-tertiary)]'
                }`}>
                  {el.significant
                    ? <AlertTriangle className="w-2.5 h-2.5 text-red-400 shrink-0" />
                    : <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />}
                  <span className="font-mono text-gray-300 shrink-0">{station?.stationName || el.stationId}</span>
                  <span className="text-gray-400">a={el.semiMajor.toFixed(2)}mm</span>
                  <span className="text-gray-400">b={el.semiMinor.toFixed(2)}mm</span>
                  <span className="text-gray-400">θ={el.orientation.toFixed(0)}°</span>
                  <span className={`ml-auto ${el.significant ? 'text-red-400' : 'text-emerald-400'}`}>
                    {el.significant ? 'SIGNIFICANT' : 'stable'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
