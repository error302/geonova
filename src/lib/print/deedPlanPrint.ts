/**
 * METARDU — Deed Plan / Boundary Identification Plan (BIP)
 *
 * Produces a Kenya Survey Regulations 1994-compliant A3 landscape deed plan
 * suitable for submission to the Director of Surveys.
 *
 * Layout: Left panel (parcel drawing) | Right panel (title block + schedules)
 *
 * References:
 *   Survey Act Cap 299, s.22 & s.28 (plan requirements)
 *   Survey Regulations 1994, Reg. 5 (plan format), Reg. 20 (beacon descriptions)
 *   Land Registration Act 2012, s.10 (title plan requirements)
 *   Basak, N.N. — Surveying and Levelling, Ch. 11 (traverse closure)
 */

import { openPrint } from './buildPrintDocument'
import type { DeedPlanInput, BoundaryPoint, BoundaryLeg } from '@/types/deedPlan'
import { computeBoundaryLegs, computeArea, computeClosureCheck } from '@/lib/compute/deedPlan'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DeedPlanPrintInput {
  input: DeedPlanInput
}

// ── Area conversions ──────────────────────────────────────────────────────────

function areaHa(sqm: number): string  { return (sqm / 10000).toFixed(4) }
function areaAcres(sqm: number): string { return (sqm / 4046.856).toFixed(4) }

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

// ── Parcel SVG drawing ────────────────────────────────────────────────────────

interface ScaledPoint { x: number; y: number; id: string; markType: string; markStatus: string }

