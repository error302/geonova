'use client';

import React, { useState, useMemo, useRef } from 'react'
import type { DesignPoint, AsBuiltPoint, ToleranceBand, AsBuiltSurveyResult } from '@/lib/engineering/asBuiltSurvey'
import { compareDesignVsAsBuilt, parseAsBuiltCSV, TOLERANCE_BANDS } from '@/lib/engineering/asBuiltSurvey'

interface AsBuiltSurveyPanelProps {
  projectId?: string
  roadClass?: string
  surfaceType?: 'paved' | 'gravel' | 'earth'
  designPoints?: DesignPoint[]
  onImport?: (points: AsBuiltPoint[]) => void
}

const SURFACE_TYPES: Array<{ key: 'paved' | 'gravel' | 'earth'; label: string; tolerance: ToleranceBand }> = [
  { key: 'paved', label: 'Paved (Asphalt/Concrete)', tolerance: TOLERANCE_BANDS.paved },
  { key: 'gravel', label: 'Gravel', tolerance: TOLERANCE_BANDS.gravel },
  { key: 'earth', label: 'Earth', tolerance: TOLERANCE_BANDS.earth },
]

export default function AsBuiltSurveyPanel({ roadClass: _roadClass, surfaceType = 'paved', designPoints = [] }: AsBuiltSurveyPanelProps) {
  const [activeSurface, setActiveSurface] = useState<'paved' | 'gravel' | 'earth'>(surfaceType)
  const [csvInput, setCsvInput] = useState('')
  const [asBuiltPoints, setAsBuiltPoints] = useState<AsBuiltPoint[]>([])
  const [result, setResult] = useState<AsBuiltSurveyResult | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)
  const [nanWarning, setNanWarning] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const tolerance = (SURFACE_TYPES.find(s => s.key === activeSurface) ?? SURFACE_TYPES[0]).tolerance

  const handleImport = () => {
    setCsvError(null)
    const points = parseAsBuiltCSV(csvInput)
    if (points.length === 0) {
      setCsvError('Invalid CSV format. Expected: chainage, level, easting, northing (E/N optional).')
      return
    }
    setAsBuiltPoints(points)
    setNanWarning(false)
    const r = compareDesignVsAsBuilt(designPoints, points, tolerance)
    setResult(r)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setCsvInput(text)
      setCsvError(null)
      const points = parseAsBuiltCSV(text)
      if (points.length === 0) {
        setCsvError('Invalid CSV format. Expected: chainage, level, easting, northing (E/N optional).')
        return
      }
      setAsBuiltPoints(points)
      setNanWarning(false)
      const r = compareDesignVsAsBuilt(designPoints, points, tolerance)
      setResult(r)
    }
    reader.readAsText(file)
    // Reset so same file can be re-uploaded
    e.target.value = ''
  }

  const handleExportCSV = () => {
    if (!result) return
    const header = 'chainage,design_level,as_built_level,deviation,tolerance,status'
    const rows = result.comparisons.map(r =>
      `${r.chainage},${r.designLevel.toFixed(4)},${r.asBuiltLevel.toFixed(4)},${r.deviation.toFixed(1)},${r.tolerance},${r.pass ? 'PASS' : 'FAIL'}`
    )
    const csvContent = [header, ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `as_built_survey_results_${Date.now()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Generate synthetic design points for demo
  const demoDesignPoints = useMemo(() => {
    if (designPoints.length > 0) return designPoints
    return Array.from({ length: 51 }, (_, i) => ({
      chainage: i * 20,
      designLevel: 100 + Math.sin(i * 0.15) * 3,
    }))
  }, [designPoints])

  const runComparison = () => {
    if (asBuiltPoints.length < 2) return
    setNanWarning(false)
    const r = compareDesignVsAsBuilt(demoDesignPoints, asBuiltPoints, tolerance)
    // Check for NaN deviations
    const hasNan = r.comparisons.some(c => isNaN(c.deviation))
    if (hasNan) setNanWarning(true)
    setResult(r)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6">
        <h3 className="text-lg font-semibold text-white">As-Built Survey Analysis</h3>
        <p className="text-sm text-zinc-400 mt-1">Compare design levels against as-built survey data</p>
      </div>

      {/* Surface Type & Tolerance */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6">
        <h4 className="font-medium text-white mb-3">Surface Type & Tolerances</h4>
        <div className="grid grid-cols-3 gap-3">
          {SURFACE_TYPES.map(st => (
            <button
              key={st.key}
              onClick={() => setActiveSurface(st.key)}
              className={`p-3 rounded-lg border-2 text-left transition-colors ${
                activeSurface === st.key
                  ? 'border-blue-500 bg-blue-900/30'
                  : 'border-zinc-700 hover:border-zinc-600'
              }`}
            >
              <div className="font-medium text-sm text-white">{st.label}</div>
              <div className="text-xs text-zinc-400 mt-1">
                Level: ±{st.tolerance.level}mm | Horiz: ±{st.tolerance.horizontal}mm
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* CSV Import */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6">
        <h4 className="font-medium text-white mb-3">Import As-Built Data (CSV)</h4>
        <p className="text-xs text-zinc-400 mb-2">Format: chainage, level, easting, northing (one point per line)</p>

        {/* File upload button */}
        <div className="mb-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-600 text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-700 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload CSV File
          </button>
        </div>

        {/* Textarea fallback */}
        <textarea
          className="w-full h-32 bg-zinc-800 border border-zinc-600 rounded-lg p-3 font-mono text-sm text-zinc-200 placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder={`0, 100.025, 123456.789, 9876543.210\n20, 100.032, 123466.521, 9876550.102\n40, 99.988, 123476.213, 9876556.834\n...`}
          value={csvInput}
          onChange={e => setCsvInput(e.target.value)}
        />

        {/* CSV error message */}
        {csvError && (
          <div className="mt-2 px-3 py-2 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-400">
            <span className="font-medium">Import Error:</span> {csvError}
          </div>
        )}

        <div className="flex gap-3 mt-3">
          <button
            onClick={handleImport}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Import & Compare
          </button>
          {designPoints.length === 0 && (
            <button
              onClick={() => {
                const demoAB = demoDesignPoints.map(d => ({
                  chainage: d.chainage,
                  surveyedLevel: d.designLevel + (Math.random() - 0.5) * 0.06,
                  surveyedEasting: 123456.789 + d.chainage * 0.5,
                  surveyedNorthing: 9876543.21 + d.chainage * 0.7,
                }))
                setAsBuiltPoints(demoAB)
                setNanWarning(false)
                const r = compareDesignVsAsBuilt(demoDesignPoints, demoAB, tolerance)
                setResult(r)
              }}
              className="px-4 py-2 bg-zinc-700 text-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-600 transition-colors"
            >
              Load Demo Data
            </button>
          )}
        </div>
      </div>

      {/* Validation: Compare button area */}
      {asBuiltPoints.length > 0 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-sm text-zinc-400">
                {asBuiltPoints.length} as-built point{asBuiltPoints.length !== 1 ? 's' : ''} loaded
              </span>
              {asBuiltPoints.length < 2 && (
                <span className="ml-2 text-xs text-amber-400">
                  — Need at least 2 points to compare
                </span>
              )}
            </div>
            <button
              onClick={runComparison}
              disabled={asBuiltPoints.length < 2}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                asBuiltPoints.length >= 2
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
            >
              Compare
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={`rounded-xl border-2 p-4 ${result.summary.isCompliant ? 'border-green-500 bg-green-900/20' : 'border-red-500 bg-red-900/20'}`}>
              <div className="text-xs text-zinc-400 uppercase tracking-wider">Pass Rate</div>
              <div className={`text-2xl font-bold ${result.summary.isCompliant ? 'text-green-400' : 'text-red-400'}`}>
                {result.summary.passRate.toFixed(1)}%
              </div>
              <div className="text-xs text-zinc-400">{result.summary.passCount} / {result.summary.totalPoints} points</div>
            </div>
            <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-4">
              <div className="text-xs text-zinc-400 uppercase tracking-wider">Max Deviation</div>
              <div className="text-2xl font-bold text-white">{result.summary.maxLevelDeviation.toFixed(1)} mm</div>
              <div className="text-xs text-zinc-400">Tolerance: ±{tolerance.level}mm</div>
            </div>
            <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-4">
              <div className="text-xs text-zinc-400 uppercase tracking-wider">RMS Error</div>
              <div className="text-2xl font-bold text-white">{result.summary.rmsError.toFixed(1)} mm</div>
              <div className="text-xs text-zinc-400">Root Mean Square</div>
            </div>
            <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-4">
              <div className="text-xs text-zinc-400 uppercase tracking-wider">Mean Deviation</div>
              <div className="text-2xl font-bold text-white">{result.summary.meanLevelDeviation.toFixed(1)} mm</div>
              <div className="text-xs text-zinc-400">Std Dev: {result.summary.standardDeviation.toFixed(1)}mm</div>
            </div>
          </div>

          {/* Compliance Badge */}
          <div className={`rounded-xl p-4 flex items-center gap-3 ${result.summary.certificationReady ? 'bg-green-900/20 border border-green-800' : 'bg-amber-900/20 border border-amber-800'}`}>
            {result.summary.certificationReady ? (
              <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            ) : (
              <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            )}
            <div>
              <div className={`font-medium ${result.summary.certificationReady ? 'text-green-400' : 'text-amber-400'}`}>
                {result.summary.certificationReady ? 'Certificate Ready' : 'Not Ready for Certification'}
              </div>
              {result.summary.issues.length > 0 && (
                <ul className="text-xs text-zinc-300 mt-1">
                  {result.summary.issues.map((issue, i) => <li key={`${issue}-${i}`}>• {issue}</li>)}
                </ul>
              )}
            </div>
          </div>

          {/* Deviation Profile SVG */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-white">Deviation Profile</h4>
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-800 border border-zinc-600 text-zinc-300 rounded-lg text-xs font-medium hover:bg-zinc-700 hover:text-white transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Results CSV
              </button>
            </div>
            {nanWarning && (
              <div className="mb-3 px-3 py-2 bg-amber-900/30 border border-amber-700 rounded-lg text-xs text-amber-400">
                <span className="font-medium">Warning:</span> Some deviation values contained NaN and were replaced with 0.
              </div>
            )}
            <DeviationProfileSvg comparisons={result.comparisons} tolerance={tolerance.level} />
          </div>

          {/* Data Table */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-700 flex items-center justify-between">
              <h4 className="font-medium text-white">As-Built Comparison Table</h4>
              <span className="text-xs text-zinc-400">{result.comparisons.length} rows</span>
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-800 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Chainage</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-zinc-400">Design RL</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-zinc-400">As-Built RL</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-zinc-400">Deviation</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-zinc-400">Tolerance</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-zinc-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.comparisons.map((row, i) => (
                    <tr key={`${row}-${i}`} className={`border-t border-zinc-800 ${row.pass ? 'bg-zinc-900' : 'bg-red-900/15'}`}>
                      <td className="px-4 py-2 font-mono text-xs text-zinc-300">{row.chainage.toFixed(0)}</td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-zinc-300">{row.designLevel.toFixed(4)}</td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-zinc-300">{row.asBuiltLevel.toFixed(4)}</td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-zinc-300">{row.deviation > 0 ? '+' : ''}{row.deviation.toFixed(1)} mm</td>
                      <td className="px-4 py-2 text-center text-xs text-zinc-400">±{row.tolerance}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${row.pass ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                          {row.pass ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── DEVIATION PROFILE SVG ────────────────────────────────────────────────────

function DeviationProfileSvg({ comparisons, tolerance }: { comparisons: Array<{ chainage: number; deviation: number; pass: boolean }>; tolerance: number }) {
  if (comparisons.length === 0) return null

  // NaN guard: replace NaN deviations with 0
  const sanitizedComparisons = comparisons.map(c => ({
    ...c,
    deviation: isNaN(c.deviation) ? 0 : c.deviation,
  }))

  const width = 900
  const height = 200
  const margin = { top: 20, right: 20, bottom: 40, left: 60 }

  const plotW = width - margin.left - margin.right
  const plotH = height - margin.top - margin.bottom

  const maxCh = Math.max(...sanitizedComparisons.map(c => c.chainage))
  const minCh = Math.min(...sanitizedComparisons.map(c => c.chainage))
  const maxDev = Math.max(tolerance * 1.5, Math.max(...sanitizedComparisons.map(c => Math.abs(c.deviation))))

  const scaleX = (ch: number) => margin.left + ((ch - minCh) / (maxCh - minCh || 1)) * plotW
  const scaleY = (dev: number) => margin.top + plotH / 2 - (dev / maxDev) * (plotH / 2)

  const polyline = sanitizedComparisons.map(c => `${scaleX(c.chainage)},${scaleY(c.deviation)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      {/* Tolerance band */}
      <rect x={margin.left} y={scaleY(tolerance)} width={plotW} height={scaleY(-tolerance) - scaleY(tolerance)} fill="rgba(34,197,94,0.15)" />
      <line x1={margin.left} y1={scaleY(0)} x2={width - margin.right} y2={scaleY(0)} stroke="#71717a" strokeWidth={1} strokeDasharray="4,2" />
      <line x1={margin.left} y1={scaleY(tolerance)} x2={width - margin.right} y2={scaleY(tolerance)} stroke="#16a34a" strokeWidth={1} strokeDasharray="4,2" />
      <line x1={margin.left} y1={scaleY(-tolerance)} x2={width - margin.right} y2={scaleY(-tolerance)} stroke="#16a34a" strokeWidth={1} strokeDasharray="4,2" />

      {/* Data line */}
      <polyline fill="none" stroke="#3b82f6" strokeWidth={1.5} points={polyline} />

      {/* Points */}
      {sanitizedComparisons.map((c, i) => (
        <circle key={`${c}-${i}`} cx={scaleX(c.chainage)} cy={scaleY(c.deviation)} r={3}
          fill={c.pass ? '#16a34a' : '#dc2626'} />
      ))}

      {/* Labels */}
      <text x={width / 2} y={height - 5} textAnchor="middle" className="text-xs" fill="#a1a1aa">Chainage (m)</text>
      <text x={10} y={height / 2} textAnchor="middle" className="text-xs" fill="#a1a1aa" transform={`rotate(-90, 10, ${height / 2})`}>Deviation (mm)</text>
      <text x={margin.left + 4} y={scaleY(tolerance) - 4} className="text-xs" fill="#16a34a">+{tolerance}</text>
      <text x={margin.left + 4} y={scaleY(-tolerance) + 12} className="text-xs" fill="#16a34a">-{tolerance}</text>
    </svg>
  )
}
