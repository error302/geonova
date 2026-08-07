/**
 * METARDU — Drone/UAV Survey Report Print Generator
 *
 * Produces a formal drone photogrammetry quality report.
 *
 * Includes:
 *   - Summary of GCP distribution
 *   - Flight parameters
 *   - Accuracy Class assessment
 *   - Checkpoint residuals (horizontal and vertical RMSE)
 *
 * References:
 *   ASPRS Positional Accuracy Standards for Digital Geospatial Data (2014)
 *   RDM 1.1 Kenya (2025)
 */

import { buildPrintDocument, openPrint } from './buildPrintDocument'
import type { PrintMeta } from './buildPrintDocument'

export interface GCPPoint {
  id: number
  name: string
  easting: string
  northing: string
  elevation: string
  status: 'planned' | 'placed' | 'measured'
}

export interface AccuracyClass {
  name: string
  horizontal: number
  vertical: number
  scale: string
}

export interface AccuracyPointResult {
  name: string
  se: number
  sn: number
  sz: number
  de: number
  dn: number
  dz: number
  dE: number
  dN: number
  dZ: number
  horizontalError: number
  error3D: number
}

export interface AccuracyResults {
  points: AccuracyPointResult[]
  hRMSE: number
  vRMSE: number
  maxHorizontal: number
  maxVertical: number
  max3D: number
  horizontalPass: boolean
  verticalPass: boolean
  pass: boolean
}

export interface DroneReportInput {
  gcps: GCPPoint[]
  accuracyResults: AccuracyResults | null
  selectedClass: AccuracyClass
  flightParams: { height: string; gsd: string; overlapFront: string; overlapSide: string }
  meta: PrintMeta
}

