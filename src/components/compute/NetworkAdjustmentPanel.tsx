'use client';

import { useState, useCallback } from 'react'
import { AlertTriangle, CheckCircle2, ShieldAlert, Zap, Compass, Folder, Lock } from 'lucide-react'
import { adjustNetwork, Station, Observation, AdjustmentResult } from '@/lib/survey/networkAdjustment'
import { adjustNetworkRobust, type RobustLSAResult, type WeightFunction } from '@/lib/survey/robustEstimation'
import { generateNetworkDXF } from '@/lib/survey/networkAdjustmentDXF'
import { ErrorEllipseCanvas } from './ErrorEllipseCanvas'
import { z } from 'zod'
import { apiGet, apiPost, ApiError } from '@/lib/api/client'

// ─── API response schemas (Zod) ────────────────────────────────────────────
const traverseImportResponseSchema = z.object({
  coordinates: z.array(z.object({}).passthrough()).optional(),
  legs: z.array(z.object({}).passthrough()).optional(),
}).passthrough()

const networkAdjustmentSaveResponseSchema = z.object({
  ok: z.boolean().optional(),
}).passthrough()

interface Props {
  projectId: string
  projectData: Record<string, unknown>
  surveyorProfile?: { fullName: string; registrationNumber: string; firmName: string } | null
}

const EMPTY_STATION: Omit<Station, 'id'> = {
  name: '', easting: 0, northing: 0, elevation: 0, isFixed: false,
}

const EMPTY_OBS: Omit<Observation, 'from' | 'to'> = {
  deltaE: 0, deltaN: 0, deltaH: 0, stdDevE: 0.005, stdDevN: 0.005, stdDevH: 0.010,
}

