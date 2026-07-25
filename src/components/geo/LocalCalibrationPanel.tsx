'use client';

import { useState } from 'react'
import { Crosshair, Plus, Trash2, CheckCircle, AlertTriangle, TrendingDown } from 'lucide-react'
import {
  calibrateTransformation,
  validateCommonPoints,
  assessCalibrationQuality,
  type CommonPoint,
  type CalibrationResult,
} from '@/lib/geo/transformationCalibration'

/**
 * Local Transformation Calibration Panel
 *
 * Lets surveyors derive a site-specific 7-parameter Bursa-Wolf transformation
 * from common points (points known in both source and target datums).
 *
 * Why: The national transformation (EPSG:1165) gives ~5m accuracy. With 5+
 * common points, you can derive a local calibration that's 100× more accurate
 * for the project area.
 */

interface CommonPointRow {
  id: string
  sourceX: string
  sourceY: string
  sourceZ: string
  targetX: string
  targetY: string
  targetZ: string
}

const EMPTY_ROW: CommonPointRow = {
  id: '', sourceX: '', sourceY: '', sourceZ: '',
  targetX: '', targetY: '', targetZ: '',
}

export function LocalCalibrationPanel() {
  const [rows, setRows] = useState<CommonPointRow[]>([
    { ...EMPTY_ROW, id: 'P1' },
    { ...EMPTY_ROW, id: 'P2' },
    { ...EMPTY_ROW, id: 'P3' },
  ])
  const [result, setResult] = useState<CalibrationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [removeOutliers, setRemoveOutliers] = useState(true)
  const [registerInRegistry, setRegisterInRegistry] = useState(false)
  const [surveyorName, setSurveyorName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [area, setArea] = useState('')

  const addRow = () => {
    setRows(prev => [...prev, { ...EMPTY_ROW, id: `P${prev.length + 1}` }])
  }

  const updateRow = (idx: number, field: keyof CommonPointRow, value: string) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  const removeRow = (idx: number) => {
    setRows(prev => prev.filter((_, i) => i !== idx))
  }

  const handleCalibrate = () => {
    setError(null)
    setResult(null)

    // Convert rows to CommonPoint[]
    const commonPoints: CommonPoint[] = []
    for (const row of rows) {
      if (!row.id || !row.sourceX || !row.sourceY || !row.sourceZ ||
          !row.targetX || !row.targetY || !row.targetZ) {
        continue
      }
      commonPoints.push({
        id: row.id,
        source: {
          x: parseFloat(row.sourceX),
          y: parseFloat(row.sourceY),
          z: parseFloat(row.sourceZ),
        },
        target: {
          x: parseFloat(row.targetX),
          y: parseFloat(row.targetY),
          z: parseFloat(row.targetZ),
        },
      })
    }

    if (commonPoints.length < 3) {
      setError(`Need at least 3 complete common points. Only ${commonPoints.length} provided.`)
      return
    }

    // Validate
    const issues = validateCommonPoints(commonPoints)
    const criticalIssues = issues.filter(i => i.includes('at least 3') || i.includes('Duplicate'))
    if (criticalIssues.length > 0) {
      setError(criticalIssues.join(' '))
      return
    }

    try {
      const provenance = registerInRegistry && surveyorName && projectName && area
        ? { surveyorName, projectName, area, notes: 'Local calibration from common points' }
        : undefined

      const res = calibrateTransformation(commonPoints, {
        removeOutliers,
        outlierThreshold: 2.5,
        registerInRegistry,
        provenance,
      })
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calibration failed')
    }
  }

  const quality = result ? assessCalibrationQuality(result.rmsFit) : null

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
          <Crosshair className="w-5 h-5 text-blue-400" />
          Local Transformation Calibration
        </h2>
        <p className="text-sm text-zinc-400">
          Derive a site-specific 7-parameter Bursa-Wolf transformation from common points.
          Achieves 100× better accuracy than the national parameters (EPSG:1165).
        </p>
      </div>

      {/* Common Points Table */}
      <section className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-white">Common Points (known in both datums)</h3>
          <button
            onClick={addRow}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> Add Point
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-zinc-800 text-left text-zinc-300">
                <th className="px-2 py-2 border border-zinc-700" rowSpan={2}>ID</th>
                <th className="px-2 py-2 border border-zinc-700 text-center" colSpan={3}>Source (e.g., WGS84 from GNSS)</th>
                <th className="px-2 py-2 border border-zinc-700 text-center" colSpan={3}>Target (e.g., Arc 1960)</th>
                <th className="px-2 py-2 border border-zinc-700" rowSpan={2}></th>
              </tr>
              <tr className="bg-zinc-800 text-left text-zinc-300">
                <th className="px-2 py-2 border border-zinc-700">X (m)</th>
                <th className="px-2 py-2 border border-zinc-700">Y (m)</th>
                <th className="px-2 py-2 border border-zinc-700">Z (m)</th>
                <th className="px-2 py-2 border border-zinc-700">X (m)</th>
                <th className="px-2 py-2 border border-zinc-700">Y (m)</th>
                <th className="px-2 py-2 border border-zinc-700">Z (m)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-zinc-800/30">
                  <td className="px-2 py-1 border border-zinc-700">
                    <input
                      type="text"
                      value={row.id}
                      onChange={e => updateRow(idx, 'id', e.target.value)}
                      className="w-16 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white text-xs"
                    />
                  </td>
                  <td className="px-1 py-1 border border-zinc-700">
                    <input type="number" value={row.sourceX} onChange={e => updateRow(idx, 'sourceX', e.target.value)}
                      className="w-28 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white text-xs font-mono"
                      placeholder="5000000" />
                  </td>
                  <td className="px-1 py-1 border border-zinc-700">
                    <input type="number" value={row.sourceY} onChange={e => updateRow(idx, 'sourceY', e.target.value)}
                      className="w-28 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white text-xs font-mono"
                      placeholder="3000000" />
                  </td>
                  <td className="px-1 py-1 border border-zinc-700">
                    <input type="number" value={row.sourceZ} onChange={e => updateRow(idx, 'sourceZ', e.target.value)}
                      className="w-28 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white text-xs font-mono"
                      placeholder="-1000000" />
                  </td>
                  <td className="px-1 py-1 border border-zinc-700">
                    <input type="number" value={row.targetX} onChange={e => updateRow(idx, 'targetX', e.target.value)}
                      className="w-28 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white text-xs font-mono"
                      placeholder="5000100" />
                  </td>
                  <td className="px-1 py-1 border border-zinc-700">
                    <input type="number" value={row.targetY} onChange={e => updateRow(idx, 'targetY', e.target.value)}
                      className="w-28 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white text-xs font-mono"
                      placeholder="3000200" />
                  </td>
                  <td className="px-1 py-1 border border-zinc-700">
                    <input type="number" value={row.targetZ} onChange={e => updateRow(idx, 'targetZ', e.target.value)}
                      className="w-28 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white text-xs font-mono"
                      placeholder="-999950" />
                  </td>
                  <td className="px-1 py-1 border border-zinc-700 text-center">
                    <button
                      onClick={() => removeRow(idx)}
                      disabled={rows.length <= 3}
                      className="text-red-400 hover:text-red-300 disabled:opacity-30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-500">
          Need at least 3 points. Use 5+ for blunder detection, 8+ for high-confidence calibration.
          Points should span the project area (not be clustered).
        </p>
      </section>

      {/* Options */}
      <section className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-4 space-y-3">
        <h3 className="font-medium text-white">Options</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={removeOutliers}
            onChange={e => setRemoveOutliers(e.target.checked)}
            className="w-4 h-4 accent-blue-600"
          />
          <span className="text-sm text-zinc-300">
            Automatically remove outliers (MAD-based detection, 2.5σ threshold)
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={registerInRegistry}
            onChange={e => setRegisterInRegistry(e.target.checked)}
            className="w-4 h-4 accent-blue-600"
          />
          <span className="text-sm text-zinc-300">
            Register in transformation registry (with provenance)
          </span>
        </label>
        {registerInRegistry && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 ml-6">
            <div>
              <label className="text-xs text-zinc-500">Surveyor Name</label>
              <input
                type="text"
                value={surveyorName}
                onChange={e => setSurveyorName(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white text-sm"
                placeholder="John Mwangi"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500">Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white text-sm"
                placeholder="Nairobi CBD Boundary"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500">Area Description</label>
              <input
                type="text"
                value={area}
                onChange={e => setArea(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white text-sm"
                placeholder="Nairobi CBD (5km radius)"
              />
            </div>
          </div>
        )}
      </section>

      <button
        onClick={handleCalibrate}
        className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
      >
        <Crosshair className="w-4 h-4" /> Derive Local Transformation
      </button>

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {result && quality && (
        <section className="space-y-4">
          {/* Quality Assessment */}
          <div className={`p-4 rounded-lg border ${
            quality.assessment === 'excellent' ? 'bg-green-900/30 border-green-700' :
            quality.assessment === 'good' ? 'bg-blue-900/30 border-blue-700' :
            quality.assessment === 'acceptable' ? 'bg-amber-900/30 border-amber-700' :
            'bg-red-900/30 border-red-700'
          }`}>
            <h3 className="font-semibold mb-2 text-white flex items-center gap-2">
              {quality.assessment === 'excellent' || quality.assessment === 'good'
                ? <CheckCircle className="w-4 h-4" />
                : <AlertTriangle className="w-4 h-4" />
              }
              Calibration: {quality.assessment.toUpperCase()}
              <span className="text-xs font-normal text-zinc-400 ml-2">
                ({result.iterations} iterations, {result.pointCount} points)
              </span>
            </h3>
            <p className="text-sm text-zinc-300 mb-3">{quality.recommendation}</p>
            <div className="grid grid-cols-3 gap-4 text-sm text-zinc-300">
              <div>
                <span className="text-zinc-500">RMS Fit</span><br />
                <strong>{result.rmsFit.toFixed(4)} m</strong>
              </div>
              <div>
                <span className="text-zinc-500">Est. Local Accuracy (95% CI)</span><br />
                <strong>{result.estimatedLocalAccuracy.toFixed(4)} m</strong>
              </div>
              <div>
                <span className="text-zinc-500 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" /> Improvement vs National
                </span><br />
                <strong>{quality.improvementFactor.toFixed(0)}×</strong> better
              </div>
            </div>
          </div>

          {/* Parameters Table */}
          <div>
            <h3 className="font-medium text-zinc-300 mb-2">7-Parameter Bursa-Wolf</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse text-zinc-300">
                <thead>
                  <tr className="bg-zinc-800 text-left">
                    <th className="px-3 py-2 border border-zinc-700">Parameter</th>
                    <th className="px-3 py-2 border border-zinc-700">Value</th>
                    <th className="px-3 py-2 border border-zinc-700">Std Dev (1σ)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="px-3 py-2 border border-zinc-700">Tx (translation X)</td>
                    <td className="px-3 py-2 border border-zinc-700 font-mono">{result.parameters.tx.toFixed(4)} m</td>
                    <td className="px-3 py-2 border border-zinc-700 font-mono">±{result.parameterStdDevs.tx.toFixed(5)} m</td></tr>
                  <tr><td className="px-3 py-2 border border-zinc-700">Ty (translation Y)</td>
                    <td className="px-3 py-2 border border-zinc-700 font-mono">{result.parameters.ty.toFixed(4)} m</td>
                    <td className="px-3 py-2 border border-zinc-700 font-mono">±{result.parameterStdDevs.ty.toFixed(5)} m</td></tr>
                  <tr><td className="px-3 py-2 border border-zinc-700">Tz (translation Z)</td>
                    <td className="px-3 py-2 border border-zinc-700 font-mono">{result.parameters.tz.toFixed(4)} m</td>
                    <td className="px-3 py-2 border border-zinc-700 font-mono">±{result.parameterStdDevs.tz.toFixed(5)} m</td></tr>
                  <tr><td className="px-3 py-2 border border-zinc-700">Rx (rotation X)</td>
                    <td className="px-3 py-2 border border-zinc-700 font-mono">{(result.parameters.rx * 206264.806).toFixed(6)}″</td>
                    <td className="px-3 py-2 border border-zinc-700 font-mono">±{(result.parameterStdDevs.rx * 206264.806).toFixed(6)}″</td></tr>
                  <tr><td className="px-3 py-2 border border-zinc-700">Ry (rotation Y)</td>
                    <td className="px-3 py-2 border border-zinc-700 font-mono">{(result.parameters.ry * 206264.806).toFixed(6)}″</td>
                    <td className="px-3 py-2 border border-zinc-700 font-mono">±{(result.parameterStdDevs.ry * 206264.806).toFixed(6)}″</td></tr>
                  <tr><td className="px-3 py-2 border border-zinc-700">Rz (rotation Z)</td>
                    <td className="px-3 py-2 border border-zinc-700 font-mono">{(result.parameters.rz * 206264.806).toFixed(6)}″</td>
                    <td className="px-3 py-2 border border-zinc-700 font-mono">±{(result.parameterStdDevs.rz * 206264.806).toFixed(6)}″</td></tr>
                  <tr><td className="px-3 py-2 border border-zinc-700">Scale</td>
                    <td className="px-3 py-2 border border-zinc-700 font-mono">{((result.parameters.scale - 1) * 1e6).toFixed(4)} ppm</td>
                    <td className="px-3 py-2 border border-zinc-700 font-mono">±{result.parameterStdDevs.scale.toFixed(5)} ppm</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-Point Residuals */}
          <div>
            <h3 className="font-medium text-zinc-300 mb-2">Per-Point Residuals {result.outlierCount > 0 && <span className="text-red-400 text-xs">({result.outlierCount} outlier{result.outlierCount > 1 ? 's' : ''})</span>}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse text-zinc-300">
                <thead>
                  <tr className="bg-zinc-800 text-left">
                    <th className="px-3 py-2 border border-zinc-700">Point</th>
                    <th className="px-3 py-2 border border-zinc-700">ΔX (m)</th>
                    <th className="px-3 py-2 border border-zinc-700">ΔY (m)</th>
                    <th className="px-3 py-2 border border-zinc-700">ΔZ (m)</th>
                    <th className="px-3 py-2 border border-zinc-700">Magnitude (m)</th>
                    <th className="px-3 py-2 border border-zinc-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.pointResiduals.map((p, i) => (
                    <tr key={i} className={p.isOutlier ? 'bg-red-950/30' : 'hover:bg-zinc-800/30'}>
                      <td className="px-3 py-2 border border-zinc-700 font-medium">{p.id}</td>
                      <td className="px-3 py-2 border border-zinc-700 font-mono">{p.residualX.toFixed(4)}</td>
                      <td className="px-3 py-2 border border-zinc-700 font-mono">{p.residualY.toFixed(4)}</td>
                      <td className="px-3 py-2 border border-zinc-700 font-mono">{p.residualZ.toFixed(4)}</td>
                      <td className="px-3 py-2 border border-zinc-700 font-mono">{p.residualMagnitude.toFixed(4)}</td>
                      <td className="px-3 py-2 border border-zinc-700">
                        {p.isOutlier
                          ? <span className="text-red-400 font-medium">⚠ OUTLIER</span>
                          : <span className="text-green-400">✓ OK</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-zinc-900/50 border border-zinc-700 rounded p-3">
            <p className="text-sm text-zinc-400">{result.summary}</p>
            {result.warnings.length > 0 && (
              <ul className="mt-2 text-xs text-amber-400 list-disc list-inside space-y-1">
                {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
