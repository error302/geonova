'use client'

/**
 * GNSS Baseline Processing Panel — RTKLIB double-difference pipeline.
 *
 * Uploads base + rover RINEX observation files and a navigation file, runs
 * the real RTKLIB baseline via /api/gnss/baseline-process, and displays:
 *
 *   - the fixed/float solution summary (quality, ratio, sigmas, fix %)
 *   - the per-station session-QC tables: SNR (L1/L2), MP1/MP2 multipath,
 *     cycle slips, tracking %, slip method — computed in the Python worker
 *   - a "Save observation report to submission" action that persists the
 *     report into project_submissions.generated_artifacts via
 *     /api/submission/gnss-observation-report (marks the rtk_result section
 *     ready in the Phase 13 package manifest).
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Satellite,
  AlertCircle,
  CheckCircle2,
  FileDown,
  Loader2,
  Save,
  ShieldCheck,
} from 'lucide-react'
import type {
  BaselineProcessOptions,
  BaselineProcessResult,
  GNSSSatelliteQC,
  GNSSStationQC,
} from '@/lib/online/gnssBaseline'
import { processBaseline } from '@/lib/online/gnssBaseline'
import { sha256 } from '@/lib/audit/auditHash'
import type { GNSSInputFile } from '@/lib/submission/gnssObservationReport'

interface ProjectOption {
  id: string
  name: string
}

const inputCls =
  'w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] focus:border-[var(--accent)]/30 focus:outline-none'
const selectCls = inputCls
const labelCls = 'text-[10px] text-[var(--text-muted)] block mb-1'

export default function GNSSBaselinePage() {
  const [baseFile, setBaseFile] = useState<File | null>(null)
  const [roverFile, setRoverFile] = useState<File | null>(null)
  const [navFile, setNavFile] = useState<File | null>(null)

  const [mode, setMode] = useState<'static' | 'kinematic'>('static')
  const [frequency, setFrequency] = useState<'l1' | 'l2' | 'l1+l2'>('l1+l2')
  const [elevationMask, setElevationMask] = useState(15)
  const [ambiguity, setAmbiguity] = useState<'fix' | 'float' | 'off'>('fix')
  const [qcMode, setQcMode] = useState<'auto' | 'rinex3_multignss' | 'legacy'>('auto')
  const [baseStation, setBaseStation] = useState('BASE')
  const [roverStation, setRoverStation] = useState('ROVER')

  const [baseline, setBaseline] = useState<BaselineProcessResult | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  // Project picker for the save-to-submission action.
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [projectId, setProjectId] = useState('')
  const [projectsError, setProjectsError] = useState('')

  // Save-to-submission state.
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ verdict: string; manifestSection: string } | null>(null)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/projects?limit=200', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: { data?: Array<{ id: string; name: string }> }) => {
        if (cancelled) return
        setProjects(Array.isArray(data?.data) ? data.data.map((p) => ({ id: p.id, name: p.name })) : [])
      })
      .catch(() => {
        if (!cancelled) setProjectsError('Could not load projects — select one from the save panel instead if it loads later.')
      })
    return () => { cancelled = true }
  }, [])

  const handleProcess = useCallback(async () => {
    setError('')
    setSaveResult(null)
    setSaveError('')
    if (!baseFile || !roverFile || !navFile) {
      setError('Base, rover, and navigation RINEX files are all required.')
      return
    }
    setProcessing(true)
    try {
      const [baseRinex, roverRinex, navRinex] = await Promise.all([
        baseFile.text(),
        roverFile.text(),
        navFile.text(),
      ])
      if (baseRinex.trim().length < 100 || roverRinex.trim().length < 100 || navRinex.trim().length < 100) {
        setError('One of the RINEX files appears truncated — each file must contain a full observation/navigation header and body.')
        return
      }
      const options: BaselineProcessOptions = { mode, frequency, elevationMask, ambiguityResolution: ambiguity, qcMode }
      const result = await processBaseline({ baseRinex, roverRinex, navRinex, options })
      setBaseline(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Baseline processing failed.')
    } finally {
      setProcessing(false)
    }
  }, [baseFile, roverFile, navFile, mode, frequency, elevationMask, ambiguity, qcMode])

  const handleSave = useCallback(async () => {
    if (!baseline) return
    if (!projectId) {
      setSaveError('Select a project to attach the observation report to.')
      return
    }
    setSaving(true)
    setSaveError('')
    setSaveResult(null)
    try {
      // Self-certifying digests: hash the exact RINEX bytes the engine
      // processed (the same text read for the baseline call), so the saved
      // report anchors to the raw input files.
      const inputFiles: GNSSInputFile[] = []
      const fileRoles = [
        { role: 'base' as const, file: baseFile },
        { role: 'rover' as const, file: roverFile },
        { role: 'nav' as const, file: navFile },
      ]
      for (const { role, file } of fileRoles) {
        if (!file) continue
        inputFiles.push({
          role,
          fileName: file.name,
          sizeBytes: file.size,
          sha256: await sha256(await file.text()),
        })
      }
      const res = await fetch('/api/submission/gnss-observation-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId,
          baseline,
          qc: baseline.qc,
          options: { mode, frequency, elevationMask, ambiguityResolution: ambiguity },
          baseStation,
          roverStation,
          inputFiles,
        }),
      })
      interface SaveReportResponse {
        error?: string
        verdict?: string
        manifest?: { statusBySection?: Record<string, string> }
      }
      const data = (await res.json().catch(() => ({}))) as SaveReportResponse
      if (!res.ok) {
        throw new Error(data.error || `Save failed (HTTP ${res.status})`)
      }
      setSaveResult({
        verdict: data.verdict ?? 'pass',
        manifestSection: data.manifest?.statusBySection?.rtk_result ?? 'ready',
      })
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }, [baseline, projectId, mode, frequency, elevationMask, ambiguity, baseStation, roverStation, baseFile, roverFile, navFile])

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">GNSS Baseline (RTKLIB)</h1>
      <p className="text-sm text-[var(--text-muted)] mb-6">
        Double-difference baseline processing of raw RINEX files via RTKLIB (rnx2rtkp) in the Python worker.
        Displays the fixed/float solution and per-satellite session QC — multipath, cycle slips, SNR, and tracking.
      </p>

      {/* ─── Inputs ─────────────────────────────────────────────────────── */}
      <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4 mb-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls} htmlFor="base-rinex">Base RINEX Observation (*.rnx, *.obs)</label>
            <input id="base-rinex" type="file" accept=".rnx,.obs,.o,.RNX,.O,.obs.gz" onChange={(e) => setBaseFile(e.target.files?.[0] || null)} className="w-full text-xs text-[var(--text-secondary)]" />
            {baseFile && <div className="mt-1 text-[10px] text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {baseFile.name} ({baseFile.size.toLocaleString()} B)</div>}
          </div>
          <div>
            <label className={labelCls} htmlFor="rover-rinex">Rover RINEX Observation (*.rnx, *.obs)</label>
            <input id="rover-rinex" type="file" accept=".rnx,.obs,.o,.RNX,.O,.obs.gz" onChange={(e) => setRoverFile(e.target.files?.[0] || null)} className="w-full text-xs text-[var(--text-secondary)]" />
            {roverFile && <div className="mt-1 text-[10px] text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {roverFile.name} ({roverFile.size.toLocaleString()} B)</div>}
          </div>
          <div>
            <label className={labelCls} htmlFor="nav-rinex">Navigation File — broadcast ephemeris (*.nav, *.rnx)</label>
            <input id="nav-rinex" type="file" accept=".nav,.rnx,.n,.N,.nav.gz" onChange={(e) => setNavFile(e.target.files?.[0] || null)} className="w-full text-xs text-[var(--text-secondary)]" />
            {navFile && <div className="mt-1 text-[10px] text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {navFile.name} ({navFile.size.toLocaleString()} B)</div>}
          </div>
        </div>

        <div className="grid grid-cols-6 gap-4 mt-4">
          <div>
            <label className={labelCls} htmlFor="bb-mode">Mode</label>
            <select id="bb-mode" className={selectCls} value={mode} onChange={(e) => setMode(e.target.value as 'static' | 'kinematic')}>
              <option value="static">Static</option>
              <option value="kinematic">Kinematic</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="bb-freq">Frequency</label>
            <select id="bb-freq" className={selectCls} value={frequency} onChange={(e) => setFrequency(e.target.value as 'l1' | 'l2' | 'l1+l2')}>
              <option value="l1+l2">L1 + L2</option>
              <option value="l1">L1 only</option>
              <option value="l2">L2 only</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="bb-elev">Elevation Mask (deg)</label>
            <input id="bb-elev" type="number" min={0} max={90} className={inputCls} value={elevationMask} onChange={(e) => setElevationMask(Number(e.target.value) || 15)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="bb-amb">Ambiguity Resolution</label>
            <select id="bb-amb" className={selectCls} value={ambiguity} onChange={(e) => setAmbiguity(e.target.value as 'fix' | 'float' | 'off')}>
              <option value="fix">Fix (integer)</option>
              <option value="float">Float</option>
              <option value="off">Off</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="bb-qcmode">QC Signal Model</label>
            <select id="bb-qcmode" className={selectCls} value={qcMode} onChange={(e) => setQcMode(e.target.value as 'auto' | 'rinex3_multignss' | 'legacy')}>
              <option value="auto">Auto (detect from RINEX)</option>
              <option value="rinex3_multignss">Multi-GNSS (G/E/C/R)</option>
              <option value="legacy">Legacy GPS L1/L2</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="bb-base">Base Station Name</label>
            <input id="bb-base" className={inputCls} value={baseStation} onChange={(e) => setBaseStation(e.target.value || 'BASE')} />
          </div>
          <div>
            <label className={labelCls} htmlFor="bb-rover">Rover Station Name</label>
            <input id="bb-rover" className={inputCls} value={roverStation} onChange={(e) => setRoverStation(e.target.value || 'ROVER')} />
          </div>
        </div>

        <button
          onClick={handleProcess}
          disabled={processing || !baseFile || !roverFile || !navFile}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-black text-xs font-semibold rounded-lg hover:bg-[var(--accent-dim)] disabled:opacity-50"
        >
          {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Satellite className="w-4 h-4" />}
          {processing ? 'Processing baseline (RTKLIB can take a few minutes)...' : 'Process Baseline'}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 text-xs text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* ─── Solution summary ───────────────────────────────────────────── */}
      {baseline && (
        <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2 text-[var(--text-primary)]">
              <ShieldCheck className="w-4 h-4" /> Baseline Solution
            </h2>
            <QualityBadge quality={baseline.quality} />
          </div>
          <div className="grid grid-cols-4 gap-4 text-xs">
            <Stat label="Ambiguity ratio" value={baseline.ratio.toFixed(2)} mono />
            <Stat label="Satellites" value={String(baseline.sat_count)} />
            <Stat label="σ N / E / U" value={`${baseline.sigma_north.toFixed(4)} / ${baseline.sigma_east.toFixed(4)} / ${baseline.sigma_up.toFixed(4)} m`} mono />
            <Stat label="Rover position" value={`${baseline.rover_latitude.toFixed(6)}°, ${baseline.rover_longitude.toFixed(6)}°, ${baseline.rover_height.toFixed(3)} m`} mono />
          </div>
          {baseline.solution_summary && (
            <div className="mt-3 pt-3 border-t border-[var(--border-color)] grid grid-cols-5 gap-4 text-xs">
              <Stat label="Epochs processed" value={String(baseline.solution_summary.epochs)} />
              <Stat label="Fixed epochs" value={`${baseline.solution_summary.fixed_epochs} (${baseline.solution_summary.fix_pct}%)`} />
              <Stat label="Float epochs" value={String(baseline.solution_summary.float_epochs)} />
              <Stat label="Final solution" value={baseline.solution_summary.final_solution} />
              <Stat label="Mean ratio" value={baseline.solution_summary.ratio.toFixed(2)} mono />
            </div>
          )}
          {baseline.epoch_solutions && (
            <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
              {Object.entries(baseline.epoch_solutions)
                .filter(([, count]) => count > 0)
                .map(([type, count]) => (
                  <span key={type} className="px-2 py-1 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-secondary)]">
                    {type}: <span className="text-[var(--text-primary)] font-mono">{count}</span>
                  </span>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Session QC tables ──────────────────────────────────────────── */}
      {baseline?.qc && (
        <div className="space-y-4 mb-4">
          <StationQCTable title="Base Station QC" station={baseline.qc.base} />
          <StationQCTable title="Rover Station QC" station={baseline.qc.rover} />
        </div>
      )}
      {baseline && !baseline.qc && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4 text-xs text-amber-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> Session QC was not computed for this baseline — verify observation quality manually before submitting.
        </div>
      )}

      {/* ─── Save observation report to submission ──────────────────────── */}
      {baseline && (
        <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-1 flex items-center gap-2 text-[var(--text-primary)]">
            <Save className="w-4 h-4" /> Save Observation Report to Submission
          </h2>
          <p className="text-xs text-[var(--text-muted)] mb-3">
            Builds the printable GNSS observation report (verdict + QC evidence) and attaches it to the project&apos;s
            submission package — marking the RTK / Field Result section ready in the Phase 13 manifest.
          </p>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="min-w-[280px]">
              <label className={labelCls} htmlFor="bb-project">Project</label>
              <select id="bb-project" className={selectCls} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">Select a project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {projectsError && <div className="mt-1 text-[10px] text-amber-400">{projectsError}</div>}
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !projectId}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-black text-xs font-semibold rounded-lg hover:bg-[var(--accent-dim)] disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save Observation Report'}
            </button>
          </div>

          {saveError && (
            <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {saveError}
            </div>
          )}
          {saveResult && (
            <div className="mt-3 bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-xs text-green-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Saved — report verdict: <span className="font-semibold uppercase">{saveResult.verdict}</span>.
              Package manifest: RTK / Field Result section is <span className="font-semibold">{saveResult.manifestSection}</span>.
              The report will be included in the assembled submission ZIP as <span className="font-mono">gnss_observation_report.txt</span>.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Small presentational helpers ───────────────────────────────────────────

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-[var(--text-muted)] mb-0.5">{label}</div>
      <div className={`text-[var(--text-primary)] ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  )
}

function QualityBadge({ quality }: { quality: BaselineProcessResult['quality'] }) {
  const color =
    quality === 'FIX' ? 'bg-green-500/15 text-green-400 border-green-500/30'
      : quality === 'FLOAT' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
        : 'bg-red-500/15 text-red-400 border-red-500/30'
  return (
    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${color}`}>
      {quality} SOLUTION
    </span>
  )
}

function VerdictBadge({ verdict }: { verdict: GNSSStationQC['verdict'] }) {
  if (!verdict) return null
  const color =
    verdict === 'pass' ? 'bg-green-500/15 text-green-400 border-green-500/30'
      : verdict === 'warn' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
        : 'bg-red-500/15 text-red-400 border-red-500/30'
  return <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${color}`}>{verdict}</span>
}

function fmtNum(v: number | null | undefined, digits = 2): string {
  return v == null || Number.isNaN(v) ? '—' : v.toFixed(digits)
}

function StationQCTable({ title, station }: { title: string; station: GNSSStationQC }) {
  if (!station.available) {
    return (
      <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">{title}</h3>
        <p className="text-xs text-amber-400">{station.error ?? 'QC unavailable for this station.'}</p>
      </div>
    )
  }

  return (
    <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
        <VerdictBadge verdict={station.verdict} />
      </div>
      <div className="grid grid-cols-6 gap-3 text-xs mb-3">
        <Stat label="Epochs" value={String(station.epoch_count ?? '—')} />
        <Stat label="Duration" value={station.duration_minutes != null ? `${station.duration_minutes} min` : '—'} />
        <Stat label="Interval" value={station.interval_sec != null ? `${station.interval_sec} s` : '—'} />
        <Stat label="Satellites" value={`${station.mean_sats_per_epoch ?? '—'} (min ${station.min_sats ?? '—'} / max ${station.max_sats ?? '—'})`} />
        <Stat label="Cycle slips" value={String(station.total_cycle_slips ?? 0)} />
        <Stat label="Slip ratio" value={station.slip_ratio != null ? station.slip_ratio.toFixed(4) : '—'} mono />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="text-[10px] text-[var(--text-muted)] uppercase">
              <th className="text-left py-1 pr-2 font-medium">Sat</th>
              <th className="text-left py-1 pr-2 font-medium">Sys</th>
              <th className="text-left py-1 pr-2 font-medium">Signals</th>
              <th className="text-right py-1 pr-2 font-medium">Track %</th>
              <th className="text-right py-1 pr-2 font-medium">SNR 1</th>
              <th className="text-right py-1 pr-2 font-medium">SNR 2</th>
              <th className="text-right py-1 pr-2 font-medium">MP1 (m)</th>
              <th className="text-right py-1 pr-2 font-medium">MP2 (m)</th>
              <th className="text-right py-1 pr-2 font-medium">Slips</th>
              <th className="text-left py-1 font-medium">Method</th>
            </tr>
          </thead>
          <tbody>
            {(station.satellites ?? []).map((sat: GNSSSatelliteQC) => (
              <tr key={sat.satellite} className="border-t border-[var(--border-color)]/60">
                <td className="py-1 pr-2 font-mono text-[var(--text-primary)]">{sat.satellite}</td>
                <td className="py-1 pr-2 text-[var(--text-secondary)]">{sat.system}</td>
                <td className="py-1 pr-2 font-mono text-[var(--text-secondary)]">{sat.signal_1 && sat.signal_2 ? `${sat.signal_1}/${sat.signal_2}` : sat.signal_1 || (sat.system === 'G' ? 'L1/L2' : '—')}</td>
                <td className={`py-1 pr-2 text-right font-mono ${sat.tracking_pct < 90 ? 'text-amber-400' : 'text-[var(--text-primary)]'}`}>{fmtNum(sat.tracking_pct, 1)}%</td>
                <td className="py-1 pr-2 text-right font-mono text-[var(--text-primary)]">{fmtNum(sat.snr_1_mean ?? sat.snr_l1_mean, 1)}</td>
                <td className="py-1 pr-2 text-right font-mono text-[var(--text-primary)]">{fmtNum(sat.snr_2_mean ?? sat.snr_l2_mean, 1)}</td>
                <td className={`py-1 pr-2 text-right font-mono ${(sat.mp_1_rms_m ?? sat.mp1_rms_m ?? sat.mp_1_mean_m ?? sat.mp1_mean_m ?? 0) > 0.5 ? 'text-amber-400' : 'text-[var(--text-primary)]'}`}>{fmtNum(sat.mp_1_rms_m ?? sat.mp1_rms_m ?? sat.mp_1_mean_m ?? sat.mp1_mean_m, 3)}</td>
                <td className={`py-1 pr-2 text-right font-mono ${(sat.mp_2_rms_m ?? sat.mp2_rms_m ?? sat.mp_2_mean_m ?? sat.mp2_mean_m ?? 0) > 0.5 ? 'text-amber-400' : 'text-[var(--text-primary)]'}`}>{fmtNum(sat.mp_2_rms_m ?? sat.mp2_rms_m ?? sat.mp_2_mean_m ?? sat.mp2_mean_m, 3)}</td>
                <td className={`py-1 pr-2 text-right font-mono ${(sat.cycle_slips ?? 0) > 2 ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>{sat.cycle_slips}</td>
                <td className="py-1 text-[var(--text-secondary)]">{sat.slip_method}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {station.satellites && station.satellites.length === 0 && (
        <p className="text-xs text-[var(--text-muted)]">No per-satellite QC rows were produced for this station.</p>
      )}

      {station.issues && station.issues.length > 0 && (
        <div className="mt-3 space-y-1">
          {station.issues.map((issue, i) => (
            <div key={`${issue.code}-${i}`} className={`text-[11px] flex items-center gap-1.5 ${issue.level === 'fail' ? 'text-red-400' : 'text-amber-400'}`}>
              <AlertCircle className="w-3 h-3 shrink-0" /> [{issue.level.toUpperCase()}] {issue.message}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
