/**
 * METARDU — Level Book Computation Sheet Print Generator
 *
 * Produces a formal leveling observation and computation sheet.
 *
 * Includes:
 *   - Table 1: Field Observations (Station, BS, IS, FS, HPC/Rise/Fall, RL, Remarks)
 *   - Table 2: Arithmetic Checks & Closure (ΣBS, ΣFS, ΣRise, ΣFall, Misclosure)
 *   - Closure validation against 10√K mm standard (RDM 1.1 Table 5.1)
 *   - Surveyor's Certificate
 *
 * References:
 *   Survey Act Cap 299, Survey Regulations 1994, Regulation 3(2)
 *   RDM 1.1 Kenya (2025), Table 5.1 — Allowable misclosures
 *   N.N. Basak — Surveying and Levelling
 */

import { buildPrintDocument, openPrint } from './buildPrintDocument'
import type { PrintMeta } from './buildPrintDocument'
import type { LevelBookResult, LevelBookRow } from '@/lib/computations/traverseEngine'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LevelBookPrintInput {
  result: LevelBookResult
  meta: PrintMeta
}

function esc(value: string | number | undefined | null): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── Body builder ──────────────────────────────────────────────────────────────

function buildBody(inp: LevelBookPrintInput): string {
  const r = inp.result
  const isRF = r.method === 'rise_and_fall'
  const mLabel = isRF ? 'Rise & Fall' : 'Height of Collimation'

  // ── Table 1: Field Book ────────────────────────────────
  const tableRows = r.rows.map((row: LevelBookRow) => `
<tr>
  <td class="bold mono">${esc(row.station)}</td>
  <td class="right mono">${row.bs !== undefined ? row.bs.toFixed(3) : ''}</td>
  <td class="right mono">${row.is !== undefined ? row.is.toFixed(3) : ''}</td>
  <td class="right mono">${row.fs !== undefined ? row.fs.toFixed(3) : ''}</td>
  <td class="right mono">${row.hi !== undefined ? row.hi.toFixed(3) : ''}</td>
  ${isRF ? `<td class="right mono" style="color:green">${row.rise !== undefined ? row.rise.toFixed(3) : ''}</td>` : ''}
  ${isRF ? `<td class="right mono" style="color:red">${row.fall !== undefined ? row.fall.toFixed(3) : ''}</td>` : ''}
  <td class="right mono bold">${row.rl !== undefined ? row.rl.toFixed(3) : ''}</td>
  <td class="right mono">${row.distance !== undefined ? row.distance.toFixed(2) : ''}</td>
  <td>${esc(row.remarks || '')}</td>
</tr>`).join('\n')

  const obsTable = `
<h2>1. Level Book Observations (${mLabel} Method)</h2>
<table>
  <thead>
    <tr>
      <th style="width:10%">Station</th>
      <th class="right" style="width:8%">BS (m)</th>
      <th class="right" style="width:8%">IS (m)</th>
      <th class="right" style="width:8%">FS (m)</th>
      <th class="right" style="width:10%">HPC (m)</th>
      ${isRF ? '<th class="right" style="width:8%">Rise (m)</th>' : ''}
      ${isRF ? '<th class="right" style="width:8%">Fall (m)</th>' : ''}
      <th class="right" style="width:10%">RL (m)</th>
      <th class="right" style="width:8%">Dist (m)</th>
      <th style="width:22%">Remarks</th>
    </tr>
  </thead>
  <tbody>
    ${tableRows}
  </tbody>
</table>
<p style="font-size:7.5pt;color:#666;">
  HPC = Height of Plane of Collimation (HI in American convention) &nbsp;|&nbsp;
  RL = HPC − (IS or FS) &nbsp;|&nbsp;
  ${isRF ? 'Rise/Fall = Prev RL − Current RL' : ''}
</p>`

  // ── Table 2: Closure & Arithmetic ──────────────────────
  const closureBox = `
<h2>2. Arithmetic Checks & Closure</h2>
<div class="summary-box">
  <div class="summary-row"><span class="summary-label">Method</span><span class="summary-value">${mLabel}</span></div>
  <div class="summary-row"><span class="summary-label">ΣBS</span><span class="summary-value">${r.sumBS.toFixed(3)} m</span></div>
  <div class="summary-row"><span class="summary-label">ΣFS</span><span class="summary-value">${r.sumFS.toFixed(3)} m</span></div>
  <div class="summary-row"><span class="summary-label">ΣBS − ΣFS</span><span class="summary-value">${(r.sumBS - r.sumFS).toFixed(3)} m</span></div>
  
  ${isRF ? `
  <div class="summary-row"><span class="summary-label">ΣRise</span><span class="summary-value">${r.sumRise.toFixed(3)} m</span></div>
  <div class="summary-row"><span class="summary-label">ΣFall</span><span class="summary-value">${r.sumFall.toFixed(3)} m</span></div>
  <div class="summary-row"><span class="summary-label">ΣRise − ΣFall</span><span class="summary-value">${(r.sumRise - r.sumFall).toFixed(3)} m</span></div>
  ` : ''}
  
  <div class="summary-row"><span class="summary-label">Arithmetic Check (ΣBS − ΣFS = Last RL − First RL)</span><span class="summary-value ${r.arithmeticPass ? 'pass' : 'fail'}">${r.arithmeticPass ? 'PASS ' : 'FAIL [x]'} (${r.arithmeticCheck.toFixed(6)} m)</span></div>
  <div class="summary-row"><span class="summary-label">Misclosure</span><span class="summary-value">${r.misclosure > 0 ? r.misclosure.toFixed(6) + ' m' : '—'}</span></div>
  <div class="summary-row"><span class="summary-label">Allowable Misclosure (C = 10√K mm, K = ${r.distanceKm} km)</span><span class="summary-value">${r.allowableMisclosure.toFixed(3)} m</span></div>
  <div class="summary-row"><span class="summary-label">Closure Check — RDM 1.1 (2025) Table 5.1</span><span class="summary-value ${r.isAcceptable ? 'pass' : 'fail'} bold">${r.isAcceptable ? 'ACCEPTABLE' : 'EXCEEDS TOLERANCE'}</span></div>
  <div class="summary-row"><span class="summary-label">Formula</span><span class="summary-value">${r.formula}</span></div>
</div>`

  return `
${obsTable}
${closureBox}
`
}

// ── Public API ────────────────────────────────────────────────────────────────

export function generateLevelBookSheet(inp: LevelBookPrintInput): string {
  const meta: PrintMeta = {
    ...inp.meta,
    title: inp.meta.title || `Level Book — ${inp.result.method === 'rise_and_fall' ? 'Rise & Fall' : 'Height of Collimation'}`,
    reference: 'RDM 1.1 (2025) Table 5.1 | Survey Act Cap 299 | Survey Regulations 1994',
  }
  return buildPrintDocument(buildBody(inp), meta)
}

export function printLevelBookSheet(inp: LevelBookPrintInput): void {
  openPrint(generateLevelBookSheet(inp))
}