function drawParcelSVG(points: BoundaryPoint[], legs: BoundaryLeg[], scale: number): string {
  if (points.length < 3) {
    return `<svg viewBox="0 0 600 500" xmlns="http://www.w3.org/2000/svg">
      <text x="300" y="250" text-anchor="middle" font-size="14" fill="#999">Add at least 3 boundary points</text>
    </svg>`
  }

  const PAD = 60
  const W = 580
  const H = 480

  const minE = Math.min(...points.map(p => p.easting))
  const maxE = Math.max(...points.map(p => p.easting))
  const minN = Math.min(...points.map(p => p.northing))
  const maxN = Math.max(...points.map(p => p.northing))

  const rangeE = maxE - minE || 1
  const rangeN = maxN - minN || 1

  const scaleX = (W - PAD * 2) / rangeE
  const scaleY = (H - PAD * 2) / rangeN
  const s = Math.min(scaleX, scaleY)

  // Centre the drawing
  const drawW = rangeE * s
  const drawH = rangeN * s
  const offX = (W - drawW) / 2
  const offY = (H - drawH) / 2

  // N is up in surveying — invert Y axis
  const toX = (e: number) => offX + (e - minE) * s
  const toY = (n: number) => H - offY - (n - minN) * s

  const scaled: ScaledPoint[] = points.map(p => ({
    x: toX(p.easting),
    y: toY(p.northing),
    id: esc(p.id),
    markType: p.markType,
    markStatus: p.markStatus,
  }))

  // Polygon outline
  const polyPoints = scaled.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  // Hatching definition for parcel fill
  const hatch = `
  <defs>
    <pattern id="hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="8" stroke="#c8d8e8" stroke-width="0.5"/>
    </pattern>
  </defs>`

  // Polygon
  const polygon = `<polygon points="${polyPoints}" fill="url(#hatch)" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/>`

  // Beacon symbols at each point
  const beaconSymbols = scaled.map(p => {
    const isMasonry = p.markType === 'MASONRY_NAIL' || p.markType === 'RIVET'
    const isControl = p.markType === 'PSC' || p.markType === 'SSC' || p.markType === 'TSC'
    const r = isControl ? 5 : 4

    if (isMasonry) {
      return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" fill="#000" stroke="#000" stroke-width="0.5"/>
<line x1="${(p.x-5).toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${(p.x+5).toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="#000" stroke-width="0.8"/>
<line x1="${p.x.toFixed(1)}" y1="${(p.y-5).toFixed(1)}" x2="${p.x.toFixed(1)}" y2="${(p.y+5).toFixed(1)}" stroke="#000" stroke-width="0.8"/>`
    }
    if (isControl) {
      return `<polygon points="${p.x.toFixed(1)},${(p.y-r-2).toFixed(1)} ${(p.x+r).toFixed(1)},${(p.y+r).toFixed(1)} ${(p.x-r).toFixed(1)},${(p.y+r).toFixed(1)}" fill="none" stroke="#000" stroke-width="1.2"/>`
    }
    // Default: square for concrete beacon, circle for iron pin
    if (p.markType === 'CONCRETE_BEACON') {
      return `<rect x="${(p.x - r).toFixed(1)}" y="${(p.y - r).toFixed(1)}" width="${(r*2).toFixed(1)}" height="${(r*2).toFixed(1)}" fill="white" stroke="#000" stroke-width="1.2"/>`
    }
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" fill="white" stroke="#000" stroke-width="1.2"/>`
  }).join('\n')

  // Point labels
  const labels = scaled.map((p) => {
    const centX = scaled.reduce((a, b) => a + b.x, 0) / scaled.length
    const centY = scaled.reduce((a, b) => a + b.y, 0) / scaled.length
    const dx = p.x - centX
    const dy = p.y - centY
    const len = Math.sqrt(dx*dx + dy*dy) || 1
    const ox = (dx/len) * 14
    const oy = (dy/len) * 14
    return `<text x="${(p.x + ox).toFixed(1)}" y="${(p.y + oy + 3).toFixed(1)}" text-anchor="middle" font-size="9" font-family="Courier New, monospace" font-weight="bold" fill="#000">${p.id}</text>`
  }).join('\n')

  // Bearing & distance labels on each leg
  const legLabels = legs.map((leg) => {
    const from = scaled.find(p => p.id === leg.fromPoint)
    const to   = scaled.find(p => p.id === leg.toPoint)
    if (!from || !to) return ''

    const mx = (from.x + to.x) / 2
    const my = (from.y + to.y) / 2
    const dx = to.x - from.x
    const dy = to.y - from.y
    const len = Math.sqrt(dx*dx + dy*dy) || 1
    // Perpendicular offset (outward from centroid)
    const centX = scaled.reduce((a, b) => a + b.x, 0) / scaled.length
    const centY = scaled.reduce((a, b) => a + b.y, 0) / scaled.length
    const pcx = mx - centX
    const pcy = my - centY
    const plen = Math.sqrt(pcx*pcx + pcy*pcy) || 1
    const ox = (pcx/plen) * 18
    const oy = (pcy/plen) * 18

    // Rotation angle for label
    let angle = Math.atan2(dy, dx) * 180 / Math.PI
    if (angle > 90) angle -= 180
    if (angle < -90) angle += 180

    // Only show on legs long enough to label (> 30px)
    if (len < 30) {
      return `<text x="${(mx+ox).toFixed(1)}" y="${(my+oy).toFixed(1)}" text-anchor="middle" font-size="7" font-family="Courier New, monospace" fill="#333">${leg.distance.toFixed(2)}m</text>`
    }

    return `<g transform="translate(${(mx+ox).toFixed(1)},${(my+oy).toFixed(1)}) rotate(${angle.toFixed(1)})">
  <text x="0" y="-3" text-anchor="middle" font-size="6.5" font-family="Courier New, monospace" fill="#333">${leg.bearing}</text>
  <text x="0" y="6" text-anchor="middle" font-size="7" font-family="Courier New, monospace" font-weight="bold" fill="#000">${leg.distance.toFixed(2)}m</text>
</g>`
  }).join('\n')

  // North arrow (top-right)
  const nax = W - 38
  const nay = 32
  const northArrow = `
<g transform="translate(${nax},${nay})">
  <polygon points="0,-18 5,5 0,0 -5,5" fill="#000"/>
  <polygon points="0,18 5,-5 0,0 -5,-5" fill="white" stroke="#000" stroke-width="0.8"/>
  <text x="0" y="-22" text-anchor="middle" font-size="10" font-family="Arial, sans-serif" font-weight="bold" fill="#000">N</text>
  <line x1="0" y1="-18" x2="0" y2="18" stroke="#000" stroke-width="0.5"/>
</g>`

  // Scale bar (bottom-left)
  // Compute nice round distance that fits ~100px
  const mapDist = 100 / s  // real-world distance represented by 100px
  // Round to nearest nice number
  const magnitudes = [0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000]
  const niceDist = magnitudes.reduce((prev, curr) => Math.abs(curr - mapDist) < Math.abs(prev - mapDist) ? curr : prev)
  const barPx = niceDist * s

  const sbx = PAD
  const sby = H - 22
  const scaleBar = `
<g>
  <rect x="${sbx}" y="${sby}" width="${barPx.toFixed(1)}" height="5" fill="#000"/>
  <rect x="${(sbx + barPx/2).toFixed(1)}" y="${sby}" width="${(barPx/2).toFixed(1)}" height="5" fill="white" stroke="#000" stroke-width="0.5"/>
  <text x="${sbx}" y="${sby+14}" font-size="7" font-family="Arial, sans-serif" fill="#000">0</text>
  <text x="${(sbx + barPx/2).toFixed(1)}" y="${sby+14}" text-anchor="middle" font-size="7" font-family="Arial, sans-serif" fill="#000">${(niceDist/2).toFixed(niceDist < 1 ? 2 : 0)}</text>
  <text x="${(sbx + barPx).toFixed(1)}" y="${sby+14}" text-anchor="end" font-size="7" font-family="Arial, sans-serif" fill="#000">${niceDist >= 1000 ? (niceDist/1000)+'km' : niceDist+'m'}</text>
  <text x="${sbx}" y="${sby-4}" font-size="7" font-family="Arial, sans-serif" fill="#555">Scale 1:${scale.toLocaleString()}</text>
</g>`

  // Grid reference label (bottom right of drawing)
  const gridLabel = `<text x="${W - PAD}" y="${H - 8}" text-anchor="end" font-size="7" font-family="Courier New, monospace" fill="#666">Arc 1960 / UTM Zone 37S (SRID 21037)</text>`

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">
  ${hatch}
  <!-- Border -->
  <rect x="1" y="1" width="${W-2}" height="${H-2}" fill="none" stroke="#000" stroke-width="1.5"/>
  <!-- Parcel polygon -->
  ${polygon}
  <!-- Beacon symbols -->
  ${beaconSymbols}
  <!-- Point labels -->
  ${labels}
  <!-- Bearing & distance labels -->
  ${legLabels}
  <!-- North arrow -->
  ${northArrow}
  <!-- Scale bar -->
  ${scaleBar}
  <!-- Grid reference -->
  ${gridLabel}
</svg>`
}

// ── Main HTML generator ───────────────────────────────────────────────────────

export function generateDeedPlanPrint(inp: DeedPlanPrintInput): string {
  const { input } = inp
  const pts = input.boundaryPoints

  if (pts.length < 3) {
    throw new Error('At least 3 boundary points are required to generate a deed plan.')
  }

  const legs   = computeBoundaryLegs(pts)
  const areaSqm = computeArea(pts)
  const closure = computeClosureCheck(pts)

  const planSvg = drawParcelSVG(pts, legs, input.scale)

  const today = new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' })
  const survDate = input.surveyDate
    ? new Date(input.surveyDate).toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' })
    : today

  // ── Bearing & Distance schedule rows ───────────────────────────────────────
  const legRows = legs.map((l, i) => `
<tr>
  <td>${i + 1}</td>
  <td class="bold">${esc(l.fromPoint)}</td>
  <td class="bold">${esc(l.toPoint)}</td>
  <td class="mono">${l.bearing}</td>
  <td class="right mono">${l.distance.toFixed(3)}</td>
</tr>`).join('')

  // ── Coordinate schedule rows ───────────────────────────────────────────────
  const coordRows = pts.map((p, i) => `
<tr>
  <td>${i + 1}</td>
  <td class="bold mono">${esc(p.id)}</td>
  <td class="right mono">${p.easting.toFixed(3)}</td>
  <td class="right mono">${p.northing.toFixed(3)}</td>
  <td>${esc(p.markType.replace(/_/g, ' '))}</td>
  <td class="center">${esc(p.markStatus)}</td>
</tr>`).join('')

  // ── Closure status ─────────────────────────────────────────────────────────
  const closureText  = closure.passes ? 'PASS' : 'FAIL'

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Deed Plan — ${blank(input.parcelNumber || 'METARDU')}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Courier New', monospace;
    font-size: 7.5pt;
    color: #000;
    background: #fff;
  }

  /* ── A3 landscape page ─── */
  @page { size: A3 landscape; margin: 6mm; }
  @media print { body { margin: 0; } }

  /* ── Main two-column layout ─── */
  .page {
    width: 100%;
    height: 100vh;
    display: grid;
    grid-template-columns: 62% 38%;
    border: 2px solid #000;
  }

  /* ── Left: plan area ─── */
  .plan-panel {
    border-right: 1.5px solid #000;
    display: flex;
    flex-direction: column;
  }
  .plan-label {
    padding: 3px 6px;
    border-bottom: 1px solid #000;
    font-size: 7pt;
    color: #555;
    font-style: italic;
    background: #f8f8f8;
  }
  .plan-drawing {
    flex: 1;
    padding: 4px;
    overflow: hidden;
  }
  .plan-drawing svg { display: block; width: 100%; height: 100%; }

  /* ── Right: title block + schedules ─── */
  .info-panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Title block */
  .title-block {
    border-bottom: 1.5px solid #000;
    padding: 6px 8px 4px;
    text-align: center;
    background: #000;
    color: #fff;
  }
  .title-main { font-size: 11pt; font-weight: bold; letter-spacing: 2px; }
  .title-sub  { font-size: 7pt;  letter-spacing: 0.5px; margin-top: 1px; }
  .title-ref  { font-size: 6.5pt; margin-top: 2px; opacity: 0.8; }

  /* Info grid */
  .info-grid {
    border-bottom: 1px solid #000;
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .info-cell {
    padding: 3px 6px;
    border-right: 1px solid #ccc;
    border-bottom: 1px solid #ccc;
  }
  .info-cell:nth-child(even) { border-right: none; }
  .info-cell-full {
    grid-column: 1 / -1;
    padding: 3px 6px;
    border-bottom: 1px solid #ccc;
  }
  .info-label { font-size: 6pt; text-transform: uppercase; color: #666; display: block; }
  .info-value { font-size: 7.5pt; font-weight: bold; }

  /* Area box */
  .area-box {
    border-bottom: 1px solid #000;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    background: #f4f4f4;
  }
  .area-cell { padding: 3px 6px; border-right: 1px solid #ccc; text-align: center; }
  .area-cell:last-child { border-right: none; }
  .area-num  { font-size: 9.5pt; font-weight: bold; font-family: 'Courier New', monospace; }
  .area-unit { font-size: 6pt; text-transform: uppercase; color: #666; }

  /* Schedules */
  .schedule-section {
    border-bottom: 1px solid #ccc;
    overflow: hidden;
  }
  .schedule-header {
    padding: 2px 6px;
    background: #111;
    color: #fff;
    font-size: 6.5pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 6.5pt;
  }
  th {
    background: #444;
    color: #fff;
    padding: 2px 4px;
    text-align: left;
    font-weight: bold;
    border: 1px solid #000;
  }
  td {
    padding: 2px 4px;
    border: 1px solid #ddd;
  }
  tr:nth-child(even) td { background: #f7f7f7; }
  .bold   { font-weight: bold; }
  .mono   { font-family: 'Courier New', monospace; }
  .right  { text-align: right; }
  .center { text-align: center; }

  /* Abuttals */
  .abuttals-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-bottom: 1px solid #ccc;
  }
  .abuttal-cell {
    padding: 3px 6px;
    border-right: 1px solid #ccc;
    border-bottom: 1px solid #ccc;
    font-size: 6.5pt;
  }
  .abuttal-cell:nth-child(even) { border-right: none; }
  .abuttal-dir { font-size: 6pt; text-transform: uppercase; color: #888; display: block; }

  /* Closure */
  .closure-row {
    display: flex;
    justify-content: space-between;
    padding: 2px 6px;
    border-bottom: 1px solid #ddd;
    font-size: 6.5pt;
  }
  .closure-pass { font-weight: bold; color: #14532d; }
  .closure-fail { font-weight: bold; color: #7f1d1d; }

  /* Surveyor certificate */
  .cert-block {
    border-top: 1.5px solid #000;
    padding: 5px 8px;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 80px;
  }
  .cert-title { font-size: 6.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #bbb; padding-bottom: 2px; margin-bottom: 4px; }
  .cert-text  { font-size: 6pt; line-height: 1.5; font-style: italic; margin-bottom: 6px; }
  .cert-sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .cert-sig-line { border-bottom: 1px solid #000; height: 18px; margin-bottom: 2px; }
  .cert-sig-label { font-size: 5.5pt; text-transform: uppercase; color: #666; }

  /* Legend */
  .legend {
    padding: 3px 6px;
    border-top: 1px solid #ccc;
    font-size: 6pt;
    color: #555;
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  .legend-item { display: flex; align-items: center; gap: 3px; }
</style>
</head>
<body>
<div class="page">

  <!-- ══ LEFT: PLAN DRAWING ══════════════════════════════════════════════ -->
  <div class="plan-panel">
    <div class="plan-label">
      BOUNDARY IDENTIFICATION PLAN &nbsp;|&nbsp; ${blank(input.parcelNumber)} &nbsp;|&nbsp;
      ${blank(input.locality)}, ${blank(input.county)} &nbsp;|&nbsp;
      Scale 1:${input.scale.toLocaleString()} &nbsp;|&nbsp; ${blank(input.datum)}
    </div>
    <div class="plan-drawing">
      ${planSvg}
    </div>
    <div class="legend">
      <span class="legend-item">
        <svg width="10" height="10"><rect x="1" y="1" width="8" height="8" fill="none" stroke="#000" stroke-width="1.2"/></svg>
        Concrete Beacon (SET)
      </span>
      <span class="legend-item">
        <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="none" stroke="#000" stroke-width="1.2"/></svg>
        Iron Pin (SET)
      </span>
      <span class="legend-item">
        <svg width="10" height="10"><line x1="2" y1="5" x2="8" y2="5" stroke="#000" stroke-width="0.8"/><line x1="5" y1="2" x2="5" y2="8" stroke="#000" stroke-width="0.8"/><circle cx="5" cy="5" r="1.5" fill="#000"/></svg>
        Masonry Nail / Rivet
      </span>
      <span class="legend-item">
        <svg width="10" height="10"><polygon points="5,1 9,9 1,9" fill="none" stroke="#000" stroke-width="1.2"/></svg>
        Control Mark (PSC/SSC)
      </span>
      <span style="margin-left:auto;color:#888;">Coordinates: Arc 1960 / UTM Zone 37S (SRID 21037)</span>
    </div>
  </div>

  <!-- ══ RIGHT: TITLE BLOCK + SCHEDULES ═══════════════════════════════════ -->
  <div class="info-panel">

    <!-- Title block -->
    <div class="title-block">
      <div class="title-main">DEED PLAN</div>
      <div class="title-sub">BOUNDARY IDENTIFICATION PLAN &mdash; FORM NO. 4</div>
      <div class="title-ref">Survey Act Cap 299 &nbsp;|&nbsp; Survey Regulations 1994, Reg. 5 &nbsp;|&nbsp; Land Registration Act 2012</div>
    </div>

    <!-- Project details -->
    <div class="info-grid">
      <div class="info-cell-full">
        <span class="info-label">Part of L.R. No.</span>
        <span class="info-value">${blank(input.parcelNumber)}</span>
      </div>
      <div class="info-cell">
        <span class="info-label">Deposited Plan No.</span>
        <span class="info-value">${blank(input.drawingNumber)}</span>
      </div>
      <div class="info-cell">
        <span class="info-label">Survey Number (DoLS)</span>
        <span class="info-value">${blank(input.surveyNumber)}</span>
      </div>
      <div class="info-cell">
        <span class="info-label">Registry Map Sheet</span>
        <span class="info-value">${blank(input.registryMapSheet || input.registrationSection)}</span>
      </div>
      <div class="info-cell">
        <span class="info-label">Registration Section</span>
        <span class="info-value">${blank(input.registrationSection)}</span>
      </div>
      <div class="info-cell">
        <span class="info-label">County</span>
        <span class="info-value">${blank(input.county)}</span>
      </div>
      <div class="info-cell">
        <span class="info-label">Locality</span>
        <span class="info-value">${blank(input.locality)}</span>
      </div>
      <div class="info-cell">
        <span class="info-label">Client / Registered Owner</span>
        <span class="info-value">${blank(input.clientName)}</span>
      </div>
      <div class="info-cell">
        <span class="info-label">Title Deed No.</span>
        <span class="info-value">${blank(input.titleDeedNumber)}</span>
      </div>
      <div class="info-cell">
        <span class="info-label">FIR No.</span>
        <span class="info-value">${blank(input.firNumber)}</span>
      </div>
      <div class="info-cell">
        <span class="info-label">Survey Date</span>
        <span class="info-value">${blank(survDate)}</span>
      </div>
      <div class="info-cell">
        <span class="info-label">Datum / Projection</span>
        <span class="info-value">${blank(input.datum)} / UTM Zone ${input.utmZone}${blank(input.hemisphere)}</span>
      </div>
      <div class="info-cell">
        <span class="info-label">Drawn By</span>
        <span class="info-value">${blank(input.drawnBy)}</span>
      </div>
      <div class="info-cell">
        <span class="info-label">Checked By</span>
        <span class="info-value">${blank(input.checkedBy)}</span>
      </div>
    </div>

    <!-- Area -->
    <div class="area-box">
      <div class="area-cell">
        <div class="area-num">A = co = ${areaHa(areaSqm)} Ha</div>
        <div class="area-unit">Computed Area</div>
      </div>
      <div class="area-cell">
        <div class="area-num">${areaSqm.toFixed(2)}</div>
        <div class="area-unit">m²</div>
      </div>
      <div class="area-cell">
        <div class="area-num">${areaAcres(areaSqm)}</div>
        <div class="area-unit">Acres</div>
      </div>
    </div>

    <!-- Bearing & Distance Schedule -->
    <div class="schedule-section">
      <div class="schedule-header">Bearing &amp; Distance Schedule</div>
      <table>
        <tr>
          <th style="width:8%">No.</th>
          <th style="width:12%">From</th>
          <th style="width:12%">To</th>
          <th style="width:42%">WCB Bearing</th>
          <th style="width:26%" class="right">Distance (m)</th>
        </tr>
        ${legRows || '<tr><td colspan="5" class="center" style="color:#999;font-style:italic;">No legs computed</td></tr>'}
      </table>
    </div>

    <!-- Coordinate Schedule -->
    <div class="schedule-section">
      <div class="schedule-header">Coordinate Schedule — Arc 1960 / UTM 37S</div>
      <table>
        <tr>
          <th style="width:6%">No.</th>
          <th style="width:10%">Stn</th>
          <th style="width:22%" class="right">Easting (m)</th>
          <th style="width:22%" class="right">Northing (m)</th>
          <th style="width:24%">Monument</th>
          <th style="width:16%" class="center">Status</th>
        </tr>
        ${coordRows || '<tr><td colspan="6" class="center" style="color:#999;font-style:italic;">No points</td></tr>'}
      </table>
    </div>

    <!-- Abuttals -->
    <div class="abuttals-grid">
      <div class="abuttal-cell"><span class="abuttal-dir">North</span>${blank(input.abuttalNorth)}</div>
      <div class="abuttal-cell"><span class="abuttal-dir">South</span>${blank(input.abuttalSouth)}</div>
      <div class="abuttal-cell"><span class="abuttal-dir">East</span>${blank(input.abuttalEast)}</div>
      <div class="abuttal-cell"><span class="abuttal-dir">West</span>${blank(input.abuttalWest)}</div>
    </div>

    <!-- Closure / Traverse Accuracy -->
    <div>
      <div class="closure-row">
        <span>Precision ratio:</span>
        <span class="bold mono">${closure.precisionRatio}</span>
      </div>
      <div class="closure-row">
        <span>Perimeter:</span>
        <span class="mono">${closure.perimeter.toFixed(3)} m</span>
      </div>
      <div class="closure-row">
        <span>Closure check (min 1:5000 — Survey Act Cap 299):</span>
        <span class="${closure.passes ? 'closure-pass' : 'closure-fail'}">${closureText}</span>
      </div>
    </div>

    <!-- Surveyor's Certificate -->
    <div class="cert-block">
      <div>
        <div class="cert-title">Surveyor's Certificate — Survey Regulations 1994, Reg. 3(2)</div>
        <div class="cert-text">
          I, ${input.surveyorName ? esc(input.surveyorName) : '______________________________'},
          Licensed Surveyor No. ${input.iskNumber ? esc(input.iskNumber) : '____________'},
          of ${input.firmName ? esc(input.firmName) : '______________________________'},
          hereby certify that this plan was prepared by me and that the survey was carried out
          in accordance with the Survey Act Cap 299 and Kenya Survey Regulations 1994.
          The boundary marks were ${pts.some(p => p.markStatus === 'SET') ? 'set' : 'identified'}
          on the ground on ${blank(survDate)}.
        </div>
      </div>
      <div class="cert-sig-grid">
        <div>
          <div class="cert-sig-line"></div>
          <div class="cert-sig-label">Signature &amp; Stamp</div>
        </div>
        <div>
          <div class="cert-sig-line"></div>
          <div class="cert-sig-label">Date Signed</div>
        </div>
        <div>
          <div class="cert-sig-line"></div>
          <div class="cert-sig-label">ISK Membership No.</div>
        </div>
        <div>
          <div class="cert-sig-line"></div>
          <div class="cert-sig-label">Firm / Practice Name</div>
        </div>
      </div>
    </div>

  </div><!-- end info-panel -->
</div><!-- end page -->
<script>
  window.addEventListener('load', () => {
    setTimeout(() => { window.focus(); window.print(); }, 600)
  })
</script>
</body>
</html>`
}

export function printDeedPlan(inp: DeedPlanPrintInput): void {
  openPrint(generateDeedPlanPrint(inp))
}
