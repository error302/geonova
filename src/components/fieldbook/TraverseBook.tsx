'use client';

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { reduceEDMObservation, computeMeanAngleDMS as sharedMeanAngleDMS } from '@/lib/survey/adapter'
import { parseFieldAngle } from '@/lib/engine/angles'

type Translator = (key: string, values?: Record<string, string | number>) => string

export type TravRow = {
  id: string
  station: string
  bearing: string
  hclDeg: string; hclMin: string; hclSec: string
  hcrDeg: string; hcrMin: string; hcrSec: string
  slopeDist: string
  vaDeg: string; vaMin: string; vaSec: string
  ih: string; th: string
  remarks: string
}

/**
 * Compute mean angle from HCL/HCR readings.
 * Delegates to the shared survey adapter implementation
 * (was duplicated here and in TraverseFieldBook — now consolidated).
 */
function computeMeanAngleDMS(obs: TravRow): string {
  return sharedMeanAngleDMS(obs.hclDeg, obs.hclMin, obs.hclSec, obs.hcrDeg, obs.hcrMin, obs.hcrSec)
}

function makeEmptyRow(index: number): TravRow {
  return {
    id: crypto.randomUUID(),
    station: `P${index + 2}`,
    bearing: '',
    hclDeg: '', hclMin: '', hclSec: '',
    hcrDeg: '', hcrMin: '', hcrSec: '',
    slopeDist: '',
    vaDeg: '', vaMin: '', vaSec: '',
    ih: '1.5', th: '1.5',
    remarks: '',
  }
}

