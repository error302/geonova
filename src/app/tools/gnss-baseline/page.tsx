'use client'

import { useState, useRef } from 'react'
import {
  processBaselineFile,
  validateBaseline,
  getSolutionQualityDescription,
  GNSSBaselineFile,
  BaselineResult
} from '@/lib/online/gnssBaseline'

export default function GNSSBaselinePage() {
  const [file, setFile] = useState<GNSSBaselineFile | null>(null)
  const [baseCoords, setBaseCoords] = useState({ easting: 500000, northing: 9800000, elevation: 1500 })
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">GNSS Baseline Processing</h1>
        <p className="text-gray-600 mb-8">Upload RINEX or proprietary GNSS baseline files for processing</p>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Base Station Coordinates</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Easting (m)</label>
                <input
                  type="number"
                  value={baseCoords.easting}
                  onChange={(e) => setBaseCoords({...baseCoords, easting: Number(e.target.value)})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Northing (m)</label>
                <input
                  type="number"
                  value={baseCoords.northing}
                  onChange={(e) => setBaseCoords({...baseCoords, northing: Number(e.target.value)})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Elevation (m)</label>
                <input
                  type="number"
                  value={baseCoords.elevation}
                  onChange={(e) => setBaseCoords({...baseCoords, elevation: Number(e.target.value)})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Supported Formats</h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>✓ RINEX (.rnx, .obs)</li>
              <li>✓ Topcon (.top, .tps)</li>
              <li>✓ Trimble (.tin, .tnx)</li>
              <li>✓ Leica (.mdb, .xml)</li>
            </ul>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
              <strong>Tip:</strong> Ensure your baseline file contains vector data (ΔE, ΔN, ΔU) from reference to rover station.
            </div>
          </div>
        </div>

        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center mb-6 transition ${
            dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
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
          <div className="text-4xl mb-3">📡</div>
          <p className="text-gray-700 mb-2">Drag & drop GNSS baseline file here</p>
          <p className="text-gray-500 text-sm mb-4">or</p>
          <button
            onClick={() => inputRef.current?.click()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Browse Files
          </button>
        </div>

        {file && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4">Uploaded File</h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Filename:</span>
                <p className="font-medium">{file.filename}</p>
              </div>
              <div>
                <span className="text-gray-500">Format:</span>
                <p className="font-medium uppercase">{file.format}</p>
              </div>
              <div>
                <span className="text-gray-500">Status:</span>
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
          <div className={`rounded-xl p-4 mb-6 ${validation.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <h4 className={`font-semibold mb-2 ${validation.valid ? 'text-green-800' : 'text-red-800'}`}>
              {validation.valid ? '✓ Validation Passed' : '✗ Validation Issues'}
            </h4>
            {validation.errors.length > 0 && (
              <ul className="text-sm text-red-700 space-y-1">
                {validation.errors.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            )}
            {validation.warnings.length > 0 && (
              <ul className="text-sm text-yellow-700 space-y-1 mt-2">
                {validation.warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}
              </ul>
            )}
          </div>
        )}

        {result && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Processing Results</h3>
            
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Solution Type</p>
                <p className="text-lg font-bold text-blue-600">{result.solutionType.toUpperCase()}</p>
                <p className="text-xs text-gray-500 mt-1">{getSolutionQualityDescription(result.solutionType)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">PDOP</p>
                <p className="text-lg font-bold">{result.pdop.toFixed(2)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">RMS</p>
                <p className="text-lg font-bold">{(result.rms * 100).toFixed(1)} cm</p>
              </div>
            </div>

            <h4 className="font-medium text-gray-800 mb-3">Baseline Vectors</h4>
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
                    <tr key={i} className="border-b">
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