function formatNumber(n: number | string, decimals: number = 4): string {
  if (typeof n === 'string') {
    const num = parseFloat(n)
    return isNaN(num) ? '—' : num.toFixed(decimals)
  }
  return n.toFixed(decimals)
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

function buildBody(inp: DroneReportInput): string {
  const { gcps, accuracyResults, selectedClass, flightParams } = inp
  
  const measured = gcps.filter(g => g.status === 'measured').length
  const totalGCPs = gcps.length

  // ── Section 1: Project & Flight Info ───────────────────
  const flightInfoBox = `
<h2>1. Flight & Control Parameters</h2>
<div class="summary-box">
  <div class="summary-row"><span class="summary-label">Target Accuracy Class</span><span class="summary-value bold">${blank(selectedClass.name)} (${blank(selectedClass.scale)})</span></div>
  <div class="summary-row"><span class="summary-label">Total Ground Control Points</span><span class="summary-value">${totalGCPs} (${measured} Measured)</span></div>
  <div class="summary-row"><span class="summary-label">Flying Height (m AGL)</span><span class="summary-value">${blank(flightParams.height)}</span></div>
  <div class="summary-row"><span class="summary-label">Target GSD (cm/px)</span><span class="summary-value">${blank(flightParams.gsd)}</span></div>
  <div class="summary-row"><span class="summary-label">Image Overlap</span><span class="summary-value">${blank(flightParams.overlapFront)}% Front / ${blank(flightParams.overlapSide)}% Side</span></div>
</div>`

  // ── Section 2: Accuracy Assessment Summary ─────────────
  let accuracyBox = ''
  let residualsTable = ''

  if (accuracyResults && accuracyResults.points && accuracyResults.points.length > 0) {
    const pass = accuracyResults.pass

    accuracyBox = `
<h2>2. Accuracy Assessment (ASPRS / RDM 1.1)</h2>
<div class="summary-box">
  <div class="summary-row"><span class="summary-label">Horizontal Tolerance</span><span class="summary-value">≤ ${selectedClass.horizontal.toFixed(3)} m</span></div>
  <div class="summary-row"><span class="summary-label">Vertical Tolerance</span><span class="summary-value">≤ ${selectedClass.vertical.toFixed(3)} m</span></div>
  <div class="summary-row"><span class="summary-label">Horizontal RMSE</span><span class="summary-value ${accuracyResults.horizontalPass ? 'pass' : 'fail'}">${formatNumber(accuracyResults.hRMSE)} m</span></div>
  <div class="summary-row"><span class="summary-label">Vertical RMSE</span><span class="summary-value ${accuracyResults.verticalPass ? 'pass' : 'fail'}">${formatNumber(accuracyResults.vRMSE)} m</span></div>
  <div class="summary-row"><span class="summary-label">Max Horizontal Error</span><span class="summary-value">${formatNumber(accuracyResults.maxHorizontal)} m</span></div>
  <div class="summary-row"><span class="summary-label">Max 3D Error</span><span class="summary-value">${formatNumber(accuracyResults.max3D)} m</span></div>
  <div class="summary-row"><span class="summary-label">Overall Status</span><span class="summary-value bold ${pass ? 'pass' : 'fail'}">${pass ? 'ACCEPTABLE' : 'EXCEEDS TOLERANCE'}</span></div>
</div>`

    // Residuals Table
    const resRows = accuracyResults.points.map((p) => `
<tr>
  <td class="bold mono">${blank(p.name)}</td>
  <td class="right mono">${formatNumber(p.se)}</td>
  <td class="right mono">${formatNumber(p.de)}</td>
  <td class="right mono ${Math.abs(p.dE) > selectedClass.horizontal ? 'fail' : 'pass'}">${formatNumber(p.dE)}</td>
  <td class="right mono">${formatNumber(p.sn)}</td>
  <td class="right mono">${formatNumber(p.dn)}</td>
  <td class="right mono ${Math.abs(p.dN) > selectedClass.horizontal ? 'fail' : 'pass'}">${formatNumber(p.dN)}</td>
  <td class="right mono ${Math.abs(p.dZ) > selectedClass.vertical ? 'fail' : 'pass'}">${formatNumber(p.dZ)}</td>
  <td class="right mono">${formatNumber(p.horizontalError)}</td>
  <td class="right mono">${formatNumber(p.error3D)}</td>
</tr>`).join('\n')

    residualsTable = `
<h2>3. Checkpoint Residuals</h2>
<table>
  <thead>
    <tr>
      <th rowspan="2" style="vertical-align:bottom">Point</th>
      <th colspan="3" class="center">Easting (m)</th>
      <th colspan="3" class="center">Northing (m)</th>
      <th rowspan="2" class="right" style="vertical-align:bottom">ΔZ (m)</th>
      <th rowspan="2" class="right" style="vertical-align:bottom">2D Error</th>
      <th rowspan="2" class="right" style="vertical-align:bottom">3D Error</th>
    </tr>
    <tr>
      <th class="right text-[10px]">Survey</th>
      <th class="right text-[10px]">Drone</th>
      <th class="right text-[10px]">ΔE</th>
      <th class="right text-[10px]">Survey</th>
      <th class="right text-[10px]">Drone</th>
      <th class="right text-[10px]">ΔN</th>
    </tr>
  </thead>
  <tbody>
    ${resRows}
  </tbody>
</table>
<p style="font-size:7.5pt;color:#666;">
  Δ = Drone Computed − Ground Truth Survey &nbsp;|&nbsp;
  2D Error = √(ΔE² + ΔN²) &nbsp;|&nbsp;
  RMSE = √(Σ(Δ²)/n)
</p>`
  } else {
    accuracyBox = `
<h2>2. Accuracy Assessment</h2>
<div class="summary-box">
  <p style="text-align:center;color:#666;width:100%;font-style:italic">No accuracy check data provided.</p>
</div>`
  }

  // ── Notes ───────────────────────────────────────────────
  const notes = `
<h3>Notes</h3>
<ol style="font-size:8pt;color:#555;line-height:1.6;padding-left:16px;">
  <li>Flight executed according to ASPRS Guidelines for Photogrammetric Mapping.</li>
  <li>Ground Control Points measured using RTK GNSS or Total Station methods.</li>
  <li>Tolerances verified against ASPRS Positional Accuracy Standards (2014) and RDM 1.1 Kenya (2025).</li>
</ol>`

  return `
${flightInfoBox}
${accuracyBox}
${residualsTable}
${notes}
`
}

// ── Public API ────────────────────────────────────────────────────────────────

export function generateDroneReport(inp: DroneReportInput): string {
  const meta: PrintMeta = {
    ...inp.meta,
    title: inp.meta.title || 'UAV Survey Report',
    reference: 'ASPRS Positional Accuracy Standards (2014) | RDM 1.1 Table 2.4',
  }
  return buildPrintDocument(buildBody(inp), meta)
}

export function printDroneReport(inp: DroneReportInput): void {
  openPrint(generateDroneReport(inp))
}
