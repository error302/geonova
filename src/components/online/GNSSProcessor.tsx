'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, MapPin, Download, Loader2 } from 'lucide-react'
import type { GNSSBaseline } from '@/types/gnss'

interface FileWithLabel {
  file: File
  stationLabel: string
}

export default function GNSSProcessor({ projectId = '' }: { projectId?: string }) {
  const router = useRouter()
  const [files, setFiles] = useState<FileWithLabel[]>([])
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState('')
  const [results, setResults] = useState<GNSSBaseline[]>([])
  const [error, setError] = useState('')

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map((file: any) => ({
        file,
        stationLabel: ''
      }))
      setFiles(prev => [...prev, ...newFiles])
    }
  }

  const updateStationLabel = (index: number, label: string) => {
    setFiles(prev => prev.map((f, i) => 
      i === index ? { ...f, stationLabel: label } : f
    ))
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const processBaselines = async () => {
    const hasLabels = files.every(f => f.stationLabel.trim())
    if (!hasLabels) {
      setError('Please label all stations before processing')
      return
    }

    setProcessing(true)
    setStatus('Uploading files...')
    setError('')

    try {
      setStatus('Processing baselines...')
      
      const formData = new FormData()
      files.forEach((f: any) => formData.append('files', f.file))
      formData.append('projectId', projectId)
      formData.append('stationLabels', JSON.stringify(files.map((f: any) => f.stationLabel)))

      const response = await fetch('/api/gnss/process', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          files: files.map((f: any) => ({
            filename: f.file.name,
            stationId: f.stationLabel,
            fileType: f.file.name.endsWith('.nav') ? 'NAV' : 'OBS',
            sizeBytes: f.file.size,
            storagePath: ''
          })),
          stationLabels: files.map((f: any) => f.stationLabel)
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Processing failed')
      }

      setResults(data.results || [])
      
      if (data.status === 'simulated') {
        setError('Simulation mode — upload valid RINEX files for real processing')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed')
    } finally {
      setProcessing(false)
      setStatus('')
    }
  }

  const fixedCount = results.filter((r: any) => r.fixed).length
  const rmsValues = results.map((r: any) => r.rmsError)
  const bestRms = rmsValues.length ? Math.min(...rmsValues) : 0
  const worstRms = rmsValues.length ? Math.max(...rmsValues) : 0

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="border-2 border-dashed border-[var(--border-color)] rounded-xl p-6 text-center">
        <Upload className="w-10 h-10 mx-auto mb-3 text-[var(--text-muted)]" />
        <p className="text-sm mb-3">Drop RINEX files (.obs, .nav, .rnx, .21o)</p>
        <input
          type="file"
          multiple
          accept=".obs,.nav,.rnx,.21o,.24o"
          onChange={handleFileUpload}
          className="hidden"
          id="rinex-upload"
        />
        <label
          htmlFor="rinex-upload"
          className="px-4 py-2 bg-[var(--accent)] text-black rounded-lg text-sm cursor-pointer inline-block"
        >
          Select Files
        </label>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm">Uploaded Files</h3>
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg">
              <FileText className="w-5 h-5 text-[var(--text-muted)]" />
              <div className="flex-1">
                <div className="text-sm font-medium">{f.file.name}</div>
                <div className="text-xs text-[var(--text-muted)]">
                  {(f.file.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <input
                type="text"
                placeholder="Station label (e.g. BASE, ROVER1)"
                value={f.stationLabel}
                onChange={e => updateStationLabel(i, e.target.value)}
                className="px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-sm w-48"
              />
              <button
                onClick={() => removeFile(i)}
                className="text-red-500 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Process Button */}
      <button
        onClick={processBaselines}
        disabled={processing || files.length < 2}
        className="w-full py-3 bg-[var(--accent)] text-black font-semibold rounded-lg disabled:opacity-50"
      >
        {processing ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            {status || 'Processing...'}
          </span>
        ) : (
          'Process Baselines'
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{results.length}</div>
              <div className="text-xs text-[var(--text-muted)]">Baselines</div>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{fixedCount}</div>
              <div className="text-xs text-[var(--text-muted)]">Fixed</div>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{(bestRms * 1000).toFixed(1)}mm</div>
              <div className="text-xs text-[var(--text-muted)]">Best RMS</div>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{(worstRms * 1000).toFixed(1)}mm</div>
              <div className="text-xs text-[var(--text-muted)]">Worst RMS</div>
            </div>
          </div>

          {/* Accuracy Banner */}
          <div className={`p-4 rounded-lg ${fixedCount === results.length ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
            {fixedCount === results.length ? (
              <span className="text-green-700">✓ All baselines fixed — First Order accuracy achieved</span>
            ) : (
              <span className="text-amber-700">⚠ Some baselines are float solutions — not suitable for cadastral work</span>
            )}
          </div>

          {/* Results Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-tertiary)]">
                <tr>
                  <th className="text-left p-3">FROM</th>
                  <th className="text-left p-3">TO</th>
                  <th className="text-right p-3">DIST (m)</th>
                  <th className="text-right p-3">RMS</th>
                  <th className="text-right p-3">RATIO</th>
                  <th className="text-center p-3">FIXED</th>
                  <th className="text-center p-3">CLASS</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className={`border-b border-[var(--border-color)] ${r.fixed ? 'bg-green-50' : 'bg-amber-50'}`}>
                    <td className="p-3">{r.fromStation}</td>
                    <td className="p-3">{r.toStation}</td>
                    <td className="p-3 text-right font-mono">{r.distance.toFixed(3)}</td>
                    <td className="p-3 text-right font-mono">{(r.rmsError * 1000).toFixed(1)}mm</td>
                    <td className="p-3 text-right font-mono">{r.ratio.toFixed(1)}</td>
                    <td className="p-3 text-center">{r.fixed ? '✓' : '⚠'}</td>
                    <td className="p-3 text-center">{r.qualityClass}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
