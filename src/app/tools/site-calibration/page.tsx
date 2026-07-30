'use client'

import { useState, useCallback } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import {
  calibrateTransformation,
  validateCommonPoints,
  assessCalibrationQuality,
  type CommonPoint,
  type CalibrationResult,
} from '@/lib/geo/transformationCalibration'
import { transformPointFull } from '@/lib/geo/helmertRigorous'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface PointRow {
  id: string
  name: string
  // Source (WGS84 from GNSS)
  sx: string; sy: string; sz: string
  // Target (Arc 1960 from registry)
  tx: string; ty: string; tz: string
}

let rowId = 0
const newRow = (): PointRow => ({
  id: `p${++rowId}`,
  name: '',
  sx: '', sy: '', sz: '',
  tx: '', ty: '', tz: '',
})

export default function SiteCalibrationPage() {
  const { t } = useLanguage()
  const [points, setPoints] = useState<PointRow[]>([
    { id: 'p1', name: 'CP1', sx: '274812.403', sy: '9856214.778', sz: '1798.500', tx: '274712.201', ty: '9856314.521', tz: '1790.123' },
    { id: 'p2', name: 'CP2', sx: '274912.108', sy: '9856220.336', sz: '1799.200', tx: '274811.906', ty: '9856320.079', tz: '1790.823' },
    { id: 'p3', name: 'CP3', sx: '274905.291', sy: '9856098.105', sz: '1801.800', tx: '274805.089', ty: '9856197.848', tz: '1793.423' },
  ])
  const [result, setResult] = useState<CalibrationResult | null>(null)
  const [error, setError] = useState('')
  const [transformInput, setTransformInput] = useState('')
  const [transformOutput, setTransformOutput] = useState('')
  const [removeOutliers, setRemoveOutliers] = useState(true)
  const [registerInRegistry, setRegisterInRegistry] = useState(false)

  const addPoint = () => setPoints(p => [...p, newRow()])
  const removePoint = (id: string) => setPoints(p => p.filter(r => r.id !== id))
  const updatePoint = (id: string, field: keyof PointRow, value: string) =>
    setPoints(p => p.map(r => r.id === id ? { ...r, [field]: value } : r))

  const runCalibration = useCallback(() => {
    setError('')
    setResult(null)
    try {
      const commonPoints: CommonPoint[] = points
        .filter(p => p.sx && p.sy && p.tx && p.ty)
        .map(p => ({
          id: p.name || p.id,
          source: {
            x: parseFloat(p.sx),
            y: parseFloat(p.sy),
            z: parseFloat(p.sz) || 0,
          },
          target: {
            x: parseFloat(p.tx),
            y: parseFloat(p.ty),
            z: parseFloat(p.tz) || 0,
          },
        }))

      if (commonPoints.length < 3) {
        setError('Need at least 3 control points with both source and target coordinates')
        return
      }

      // Validate
      const issues = validateCommonPoints(commonPoints)
      const criticalIssues = issues.filter(i => i.includes('at least 3') || i.includes('Duplicate'))
      if (criticalIssues.length > 0) {
        setError(criticalIssues.join(' '))
        return
      }

      const res = calibrateTransformation(commonPoints, {
        removeOutliers,
        outlierThreshold: 2.5,
        registerInRegistry,
        provenance: registerInRegistry ? {
          surveyorName: 'Current User',
          projectName: 'Site Calibration',
          area: 'Project Area',
        } : undefined,
      })
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calibration failed')
    }
  }, [points, removeOutliers, registerInRegistry])

  const runTransform = () => {
    if (!result) return
    // Parse input: one point per line, "X Y Z" or "name X Y Z"
    const lines = transformInput.trim().split('\n').filter(l => l.trim())
    const out = lines.map(line => {
      const parts = line.trim().split(/\s+/)
      let name = ''
      let x: number, y: number, z: number
      if (parts.length === 4) {
        name = parts[0]
        x = parseFloat(parts[1]); y = parseFloat(parts[2]); z = parseFloat(parts[3])
      } else if (parts.length === 3) {
        x = parseFloat(parts[0]); y = parseFloat(parts[1]); z = parseFloat(parts[2])
      } else {
        return `# Invalid: ${line}`
      }
      const t = transformPointFull(x, y, z, result.parameters)
      return `${name} ${t.x.toFixed(4)} ${t.y.toFixed(4)} ${t.z.toFixed(4)}`
    })
    setTransformOutput(out.join('\n'))
  }

  const quality = result ? assessCalibrationQuality(result.rmsFit) : null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-6 md:py-10">
      <PageHeader
        title="Site calibration (rigorous)"
        subtitle="Derive a site-specific 7-parameter Bursa-Wolf transformation from common points. Uses full rotation matrix + Gauss-Newton iteration + MAD-based outlier detection."
        reference="Helmert 7-param (rigorous) | Arc 1960 (Clarke 1880) ↔ WGS84 | Local calibration"
        badge="Geodesy"
      />

      {error && (
        <div className="mb-4 p-3 border border-[var(--error)]/30 bg-[var(--error)]/5 rounded-md text-sm text-[var(--error)] font-mono">
          {error}
        </div>
      )}

      {/* Options */}
      <div className="mb-4 p-3 border border-[var(--border-color)] rounded-md bg-[var(--bg-secondary)] flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={removeOutliers}
            onChange={e => setRemoveOutliers(e.target.checked)}
            className="w-4 h-4 accent-[var(--accent)]"
          />
          <span>Auto-remove outliers (MAD, 2.5σ)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={registerInRegistry}
            onChange={e => setRegisterInRegistry(e.target.checked)}
            className="w-4 h-4 accent-[var(--accent)]"
          />
          <span>Register in transformation registry</span>
        </label>
      </div>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
        {/* Left: input */}
        <div className="space-y-4">
          <div className="card">
            <div className="card-header">
              <span className="label">Control point pairs</span>
              <span className="font-mono text-[10px] text-[var(--text-muted)]">{points.length} points</span>
            </div>
            <div className="card-body">
              <p className="text-xs text-[var(--text-muted)] mb-4 font-mono">
                Enter control points with known coordinates in both systems. Source = GNSS (WGS84). Target = Registry (Arc 1960).
                Use 5+ points for blunder detection, 8+ for high-confidence calibration.
              </p>
              <div className="overflow-x-auto">
                <div className="min-w-[700px] space-y-1">
                  {/* Header */}
                  <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr_1fr_28px] gap-1 items-center font-mono text-[9px] text-[var(--text-muted)] tracking-[0.04em] uppercase">
                    <span>Name</span>
                    <span className="text-[var(--accent)]">Src X</span>
                    <span className="text-[var(--accent)]">Src Y</span>
                    <span className="text-[var(--accent)]">Src Z</span>
                    <span className="text-[var(--primary-blue)]">Tgt X</span>
                    <span className="text-[var(--primary-blue)]">Tgt Y</span>
                    <span className="text-[var(--primary-blue)]">Tgt Z</span>
                    <span></span>
                  </div>
                  {points.map(p => (
                    <div key={p.id} className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr_1fr_28px] gap-1 items-center">
                      <input className="input font-mono text-xs px-1 py-1" value={p.name} onChange={e => updatePoint(p.id, 'name', e.target.value)} aria-label="CP1" placeholder="CP1" />
                      <input className="input font-mono text-xs px-1 py-1" style={{ borderColor: 'var(--accent)' }} value={p.sx} onChange={e => updatePoint(p.id, 'sx', e.target.value)} aria-label="274812" placeholder="274812" />
                      <input className="input font-mono text-xs px-1 py-1" style={{ borderColor: 'var(--accent)' }} value={p.sy} onChange={e => updatePoint(p.id, 'sy', e.target.value)} aria-label="9856214" placeholder="9856214" />
                      <input className="input font-mono text-xs px-1 py-1" style={{ borderColor: 'var(--accent)' }} value={p.sz} onChange={e => updatePoint(p.id, 'sz', e.target.value)} aria-label="1798" placeholder="1798" />
                      <input className="input font-mono text-xs px-1 py-1" style={{ borderColor: 'var(--primary-blue)' }} value={p.tx} onChange={e => updatePoint(p.id, 'tx', e.target.value)} aria-label="274712" placeholder="274712" />
                      <input className="input font-mono text-xs px-1 py-1" style={{ borderColor: 'var(--primary-blue)' }} value={p.ty} onChange={e => updatePoint(p.id, 'ty', e.target.value)} aria-label="9856314" placeholder="9856314" />
                      <input className="input font-mono text-xs px-1 py-1" style={{ borderColor: 'var(--primary-blue)' }} value={p.tz} onChange={e => updatePoint(p.id, 'tz', e.target.value)} aria-label="1790" placeholder="1790" />
                      <button onClick={() => removePoint(p.id)} className="text-[var(--text-muted)] hover:text-[var(--error)] text-sm">×</button>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={addPoint} className="mt-3 font-mono text-[11px] text-[var(--accent)] hover:opacity-80">+ Add control point</button>
            </div>
          </div>

          <button onClick={runCalibration} className="btn btn-primary w-full">
            Derive local transformation (rigorous)
          </button>
        </div>

        {/* Right: results */}
        <div>
          {!result || !quality ? (
            <div className="card">
              <div className="card-body text-center py-16">
                <p className="text-sm text-[var(--text-muted)]">Enter control points and compute.</p>
                <p className="text-xs text-[var(--text-muted)] mt-2 font-mono">Rigorous 7-param: Tx, Ty, Tz, Rx, Ry, Rz, Scale</p>
                <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">Full rotation matrix + Gauss-Newton iteration</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Quality Assessment */}
              <div className={`card border-l-4 ${
                quality.assessment === 'excellent' ? 'border-l-green-500' :
                quality.assessment === 'good' ? 'border-l-blue-500' :
                quality.assessment === 'acceptable' ? 'border-l-amber-500' :
                'border-l-red-500'
              }`}>
                <div className="card-header">
                  <span className="label">Quality: {quality.assessment.toUpperCase()}</span>
                  <span className="font-mono text-[10px] text-[var(--text-muted)]">
                    {result.iterations} iter · {result.pointCount} pts
                  </span>
                </div>
                <div className="card-body">
                  <p className="text-xs text-[var(--text-primary)] mb-3">{quality.recommendation}</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="font-mono text-[9px] text-[var(--text-muted)] uppercase mb-1">RMS Fit</div>
                      <div className="font-display text-base text-[var(--text-primary)]">{result.rmsFit.toFixed(4)} m</div>
                    </div>
                    <div>
                      <div className="font-mono text-[9px] text-[var(--text-muted)] uppercase mb-1">95% CI</div>
                      <div className="font-display text-base text-[var(--text-primary)]">±{result.estimatedLocalAccuracy.toFixed(4)} m</div>
                    </div>
                    <div>
                      <div className="font-mono text-[9px] text-[var(--text-muted)] uppercase mb-1">vs National</div>
                      <div className="font-display text-base text-[var(--success)]">{quality.improvementFactor.toFixed(0)}× better</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Parameters */}
              <div className="card">
                <div className="card-header"><span className="label">Rigorous Helmert parameters</span></div>
                <div className="card-body space-y-2">
                  <ParamRow label="Tx (translation)" value={`${result.parameters.tx.toFixed(4)} m`} stddev={`±${result.parameterStdDevs.tx.toFixed(5)} m`} />
                  <ParamRow label="Ty (translation)" value={`${result.parameters.ty.toFixed(4)} m`} stddev={`±${result.parameterStdDevs.ty.toFixed(5)} m`} />
                  <ParamRow label="Tz (translation)" value={`${result.parameters.tz.toFixed(4)} m`} stddev={`±${result.parameterStdDevs.tz.toFixed(5)} m`} />
                  <ParamRow label="Rx (rotation)" value={`${(result.parameters.rx * 206264.806).toFixed(6)}″`} stddev={`±${(result.parameterStdDevs.rx * 206264.806).toFixed(6)}″`} />
                  <ParamRow label="Ry (rotation)" value={`${(result.parameters.ry * 206264.806).toFixed(6)}″`} stddev={`±${(result.parameterStdDevs.ry * 206264.806).toFixed(6)}″`} />
                  <ParamRow label="Rz (rotation)" value={`${(result.parameters.rz * 206264.806).toFixed(6)}″`} stddev={`±${(result.parameterStdDevs.rz * 206264.806).toFixed(6)}″`} />
                  <ParamRow label="Scale" value={`${((result.parameters.scale - 1) * 1e6).toFixed(4)} ppm`} stddev={`±${result.parameterStdDevs.scale.toFixed(5)} ppm`} highlight />
                </div>
              </div>

              {/* Per-point residuals with outlier flags */}
              <div className="card">
                <div className="card-header">
                  <span className="label">Per-point residuals</span>
                  {result.outlierCount > 0 && (
                    <span className="font-mono text-[10px] text-[var(--error)]">
                      {result.outlierCount} outlier{result.outlierCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="card-body">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[var(--text-muted)] border-b border-[var(--border-color)]">
                        <th className="text-left py-2">Point</th>
                        <th className="text-right py-2">dX (mm)</th>
                        <th className="text-right py-2">dY (mm)</th>
                        <th className="text-right py-2">dZ (mm)</th>
                        <th className="text-right py-2">Mag (mm)</th>
                        <th className="text-center py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.pointResiduals.map(tp => (
                        <tr key={tp.id} className={`border-b border-[var(--border-color)]/50 ${tp.isOutlier ? 'bg-red-950/20' : ''}`}>
                          <td className="py-1.5 font-mono text-[var(--accent)]">{tp.id}</td>
                          <td className="py-1.5 text-right font-mono">{(tp.residualX * 1000).toFixed(2)}</td>
                          <td className="py-1.5 text-right font-mono">{(tp.residualY * 1000).toFixed(2)}</td>
                          <td className="py-1.5 text-right font-mono">{(tp.residualZ * 1000).toFixed(2)}</td>
                          <td className="py-1.5 text-right font-mono font-medium">{(tp.residualMagnitude * 1000).toFixed(2)}</td>
                          <td className="py-1.5 text-center">
                            {tp.isOutlier
                              ? <span className="text-[var(--error)]">⚠ OUTLIER</span>
                              : <span className="text-[var(--success)]">✓</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Batch transform */}
              <div className="card">
                <div className="card-header"><span className="label">Batch transform</span></div>
                <div className="card-body space-y-3">
                  <p className="text-xs text-[var(--text-muted)] font-mono">Paste points to transform (one per line: "X Y Z" or "name X Y Z"):</p>
                  <textarea
                    className="input font-mono text-xs h-24"
                    value={transformInput}
                    onChange={e => setTransformInput(e.target.value)}
                    placeholder={'CP4 274850.000 9856150.000 1799.000\n274900.000 9856200.000 1800.500'}
                  />
                  <button onClick={runTransform} className="btn btn-secondary text-xs w-full">Transform points</button>
                  {transformOutput && (
                    <div className="border border-[var(--border-color)] rounded-md p-3 bg-[var(--bg-secondary)]">
                      <div className="font-mono text-[9px] text-[var(--text-muted)] tracking-[0.06em] uppercase mb-2">Output (target system)</div>
                      <pre className="font-mono text-xs text-[var(--success)] whitespace-pre-wrap">{transformOutput}</pre>
                    </div>
                  )}
                </div>
              </div>

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="card border-l-4 border-l-amber-500">
                  <div className="card-body">
                    <ul className="text-xs text-amber-400 list-disc list-inside space-y-1">
                      {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ParamRow({ label, value, stddev, highlight }: { label: string; value: string; stddev?: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.04em] uppercase">{label}</span>
      <div className="text-right">
        <span className={`font-mono text-sm ${highlight ? 'text-[var(--accent)] font-medium' : 'text-[var(--text-primary)]'}`}>{value}</span>
        {stddev && <span className="font-mono text-[10px] text-[var(--text-muted)] ml-2">±{stddev.replace('±', '')}</span>}
      </div>
    </div>
  )
}