export function TraverseBook({
  t,
  travMode,
  setTravMode,
  startStation,
  startE,
  startN,
  closeE,
  closeN,
  setStartStation,
  setStartE,
  setStartN,
  setCloseE,
  setCloseN,
  travRows,
  setTravRows,
  computed,
}: {
  t: Translator
  travMode: 'open' | 'closed' | 'link'
  setTravMode: Dispatch<SetStateAction<'open' | 'closed' | 'link'>>
  startStation: string
  startE: string
  startN: string
  closeE: string
  closeN: string
  setStartStation: Dispatch<SetStateAction<string>>
  setStartE: Dispatch<SetStateAction<string>>
  setStartN: Dispatch<SetStateAction<string>>
  setCloseE: Dispatch<SetStateAction<string>>
  setCloseN: Dispatch<SetStateAction<string>>
  travRows: TravRow[]
  setTravRows: Dispatch<SetStateAction<TravRow[]>>
  computed:
    | { ok: false; errors: string[] }
    | { ok: true; mode: 'open'; raw: { legs: Array<{ deltaN: number; deltaE: number; easting: number; northing: number }> } }
    | { ok: true; mode: 'closed' | 'link'; adjusted: { legs: Array<{ adjDeltaN: number; adjDeltaE: number; adjEasting: number; adjNorthing: number }>; closingErrorE: number; closingErrorN: number; linearError: number; totalDistance: number } }
}) {
  const [edmOpen, setEdmOpen] = useState(false)

  // Auto-compute bearing from FL/FR mean whenever travRows change
  useEffect(() => {
    let changed = false
    const updated = travRows.map((row) => {
      const hasHCL = row.hclDeg !== '' || row.hclMin !== '' || row.hclSec !== ''
      const hasHCR = row.hcrDeg !== '' || row.hcrMin !== '' || row.hcrSec !== ''
      if (!hasHCL || !hasHCR) return row
      const meanStr = computeMeanAngleDMS(row)
      if (meanStr === row.bearing) return row
      changed = true
      return { ...row, bearing: meanStr }
    })
    if (changed) setTravRows(updated)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [travRows.map((r) => `${r.hclDeg}-${r.hclMin}-${r.hclSec}-${r.hcrDeg}-${r.hcrMin}-${r.hcrSec}`).join('|')])

  // Helper to build EDM correction rows from computed results
  const edmRows = (() => {
    if (!computed.ok) return []
    const legs = computed.mode === 'open' ? computed.raw.legs : computed.adjusted.legs
    if (!legs || legs.length === 0) return []
    return travRows.map((row, i) => {
      const leg = legs[i]
      if (!leg) return null
      const sd = parseFloat(row.slopeDist) || 0
      const hasDMS = row.vaMin !== '' || row.vaSec !== ''
      const vaDecimal = hasDMS
        ? (parseInt(row.vaDeg) || 0) + (parseInt(row.vaMin) || 0) / 60 + (parseFloat(row.vaSec) || 0) / 3600
        : (parseFieldAngle(row.vaDeg) ?? 0)

      if (sd <= 0) return null

      // Use the survey engine's full correction pipeline (IAG/ISO standard)
      // instead of the old Barrel & Sears / USACE formulas.
      // This gives wavelength-dependent atmospheric correction, WGS84 Earth
      // radius, geoid undulation support, and Simpson's rule line scale factor.
      const edmResult = reduceEDMObservation({
        slopeDistance: sd,
        verticalAngle: vaDecimal,
        // Coordinates available for grid scale factor computation
        fromEasting: parseFloat(startE) || undefined,
        fromNorthing: parseFloat(startN) || undefined,
        // Note: atmospheric/sea level corrections skipped unless
        // temperature/pressure/elevation are provided via the
        // TraverseFieldBook component's Atmospheric Conditions panel
      })

      const fromStation = i === 0 ? startStation : travRows[i - 1]?.station || '?'
      const toStation = row.station || '?'

      return {
        line: `${fromStation} → ${toStation}`,
        sd,
        hd: edmResult.horizontalDistance,
        crCorr: edmResult.crCorrection * 1000,
        gridDist: edmResult.gridDistance,
        atmPPM: edmResult.atmosphericPPM,
        seaPPM: edmResult.seaLevelPPM,
        sf: edmResult.lineScaleFactor,
        warnings: edmResult.warnings,
      }
    }).filter(Boolean)
  })()

  return (
    <div className="card">
      <div className="card-header flex flex-wrap gap-4 items-center justify-between">
        <span className="label">{t('field.traverseBook')}</span>
        <div className="flex gap-2">
          <button onClick={() => setTravMode('open')} className={`btn text-xs ${travMode === 'open' ? 'btn-primary' : 'btn-secondary'}`}>
            {t('traverse.open')}
          </button>
          <button onClick={() => setTravMode('closed')} className={`btn text-xs ${travMode === 'closed' ? 'btn-primary' : 'btn-secondary'}`}>
            {t('traverse.closed')}
          </button>
          <button onClick={() => setTravMode('link')} className={`btn text-xs ${travMode === 'link' ? 'btn-primary' : 'btn-secondary'}`}>
            {t('traverse.link')}
          </button>
        </div>
      </div>

      <div className="card-body space-y-4">
        <div className="grid md:grid-cols-4 gap-3">
          <div>
            <label className="label">{t('common.startStation')}</label>
            <input aria-label="{t('common.startStation')}" className="input input-sm" value={startStation} onChange={(e) => setStartStation(e.target.value)} />
          </div>
          <div>
            <label className="label">{t('common.startEasting')}</label>
            <input aria-label="{t('common.startEasting')}" inputMode="decimal" className="input input-sm" value={startE} onChange={(e) => setStartE(e.target.value)} />
          </div>
          <div>
            <label className="label">{t('common.startNorthing')}</label>
            <input aria-label="{t('common.startNorthing')}" inputMode="decimal" className="input input-sm" value={startN} onChange={(e) => setStartN(e.target.value)} />
          </div>
          {travMode === 'link' ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">{t('traverse.closeE')} <span className="text-red-400">*</span></label>
                <input aria-label="{t('common.startNorthing')}" inputMode="decimal" className="input input-sm" value={closeE} onChange={(e) => setCloseE(e.target.value)} />
              </div>
              <div>
                <label className="label">{t('traverse.closeN')} <span className="text-red-400">*</span></label>
                <input aria-label="Closing northing" inputMode="decimal" className="input input-sm" value={closeN} onChange={(e) => setCloseN(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className={`p-3 border rounded text-xs flex items-center gap-1.5 ${travMode === 'open' ? 'bg-red-900/20 border-red-600 text-red-400' : 'bg-[var(--bg-primary)]/40 border-[var(--border-color)] text-[var(--text-muted)]'}`}>
              {travMode === 'closed'
                ? t('traverse.closedHint')
                : <><AlertTriangle className="w-3.5 h-3.5 inline shrink-0" /> Open traverse: No closing control — prohibited for cadastral surveys per Reg. 67 (swinging traverse). Use link or closed mode instead.</>
              }
            </div>
          )}
        </div>

        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="table min-w-[1400px]">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="text-left" rowSpan={2}>{t('common.station')}</th>
                <th className="text-center" colSpan={3}>HCL (Face Left)</th>
                <th className="text-center" colSpan={3}>HCR (Face Right)</th>
                <th className="text-center" rowSpan={2}>Mean Bearing</th>
                <th className="text-right" rowSpan={2}>SD (m)</th>
                <th className="text-center" colSpan={3}>VA (DMS)</th>
                <th className="text-right" rowSpan={2}>IH (m)</th>
                <th className="text-right" rowSpan={2}>TH (m)</th>
                <th className="text-right" rowSpan={2}>{t('traverse.latitude')}</th>
                <th className="text-right" rowSpan={2}>{t('traverse.departure')}</th>
                <th className="text-right" rowSpan={2}>{t('common.easting')}</th>
                <th className="text-right" rowSpan={2}>{t('common.northing')}</th>
                <th className="text-left" rowSpan={2}>{t('common.remarks')}</th>
                <th rowSpan={2} />
              </tr>
              <tr>
                <th className="text-center text-[10px] text-[var(--text-muted)]">Deg</th>
                <th className="text-center text-[10px] text-[var(--text-muted)]">Min</th>
                <th className="text-center text-[10px] text-[var(--text-muted)]">Sec</th>
                <th className="text-center text-[10px] text-[var(--text-muted)]">Deg</th>
                <th className="text-center text-[10px] text-[var(--text-muted)]">Min</th>
                <th className="text-center text-[10px] text-[var(--text-muted)]">Sec</th>
                <th className="text-center text-[10px] text-[var(--text-muted)]">Deg</th>
                <th className="text-center text-[10px] text-[var(--text-muted)]">Min</th>
                <th className="text-center text-[10px] text-[var(--text-muted)]">Sec</th>
              </tr>
            </thead>
            <tbody>
              {travRows.map((r, idx) => {
                const out = computed.ok ? (computed.mode === 'open' ? computed.raw.legs[idx] : computed.adjusted.legs[idx]) : null
                const lat = out ? (computed.ok && computed.mode === 'open' ? (out as { deltaN: number }).deltaN : (out as { adjDeltaN: number }).adjDeltaN) : null
                const dep = out ? (computed.ok && computed.mode === 'open' ? (out as { deltaE: number }).deltaE : (out as { adjDeltaE: number }).adjDeltaE) : null
                const ee = out ? (computed.ok && computed.mode === 'open' ? (out as { easting: number }).easting : (out as { adjEasting: number }).adjEasting) : null
                const nn = out ? (computed.ok && computed.mode === 'open' ? (out as { northing: number }).northing : (out as { adjNorthing: number }).adjNorthing) : null

                const meanStr = computeMeanAngleDMS(r)

                const upd = (fields: Partial<TravRow>) =>
                  setTravRows((p) => p.map((x) => (x.id === r.id ? { ...x, ...fields } : x)))

                return (
                  <tr key={r.id}>
                    <td className="text-left"><input aria-label="Station" className="input input-sm" value={r.station} onChange={(e) => upd({ station: e.target.value })} /></td>
                    {/* HCL */}
                    <td className="text-center"><input type="number" className="input input-sm font-mono w-14 text-center" value={r.hclDeg} onChange={(e) => upd({ hclDeg: e.target.value })} aria-label="Deg" placeholder="Deg" /></td>
                    <td className="text-center"><input type="number" className="input input-sm font-mono w-14 text-center" value={r.hclMin} onChange={(e) => upd({ hclMin: e.target.value })} aria-label="Min" placeholder="Min" /></td>
                    <td className="text-center"><input type="number" step="0.1" className="input input-sm font-mono w-16 text-center" value={r.hclSec} onChange={(e) => upd({ hclSec: e.target.value })} aria-label="Sec" placeholder="Sec" /></td>
                    {/* HCR */}
                    <td className="text-center"><input type="number" className="input input-sm font-mono w-14 text-center" value={r.hcrDeg} onChange={(e) => upd({ hcrDeg: e.target.value })} aria-label="Deg" placeholder="Deg" /></td>
                    <td className="text-center"><input type="number" className="input input-sm font-mono w-14 text-center" value={r.hcrMin} onChange={(e) => upd({ hcrMin: e.target.value })} aria-label="Min" placeholder="Min" /></td>
                    <td className="text-center"><input type="number" step="0.1" className="input input-sm font-mono w-16 text-center" value={r.hcrSec} onChange={(e) => upd({ hcrSec: e.target.value })} aria-label="Sec" placeholder="Sec" /></td>
                    {/* Mean Bearing */}
                    <td className="text-center font-mono text-xs text-amber-400 whitespace-nowrap">{meanStr}</td>
                    {/* Slope Distance */}
                    <td className="text-right"><input inputMode="decimal" className="input input-sm font-mono w-20 text-right" value={r.slopeDist} onChange={(e) => upd({ slopeDist: e.target.value })} aria-label="100.000" placeholder="100.000" /></td>
                    {/* VA */}
                    <td className="text-center"><input type="number" className="input input-sm font-mono w-14 text-center" value={r.vaDeg} onChange={(e) => upd({ vaDeg: e.target.value })} aria-label="Deg" placeholder="Deg" /></td>
                    <td className="text-center"><input type="number" className="input input-sm font-mono w-14 text-center" value={r.vaMin} onChange={(e) => upd({ vaMin: e.target.value })} aria-label="Min" placeholder="Min" /></td>
                    <td className="text-center"><input type="number" step="0.1" className="input input-sm font-mono w-16 text-center" value={r.vaSec} onChange={(e) => upd({ vaSec: e.target.value })} aria-label="Sec" placeholder="Sec" /></td>
                    {/* IH / TH */}
                    <td className="text-right"><input aria-label="Ih" inputMode="decimal" step="0.001" className="input input-sm font-mono w-14 text-right" value={r.ih} onChange={(e) => upd({ ih: e.target.value })} /></td>
                    <td className="text-right"><input aria-label="Th" inputMode="decimal" step="0.001" className="input input-sm font-mono w-14 text-right" value={r.th} onChange={(e) => upd({ th: e.target.value })} /></td>
                    {/* Computed columns */}
                    <td className="font-mono text-right text-xs">{lat !== null ? Number(lat).toFixed(4) : '—'}</td>
                    <td className="font-mono text-right text-xs">{dep !== null ? Number(dep).toFixed(4) : '—'}</td>
                    <td className="font-mono text-right text-xs">{ee !== null ? Number(ee).toFixed(4) : '—'}</td>
                    <td className="font-mono text-right text-xs">{nn !== null ? Number(nn).toFixed(4) : '—'}</td>
                    {/* Remarks */}
                    <td className="text-left"><input aria-label="Remarks" className="input input-sm" value={r.remarks} onChange={(e) => upd({ remarks: e.target.value })} /></td>
                    <td><button className="btn btn-secondary text-xs" onClick={() => setTravRows((p) => p.filter((x) => x.id !== r.id))}>{t('common.remove')}</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <button onClick={() => setTravRows((p) => [...p, makeEmptyRow(p.length)])} className="btn btn-secondary">
          {t('common.addRow')}
        </button>

        {/* EDM Corrections Panel */}
        {computed.ok && edmRows.length > 0 && (
          <div className="border border-[var(--border-color)] rounded overflow-hidden">
            <button
              onClick={() => setEdmOpen(!edmOpen)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-[var(--bg-primary)]/40 text-sm font-medium hover:bg-[var(--border-color)]/30 transition-colors"
            >
              <span>[Compass] EDM Corrections <span className="text-[var(--text-muted)] font-normal">(Survey Engine · IAG/ISO · UTM 37S)</span></span>
              <span className="text-[var(--text-muted)]">{edmOpen ? '▲' : '▼'}</span>
            </button>
            {edmOpen && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] bg-[var(--bg-primary)]/30">
                      <th className="px-2 py-2 text-left">Line</th>
                      <th className="px-2 py-2 text-right">SD (m)</th>
                      <th className="px-2 py-2 text-right">HD (m)</th>
                      <th className="px-2 py-2 text-right">C&amp;R (mm)</th>
                      <th className="px-2 py-2 text-right">Atm PPM</th>
                      <th className="px-2 py-2 text-right">Scale Factor</th>
                      <th className="px-2 py-2 text-right">Grid Dist (m)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {edmRows.map((row, i) => row && (
                      <tr key={`${row}-${i}`} className="border-b border-[var(--border-color)]/30">
                        <td className="px-2 py-1.5 font-mono">{row.line}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{row.sd.toFixed(3)}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{row.hd.toFixed(3)}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{row.crCorr.toFixed(1)}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-blue-400">{(row as { atmPPM?: number }).atmPPM?.toFixed(1) ?? '—'}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-cyan-400">{(row as { sf?: number }).sf?.toFixed(6) ?? '—'}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-amber-400">{row.gridDist.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {computed.ok && computed.mode !== 'open' && (
          <div className="grid md:grid-cols-4 gap-3">
            <div className="p-3 bg-[var(--bg-primary)]/40 border border-[var(--border-color)] rounded">
              <div className="text-xs text-[var(--text-muted)]">{t('traverse.closingErrorE')}</div>
              <div className="font-mono">{Number(computed.adjusted.closingErrorE).toFixed(4)} m</div>
            </div>
            <div className="p-3 bg-[var(--bg-primary)]/40 border border-[var(--border-color)] rounded">
              <div className="text-xs text-[var(--text-muted)]">{t('traverse.closingErrorN')}</div>
              <div className="font-mono">{Number(computed.adjusted.closingErrorN).toFixed(4)} m</div>
            </div>
            <div className="p-3 bg-[var(--bg-primary)]/40 border border-[var(--border-color)] rounded">
              <div className="text-xs text-[var(--text-muted)]">{t('traverse.linearError')}</div>
              <div className="font-mono">{Number(computed.adjusted.linearError).toFixed(4)} m</div>
            </div>
            <div className="p-3 bg-[var(--bg-primary)]/40 border border-[var(--border-color)] rounded">
              <div className="text-xs text-[var(--text-muted)]">{t('traverse.precision')}</div>
              <div className="font-mono">
                1 : {Math.max(1, Math.round(Number(computed.adjusted.totalDistance) / Math.max(1e-12, Number(computed.adjusted.linearError)))).toLocaleString()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
