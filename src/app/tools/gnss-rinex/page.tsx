'use client'

import { useState, useCallback } from 'react'
import { Upload, Satellite, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { GNSSPositionResult } from '@/lib/gnss/rinexProcessor'
import { computeConfidenceEllipse } from '@/lib/gnss/rinexProcessor'

export default function GNSSRinexPage() {
  const [obsFile, setObsFile] = useState<File | null>(null)
  const [navFile, setNavFile] = useState<File | null>(null)
  const [usePrecise, setUsePrecise] = useState(false)
  const [stationName, setStationName] = useState('')
  const [result, setResult] = useState<GNSSPositionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleObsFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setObsFile(e.target.files?.[0] || null)
  }, [])

  const handleNavFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNavFile(e.target.files?.[0] || null)
  }, [])

  const handleProcess = async () => {
    if (!obsFile) { setError('RINEX observation file is required'); return }
    setLoading(true); setError(''); setResult(null)
    try {
      // Read files as base64
      const obsB64 = await fileToBase64(obsFile)
      const navB64 = navFile ? await fileToBase64(navFile) : undefined

      const res = await fetch('/api/gnss/process-rinex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rinex_obs: obsB64,
          rinex_nav: navB64,
          use_precise_ephemeris: usePrecise,
          station_name: stationName || 'unknown',
        }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || `Failed (${res.status})`) }
      const data = await res.json()
      setResult(data.data)
    } catch (e) { setError(e instanceof Error ? e.message : 'Processing failed') }
    finally { setLoading(false) }
  }

  const inputCls = "w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] focus:border-[var(--accent)]/30 focus:outline-none"

  const ellipse = result?.covariance ? computeConfidenceEllipse(result.covariance) : null

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">GNSS RINEX Processing</h1>
      <p className="text-sm text-[var(--text-muted)] mb-6">Upload RINEX observation files for PPP (Precise Point Positioning) processing. Works without RTK — just a RINEX file + IGS precise ephemeris.</p>

      <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4 mb-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] text-[var(--text-muted)] block mb-1">RINEX Observation File (*.rnx, *.obs)</label>
            <input type="file" accept=".rnx,.obs,.RNX,.O" onChange={handleObsFile} className="w-full text-xs text-[var(--text-secondary)]" />
            {obsFile && <div className="mt-1 text-[10px] text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {obsFile.name}</div>}
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-muted)] block mb-1">RINEX Navigation File (optional)</label>
            <input type="file" accept=".nav,.rnx,.N" onChange={handleNavFile} className="w-full text-xs text-[var(--text-secondary)]" />
            {navFile && <div className="mt-1 text-[10px] text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {navFile.name}</div>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-3">
          <div><label className="text-[10px] text-[var(--text-muted)] block mb-1">Station Name</label><input value={stationName} onChange={e => setStationName(e.target.value)} className={inputCls} placeholder="NALR" /></div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
              <input type="checkbox" checked={usePrecise} onChange={e => setUsePrecise(e.target.checked)} className="w-4 h-4" />
              Use IGS Precise Ephemeris (sub-meter accuracy)
            </label>
          </div>
        </div>
        <button onClick={handleProcess} disabled={loading || !obsFile} className="mt-3 flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-black text-xs font-semibold rounded-lg hover:bg-[var(--accent-dim)] disabled:opacity-50">
          <Satellite className="w-4 h-4" /> {loading ? 'Processing...' : 'Process RINEX'}
        </button>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 text-xs text-red-400 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}

      {result && (
        <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Satellite className="w-4 h-4" /> Position Result ({result.method})</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-xs"><span className="text-[var(--text-muted)]">Latitude:</span> <span className="font-mono text-[var(--text-primary)]">{result.latitude.toFixed(8)}°</span></div>
              <div className="text-xs"><span className="text-[var(--text-muted)]">Longitude:</span> <span className="font-mono text-[var(--text-primary)]">{result.longitude.toFixed(8)}°</span></div>
              <div className="text-xs"><span className="text-[var(--text-muted)]">Height:</span> <span className="font-mono text-[var(--text-primary)]">{result.height.toFixed(4)} m</span></div>
              <div className="text-xs"><span className="text-[var(--text-muted)]">ECEF:</span> <span className="font-mono text-[var(--text-primary)]">[{result.ecef.map(v => v.toFixed(2)).join(', ')}]</span></div>
            </div>
            <div className="space-y-2">
              <div className="text-xs"><span className="text-[var(--text-muted)]">RMS:</span> <span className="font-mono text-[var(--text-primary)]">{result.rms.toFixed(4)} m</span></div>
              <div className="text-xs"><span className="text-[var(--text-muted)]">Satellites:</span> <span className="font-mono text-[var(--text-primary)]">{result.n_satellites}</span></div>
              <div className="text-xs"><span className="text-[var(--text-muted)]">Epochs:</span> <span className="font-mono text-[var(--text-primary)]">{result.n_epochs}</span></div>
              {ellipse && (
                <div className="text-xs"><span className="text-[var(--text-muted)]">95% Ellipse:</span> <span className="font-mono text-[var(--text-primary)]">a={ellipse.semiMajor.toFixed(3)}m b={ellipse.semiMinor.toFixed(3)}m θ={ellipse.orientation.toFixed(1)}°</span></div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

async function fileToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}
