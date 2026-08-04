'use client';

import { useState } from 'react'
import { printSettingOutSchedule } from '@/lib/print/settingOutSchedule'
import { PrintMetaPanel, defaultPrintMeta } from '@/components/shared/PrintMetaPanel'
import type { PrintMeta } from '@/components/shared/PrintMetaPanel'
import type { SettingOutResult } from '@/lib/computations/settingOutEngine'

interface Props {
  result: SettingOutResult
  station: { e: string; n: string; rl: string; ih: string }
}

export default function StakeOutSheet({ result }: Props) {
  const [printMeta, setPrintMeta] = useState<PrintMeta>(defaultPrintMeta)
  const [jobDescription, setJobDescription] = useState('')
  const [expanded, setExpanded] = useState(false)

  const { rows, bsBearing, instrumentStation, backsight } = result

  function handlePrint() {
    printSettingOutSchedule({ meta: printMeta, result, jobDescription: jobDescription || undefined })
  }

  return (
    <div className="space-y-4 text-sm">

      {/* ── SETUP SUMMARY ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs font-mono">
        <div>
          <span className="text-[var(--text-muted)]">Station: </span>
          <span className="text-[var(--text-primary)] font-bold">{instrumentStation.e.toFixed(3)}, {instrumentStation.n.toFixed(3)}</span>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Station RL: </span>
          <span className="text-[var(--text-primary)] font-bold">{instrumentStation.rl.toFixed(3)} m</span>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">IH: </span>
          <span className="text-[var(--text-primary)] font-bold">{instrumentStation.ih.toFixed(3)} m</span>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Backsight: </span>
          <span className="text-[var(--text-primary)] font-bold">{backsight.e.toFixed(3)}, {backsight.n.toFixed(3)}</span>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">BS Bearing: </span>
          <span className="text-[var(--accent)] font-bold">{bsBearing}</span>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Points: </span>
          <span className="text-[var(--text-primary)] font-bold">{rows.length}</span>
        </div>
      </div>

      {/* ── POINT PREVIEW TABLE ─────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono border-collapse">
          <thead>
            <tr className="bg-[var(--bg-tertiary)]">
              {['Point', 'Design E', 'Design N', 'Design RL', 'Hz Angle from BS', 'HD (m)', 'VD (m)', 'VA', 'SD (m)', 'TH (m)'].map(h => (
                <th key={h} className="px-2 py-2 text-right first:text-left border border-[var(--border-color)] text-[var(--text-muted)] font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any, i: number) => (
              <tr key={row.id} className={i % 2 === 0 ? 'bg-transparent' : 'bg-[var(--bg-tertiary)]/30'}>
                <td className="px-2 py-1.5 border border-[var(--border-color)]/50 font-bold text-[var(--text-primary)]">{row.id}</td>
                <td className="px-2 py-1.5 border border-[var(--border-color)]/50 text-right text-[var(--text-primary)]">{row.designE.toFixed(3)}</td>
                <td className="px-2 py-1.5 border border-[var(--border-color)]/50 text-right text-[var(--text-primary)]">{row.designN.toFixed(3)}</td>
                <td className="px-2 py-1.5 border border-[var(--border-color)]/50 text-right text-[var(--text-primary)]">{row.designRL.toFixed(3)}</td>
                <td className="px-2 py-1.5 border border-[var(--border-color)]/50 text-right text-[var(--accent)] font-bold">{row.HzAngle}</td>
                <td className="px-2 py-1.5 border border-[var(--border-color)]/50 text-right text-[var(--text-primary)]">{row.HD.toFixed(3)}</td>
                <td className="px-2 py-1.5 border border-[var(--border-color)]/50 text-right text-[var(--text-primary)]">{row.heightDiff.toFixed(3)}</td>
                <td className="px-2 py-1.5 border border-[var(--border-color)]/50 text-right text-[var(--text-secondary)]">{row.VA}</td>
                <td className="px-2 py-1.5 border border-[var(--border-color)]/50 text-right text-[var(--text-secondary)]">{row.SD.toFixed(3)}</td>
                <td className="px-2 py-1.5 border border-[var(--border-color)]/50 text-right text-[var(--text-muted)]">{row.TH.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── PRINT HEADER ────────────────────────────────────────────── */}
      <div className="card">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-left"
          onClick={() => setExpanded(v => !v)}
        >
          <span className="font-semibold text-sm">Print Header Details</span>
          <span className="text-[var(--text-muted)] text-xs">{expanded ? '▲ collapse' : '▼ fill in for formal submission'}</span>
        </button>
        {expanded && (
          <div className="border-t border-[var(--border-color)] p-4 space-y-4">
            <PrintMetaPanel meta={printMeta} onChange={setPrintMeta} />

            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1" htmlFor="job-description-instructions-to-contractor-optional">
                Job Description / Instructions to Contractor <span className="text-[var(--text-muted)] font-normal">(optional)</span>
              </label>
              <textarea
                 id="job-description-instructions-to-contractor-optional" className="input w-full resize-none"
                rows={3}
                value={jobDescription}
                placeholder="e.g. All pegs to be 50×50mm timber, 600mm long driven 400mm into ground. Paint top red for cut, green for fill."
                onChange={e => setJobDescription(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── WHAT'S INCLUDED ─────────────────────────────────────────── */}
      <div className="p-3 bg-[var(--bg-tertiary)]/50 rounded border border-[var(--border-color)] text-xs space-y-1 text-[var(--text-muted)]">
        <p className="font-semibold text-[var(--text-primary)] mb-1.5">Schedule will include:</p>
        <p> Standard document header (project · client · date · surveyor · reg no · instrument)</p>
        <p> Instrument station: E, N, RL, IH — Backsight: E, N, WCB bearing</p>
        <p> Full table: Point ID · Design E · Design N · Design RL · Hz Angle · HD · VD · VA · SD · TH</p>
        <p> 10 field notes including construction tolerance (±25mm H / ±15mm V — RDM 1.1 Table 5.2)</p>
        <p> Surveyor&apos;s Certificate — Survey Regulations 1994, Regulation 3(2)</p>
        <p className="font-mono mt-1">Reference: Ghilani &amp; Wolf Ch.23 | RDM 1.1 (2025) Table 5.2 | Survey Act Cap 299</p>
      </div>

      {/* ── PRINT BUTTON ────────────────────────────────────────────── */}
      <button
        onClick={handlePrint}
        disabled={rows.length === 0}
        className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent-dim)] disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold rounded text-sm transition-colors"
      >
        Print Setting Out Schedule — {rows.length} point{rows.length !== 1 ? 's' : ''}
      </button>

    </div>
  )
}
