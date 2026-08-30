'use client';

import { useState } from 'react'
import { Upload, FileText, Loader2, AlertTriangle, Satellite } from 'lucide-react'

interface FileWithLabel {
  file: File
  stationLabel: string
}

interface StationResult {
  station: string
  ok: boolean
  error?: string
  latitude?: number
  longitude?: number
  height?: number
  method?: string
  n_satellites?: number
  n_epochs?: number
  rms?: number
  warnings?: string[]
}

interface BaselineResult {
  from: string
  to: string
  delta_x_m: number
  delta_y_m: number
  delta_z_m: number
  delta_e_m: number
  delta_n_m: number
  delta_u_m: number
  distance_m: number
  sigma_m: number
  method: string
  note: string
}

/**
 * GNSS multi-file processor.
 *
 * REVIVED 2026-08-31 (audit C9 "make it work"): files are now read in the
 * browser and their CONTENT is uploaded for real SPP processing (previously
 * only filename/size metadata was sent — processing could never happen).
 * Results are honestly labelled differential SPP: metre-level, suitable for
 * reconnaissance/checks, NOT for cadastral work — the banner says so, and
 * survey-grade work is pointed at the RTKLIB baseline processor.
 */
export default function GNSSProcessor({ projectId = '' }: { projectId?: string }) {
  const [files, setFiles] = useState<FileWithLabel[]>([])
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState('')
  const [stations, setStations] = useState<StationResult[]>([])
  const [results, setResults] = useState<BaselineResult[]>([])
  const [error, setError] = useState('')

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map((file) => ({
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

  async function fileToBase64(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    const CHUNK = 0x8000
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
    }
    return btoa(binary)
  }

  const processBaselines = async () => {
    const hasLabels = files.every(f => f.stationLabel.trim())
    if (!hasLabels) {
      setError('Please label all stations before processing')
      return
    }

    setProcessing(true)
    setStatus('Reading files...')
    setError('')
    setResults([])
    setStations([])

    try {
      setStatus('Uploading files for processing...')
      const filesWithContent = await Promise.all(files.map(async (f) => ({
        filename: f.file.name,
        stationId: f.stationLabel.trim(),
        fileType: /\.(nav|\d{2}n|\d{2}g)$/i.test(f.file.name) ? 'NAV' : 'OBS',
        sizeBytes: f.file.size,
        storagePath: '',
        content: await fileToBase64(f.file),
      })))

      setStatus('Processing (SPP solve per station)...')
      const response = await fetch('/api/gnss/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          files: filesWithContent,
          stationLabels: files.map(f => f.stationLabel.trim()),
        }),
      })

      const data = (await response.json()) as {
        error?: string
        results?: BaselineResult[]
        stations?: StationResult[]
        status?: string
      }

      if (!response.ok) {
        throw new Error(data.error || `Processing failed (${response.status})`)
      }

      setResults(data.results || [])
      setStations(data.stations || [])
      const failedStations = (data.stations || []).filter(s => !s.ok)
      if (failedStations.length > 0) {
        setError(`Could not solve ${failedStations.length} station(s): ` +
          failedStations.map(s => `${s.station} — ${s.error}`).join('; '))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed')
    } finally {
      setProcessing(false)
      setStatus('')
    }
  }

  const solvedStations = stations.filter(s => s.ok)

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="border-2 border-dashed border-[var(--border-color)] rounded-xl p-6 text-center">
        <Upload className="w-10 h-10 mx-auto mb-3 text-[var(--text-muted)]" />
        <p className="text-sm mb-3">
          Upload RINEX observation files for each station, plus (optionally) a shared
          navigation file. Without a nav file the daily broadcast ephemeris is
          fetched automatically.
        </p>
        <input
          type="file"
          multiple
          accept=".obs,.nav,.rnx,.21o,.22o,.23o,.24o,.25o,.26o,.o,.n"
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
          <h3 className="font-semibold text-sm">Files</h3>
          {files.map((f, i) => (
            <div key={`${f.file.name}-${i}`} className="flex items-center gap-3 p-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg">
              <FileText className="w-5 h-5 text-[var(--text-muted)]" />
              <div className="flex-1">
                <div className="text-sm font-medium">{f.file.name}</div>
                <div className="text-xs text-[var(--text-muted)]">
                  {(f.file.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <input
                type="text"
                aria-label={`Station label for ${f.file.name}`} placeholder="e.g. BASE, ROVER1"
                value={f.stationLabel}
                onChange={e => updateStationLabel(i, e.target.value)}
                className="px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-sm w-48"
              />
              <button
                onClick={() => removeFile(i)}
                className="text-red-500 hover:text-red-600"
                aria-label={`Remove ${f.file.name}`}
              >
                [x]
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
          'Process Stations'
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
          {error}
        </div>
      )}

      {/* Station positions */}
      {solvedStations.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Satellite className="w-4 h-4" /> Station Positions ({solvedStations[0]?.method || 'SPP'})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-tertiary)]">
                <tr>
                  <th className="text-left p-3">STATION</th>
                  <th className="text-right p-3">LATITUDE</th>
                  <th className="text-right p-3">LONGITUDE</th>
                  <th className="text-right p-3">HEIGHT (m)</th>
                  <th className="text-right p-3">SATS</th>
                  <th className="text-right p-3">EPOCHS</th>
                </tr>
              </thead>
              <tbody>
                {solvedStations.map((s, i) => (
                  <tr key={`${s.station}-${i}`} className="border-b border-[var(--border-color)]">
                    <td className="p-3">{s.station}</td>
                    <td className="p-3 text-right font-mono">{s.latitude?.toFixed(8)}</td>
                    <td className="p-3 text-right font-mono">{s.longitude?.toFixed(8)}</td>
                    <td className="p-3 text-right font-mono">{s.height?.toFixed(3)}</td>
                    <td className="p-3 text-right font-mono">{s.n_satellites}</td>
                    <td className="p-3 text-right font-mono">{s.n_epochs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Baselines */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{results.length}</div>
              <div className="text-xs text-[var(--text-muted)]">Baselines</div>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">
                {Math.min(...results.map(r => r.distance_m)).toFixed(1)} m
              </div>
              <div className="text-xs text-[var(--text-muted)]">Shortest</div>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">
                {Math.max(...results.map(r => r.distance_m)).toFixed(1)} m
              </div>
              <div className="text-xs text-[var(--text-muted)]">Longest</div>
            </div>
          </div>

          {/* Honest accuracy banner */}
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
            <span className="text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5 inline shrink-0" />{' '}
              Differential SPP baselines — metre-level accuracy (common
              ephemeris and atmosphere errors only partially cancel). Not
              suitable for cadastral work: use the RTKLIB baseline processor
              (GNSS Baseline tool) for survey-grade results.
            </span>
          </div>

          {/* Results Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-tertiary)]">
                <tr>
                  <th className="text-left p-3">FROM</th>
                  <th className="text-left p-3">TO</th>
                  <th className="text-right p-3">ΔE (m)</th>
                  <th className="text-right p-3">ΔN (m)</th>
                  <th className="text-right p-3">ΔU (m)</th>
                  <th className="text-right p-3">DIST (m)</th>
                  <th className="text-right p-3">σ (m)</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={`${r.from}-${r.to}-${i}`} className="border-b border-[var(--border-color)]">
                    <td className="p-3">{r.from}</td>
                    <td className="p-3">{r.to}</td>
                    <td className="p-3 text-right font-mono">{r.delta_e_m.toFixed(3)}</td>
                    <td className="p-3 text-right font-mono">{r.delta_n_m.toFixed(3)}</td>
                    <td className="p-3 text-right font-mono">{r.delta_u_m.toFixed(3)}</td>
                    <td className="p-3 text-right font-mono">{r.distance_m.toFixed(3)}</td>
                    <td className="p-3 text-right font-mono">±{r.sigma_m.toFixed(1)}</td>
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
