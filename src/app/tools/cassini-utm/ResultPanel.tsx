'use client'

// Result panel — right panel of the Cassini ↔ UTM converter.
//
// Contains: single conversion result card (with WGS84 geographic
// approximation), empty state for single mode, and the batch results
// table with copy / download CSV buttons.
//
// Extracted from src/app/tools/cassini-utm/page.tsx.

import {
  AlertTriangle,
  Copy,
  Check,
  Download,
  Globe,
} from 'lucide-react'
import {
  toDMS,
} from '@/lib/geo/cassini'
import type {
  ConversionResult,
  TopoSheetParams,
} from '@/lib/geo/cassini'
import { r1, r3, r4 } from './formatHelpers'

interface ResultPanelProps {
  inputMode: 'single' | 'batch'
  direction: 'cassini-to-utm' | 'utm-to-cassini'
  // single
  singleResult: ConversionResult | null
  singleWGS84: { lat: number; lon: number } | null
  activeSheet: TopoSheetParams
  copied: boolean
  handleCopySingle: () => void
  // batch
  batchResults: ConversionResult[]
  batchErrors: string[]
  handleCopyBatchCsv: () => void
  handleDownloadCsv: () => void
}

export function ResultPanel({
  inputMode,
  direction,
  singleResult,
  singleWGS84,
  activeSheet,
  copied,
  handleCopySingle,
  batchResults,
  batchErrors,
  handleCopyBatchCsv,
  handleDownloadCsv,
}: ResultPanelProps) {
  return (
    <div className="space-y-6">
      {/* ── 1. Single Result Card ── */}
      {inputMode === 'single' && singleResult && (
        <div className="card">
          <div className="card-header">
            <span className="label text-sm font-semibold">Conversion Result</span>
            <button onClick={handleCopySingle} className="btn btn-secondary text-xs px-2 py-1">
              {copied ? <Check className="h-3.5 w-3.5 text-[var(--success)]" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="card-body space-y-4">
            {singleResult.warning && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                {singleResult.warning}
              </div>
            )}

            {/* Source */}
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-1 uppercase tracking-wider font-medium">Source</p>
              {direction === 'cassini-to-utm' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase">Cassini Easting</p>
                    <p className="font-mono text-sm text-[var(--text-primary)]">{r1(singleResult.cassiniE)} ft</p>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase">Cassini Northing</p>
                    <p className="font-mono text-sm text-[var(--text-primary)]">{r1(singleResult.cassiniN)} ft</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase">UTM Easting</p>
                    <p className="font-mono text-sm text-[var(--text-primary)]">{r3(singleResult.utmE)} m</p>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase">UTM Northing</p>
                    <p className="font-mono text-sm text-[var(--text-primary)]">{r3(singleResult.utmN)} m</p>
                  </div>
                </div>
              )}
            </div>

            {/* Result */}
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-1 uppercase tracking-wider font-medium">
                Result ({direction === 'cassini-to-utm' ? 'UTM (metres)' : 'Cassini (feet)'})
              </p>
              {direction === 'cassini-to-utm' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-[var(--accent-subtle)] border border-[color-mix(in_srgb,var(--accent)_20%,transparent)]">
                    <p className="text-[10px] text-[var(--accent)] uppercase">UTM Easting</p>
                    <p className="font-mono text-sm text-[var(--text-primary)]">{r3(singleResult.utmE)} m</p>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--accent-subtle)] border border-[color-mix(in_srgb,var(--accent)_20%,transparent)]">
                    <p className="text-[10px] text-[var(--accent)] uppercase">UTM Northing</p>
                    <p className="font-mono text-sm text-[var(--text-primary)]">{r3(singleResult.utmN)} m</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-[var(--accent-subtle)] border border-[color-mix(in_srgb,var(--accent)_20%,transparent)]">
                    <p className="text-[10px] text-[var(--accent)] uppercase">Cassini Easting</p>
                    <p className="font-mono text-sm text-[var(--text-primary)]">{r1(singleResult.cassiniE)} ft</p>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--accent-subtle)] border border-[color-mix(in_srgb,var(--accent)_20%,transparent)]">
                    <p className="text-[10px] text-[var(--accent)] uppercase">Cassini Northing</p>
                    <p className="font-mono text-sm text-[var(--text-primary)]">{r1(singleResult.cassiniN)} ft</p>
                  </div>
                </div>
              )}
            </div>

            {/* Intermediate: conformal correction */}
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-1 uppercase tracking-wider font-medium">Intermediate</p>
              <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                <p className="text-[10px] text-[var(--text-muted)] uppercase">Conformal-corrected Easting</p>
                <p className="font-mono text-sm text-[var(--text-primary)]">{r1(singleResult.conformalE)} ft</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  Correction: {r4(singleResult.conformalE - singleResult.cassiniE)} ft from raw E
                </p>
              </div>
            </div>

            {/* Sheet info */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
              <span className="text-xs text-[var(--text-muted)]">Sheet: {activeSheet.name}</span>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                P={activeSheet.P} Q={activeSheet.Q}
              </span>
            </div>

            {/* WGS84 Geographic Output */}
            {singleWGS84 && (
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1 uppercase tracking-wider font-medium">
                  <Globe className="h-3 w-3 inline-block mr-1" />
                  WGS84 Geographic (approximate)
                </p>
                <div className="p-3 rounded-lg bg-[var(--accent-subtle)] border border-[color-mix(in_srgb,var(--accent)_20%,transparent)] space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-[var(--accent)] uppercase">Latitude</p>
                      <p className="font-mono text-sm text-[var(--text-primary)]">{singleWGS84.lat.toFixed(8)}°</p>
                      <p className="font-mono text-xs text-[var(--text-secondary)]">{toDMS(singleWGS84.lat, true)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--accent)] uppercase">Longitude</p>
                      <p className="font-mono text-sm text-[var(--text-primary)]">{singleWGS84.lon.toFixed(8)}°</p>
                      <p className="font-mono text-xs text-[var(--text-secondary)]">{toDMS(singleWGS84.lon, false)}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    <AlertTriangle className="w-3.5 h-3.5 inline shrink-0" /> Approximate — datum shift from Arc 1960 to WGS84 not applied (~10–30 m)
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Empty state for single ── */}
      {inputMode === 'single' && !singleResult && (
        <div className="card">
          <div className="card-body flex flex-col items-center justify-center py-12 text-center">
            <Globe className="h-10 w-10 text-[var(--text-muted)] mb-3" />
            <p className="text-sm text-[var(--text-muted)]">
              Enter coordinates and click <strong>Convert</strong> to see results
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Cassini values in FEET (negative northing for south of origin)
            </p>
          </div>
        </div>
      )}

      {/* ── 2. Batch Results Table ── */}
      {inputMode === 'batch' && batchResults.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="label text-sm font-semibold">
              Batch Results ({batchResults.length} points)
            </span>
            <div className="flex gap-2">
              <button onClick={handleCopyBatchCsv} className="btn btn-secondary text-xs px-2 py-1">
                {copied ? <Check className="h-3.5 w-3.5 text-[var(--success)]" /> : <Copy className="h-3.5 w-3.5" />}
                Copy CSV
              </button>
              <button onClick={handleDownloadCsv} className="btn btn-secondary text-xs px-2 py-1">
                <Download className="h-3.5 w-3.5" />
                Download CSV
              </button>
            </div>
          </div>
          <div className="card-body p-0">
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="table-header">
                    <th className="table-cell text-left font-semibold py-2 px-3">ID</th>
                    <th className="table-cell text-right font-semibold py-2 px-3">
                      Src E ({direction === 'cassini-to-utm' ? 'ft' : 'm'})
                    </th>
                    <th className="table-cell text-right font-semibold py-2 px-3">
                      Src N ({direction === 'cassini-to-utm' ? 'ft' : 'm'})
                    </th>
                    <th className="table-cell text-right font-semibold py-2 px-3">
                      Tgt E ({direction === 'cassini-to-utm' ? 'm' : 'ft'})
                    </th>
                    <th className="table-cell text-right font-semibold py-2 px-3">
                      Tgt N ({direction === 'cassini-to-utm' ? 'm' : 'ft'})
                    </th>
                    <th className="table-cell text-right font-semibold py-2 px-3">Conf. E (ft)</th>
                  </tr>
                </thead>
                <tbody>
                  {batchResults.map((r, i) => (
                    <tr key={r.id ?? i} className="table-row">
                      <td className="table-cell py-2 px-3 font-medium text-[var(--text-primary)]">
                        {r.id ?? i + 1}
                        {r.warning && (
                          <span className="ml-1 inline-flex" title={r.warning}>
                            <AlertTriangle className="h-3 w-3 text-[var(--warning)]" />
                          </span>
                        )}
                      </td>
                      <td className="table-cell py-2 px-3 text-right font-mono">
                        {direction === 'cassini-to-utm' ? r1(r.cassiniE) : r3(r.utmE)}
                      </td>
                      <td className="table-cell py-2 px-3 text-right font-mono">
                        {direction === 'cassini-to-utm' ? r1(r.cassiniN) : r3(r.utmN)}
                      </td>
                      <td className="table-cell py-2 px-3 text-right font-mono text-[var(--accent)]">
                        {direction === 'cassini-to-utm' ? r3(r.utmE) : r1(r.cassiniE)}
                      </td>
                      <td className="table-cell py-2 px-3 text-right font-mono text-[var(--accent)]">
                        {direction === 'cassini-to-utm' ? r3(r.utmN) : r1(r.cassiniN)}
                      </td>
                      <td className="table-cell py-2 px-3 text-right font-mono text-[var(--text-muted)]">
                        {r1(r.conformalE)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[var(--border-color)] bg-[var(--bg-tertiary)]">
                    <td colSpan={6} className="table-cell py-2 px-3 font-semibold text-[var(--text-muted)]">
                      Sheet: {activeSheet.name} — {batchResults.length} points converted
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Batch parse errors */}
            {batchErrors.length > 0 && (
              <div className="px-4 py-3 border-t border-[var(--border-color)]">
                <p className="text-xs text-[var(--warning)] font-medium mb-1">Parse warnings:</p>
                {batchErrors.map((err, i) => (
                  <p key={`${err}-${i}`} className="text-[10px] text-[var(--text-muted)]">{err}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