export function NetworkAdjustmentPanel({ projectId, projectData, surveyorProfile }: Props) {
  const [stations, setStations] = useState<Station[]>([])
  const [observations, setObservations] = useState<Observation[]>([])
  const [result, setResult] = useState<AdjustmentResult | null>(null)
  const [robustResult, setRobustResult] = useState<RobustLSAResult | null>(null)
  const [robustMode, setRobustMode] = useState(false)
  const [weightFunction, setWeightFunction] = useState<WeightFunction>('huber')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [importStatus, setImportStatus] = useState('')

  // ─── Import from Traverse ────────────────────────────────────────────────
  const handleImportFromTraverse = useCallback(async () => {
    try {
      setImportStatus('Loading traverse data...')
      const data = await apiGet(
        `/api/project/${projectId}/traverse`,
        traverseImportResponseSchema,
        { ttlMs: 0 },
      )
      const coords = (data.coordinates as unknown as Array<Record<string, unknown>>) || []
      const legs = (data.legs as unknown as Array<Record<string, unknown>>) || []

      if (coords.length < 2) {
        setImportStatus('')
        setError('Traverse has fewer than 2 stations.')
        return
      }

      // Convert traverse stations → LSQ stations
      const newStations: Station[] = coords.map((c, i: number) => ({
        id: `trv-${c.station}`,
        name: c.station as string,
        easting: c.easting as number,
        northing: c.northing as number,
        elevation: (c.rl as number) ?? 0,
        isFixed: i === 0 || i === coords.length - 1, // first and last are fixed
      }))

      // Convert traverse legs → LSQ observations
      const newObs: Observation[] = legs.map((leg) => {
        const fromStn = newStations.find((s: Station) => s.name === leg.from)
        const toStn = newStations.find((s: Station) => s.name === leg.to)
        if (!fromStn || !toStn) return null
        return {
          from: fromStn.id,
          to: toStn.id,
          deltaE: (leg.adjDep as number) ?? (leg.departure as number) ?? 0,
          deltaN: (leg.adjLat as number) ?? (leg.latitude as number) ?? 0,
          deltaH: 0,
          stdDevE: 0.005 + (leg.hd as number ?? 100) * 0.00001, stdDevN: 0.005 + (leg.hd as number ?? 100) * 0.00001, stdDevH: (0.005 + (leg.hd as number ?? 100) * 0.00001) * 2, // 5mm + 10ppm
        }
      }).filter(Boolean) as Observation[]

      setStations(newStations)
      setObservations(newObs)
      setResult(null)
      setError(null)
      setImportStatus(`Imported ${newStations.length} stations and ${newObs.length} observations from traverse.`)
      setTimeout(() => setImportStatus(''), 4000)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        // 404 / not-found → no traverse data yet; anything else → surface message
        setError(err.isNotFound
          ? 'No traverse data found for this project. Run a traverse computation first.'
          : err.message)
      } else {
        setError((err as Error).message ?? 'Failed to import traverse data.')
      }
      setImportStatus('')
    }
  }, [projectId])

  // ─── Import from GSI File ─────────────────────────────────────────────────
  const handleImportGSI = useCallback(async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.gsi,.GSI'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        setImportStatus('Parsing GSI file...')
        const content = await file.text()
        const { parseGSI, pairFaces } = await import('@/lib/import/totalStation/parseGSI')
        const parsed = parseGSI(content)

        if (!parsed.ok || parsed.records.length === 0) {
          setError('GSI file parsed but no valid records found.')
          setImportStatus('')
          return
        }

        // Extract coordinate records as stations
        const coordRecords = parsed.records.filter(r => r.easting !== undefined && r.northing !== undefined)
        const obsRecords = parsed.records.filter(r => r.horizontalAngle !== undefined || r.slopeDistance !== undefined)

        if (coordRecords.length >= 2) {
          const newStations: Station[] = coordRecords.map((r, i) => ({
            id: `gsi-${r.pointId}`,
            name: r.pointId,
            easting: r.easting!,
            northing: r.northing!,
            elevation: r.elevation ?? 0,
            isFixed: i === 0,
          }))
          setStations(newStations)

          // Create observations from consecutive coordinate pairs
          const newObs: Observation[] = []
          for (let i = 0; i < newStations.length - 1; i++) {
            newObs.push({
              from: newStations[i].id,
              to: newStations[i + 1].id,
              deltaE: newStations[i + 1].easting - newStations[i].easting,
              deltaN: newStations[i + 1].northing - newStations[i].northing,
              deltaH: newStations[i + 1].elevation - newStations[i].elevation,
              stdDevE: 0.005, stdDevN: 0.005, stdDevH: 0.010,
            })
          }
          setObservations(newObs)
        }

        setResult(null)
        setError(null)
        setImportStatus(
          `GSI ${parsed.format}: ${parsed.statistics.totalRecords} records, ` +
          `${parsed.statistics.coordinateRecords} coords, ` +
          `${parsed.statistics.faceLeftCount} FL / ${parsed.statistics.faceRightCount} FR`
        )
        setTimeout(() => setImportStatus(''), 6000)
      } catch (err: unknown) {
        setError((err as Error).message ?? 'Failed to parse GSI file.')
        setImportStatus('')
      }
    }
    input.click()
  }, [])

  const addStation = () => {
    setStations(prev => [...prev, {
      ...EMPTY_STATION,
      id: `stn-${Date.now()}`,
    }])
  }

  const updateStation = (id: string, field: keyof Station, value: string | number | boolean) => {
    setStations(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  const removeStation = (id: string) => {
    setStations(prev => prev.filter(s => s.id !== id))
    setObservations(prev => prev.filter(o => o.from !== id && o.to !== id))
  }

  const addObservation = () => {
    if (stations.length < 2) return
    setObservations(prev => [...prev, {
      ...EMPTY_OBS,
      from: stations[0].id,
      to: stations[1].id,
    }])
  }

  const updateObservation = (idx: number, field: keyof Observation, value: string | number) => {
    setObservations(prev => prev.map((o, i) => i === idx ? { ...o, [field]: value } : o))
  }

  const removeObservation = (idx: number) => {
    setObservations(prev => prev.filter((_, i) => i !== idx))
  }

  const handleCompute = () => {
    setError(null)
    setResult(null)
    setRobustResult(null)
    try {
      if (robustMode) {
        // Convert Station/Observation to the format expected by adjustNetworkRobust
        const robustStations = stations.map(s => ({
          id: s.id, name: s.name,
          easting: s.easting, northing: s.northing, elevation: s.elevation,
          isFixed: s.isFixed,
        }))
        const robustObs = observations.map(o => ({
          type: 'coordinate_diff' as const,
          from: o.from, to: o.to,
          deltaE: o.deltaE, deltaN: o.deltaN, deltaH: o.deltaH,
          stdDevE: o.stdDevE, stdDevN: o.stdDevN, stdDevH: o.stdDevH,
        }))
        const res = adjustNetworkRobust(robustStations, robustObs, {
          weightFunction,
          maxIterations: 30,
        })
        setRobustResult(res)
        // Also set the standard result (for the adjusted coordinates table + error ellipses)
        setResult({
          adjustedStations: res.adjustedStations,
          sigmaZero: res.sigmaZero,
          degreesOfFreedom: res.degreesOfFreedom,
          iterations: res.iterations,
          passedTolerance: res.blunders.length === 0,
          warnings: [...res.warnings, ...res.blunders.map(b =>
            `BLUNDER: ${b.from || '?'}→${b.to || '?'} (${b.type}) — residual=${b.residual.toFixed(4)}m, weight=${b.finalWeight.toFixed(3)}`,
          )],
        })
        saveResult({
          adjustedStations: res.adjustedStations,
          sigmaZero: res.sigmaZero,
          degreesOfFreedom: res.degreesOfFreedom,
          iterations: res.iterations,
          passedTolerance: res.blunders.length === 0,
          warnings: res.warnings,
        })
      } else {
        const res = adjustNetwork(stations, observations)
        setResult(res)
        saveResult(res)
      }
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Adjustment failed.')
    }
  }

  const saveResult = async (res: AdjustmentResult) => {
    setSaving(true)
    try {
      await apiPost(
        `/api/project/${projectId}/network-adjustment`,
        networkAdjustmentSaveResponseSchema,
        {
          stations,
          observations,
          adjusted_stations: res.adjustedStations,
          summary: {
            iterations: res.iterations,
            sigma_zero: res.sigmaZero,
            dof: res.degreesOfFreedom,
            passed_tolerance: res.passedTolerance,
          },
          status: res.passedTolerance ? 'adjusted' : 'failed',
        },
      )
    } catch {
      // non-fatal
    } finally {
      setSaving(false)
    }
  }

  const handleExportDXF = async () => {
    if (!result) return
    const profile = surveyorProfile ?? { fullName: 'Unknown', registrationNumber: 'N/A', firmName: 'N/A' }
    const dxfString = generateNetworkDXF({
      adjustedStations: result.adjustedStations,
      observations,
      projectData,
      surveyorProfile: profile,
    })
    const blob = new Blob([dxfString], { type: 'application/dxf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `network-adjustment-${projectId}.dxf`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">GPS Network Adjustment</h2>
        <p className="text-sm text-zinc-400">
          Least squares adjustment of GPS/GNSS baselines. Arc 1960 / UTM Zone 37S.
          At least one fixed control station required.
        </p>
      </div>

      {importStatus && (
        <div className="bg-blue-900/30 border border-blue-700 text-blue-300 px-4 py-3 rounded-lg text-sm">
          {importStatus}
        </div>
      )}

      {/* Import Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleImportFromTraverse}
          className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium flex items-center gap-1.5"
        >
          <Compass className="w-4 h-4" /> Import from Traverse
        </button>
        <button
          onClick={handleImportGSI}
          className="text-sm bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-medium flex items-center gap-1.5"
        >
          <Folder className="w-4 h-4" /> Import GSI File
        </button>
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-zinc-300">Control Stations</h3>
          <button
            onClick={addStation}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
          >
            + Add Station
          </button>
        </div>

        {stations.length === 0 && (
          <p className="text-sm text-zinc-500 italic">No stations added yet.</p>
        )}

        <div className="space-y-3">
          {stations.map(s => (
            <div key={s.id} className="grid grid-cols-7 gap-2 items-center bg-zinc-800 p-3 rounded-lg">
              <input
                className="col-span-1 bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm text-white"
                aria-label="Name" placeholder="e.g. TBM1"
                value={s.name}
                onChange={e => updateStation(s.id, 'name', e.target.value)}
              />
              <input
                type="number" step="0.001"
                className="col-span-2 bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm text-white"
                aria-label="Easting (m)" placeholder="e.g. 500000.000"
                value={s.easting || ''}
                onChange={e => updateStation(s.id, 'easting', parseFloat(e.target.value) || 0)}
              />
              <input
                type="number" step="0.001"
                className="col-span-2 bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm text-white"
                aria-label="Northing (m)" placeholder="e.g. 9900000.000"
                value={s.northing || ''}
                onChange={e => updateStation(s.id, 'northing', parseFloat(e.target.value) || 0)}
              />
              <label className="flex items-center gap-1 text-sm text-zinc-300">
                <input aria-label="Isfixed"
                  type="checkbox"
                  checked={s.isFixed}
                  onChange={e => updateStation(s.id, 'isFixed', e.target.checked)}
                />
                Fixed
              </label>
              <button
                onClick={() => removeStation(s.id)}
                className="text-red-400 text-sm hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-zinc-300">Baseline Observations</h3>
          <button
            onClick={addObservation}
            disabled={stations.length < 2}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-40"
          >
            + Add Baseline
          </button>
        </div>

        {observations.length === 0 && (
          <p className="text-sm text-zinc-500 italic">No baselines added yet.</p>
        )}

        <div className="space-y-3">
          {observations.map((obs, idx) => (
            <div key={`${obs}-${idx}`} className="grid grid-cols-7 gap-2 items-center bg-zinc-800 p-3 rounded-lg">
              <select
                className="bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm text-white"
                value={obs.from}
                onChange={e => updateObservation(idx, 'from', e.target.value)}
              >
                {stations.map(s => <option key={s.id} value={s.id}>{s.name || s.id}</option>)}
              </select>
              <select
                className="bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm text-white"
                value={obs.to}
                onChange={e => updateObservation(idx, 'to', e.target.value)}
              >
                {stations.map(s => <option key={s.id} value={s.id}>{s.name || s.id}</option>)}
              </select>
              <input
                type="number" step="0.001"
                className="bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm text-white"
                aria-label="ΔE (m)" placeholder="e.g. 0.002"
                value={obs.deltaE || ''}
                onChange={e => updateObservation(idx, 'deltaE', parseFloat(e.target.value) || 0)}
              />
              <input
                type="number" step="0.001"
                className="bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm text-white"
                aria-label="ΔN (m)" placeholder="e.g. 0.003"
                value={obs.deltaN || ''}
                onChange={e => updateObservation(idx, 'deltaN', parseFloat(e.target.value) || 0)}
              />
              <input
                type="number" step="0.001"
                className="bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm text-white"
                aria-label="ΔH (m)" placeholder="e.g. 0.001"
                value={obs.deltaH || ''}
                onChange={e => updateObservation(idx, 'deltaH', parseFloat(e.target.value) || 0)}
              />
              <input
                type="number" step="0.0001"
                className="bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm text-white"
                aria-label="σ (m)" placeholder="e.g. 0.005"
                value={obs.stdDevE || ''}
                onChange={e => {
                  const v = parseFloat(e.target.value) || 0.005
                  updateObservation(idx, 'stdDevE', v)
                  updateObservation(idx, 'stdDevN', v)
                  updateObservation(idx, 'stdDevH', v * 2)
                }}
              />
              <button
                onClick={() => removeObservation(idx)}
                className="text-red-400 text-sm hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Robust Estimation Controls */}
      <section className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Robust Estimation (Blunder Detection)
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              Down-weights observations with large residuals using IRLS. Detects blunders that standard LSA misses.
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={robustMode}
              onChange={e => { setRobustMode(e.target.checked); setResult(null); setRobustResult(null) }}
              className="w-4 h-4 accent-green-600"
            />
            <span className="text-sm text-zinc-300">Enable Robust Mode</span>
          </label>
        </div>
        {robustMode && (
          <div className="flex items-center gap-4 text-sm">
            <label className="text-zinc-400" htmlFor="weight-function">Weight Function:</label>
            <select
               id="weight-function" value={weightFunction}
              onChange={e => setWeightFunction(e.target.value as WeightFunction)}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white"
            >
              <option value="huber">Huber (gentle, 95% efficient)</option>
              <option value="igg3">IGG3 (Chinese standard, hard reject at 2.5σ)</option>
              <option value="tukey">Tukey Biweight (most aggressive)</option>
            </select>
          </div>
        )}
      </section>

      <div className="flex gap-3">
        <button
          onClick={handleCompute}
          disabled={stations.length < 2 || observations.length === 0}
          className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 disabled:opacity-40 font-medium flex items-center gap-2"
        >
          {robustMode && <Zap className="w-4 h-4" />}
          {robustMode ? 'Run Robust Adjustment' : 'Run Adjustment'}
        </button>
        {result && (
          <button
            onClick={handleExportDXF}
            className="bg-gray-700 text-white px-5 py-2 rounded-lg hover:bg-gray-600 font-medium"
          >
            Export DXF
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {result && (
        <section className="space-y-5">
          <div className={`p-4 rounded-lg border ${result.passedTolerance ? 'bg-green-900/30 border-green-700' : 'bg-amber-900/30 border-amber-700'}`}>
            <h3 className="font-semibold mb-2 text-white flex items-center gap-2">
              {result.passedTolerance
                ? <><CheckCircle2 className="w-4 h-4" /> Adjustment Passed</>
                : <><AlertTriangle className="w-4 h-4" /> Adjustment — Check Residuals</>
              }
            </h3>
            <div className="grid grid-cols-3 gap-4 text-sm text-zinc-300">
              <div><span className="text-zinc-500">σ₀ (ref std dev)</span><br /><strong>{result.sigmaZero.toFixed(4)}</strong></div>
              <div><span className="text-zinc-500">Degrees of freedom</span><br /><strong>{result.degreesOfFreedom}</strong></div>
              <div><span className="text-zinc-500">Iterations</span><br /><strong>{result.iterations}</strong></div>
            </div>
            {result.warnings.length > 0 && (
              <ul className="mt-3 text-sm text-amber-400 list-disc list-inside space-y-1">
                {result.warnings.map((w, i) => <li key={`${w}-${i}`}>{w}</li>)}
              </ul>
            )}
          </div>

          <div>
            <h3 className="font-medium text-zinc-300 mb-2">Adjusted Coordinates</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse text-zinc-300">
                <thead>
                  <tr className="bg-zinc-800 text-left">
                    <th className="px-3 py-2 border border-zinc-700">Station</th>
                    <th className="px-3 py-2 border border-zinc-700">Easting (m)</th>
                    <th className="px-3 py-2 border border-zinc-700">Northing (m)</th>
                    <th className="px-3 py-2 border border-zinc-700">Residual E (m)</th>
                    <th className="px-3 py-2 border border-zinc-700">Residual N (m)</th>
                    <th className="px-3 py-2 border border-zinc-700">Semi-major (m)</th>
                    <th className="px-3 py-2 border border-zinc-700">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {result.adjustedStations.map(s => (
                    <tr key={s.id} className="hover:bg-zinc-800/50">
                      <td className="px-3 py-2 border border-zinc-700 font-medium">{s.name || s.id}</td>
                      <td className="px-3 py-2 border border-zinc-700 font-mono">{s.easting.toFixed(4)}</td>
                      <td className="px-3 py-2 border border-zinc-700 font-mono">{s.northing.toFixed(4)}</td>
                      <td className="px-3 py-2 border border-zinc-700 font-mono">{s.residualE.toFixed(5)}</td>
                      <td className="px-3 py-2 border border-zinc-700 font-mono">{s.residualN.toFixed(5)}</td>
                      <td className="px-3 py-2 border border-zinc-700 font-mono">{s.semiMajor.toFixed(5)}</td>
                      <td className="px-3 py-2 border border-zinc-700">{s.isFixed ? <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Fixed</span> : 'Free'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Error Ellipse Diagram */}
          <ErrorEllipseCanvas
            stations={result.adjustedStations}
            observations={observations}
            width={700}
            height={450}
          />

          {/* Robust Adjustment: Blunder Detection Panel */}
          {robustResult && (
            <div className={`p-4 rounded-lg border ${robustResult.blunders.length === 0 ? 'bg-green-900/30 border-green-700' : 'bg-red-900/30 border-red-700'}`}>
              <h3 className="font-semibold mb-2 text-white flex items-center gap-2">
                {robustResult.blunders.length === 0
                  ? <><CheckCircle2 className="w-4 h-4" /> No Blunders Detected</>
                  : <><AlertTriangle className="w-4 h-4" /> {robustResult.blunders.length} Blunder(s) Detected</>
                }
                <span className="text-xs font-normal text-zinc-400 ml-2">
                  ({robustResult.method.toUpperCase()} IRLS, {robustResult.iterations} iterations)
                </span>
              </h3>
              <p className="text-sm text-zinc-300 mb-3">{robustResult.summary}</p>

              {/* Per-observation weights table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse text-zinc-300">
                  <thead>
                    <tr className="bg-zinc-800 text-left">
                      <th className="px-3 py-2 border border-zinc-700">#</th>
                      <th className="px-3 py-2 border border-zinc-700">From → To</th>
                      <th className="px-3 py-2 border border-zinc-700">Type</th>
                      <th className="px-3 py-2 border border-zinc-700">Residual (m)</th>
                      <th className="px-3 py-2 border border-zinc-700">Std. Residual</th>
                      <th className="px-3 py-2 border border-zinc-700">Final Weight</th>
                      <th className="px-3 py-2 border border-zinc-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {robustResult.blunders.map((b, i) => (
                      <tr key={i} className="bg-red-950/30">
                        <td className="px-3 py-2 border border-zinc-700">{b.index + 1}</td>
                        <td className="px-3 py-2 border border-zinc-700 font-medium">{b.from || '?'} → {b.to || '?'}</td>
                        <td className="px-3 py-2 border border-zinc-700">{b.type}</td>
                        <td className="px-3 py-2 border border-zinc-700 font-mono">{b.residual.toFixed(4)}</td>
                        <td className="px-3 py-2 border border-zinc-700 font-mono">{b.standardizedResidual.toFixed(2)}σ</td>
                        <td className="px-3 py-2 border border-zinc-700 font-mono text-red-400">{b.finalWeight.toFixed(3)}</td>
                        <td className="px-3 py-2 border border-zinc-700 text-red-400 font-medium">BLUNDER</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {robustResult.blunders.length > 0 && (
                <p className="text-xs text-zinc-400 mt-3">
                  💡 Blunders are down-weighted automatically. Re-check the observation field notes for the flagged legs —
                  look for swapped face, wrong target height, or transcription errors. After correcting, re-run the adjustment.
                </p>
              )}
            </div>
          )}

          {saving && <p className="text-sm text-zinc-500 italic">Saving results…</p>}
        </section>
      )}
    </div>
  )
}