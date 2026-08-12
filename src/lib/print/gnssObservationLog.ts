/**
 * METARDU — GNSS Observation Log / Baseline Report
 *
 * Produces a formal GNSS observation log suitable for submission
 * to the Director of Surveys or project record-keeping.
 *
 * Includes:
 *   - Session header (project, equipment, date, operator)
 *   - Occupation schedule table (start/end, duration, satellites, PDOP)
 *   - Baseline vectors table (from/to, ΔE/ΔN/ΔU, distance, RMS)
 *   - Quality assessment summary
 *   - Surveyor's Certificate
 *
 * References:
 *   Survey Act Cap 299, s.22 (survey records)
 *   Survey Regulations 1994, Reg. 21 (instrument records)
 *   ISK — GNSS Best Practice Guidelines (2019)
 *   ISO 17123-8: GNSS field procedures
 */

import { buildPrintDocument, openPrint } from './buildPrintDocument'
import type { PrintMeta } from './buildPrintDocument'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GNSSObservationEntry {
  /** Point ID e.g. "BM_101" */
  pointId: string
  /** Session start time ISO string */
  startTime: string
  /** Session end time ISO string */
  endTime: string
  /** Duration in minutes */
  durationMin: number
  /** Number of satellites tracked */
  satellites: number
  /** Position Dilution of Precision */
  pdop: number
  /** Horizontal DOP */
  hdop: number
  /** Vertical DOP */
  vdop: number
  /** Fix type */
  fixType: 'FIX' | 'FLOAT' | 'DGNSS' | 'AUTONOMOUS' | 'RTK_FIX' | 'RTK_FLOAT'
  /** Antenna height in metres */
  antennaHeight: number
  /** Antenna measurement method */
  antennaMeasurement: 'SLANT' | 'VERTICAL' | 'ARP'
  /** Easting (projected) */
  easting?: number
  /** Northing (projected) */
  northing?: number
  /** Ellipsoidal height */
  ellHeight?: number
  /** Orthometric height */
  orthoHeight?: number
  /** RMS horizontal error (metres) */
  rmsH?: number
  /** RMS vertical error (metres) */
  rmsV?: number
  /** Notes */
  notes?: string
}

export interface GNSSBaselineEntry {
  /** From station */
  from: string
  /** To station */
  to: string
  /** Delta Easting (metres) */
  deltaE: number
  /** Delta Northing (metres) */
  deltaN: number
  /** Delta Elevation (metres) */
  deltaU: number
  /** Slope distance (metres) */
  distance: number
  /** Azimuth WCB (degrees) */
  azimuth: number
  /** Solution type */
  solution: 'FIX' | 'FLOAT' | 'DGNSS'
  /** Ratio (fix quality indicator) */
  ratio?: number
  /** RMS of baseline solution (metres) */
  rms: number
}

export interface GNSSLogInput {
  observations: GNSSObservationEntry[]
  baselines: GNSSBaselineEntry[]
  /** Equipment details */
  receiverModel: string
  receiverSerial: string
  antennaModel: string
  antennaSerial: string
  /** Reference station */
  baseStationId: string
  baseStationSource: 'OWN_BASE' | 'CORS' | 'VRS' | 'THIRD_PARTY'
  /** Coordinate system / datum */
  datum: string
  projection: string
  geoidModel: string
  /** Cutoff angle in degrees */
  elevationMask: number
  /** Epoch interval in seconds */
  epochInterval: number
  /** RINEX version if applicable */
  rinexVersion?: string
  /** Processing software */
  processingSoftware?: string
  /** Meta for header */
  meta: PrintMeta
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  } catch { return iso }
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return iso }
}

function fixClass(fix: string): string {
  if (fix === 'FIX' || fix === 'RTK_FIX') return 'pass'
  if (fix === 'FLOAT' || fix === 'RTK_FLOAT') return 'warn'
  return 'fail'
}

