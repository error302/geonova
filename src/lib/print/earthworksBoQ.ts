/**
 * METARDU — Earthworks Bill of Quantities (BoQ) Print Generator
 *
 * Produces a formal earthworks BoQ suitable for submission to
 * contractors, county governments, and KeNHA.
 *
 * Includes:
 *   - Cross-section areas schedule
 *   - End Area and Prismoidal volume computation
 *   - Cumulative volumes with shrinkage adjustment
 *   - Mass haul summary
 *   - Road template specification
 *   - Surveyor's Certificate
 *
 * References:
 *   Ghilani & Wolf — Elementary Surveying 16th Ed., Chapter 26
 *   Merritt, Ricketts & Loftin — Standard Handbook for Civil Engineers 5th Ed.
 *   RDM 1.1 (2025), Section 5.8 — Earthworks
 *   KeNHA Standard Specification for Road and Bridge Works (2014), Section 5
 */

import { buildPrintDocument, openPrint } from './buildPrintDocument'
import type { PrintMeta } from './buildPrintDocument'
import type {
  CrossSectionComputed,
  EarthworkResult,
  RoadTemplate,
} from '@/lib/computations/earthworksEngine'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EarthworksBoQInput {
  /** Computed cross sections */
  sections: CrossSectionComputed[]
  /** Computed earthwork result (volumes, mass ordinates) */
  result: EarthworkResult
  /** Road template used */
  template: RoadTemplate
  /** Road name / description */
  roadName: string
  /** Start chainage (km+m string) */
  startChainage: string
  /** End chainage (km+m string) */
  endChainage: string
  /** Unit rates (KES per m³) */
  cutRate?: number
  fillRate?: number
  compactionRate?: number
  haulRate?: number
  /** Average haul distance (m) */
  avgHaulDistance?: number
  /** Compaction factor (default 1.0 = no extra) */
  compactionFactor?: number
  /** Print meta */
  meta: PrintMeta
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCh(ch: number): string {
  const km = Math.floor(ch / 1000)
  const m = ch % 1000
  return km > 0 ? `${km}+${m.toFixed(3).padStart(7, '0')}` : `0+${m.toFixed(3).padStart(7, '0')}`
}

function fmtNum(n: number, dp: number = 2): string {
  return n.toLocaleString('en-KE', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

function fmtMoney(n: number): string {
  return n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function esc(value: string | number | undefined | null): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function blank(value: string | number | undefined | null): string {
  const text = String(value ?? '').trim()
  return text ? esc(text) : '&mdash;'
}

// ── Body builder ──────────────────────────────────────────────────────────────

function buildBody(inp: EarthworksBoQInput): string {
  const { sections, result, template } = inp
  const cutRate = inp.cutRate ?? 0
  const fillRate = inp.fillRate ?? 0
  const compactionRate = inp.compactionRate ?? 0
  const haulRate = inp.haulRate ?? 0
  const avgHaul = inp.avgHaulDistance ?? 0
  const compFactor = inp.compactionFactor ?? 1.0

  // ── 1. Road Template Specification ──────────────────────
  const templateBox = `
<h2>1. Road Template Specification</h2>
<div class="summary-box" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;">
  <div class="summary-row"><span class="summary-label">Carriageway Width</span><span class="summary-value">${template.carriagewayWidth.toFixed(1)} m</span></div>
  <div class="summary-row"><span class="summary-label">Shoulder Width</span><span class="summary-value">${template.shoulderWidth.toFixed(1)} m (each)</span></div>
  <div class="summary-row"><span class="summary-label">Camber</span><span class="summary-value">${template.camber.toFixed(1)}%</span></div>
  <div class="summary-row"><span class="summary-label">Cut Slope</span><span class="summary-value">1 : ${template.cutSlopeH.toFixed(1)}</span></div>
  <div class="summary-row"><span class="summary-label">Fill Slope</span><span class="summary-value">1 : ${template.fillSlopeH.toFixed(1)}</span></div>
  <div class="summary-row"><span class="summary-label">Shrinkage Factor</span><span class="summary-value">${result.shrinkageFactor}</span></div>
  <div class="summary-row"><span class="summary-label">Road</span><span class="summary-value">${blank(inp.roadName)}</span></div>
  <div class="summary-row"><span class="summary-label">Chainage</span><span class="summary-value">${blank(inp.startChainage || fmtCh(sections[0]?.chainage ?? 0))} → ${blank(inp.endChainage || fmtCh(sections[sections.length - 1]?.chainage ?? 0))}</span></div>
  <div class="summary-row"><span class="summary-label">Sections</span><span class="summary-value">${sections.length}</span></div>
</div>`

  // ── 2. Cross-Section Areas Schedule ─────────────────────
  const sectionRows = sections.map((s, i) => `
<tr>
  <td class="center">${i + 1}</td>
  <td class="mono">${fmtCh(s.chainage)}</td>
  <td class="right mono">${s.centrelineRL.toFixed(3)}</td>
  <td class="right mono">${s.formationRL.toFixed(3)}</td>
  <td class="right mono ${s.centreHeight > 0 ? '' : 'bold'}">${s.centreHeight.toFixed(3)}</td>
  <td class="center"><span class="${s.mode === 'cut' ? 'pass' : s.mode === 'fill' ? 'warn' : ''}">${s.mode.toUpperCase()}</span></td>
  <td class="right mono">${s.cutArea.toFixed(3)}</td>
  <td class="right mono">${s.fillArea.toFixed(3)}</td>
</tr>`).join('')

  const areasTable = `
<h2>2. Cross-Section Areas Schedule</h2>
<table>
  <thead>
    <tr>
      <th style="width:5%">No.</th>
      <th style="width:13%">Chainage</th>
      <th class="right" style="width:12%">CL RL (m)</th>
      <th class="right" style="width:12%">Form RL (m)</th>
      <th class="right" style="width:12%">Ht (m)</th>
      <th style="width:8%">Type</th>
      <th class="right" style="width:14%">Cut A (m²)</th>
      <th class="right" style="width:14%">Fill A (m²)</th>
    </tr>
  </thead>
  <tbody>
    ${sectionRows}
  </tbody>
</table>`

  // ── 3. Volume Computation Schedule ──────────────────────
  const legRows = result.legs.map((leg, i) => `
<tr>
  <td class="center">${i + 1}</td>
  <td class="mono">${fmtCh(leg.fromChainage)}</td>
  <td class="mono">${fmtCh(leg.toChainage)}</td>
  <td class="right mono">${leg.distance.toFixed(3)}</td>
  <td class="right mono">${fmtNum(leg.cutVolEndArea)}</td>
  <td class="right mono">${fmtNum(leg.fillVolEndArea)}</td>
  <td class="right mono bold">${fmtNum(leg.cutVolPrismoidal)}</td>
  <td class="right mono bold">${fmtNum(leg.fillVolPrismoidal)}</td>
  <td class="right mono">${fmtNum(leg.cumCutPrismoidal)}</td>
  <td class="right mono">${fmtNum(leg.cumFillPrismoidal)}</td>
</tr>`).join('')

  const volumeTable = `
<h2>3. Volume Computation Schedule</h2>
<p style="font-size:8pt;color:#555;margin-bottom:4px;">
  Warning: End Area overestimates by up to 3%. Prismoidal values govern. — Ghilani & Wolf, Ch.26
</p>
<table>
  <thead>
    <tr>
      <th style="width:4%">No.</th>
      <th style="width:10%">From</th>
      <th style="width:10%">To</th>
      <th class="right" style="width:7%">Dist (m)</th>
      <th class="right" style="width:10%">Cut EA (m³)</th>
      <th class="right" style="width:10%">Fill EA (m³)</th>
      <th class="right" style="width:11%">Cut Pris (m³)</th>
      <th class="right" style="width:11%">Fill Pris (m³)</th>
      <th class="right" style="width:10%">Cum Cut (m³)</th>
      <th class="right" style="width:10%">Cum Fill (m³)</th>
    </tr>
  </thead>
  <tbody>
    ${legRows}
    <tr style="font-weight:bold;background:#e8e8e8;">
      <td colspan="4" class="bold">TOTALS</td>
      <td class="right mono">${fmtNum(result.totalCutEndArea)}</td>
      <td class="right mono">${fmtNum(result.totalFillEndArea)}</td>
      <td class="right mono bold">${fmtNum(result.totalCutPrismoidal)}</td>
      <td class="right mono bold">${fmtNum(result.totalFillPrismoidal)}</td>
      <td class="right mono">—</td>
      <td class="right mono">—</td>
    </tr>
  </tbody>
</table>`

  // ── 4. Summary & Adjustment ─────────────────────────────
  const adjCut = result.adjustedCut
  const netBalance = adjCut - result.totalFillPrismoidal
  const compactionVol = result.totalFillPrismoidal * compFactor

  const summaryBox = `
<h2>4. Volume Summary & Adjustment</h2>
<div class="summary-box">
  <div class="summary-row"><span class="summary-label">Total Cut (Prismoidal)</span><span class="summary-value">${fmtNum(result.totalCutPrismoidal)} m³</span></div>
  <div class="summary-row"><span class="summary-label">Total Fill (Prismoidal)</span><span class="summary-value">${fmtNum(result.totalFillPrismoidal)} m³</span></div>
  <div class="summary-row"><span class="summary-label">Shrinkage Factor</span><span class="summary-value">${result.shrinkageFactor}</span></div>
  <div class="summary-row"><span class="summary-label">Adjusted Cut (Cut × Shrinkage)</span><span class="summary-value bold">${fmtNum(adjCut)} m³</span></div>
  ${compFactor !== 1.0 ? `<div class="summary-row"><span class="summary-label">Compaction Volume (Fill × ${compFactor})</span><span class="summary-value">${fmtNum(compactionVol)} m³</span></div>` : ''}
  <div class="summary-row"><span class="summary-label">Net Balance (Adj Cut − Fill)</span><span class="summary-value ${netBalance >= 0 ? 'pass' : 'fail'}">${netBalance >= 0 ? '+' : ''}${fmtNum(netBalance)} m³ (${netBalance >= 0 ? 'SURPLUS — haul to spoil' : 'DEFICIT — borrow required'})</span></div>
</div>`

  // ── 5. Bill of Quantities (if rates provided) ───────────
  let boqTable = ''
  if (cutRate > 0 || fillRate > 0) {
    const cutTotal = result.totalCutPrismoidal * cutRate
    const fillTotal = result.totalFillPrismoidal * fillRate
    const compTotal = compactionVol * compactionRate
    const haulTotal = (netBalance > 0 ? netBalance : Math.abs(netBalance)) * (avgHaul / 1000) * haulRate
    const grandTotal = cutTotal + fillTotal + compTotal + haulTotal

    boqTable = `
<h2>5. Bill of Quantities — Earthworks</h2>
<table>
  <thead>
    <tr>
      <th style="width:5%">Item</th>
      <th style="width:35%">Description</th>
      <th class="right" style="width:12%">Quantity</th>
      <th style="width:6%">Unit</th>
      <th class="right" style="width:14%">Rate (KES)</th>
      <th class="right" style="width:18%">Amount (KES)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="center">5.1</td>
      <td>Excavation in common material (cut to fill or spoil)</td>
      <td class="right mono">${fmtNum(result.totalCutPrismoidal)}</td>
      <td class="center">m³</td>
      <td class="right mono">${fmtMoney(cutRate)}</td>
      <td class="right mono bold">${fmtMoney(cutTotal)}</td>
    </tr>
    <tr>
      <td class="center">5.2</td>
      <td>Filling and compaction of embankment</td>
      <td class="right mono">${fmtNum(result.totalFillPrismoidal)}</td>
      <td class="center">m³</td>
      <td class="right mono">${fmtMoney(fillRate)}</td>
      <td class="right mono bold">${fmtMoney(fillTotal)}</td>
    </tr>
    ${compactionRate > 0 ? `
    <tr>
      <td class="center">5.3</td>
      <td>Extra compaction (over-excavation / re-compaction)</td>
      <td class="right mono">${fmtNum(compactionVol)}</td>
      <td class="center">m³</td>
      <td class="right mono">${fmtMoney(compactionRate)}</td>
      <td class="right mono bold">${fmtMoney(compTotal)}</td>
    </tr>` : ''}
    ${haulRate > 0 && avgHaul > 0 ? `
    <tr>
      <td class="center">5.${compactionRate > 0 ? '4' : '3'}</td>
      <td>Haulage of ${netBalance >= 0 ? 'surplus to spoil' : 'borrow material'} (avg ${avgHaul}m)</td>
      <td class="right mono">${fmtNum(Math.abs(netBalance))}</td>
      <td class="center">m³·km</td>
      <td class="right mono">${fmtMoney(haulRate)}</td>
      <td class="right mono bold">${fmtMoney(haulTotal)}</td>
    </tr>` : ''}
  </tbody>
  <tfoot>
    <tr>
      <td colspan="5" class="bold" style="text-align:right;">SUB-TOTAL (Earthworks)</td>
      <td class="right mono bold">${fmtMoney(grandTotal)}</td>
    </tr>
    <tr>
      <td colspan="5" class="bold" style="text-align:right;">VAT (16%)</td>
      <td class="right mono">${fmtMoney(grandTotal * 0.16)}</td>
    </tr>
    <tr>
      <td colspan="5" class="bold" style="text-align:right;">TOTAL (incl. VAT)</td>
      <td class="right mono bold" style="font-size:10pt;">${fmtMoney(grandTotal * 1.16)}</td>
    </tr>
  </tfoot>
</table>`
  }

  // ── 6. Mass Haul Summary ────────────────────────────────
  const massRows = result.massOrdinates.map((m, _i) => `
<tr>
  <td class="mono">${fmtCh(m.chainage)}</td>
  <td class="right mono">${fmtNum(m.cumCut)}</td>
  <td class="right mono">${fmtNum(m.cumFill)}</td>
  <td class="right mono ${m.ordinate >= 0 ? 'pass' : 'fail'}">${m.ordinate >= 0 ? '+' : ''}${fmtNum(m.ordinate)}</td>
</tr>`).join('')

  const massTable = result.massOrdinates.length > 0 ? `
<h2>${boqTable ? '6' : '5'}. Mass Haul Ordinates</h2>
<table>
  <thead>
    <tr>
      <th style="width:25%">Chainage</th>
      <th class="right" style="width:20%">Cum Cut (m³)</th>
      <th class="right" style="width:20%">Cum Fill (m³)</th>
      <th class="right" style="width:25%">Mass Ordinate (m³)</th>
    </tr>
  </thead>
  <tbody>${massRows}</tbody>
</table>` : ''

  // ── Field notes ─────────────────────────────────────────
  const notes = `
<h3>Notes</h3>
<ol style="font-size:8pt;color:#555;line-height:1.6;padding-left:16px;">
  <li>Volumes computed by Prismoidal Formula — Ghilani & Wolf, Elementary Surveying 16th Ed., Chapter 26.</li>
  <li>End Area volumes shown for comparison only; Prismoidal values govern.</li>
  <li>Shrinkage factor ${result.shrinkageFactor} applied to cut volumes per KeNHA Specification Section 5.</li>
  <li>Cross-sections taken perpendicular to centreline at ${sections.length > 1 ? `${(sections[1].chainage - sections[0].chainage).toFixed(0)}m intervals` : '—'}.</li>
  <li>Coordinate system: Arc 1960 / UTM Zone 37S. Heights: MSL (Nairobi datum).</li>
  <li>All quantities are subject to re-measurement upon excavation.</li>
</ol>`

  return `
${templateBox}
${areasTable}
${volumeTable}
${summaryBox}
${boqTable}
${massTable}
${notes}
`
}

// ── Public API ────────────────────────────────────────────────────────────────

export function generateEarthworksBoQ(inp: EarthworksBoQInput): string {
  const meta: PrintMeta = {
    ...inp.meta,
    title: inp.meta.title || 'Earthworks Bill of Quantities',
    reference: 'RDM 1.1 (2025) Section 5.8 | Ghilani & Wolf Ch.26 | KeNHA Specification (2014) Section 5',
  }
  return buildPrintDocument(buildBody(inp), meta)
}

export function printEarthworksBoQ(inp: EarthworksBoQInput): void {
  openPrint(generateEarthworksBoQ(inp))
}
