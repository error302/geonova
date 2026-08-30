'use client'

import { useState, useCallback } from 'react'
import { Satellite, AlertCircle, CheckCircle2, Loader2, Info } from 'lucide-react'
import type { GNSSPositionResult } from '@/lib/gnss/rinexProcessor'

/**
 * /tools/gnss-rinex — RINEX processing (SPP).
 *
 * REVIVED 2026-08-31 (audit C9 "make it work"): the processing backend is
 * real again — the compute worker parses RINEX 2/3 observation files,
 * evaluates broadcast or IGS SP3 ephemerides, and solves multi-epoch
 * weighted least-squares SPP. Results are labelled honestly (SPP / SPP-IF /
 * SPP-SP3 with accuracy statements); PPP is not claimed because carrier-
 * phase ambiguities are not estimated.
 */

const METHOD_LABELS: Record<string, string> = {
  'SPP': 'SPP — single-frequency code, broadcast ephemeris',
  'SPP-IF': 'SPP — dual-frequency ionosphere-free, broadcast ephemeris',
  'SPP-SP3': 'SPP — IGS precise orbits & clocks (SP3)',
}

export default function GNSSRinexPage() {
  const [obsFile, setObsFile] = useState<File | null>(null)
  const [navFile, setNavFile] = useState<File | null>(null)
  const [usePrecise, setUsePrecise] = useState(false)
  const [stationName, setStationName] = useState('')
  const [result, setResult] = useState<GNSSPositionResult | null>(null)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)

  const handleObsFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setObsFile(e.target.files?.[0] || null)
  }, [])

  const handleNavFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNavFile(e.target.files?.[0] || null)
  }, [])

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

  const handleProcess = async () => {
    if (!obsFile) { setError('RINEX observation file is required'); return }
    setError(''); setResult(null)
    setProcessing(true)
    try {
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
      if (!res.ok) {
        const e = await res.json() as { error?: string }
        throw new Error(e.error || `Failed (${res.status})`)
      }
      const data = await res.json() as { data: GNSSPositionResult }
      setResult(data.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Processing failed')
    } finally {
      setProcessing(false)
    }
  }

  const inputCls = "w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] focus:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] focus:outline-none"

  const sigma = result?.sigma_m
  const dop = result?.dop

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">GNSS RINEX Processing</h1>
      <p className="text-sm text-[var(--text-muted)] mb-6">
        Upload a RINEX observation file for code-based single point positioning. Works
        without a base station — the ephemeris is read from your navigation file or
        fetched automatically (broadcast daily, or IGS precise orbits &amp; clocks).
      </p>

      <div className="bg-[color-mix(in_srgb,var(--bg-secondary)_50%,transparent)] border border-[var(--border-color)] rounded-xl p-4 mb-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] text-[var(--text-muted)] block mb-1" htmlFor="rinex-observation-file-rnx-obs">
              RINEX Observation File (*.obs, *.rnx, *.??o, .gz)
            </label>
            <input id="rinex-observation-file-rnx-obs" type="file" accept=".rnx,.obs,.RNX,.O,.gz,.crx,.d" onChange={handleObsFile} className="w-full text-xs text-[var(--text-secondary)]" />
            {obsFile && <div className="mt-1 text-[10px] text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {obsFile.name} ({(obsFile.size / 1024 / 1024).toFixed(2)} MB)</div>}
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-muted)] block mb-1" htmlFor="rinex-navigation-file-optional">
              RINEX Navigation File (optional — auto-downloaded when omitted)
            </label>
            <input id="rinex-navigation-file-optional" type="file" accept=".nav,.rnx,.N,.gz" onChange={handleNavFile} className="w-full text-xs text-[var(--text-secondary)]" />
            {navFile && <div className="mt-1 text-[10px] text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {navFile.name}</div>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-3">
          <div><label className="text-[10px] text-[var(--text-muted)] block mb-1" htmlFor="station-name">Station Name</label><input id="station-name" value={stationName} onChange={e => setStationName(e.target.value)} className={inputCls} placeholder="e.g. NAIROBI-01 (defaults to the RINEX marker name)" /></div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
              <input type="checkbox" checked={usePrecise} onChange={e => setUsePrecise(e.target.checked)} className="w-4 h-4" />
              Use IGS precise orbits &amp; clocks (SP3) — best accuracy
            </label>
          </div>
        </div>
        <button onClick={handleProcess} disabled={processing || !obsFile} className="mt-3 flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-black text-xs font-semibold rounded-lg hover:bg-[var(--accent-dim)] disabled:opacity-50">
          {processing
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing RINEX…</>
            : <><Satellite className="w-4 h-4" /> Process RINEX file</>}
        </button>
        {processing && <p className="mt-2 text-[10px] text-[var(--text-muted)]">Parsing observations, fetching ephemerides and solving — this can take up to a minute for large files.</p>}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 text-xs text-red-400 flex items-start gap-2" role="alert">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="bg-[color-mix(in_srgb,var(--bg-secondary)_50%,transparent)] border border-[var(--border-color)] rounded-xl p-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Satellite className="w-4 h-4" /> Position Result
              </h2>
              <span className="text-[10px] px-2 py-1 rounded-full bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)] font-medium">
                {METHOD_LABELS[result.method] ?? result.method}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              <div className="text-xs"><span className="text-[var(--text-muted)]">Latitude:</span> <span className="font-mono text-[var(--text-primary)]">{result.latitude.toFixed(8)}°</span></div>
              <div className="text-xs"><span className="text-[var(--text-muted)]">Longitude:</span> <span className="font-mono text-[var(--text-primary)]">{result.longitude.toFixed(8)}°</span></div>
              <div className="text-xs"><span className="text-[var(--text-muted)]">Ellipsoidal height:</span> <span className="font-mono text-[var(--text-primary)]">{result.height.toFixed(4)} m</span></div>
              <div className="text-xs"><span className="text-[var(--text-muted)]">ECEF:</span> <span className="font-mono text-[var(--text-primary)] text-[10px]">[{result.ecef.map(v => v.toFixed(2)).join(', ')}]</span></div>
              <div className="text-xs"><span className="text-[var(--text-muted)]">Satellites used:</span> <span className="font-mono text-[var(--text-primary)]">{result.n_satellites}</span></div>
              <div className="text-xs"><span className="text-[var(--text-muted)]">Epochs solved:</span> <span className="font-mono text-[var(--text-primary)]">{result.n_epochs_used ?? result.n_epochs} / {result.n_epochs}</span></div>
              <div className="text-xs"><span className="text-[var(--text-muted)]">Post-fit RMS:</span> <span className="font-mono text-[var(--text-primary)]">{result.rms.toFixed(4)} m</span></div>
              <div className="text-xs"><span className="text-[var(--text-muted)]">Ephemeris:</span> <span className="font-mono text-[var(--text-primary)]">{result.ephemeris?.notes || 'broadcast'}</span></div>
              {sigma && (
                <>
                  <div className="text-xs"><span className="text-[var(--text-muted)]">Formal σ E/N/U:</span> <span className="font-mono text-[var(--text-primary)]">±{sigma.east.toFixed(2)} / ±{sigma.north.toFixed(2)} / ±{sigma.up.toFixed(2)} m</span></div>
                  {result.scatter_m && (
                    <div className="text-xs"><span className="text-[var(--text-muted)]">Epoch scatter E/N/U:</span> <span className="font-mono text-[var(--text-primary)]">{result.scatter_m.east.toFixed(2)} / {result.scatter_m.north.toFixed(2)} / {result.scatter_m.up.toFixed(2)} m</span></div>
                  )}
                </>
              )}
              {dop && Number.isFinite(dop.pdop) && (
                <div className="text-xs"><span className="text-[var(--text-muted)]">DOP (PDOP/HDOP/VDOP):</span> <span className="font-mono text-[var(--text-primary)]">{dop.pdop.toFixed(2)} / {dop.hdop.toFixed(2)} / {dop.vdop.toFixed(2)}</span></div>
              )}
              {result.time_span && (
                <div className="text-xs"><span className="text-[var(--text-muted)]">Session:</span> <span className="font-mono text-[var(--text-primary)] text-[10px]">{result.time_span.start.replace('T', ' ').replace('Z', '')} → {result.time_span.end.replace('T', ' ').replace('Z', '')}</span></div>
              )}
            </div>
          </div>

          {result.accuracy_note && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-xs text-[var(--text-secondary)] flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" />
              <div><span className="font-medium text-amber-400">Accuracy:</span> {result.accuracy_note}</div>
            </div>
          )}

          {result.warnings && result.warnings.length > 0 && (
            <div className="bg-[color-mix(in_srgb,var(--bg-secondary)_50%,transparent)] border border-[var(--border-color)] rounded-lg p-3 text-xs text-[var(--text-secondary)] space-y-1">
              <p className="font-medium">Processing notes</p>
              {result.warnings.map((w, i) => <p key={i}>• {w}</p>)}
            </div>
          )}

          {result.satellites && result.satellites.length > 0 && (
            <div className="bg-[color-mix(in_srgb,var(--bg-secondary)_50%,transparent)] border border-[var(--border-color)] rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Satellites (last epoch)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-[var(--text-muted)]">
                    <tr>
                      <th className="text-left p-2">SV</th>
                      <th className="text-right p-2">Elevation</th>
                      <th className="text-right p-2">Azimuth</th>
                      <th className="text-right p-2">Obs. mode</th>
                      <th className="text-right p-2">Epochs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.satellites.map(s => (
                      <tr key={s.sat} className="border-t border-[var(--border-color)]">
                        <td className="p-2 font-mono">{s.sat}</td>
                        <td className="p-2 text-right font-mono">{s.elevation_deg.toFixed(1)}°</td>
                        <td className="p-2 text-right font-mono">{s.azimuth_deg.toFixed(1)}°</td>
                        <td className="p-2 text-right">{s.mode === 'IF' ? 'dual-freq IF' : 'single-freq'}</td>
                        <td className="p-2 text-right font-mono">{s.epochs_observed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