function dmsFromDec(deg: number): string {
  const d = Math.floor(deg)
  const minDec = (deg - d) * 60
  const m = Math.floor(minDec)
  const s = (minDec - m) * 60
  return `${String(d).padStart(3, '0')}°${String(m).padStart(2, '0')}'${s.toFixed(1).padStart(4, '0')}"`
}

// ── Body HTML builder ─────────────────────────────────────────────────────────

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

function buildBody(inp: GNSSLogInput): string {
  const obs = inp.observations
  const bsl = inp.baselines

  // ── Equipment box ────────────────────────────────────────────
  const equipmentBox = `
<div class="summary-box" style="display:grid;grid-template-columns:1fr 1fr;gap:0;">
  <div class="summary-row"><span class="summary-label">Receiver</span><span class="summary-value">${blank(inp.receiverModel)}</span></div>
  <div class="summary-row"><span class="summary-label">Receiver S/N</span><span class="summary-value">${blank(inp.receiverSerial)}</span></div>
  <div class="summary-row"><span class="summary-label">Antenna</span><span class="summary-value">${blank(inp.antennaModel)}</span></div>
  <div class="summary-row"><span class="summary-label">Antenna S/N</span><span class="summary-value">${blank(inp.antennaSerial)}</span></div>
  <div class="summary-row"><span class="summary-label">Base Station</span><span class="summary-value">${blank(inp.baseStationId)} (${blank(inp.baseStationSource.replace(/_/g, ' '))})</span></div>
  <div class="summary-row"><span class="summary-label">Elevation Mask</span><span class="summary-value">${inp.elevationMask}°</span></div>
  <div class="summary-row"><span class="summary-label">Epoch Interval</span><span class="summary-value">${inp.epochInterval}s</span></div>
  <div class="summary-row"><span class="summary-label">Datum / Projection</span><span class="summary-value">${blank(inp.datum)} / ${blank(inp.projection)}</span></div>
  <div class="summary-row"><span class="summary-label">Geoid Model</span><span class="summary-value">${blank(inp.geoidModel)}</span></div>
  <div class="summary-row"><span class="summary-label">Processing Software</span><span class="summary-value">${blank(inp.processingSoftware || 'N/A')}</span></div>
</div>`

  // ── Observation schedule table ──────────────────────────────
  const obsRows = obs.map((o, i) => `
<tr>
  <td class="center">${i + 1}</td>
  <td class="bold mono">${blank(o.pointId)}</td>
  <td class="mono">${fmtTime(o.startTime)}</td>
  <td class="mono">${fmtTime(o.endTime)}</td>
  <td class="right mono">${o.durationMin.toFixed(0)}</td>
  <td class="center">${o.satellites}</td>
  <td class="right mono">${o.pdop.toFixed(1)}</td>
  <td class="right mono">${o.hdop.toFixed(1)}</td>
  <td class="center"><span class="${fixClass(o.fixType)}">${o.fixType.replace(/_/g, ' ')}</span></td>
  <td class="right mono">${o.antennaHeight.toFixed(3)}</td>
  <td class="center" style="font-size:7.5pt">${o.antennaMeasurement}</td>
</tr>`).join('')

  const obsTable = `
<h2>1. Occupation Schedule</h2>
<table>
  <thead>
    <tr>
      <th style="width:4%">No.</th>
      <th style="width:10%">Point</th>
      <th style="width:8%">Start</th>
      <th style="width:8%">End</th>
      <th class="right" style="width:6%">Min</th>
      <th style="width:5%">Sats</th>
      <th class="right" style="width:6%">PDOP</th>
      <th class="right" style="width:6%">HDOP</th>
      <th style="width:10%">Fix</th>
      <th class="right" style="width:8%">Ant H (m)</th>
      <th style="width:5%">Meas</th>
    </tr>
  </thead>
  <tbody>
    ${obsRows || '<tr><td colspan="11" class="center" style="color:#999;font-style:italic;">No observations entered</td></tr>'}
  </tbody>
</table>`

  // ── Coordinate results table ────────────────────────────────
  const coordRows = obs.filter(o => o.easting && o.northing).map((o, i) => `
<tr>
  <td class="center">${i + 1}</td>
  <td class="bold mono">${blank(o.pointId)}</td>
  <td class="right mono">${o.easting?.toFixed(3) ?? '—'}</td>
  <td class="right mono">${o.northing?.toFixed(3) ?? '—'}</td>
  <td class="right mono">${o.ellHeight?.toFixed(3) ?? '—'}</td>
  <td class="right mono">${o.orthoHeight?.toFixed(3) ?? '—'}</td>
  <td class="right mono">${o.rmsH?.toFixed(3) ?? '—'}</td>
  <td class="right mono">${o.rmsV?.toFixed(3) ?? '—'}</td>
</tr>`).join('')

  const coordTable = coordRows ? `
<h2>2. Coordinate Results — ${blank(inp.datum)}</h2>
<table>
  <thead>
    <tr>
      <th style="width:4%">No.</th>
      <th style="width:10%">Point</th>
      <th class="right" style="width:14%">Easting (m)</th>
      <th class="right" style="width:14%">Northing (m)</th>
      <th class="right" style="width:12%">Ell. Ht (m)</th>
      <th class="right" style="width:12%">Ortho Ht (m)</th>
      <th class="right" style="width:10%">RMS H (m)</th>
      <th class="right" style="width:10%">RMS V (m)</th>
    </tr>
  </thead>
  <tbody>${coordRows}</tbody>
</table>` : ''

  // ── Baseline vectors table ──────────────────────────────────
  const bslRows = bsl.map((b, i) => `
<tr>
  <td class="center">${i + 1}</td>
  <td class="bold mono">${blank(b.from)}</td>
  <td class="bold mono">${blank(b.to)}</td>
  <td class="right mono">${b.deltaE.toFixed(3)}</td>
  <td class="right mono">${b.deltaN.toFixed(3)}</td>
  <td class="right mono">${b.deltaU.toFixed(3)}</td>
  <td class="right mono">${b.distance.toFixed(3)}</td>
  <td class="mono">${dmsFromDec(b.azimuth)}</td>
  <td class="center"><span class="${b.solution === 'FIX' ? 'pass' : b.solution === 'FLOAT' ? 'warn' : 'fail'}">${b.solution}</span></td>
  <td class="right mono">${b.ratio?.toFixed(1) ?? '—'}</td>
  <td class="right mono">${b.rms.toFixed(4)}</td>
</tr>`).join('')

  const bslTable = bsl.length > 0 ? `
<h2>${coordRows ? '3' : '2'}. Baseline Vectors</h2>
<table>
  <thead>
    <tr>
      <th style="width:4%">No.</th>
      <th style="width:8%">From</th>
      <th style="width:8%">To</th>
      <th class="right" style="width:10%">ΔE (m)</th>
      <th class="right" style="width:10%">ΔN (m)</th>
      <th class="right" style="width:10%">ΔU (m)</th>
      <th class="right" style="width:10%">Dist (m)</th>
      <th style="width:12%">Azimuth</th>
      <th style="width:6%">Sol</th>
      <th class="right" style="width:6%">Ratio</th>
      <th class="right" style="width:8%">RMS (m)</th>
    </tr>
  </thead>
  <tbody>${bslRows}</tbody>
</table>` : ''

  // ── Quality assessment ──────────────────────────────────────
  const fixCount = obs.filter(o => o.fixType === 'FIX' || o.fixType === 'RTK_FIX').length
  const floatCount = obs.filter(o => o.fixType === 'FLOAT' || o.fixType === 'RTK_FLOAT').length
  const avgPdop = obs.length > 0 ? obs.reduce((a, o) => a + o.pdop, 0) / obs.length : 0
  const avgSats = obs.length > 0 ? obs.reduce((a, o) => a + o.satellites, 0) / obs.length : 0
  const maxRms = bsl.length > 0 ? Math.max(...bsl.map(b => b.rms)) : 0
  const avgRms = bsl.length > 0 ? bsl.reduce((a, b) => a + b.rms, 0) / bsl.length : 0
  const allFixed = fixCount === obs.length
  const minSats = obs.length > 0 ? Math.min(...obs.map(o => o.satellites)) : 0

  const qualitySection = `
<h2>${coordRows ? '4' : bsl.length > 0 ? '3' : '2'}. Quality Assessment</h2>
<div class="summary-box">
  <div class="summary-row"><span class="summary-label">Total observations</span><span class="summary-value">${obs.length}</span></div>
  <div class="summary-row"><span class="summary-label">Fixed solutions</span><span class="summary-value ${allFixed ? 'pass' : 'warn'}">${fixCount} / ${obs.length} (${obs.length > 0 ? ((fixCount / obs.length) * 100).toFixed(0) : 0}%)</span></div>
  <div class="summary-row"><span class="summary-label">Float solutions</span><span class="summary-value">${floatCount}</span></div>
  <div class="summary-row"><span class="summary-label">Avg PDOP</span><span class="summary-value ${avgPdop <= 3 ? 'pass' : avgPdop <= 6 ? 'warn' : 'fail'}">${avgPdop.toFixed(2)}</span></div>
  <div class="summary-row"><span class="summary-label">Avg satellites</span><span class="summary-value">${avgSats.toFixed(1)}</span></div>
  <div class="summary-row"><span class="summary-label">Min satellites</span><span class="summary-value ${minSats >= 5 ? 'pass' : 'fail'}">${minSats}</span></div>
  ${bsl.length > 0 ? `
  <div class="summary-row"><span class="summary-label">Total baselines</span><span class="summary-value">${bsl.length}</span></div>
  <div class="summary-row"><span class="summary-label">Avg baseline RMS</span><span class="summary-value ${avgRms <= 0.01 ? 'pass' : avgRms <= 0.05 ? 'warn' : 'fail'}">${avgRms.toFixed(4)} m</span></div>
  <div class="summary-row"><span class="summary-label">Max baseline RMS</span><span class="summary-value ${maxRms <= 0.02 ? 'pass' : maxRms <= 0.1 ? 'warn' : 'fail'}">${maxRms.toFixed(4)} m</span></div>
  ` : ''}
  <div class="summary-row"><span class="summary-label">Overall quality</span><span class="summary-value ${allFixed && avgPdop <= 3 ? 'pass' : 'warn'}">${allFixed && avgPdop <= 3 ? 'EXCELLENT' : fixCount > obs.length / 2 ? 'ACCEPTABLE' : 'REVIEW REQUIRED'}</span></div>
</div>`

  // ── Field notes ─────────────────────────────────────────────
  const obsWithNotes = obs.filter(o => o.notes)
  const notesSection = obsWithNotes.length > 0 ? `
<h2>Field Notes</h2>
<table>
  <thead>
    <tr>
      <th style="width:15%">Point</th>
      <th>Notes</th>
    </tr>
  </thead>
  <tbody>
    ${obsWithNotes.map(o => `<tr><td class="bold mono">${blank(o.pointId)}</td><td>${blank(o.notes)}</td></tr>`).join('')}
  </tbody>
</table>` : ''

  return `
${equipmentBox}
${obsTable}
${coordTable}
${bslTable}
${qualitySection}
${notesSection}
`
}

// ── Public API ────────────────────────────────────────────────────────────────

export function generateGNSSObservationLog(inp: GNSSLogInput): string {
  const meta: PrintMeta = {
    ...inp.meta,
    title: inp.meta.title || 'GNSS Observation Log',
    reference: 'Survey Act Cap 299 | Survey Regulations 1994, Reg. 21 | ISK GNSS Guidelines 2019 | ISO 17123-8',
  }
  return buildPrintDocument(buildBody(inp), meta)
}

export function printGNSSObservationLog(inp: GNSSLogInput): void {
  openPrint(generateGNSSObservationLog(inp))
}
