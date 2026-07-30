'use client';

import { useState, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import {
  processBaselineFile,
  validateBaseline,
  getSolutionQualityDescription,
  GNSSBaselineFile,
  BaselineResult
} from '@/lib/online/gnssBaseline'
import { useLanguage } from '@/lib/i18n/LanguageContext'

function GNSSBaselinePage() {
  const { t } = useLanguage()
  const [file, setFile] = useState<GNSSBaselineFile | null>(null)
  const [baseCoords, setBaseCoords] = useState({ easting: 0, northing: 0, elevation: 0 })
  const [result, setResult] = useState<BaselineResult | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (content: string, filename: string) => {
    const processed = processBaselineFile(content, filename)
    setFile(processed)
    if (processed.result) {
      setResult(processed.result)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const f = e.dataTransfer.files[0]
    if (f) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        if (ev.target?.result) {
          handleFile(ev.target.result as string, f.name)
        }
      }
      reader.readAsText(f)
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        if (ev.target?.result) {
          handleFile(ev.target.result as string, f.name)
        }
      }
      reader.readAsText(f)
    }
  }

  const validation = result ? validateBaseline(result.baselineVectors) : null

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <PageHeader title={t('tools.gnssBaseline')} subtitle={t('tools.gnssBaselineDesc')} />

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4">
            <h3 className="font-semibold text-[var(--text-primary)] mb-3">Base Station Coordinates</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Easting (m)</label>
                <input aria-label="Easting"
                  type="number"
                  value={baseCoords.easting}
                  onChange={(e) => setBaseCoords({...baseCoords, easting: Number(e.target.value)})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Northing (m)</label>
                <input aria-label="Northing"
                  type="number"
                  value={baseCoords.northing}
                  onChange={(e) => setBaseCoords({...baseCoords, northing: Number(e.target.value)})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Elevation (m)</label>
                <input aria-label="Elevation"
                  type="number"
                  value={baseCoords.elevation}
                  onChange={(e) => setBaseCoords({...baseCoords, elevation: Number(e.target.value)})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4">
            <h3 className="font-semibold text-[var(--text-primary)] mb-3">Supported Formats</h3>
            <ul className="text-sm text-[var(--text-muted)] space-y-2">
              <li> RINEX (.rnx, .obs)</li>
              <li> Topcon (.top, .tps)</li>
              <li> Trimble (.tin, .tnx)</li>
              <li> Leica (.mdb, .xml)</li>
            </ul>
            <div className="mt-4 p-3 bg-blue-950/50 border border-blue-800/50 rounded-lg text-sm text-blue-300">
              <strong>Tip:</strong> Ensure your baseline file contains vector data (ΔE, ΔN, ΔU) from reference to rover station.
            </div>
          </div>
        </div>

        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center mb-6 transition ${
            dragActive ? 'border-blue-500 bg-blue-950/30' : 'border-[var(--border-color)]'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".rnx,.obs,.top,.tps,.tin,.tnx,.mdb,.xml,.txt"
            onChange={handleInput}
            className="hidden"
          />
          <div className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l3 3m0 0l3-3m-3 3v-7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="text-[var(--text-muted)] mb-2">Drag & drop GNSS baseline file here</p>
          <p className="text-[var(--text-muted)] text-sm mb-4">or</p>
          <button
            onClick={() => inputRef.current?.click()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Browse Files
          </button>
        </div>

        {file && (
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6 mb-6">
            <h3 className="font-semibold text-[var(--text-primary)] mb-4">Uploaded File</h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-[var(--text-muted)]">Filename:</span>
                <p className="font-medium">{file.filename}</p>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Format:</span>
                <p className="font-medium uppercase">{file.format}</p>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Status:</span>
                <p className={`font-medium ${
                  file.status === 'completed' ? 'text-green-600' :
                  file.status === 'failed' ? 'text-red-600' :
                  'text-yellow-600'
                }`}>{file.status}</p>
              </div>
            </div>
          </div>
        )}

        {validation && (
          <div className={`rounded-xl p-4 mb-6 ${validation.valid ? 'bg-green-950/30 border border-green-800' : 'bg-red-950/30 border border-red-800'}`}>
            <h4 className={`font-semibold mb-2 ${validation.valid ? 'text-green-300' : 'text-red-300'}`}>
              {validation.valid ? ' Validation Passed' : '[x] Validation Issues'}
            </h4>
            {validation.errors.length > 0 && (
              <ul className="text-sm text-red-400 space-y-1">
                {validation.errors.map((e, i) => <li key={`${e}-${i}`}>• {e}</li>)}
              </ul>
            )}
            {validation.warnings.length > 0 && (
              <ul className="text-sm text-yellow-400 space-y-1 mt-2">
                {validation.warnings.map((w, i) => <li key={`${w}-${i}`}><AlertTriangle className="w-3.5 h-3.5 inline shrink-0" /> {w}</li>)}
              </ul>
            )}
          </div>
        )}

        {result && (
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6">
            <h3 className="font-semibold text-[var(--text-primary)] mb-4">Processing Results</h3>
            
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
                <p className="text-sm text-[var(--text-muted)]">Solution Type</p>
                <p className="text-lg font-bold text-blue-400">{result.solutionType.toUpperCase()}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">{getSolutionQualityDescription(result.solutionType)}</p>
              </div>
              <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
                <p className="text-sm text-[var(--text-muted)]">PDOP</p>
                <p className="text-lg font-bold">{result.pdop.toFixed(2)}</p>
              </div>
              <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
                <p className="text-sm text-[var(--text-muted)]">RMS</p>
                <p className="text-lg font-bold">{(result.rms * 100).toFixed(1)} cm</p>
              </div>
            </div>

            <h4 className="font-medium text-[var(--text-primary)] mb-3">Baseline Vectors</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">From</th>
                    <th className="text-left py-2">To</th>
                    <th className="text-right py-2">ΔE (m)</th>
                    <th className="text-right py-2">ΔN (m)</th>
                    <th className="text-right py-2">ΔU (m)</th>
                    <th className="text-right py-2">Distance (m)</th>
                    <th className="text-right py-2">Azimuth</th>
                  </tr>
                </thead>
                <tbody>
                  {result.baselineVectors.map((v, i) => (
                    <tr key={`${v}-${i}`} className="border-b">
                      <td className="py-2">{v.from}</td>
                      <td className="py-2">{v.to}</td>
                      <td className="text-right font-mono">{v.deltaEasting.toFixed(4)}</td>
                      <td className="text-right font-mono">{v.deltaNorthing.toFixed(4)}</td>
                      <td className="text-right font-mono">{v.deltaElevation.toFixed(4)}</td>
                      <td className="text-right font-mono">{v.distance.toFixed(3)}</td>
                      <td className="text-right font-mono">{v.azimuth.toFixed(2)}°</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// P0-2 (2026-07-24): Wrap in <ToolGate> so direct-URL access can't
// bypass the plan check. The catalog page (/tools) shows lock badges,
// but those are display-only — this gate enforces the same check at
// the page level. Server-side enforcement for any export API this
// tool calls happens via the requirePlan() decorator on the route.
import { ToolGate } from '@/components/shared/ToolGate'

export default function GNSSBaselinePageGated() {
  return (
    <ToolGate toolPath="/tools/gnss-baseline">
      <GNSSBaselinePage />
    </ToolGate>
  )
}
