/**
 * Form No. 3 Mutation Survey Plan — SVG Renderer
 *
 * Standalone renderer producing Kenya cadastral mutation survey plan output
 * compliant with Survey Act Cap. 299, Survey Regulations 1994 and RDM 1.1.
 *
 * Page: A1 landscape (841 × 594 mm)
 * NOT extending SurveyPlanRenderer — Form No. 3 has its own page layout.
 *
 * Drawing layers (bottom → top):
 *   1.  Page background
 *   2.  Double-line border frame
 *   3.  Grid tick marks & coordinate labels
 *   4.  Scheme boundary outline
 *   5.  Plot boundaries (black, no fill)
 *   6.  Beacon circles (red, unfilled)
 *   7.  Dimension lines (bearing & distance)
 *   8.  Area labels ("A = X.XXXX Ha")
 *   9.  Road corridors & labels
 *  10.  Survey monuments (M1–M10)
 *  11.  Bearing schedule table (top-left)
 *  12.  Authentication block (bottom-right)
 *  13.  Title block strip (bottom)
 *  14.  North arrow & scale bar
 */

import type { MutationPlanData } from './formNo3Types'
import {
  PX_PER_MM,
  PX_PER_M,
  mmToPx,
  bearingFromDelta,
  distance,
  centroid,
  boundingBox,
  formatBearingDegMinSec,
  STANDARD_SCALES,
  segmentAngle,
  offsetFromMidpoint,
} from './geometry'
import {
  escapeXml,
  C_BLACK,
  C_RED,
} from './symbols'

// ─── Layout constants (all in mm) ──────────────────────────────────────────

const PAGE_W_MM = 841
const PAGE_H_MM = 594

/** Outer border inset from page edge */
const BORDER_OUTER_INSET = 5
/** Inner border inset from page edge */
const BORDER_INNER_INSET = 10

/** Drawing area margin inside inner border */
const DRAW_MARGIN = 15
/** Title block height at bottom */
const TITLE_BLOCK_H_MM = 28
/** Auth block reserved height */
const AUTH_BLOCK_H_MM = 68

const FONT_LABEL = "'Times New Roman', serif"
const FONT_FORM = "'Calibri', sans-serif"

// ─── Internal renderer state ────────────────────────────────────────────────

interface RenderState {
  pageW: number
  pageH: number
  drawX: number
  drawY: number
  drawW: number
  drawH: number
  scale: number
  pxPerM: number
  bbMinE: number
  bbMaxE: number
  bbMinN: number
  bbMaxN: number
  offsetX: number
  offsetY: number
  toSvgX: (m: number) => number
  toSvgY: (m: number) => number
}

// ─── Main entry point ───────────────────────────────────────────────────────

/**
 * Render a complete Form No. 3 Mutation Survey Plan as SVG.
 *
 * @param data - Fully populated MutationPlanData
 * @returns Complete SVG document string
 */
export function renderFormNo3(data: MutationPlanData): string {
  const state = buildState(data)
  const layers: string[] = []

  // 1 – Page background
  layers.push(drawPageBackground(state))
  // 2 – Double-line border
  layers.push(drawDoubleBorder(state))
  // 3 – Grid ticks & labels
  layers.push(drawGridTicksAndLabels(state, data))
  // 4 – Scheme boundary
  layers.push(drawSchemeBoundary(state, data))
  // 5 – Plot boundaries
  layers.push(drawPlotBoundaries(state, data))
  // 6 – Beacon circles
  layers.push(drawBeaconCircles(state, data))
  // 7 – Dimension lines
  layers.push(drawDimensionLines(state, data))
  // 8 – Area labels
  layers.push(drawAreaLabels(state, data))
  // 9 – Road corridors
  layers.push(drawRoadCorridors(state, data))
  // 10 – Survey monuments
  layers.push(drawSurveyMonuments(state, data))
  // 11 – Bearing schedule table
  layers.push(drawBearingScheduleTable(state, data))
  // 12 – Authentication block
  layers.push(drawAuthBlock(state, data))
  // 13 – Title block
  layers.push(drawTitleBlock(state, data))
  // 14 – North arrow & scale bar
  layers.push(drawNorthArrowAndScaleBar(state, data))

  return (
    `<svg xmlns="http://www.w3.org/2000/svg"` +
    ` viewBox="0 0 ${state.pageW} ${state.pageH}"` +
    ` width="${state.pageW}" height="${state.pageH}"` +
    ` style="font-family: ${FONT_LABEL}; background: white;">` +
    layers.join('\n') +
    `</svg>`
  )
}

export default renderFormNo3

// ─── State builder ──────────────────────────────────────────────────────────

function buildState(data: MutationPlanData): RenderState {
  const pageW = mmToPx(PAGE_W_MM)
  const pageH = mmToPx(PAGE_H_MM)

  // Drawing area: inside inner border, above title block
  const drawX = mmToPx(BORDER_INNER_INSET + DRAW_MARGIN)
  const drawY = mmToPx(BORDER_INNER_INSET + DRAW_MARGIN)
  const drawW = pageW - 2 * drawX
  const drawH = pageH - drawY - mmToPx(BORDER_INNER_INSET + DRAW_MARGIN + TITLE_BLOCK_H_MM)

  // Compute bounding box of all geometry
  const allPts = [
    ...data.schemeBoundary,
    ...data.plots.flatMap((p) => p.boundaryPoints),
    ...data.roads.flatMap((r) => r.centerline),
    ...data.monuments.map((m) => ({ easting: m.easting, northing: m.northing })),
  ]
  const bb = boundingBox(allPts)

  // Compute scale: fit data into drawing area with padding
  const padding = mmToPx(10)
  const effectiveW = drawW - padding * 2
  const effectiveH = drawH - padding * 2
  const rawPxPerM = Math.min(effectiveW / bb.rangeE, effectiveH / bb.rangeN)
  const rawScale = PX_PER_M / rawPxPerM

  // Use project-provided scale if set, otherwise snap to standard
  const scale = data.project.scale > 0
    ? data.project.scale
    : STANDARD_SCALES.find((s) => s >= rawScale) || 10000

  const pxPerM = PX_PER_M / scale
  const offsetX = (effectiveW - bb.rangeE * pxPerM) / 2
  const offsetY = (effectiveH - bb.rangeN * pxPerM) / 2

  const toSvgX = (m: number): number =>
    drawX + padding + offsetX + (m - bb.minE) * pxPerM

  const toSvgY = (m: number): number =>
    drawY + padding + offsetY + (bb.maxN - m) * pxPerM

  return {
    pageW,
    pageH,
    drawX,
    drawY,
    drawW,
    drawH,
    scale,
    pxPerM,
    bbMinE: bb.minE,
    bbMaxE: bb.maxE,
    bbMinN: bb.minN,
    bbMaxN: bb.maxN,
    offsetX,
    offsetY,
    toSvgX,
    toSvgY,
  }
}

// ─── Layer 1: Page background ──────────────────────────────────────────────

function drawPageBackground(s: RenderState): string {
  return `<rect x="0" y="0" width="${s.pageW}" height="${s.pageH}" fill="white"/>`
}

// ─── Layer 2: Double-line border ───────────────────────────────────────────

function drawDoubleBorder(s: RenderState): string {
  const oi = mmToPx(BORDER_OUTER_INSET)
  const ii = mmToPx(BORDER_INNER_INSET)
  return [
    `<rect x="${oi}" y="${oi}" width="${s.pageW - 2 * oi}" height="${s.pageH - 2 * oi}"` +
    ` fill="none" stroke="${C_BLACK}" stroke-width="2.5"/>`,
    `<rect x="${ii}" y="${ii}" width="${s.pageW - 2 * ii}" height="${s.pageH - 2 * ii}"` +
    ` fill="none" stroke="${C_BLACK}" stroke-width="0.8"/>`,
  ].join('')
}

// ─── Layer 3: Grid tick marks & coordinate labels ─────────────────────────

function drawGridTicksAndLabels(s: RenderState, data: MutationPlanData): string {
  const g = data.grid
  const gridMinE = Math.floor(g.minE / g.intervalE) * g.intervalE
  const gridMaxE = Math.ceil(g.maxE / g.intervalE) * g.intervalE
  const gridMinN = Math.floor(g.minN / g.intervalN) * g.intervalN
  const gridMaxN = Math.ceil(g.maxN / g.intervalN) * g.intervalN

  const tickLen = mmToPx(3)
  const marginInner = mmToPx(BORDER_INNER_INSET)
  const fontSize = mmToPx(2.2)

  let svg = ''

  // Vertical grid ticks along top & bottom margins (easting labels)
  for (let e = gridMinE; e <= gridMaxE; e += g.intervalE) {
    const x = s.toSvgX(e)
    // Top tick
    svg += `<line x1="${x}" y1="${marginInner}" x2="${x}" y2="${marginInner + tickLen}"` +
      ` stroke="${C_BLACK}" stroke-width="0.5"/>`
    // Bottom tick
    svg += `<line x1="${x}" y1="${s.pageH - marginInner}" x2="${x}" y2="${s.pageH - marginInner - tickLen}"` +
      ` stroke="${C_BLACK}" stroke-width="0.5"/>`
    // Label at top (formatted with space group, e.g. "114 500")
    svg += `<text x="${x}" y="${marginInner - mmToPx(1.5)}" text-anchor="middle"` +
      ` font-family="${FONT_FORM}" font-size="${fontSize}" fill="${C_BLACK}">` +
      `${escapeXml(formatGridCoord(e))}</text>`
  }

  // Horizontal grid ticks along left & right margins (northing labels)
  for (let n = gridMinN; n <= gridMaxN; n += g.intervalN) {
    const y = s.toSvgY(n)
    // Left tick
    svg += `<line x1="${marginInner}" y1="${y}" x2="${marginInner + tickLen}" y2="${y}"` +
      ` stroke="${C_BLACK}" stroke-width="0.5"/>`
    // Right tick
    svg += `<line x1="${s.pageW - marginInner}" y1="${y}" x2="${s.pageW - marginInner - tickLen}" y2="${y}"` +
      ` stroke="${C_BLACK}" stroke-width="0.5"/>`
    // Label at left
    svg += `<text x="${marginInner + tickLen + mmToPx(1)}" y="${y + mmToPx(0.8)}"` +
      ` font-family="${FONT_FORM}" font-size="${fontSize}" fill="${C_BLACK}">` +
      `${escapeXml(formatGridCoord(n))}</text>`
  }

  return svg
}

/** Format coordinate with space grouping, e.g. 114500 → "114 500" */
function formatGridCoord(val: number): string {
  const str = Math.round(val).toString()
  // Group last 3 digits
  if (str.length > 3) {
    return str.slice(0, -3) + ' ' + str.slice(-3)
  }
  return str
}

// ─── Layer 4: Scheme boundary ──────────────────────────────────────────────

function drawSchemeBoundary(s: RenderState, data: MutationPlanData): string {
  const pts = data.schemeBoundary
  if (pts.length < 2) return ''
  const coords = pts.map((p) => `${s.toSvgX(p.easting)},${s.toSvgY(p.northing)}`).join(' ')
  const close = `${s.toSvgX(pts[0].easting)},${s.toSvgY(pts[0].northing)}`
  return `<polyline points="${coords} ${close}" fill="none" stroke="${C_BLACK}" stroke-width="1.5"` +
    ` stroke-dasharray="6,3" opacity="0.6"/>`
}

// ─── Layer 5: Plot boundaries ──────────────────────────────────────────────

function drawPlotBoundaries(s: RenderState, data: MutationPlanData): string {
  let svg = ''
  for (const plot of data.plots) {
    const pts = plot.boundaryPoints
    if (pts.length < 3) continue
    const coords = pts.map((p) => `${s.toSvgX(p.easting)},${s.toSvgY(p.northing)}`).join(' ')
    const close = `${s.toSvgX(pts[0].easting)},${s.toSvgY(pts[0].northing)}`
    svg += `<polygon points="${coords} ${close}" fill="none" stroke="${C_BLACK}" stroke-width="1.2"/>`
  }
  return svg
}

// ─── Layer 6: Beacon circles ───────────────────────────────────────────────

function drawBeaconCircles(s: RenderState, data: MutationPlanData): string {
  const beaconRadius = mmToPx(0.9) // 1.8pt diameter → 0.9pt radius
  let svg = ''
  const seen = new Set<string>()

  for (const plot of data.plots) {
    for (const pt of plot.boundaryPoints) {
      const key = `${pt.easting.toFixed(3)},${pt.northing.toFixed(3)}`
      if (seen.has(key)) continue
      seen.add(key)
      const cx = s.toSvgX(pt.easting)
      const cy = s.toSvgY(pt.northing)
      // Red unfilled circle
      svg += `<circle cx="${cx}" cy="${cy}" r="${beaconRadius}" fill="none" stroke="${C_RED}" stroke-width="0.8"/>`
      // Tiny centre dot
      svg += `<circle cx="${cx}" cy="${cy}" r="0.6" fill="${C_RED}"/>`
    }
  }
  return svg
}

// ─── Layer 7: Dimension lines (bearing & distance) ─────────────────────────

function drawDimensionLines(s: RenderState, data: MutationPlanData): string {
  const labelFontSize = mmToPx(3.0)
  let svg = ''
  const seen = new Set<string>()

  for (const plot of data.plots) {
    const pts = plot.boundaryPoints
    for (let i = 0; i < pts.length; i++) {
      const from = pts[i]
      const to = pts[(i + 1) % pts.length]

      // Avoid duplicate lines on shared boundaries
      const lineKey = [
        from.easting.toFixed(2), from.northing.toFixed(2),
        to.easting.toFixed(2), to.northing.toFixed(2),
      ].join('|')
      const lineKeyRev = [
        to.easting.toFixed(2), to.northing.toFixed(2),
        from.easting.toFixed(2), from.northing.toFixed(2),
      ].join('|')
      if (seen.has(lineKey) || seen.has(lineKeyRev)) continue
      seen.add(lineKey)
      seen.add(lineKeyRev)

      const dist = distance(from.easting, from.northing, to.easting, to.northing)
      const bearing = bearingFromDelta(to.easting - from.easting, to.northing - from.northing)
      const bearingStr = formatBearingDegMinSec(bearing)
      const distStr = `${dist.toFixed(2)} m`

      const angleDeg = segmentAngle(from.easting, from.northing, to.easting, to.northing)
      let textAngle = angleDeg
      if (textAngle > 90 || textAngle < -90) textAngle += 180

      // Offset midpoint perpendicular to the line
      const offsetM = 5 / s.pxPerM // 5mm in ground units
      const [mx, my] = offsetFromMidpoint(from.easting, from.northing, to.easting, to.northing, offsetM)
      const bx = s.toSvgX(mx)
      const by = s.toSvgY(my)

      const tw = Math.max(bearingStr.length * 4.5, distStr.length * 4) + 8
      const th = mmToPx(7)

      svg += `<g transform="translate(${bx},${by})">`
      svg += `<g transform="rotate(${textAngle})">`
      // White background for readability
      svg += `<rect x="${-tw / 2}" y="${-th / 2}" width="${tw}" height="${th}" fill="white" opacity="0.88" stroke="none"/>`
      // Bearing text
      svg += `<text x="0" y="${-mmToPx(0.8)}" text-anchor="middle" font-family="${FONT_LABEL}" font-size="${labelFontSize}" fill="${C_BLACK}">${escapeXml(bearingStr)}</text>`
      // Distance text
      svg += `<text x="0" y="${mmToPx(2.2)}" text-anchor="middle" font-family="${FONT_LABEL}" font-size="${labelFontSize}" fill="${C_BLACK}">${escapeXml(distStr)}</text>`
      svg += `</g>`

      // V-arrowheads at each end of the dimension line
      const fx = s.toSvgX(from.easting)
      const fy = s.toSvgY(from.northing)
      const tx = s.toSvgX(to.easting)
      const ty = s.toSvgY(to.northing)

      // "From" arrowhead
      svg += drawVArrowhead(fx, fy, bx, by, C_BLACK, 4)
      // "To" arrowhead
      svg += drawVArrowhead(tx, ty, bx, by, C_BLACK, 4)

      svg += `</g>`
    }
  }
  return svg
}

/** Draw a V-shaped arrowhead pointing from tip toward the midpoint */
function drawVArrowhead(tipX: number, tipY: number, midX: number, midY: number, color: string, size: number): string {
  const angle = Math.atan2(midY - tipY, midX - tipX)
  const a1 = angle + Math.PI / 6
  const a2 = angle - Math.PI / 6
  const x1 = tipX + size * Math.cos(a1)
  const y1 = tipY + size * Math.sin(a1)
  const x2 = tipX + size * Math.cos(a2)
  const y2 = tipY + size * Math.sin(a2)
  return `<polygon points="${tipX},${tipY} ${x1},${y1} ${x2},${y2}" fill="${color}"/>`
}

// ─── Layer 8: Area labels ─────────────────────────────────────────────────

function drawAreaLabels(s: RenderState, data: MutationPlanData): string {
  const labelFontSize = mmToPx(3.0)
  let svg = ''

  for (const plot of data.plots) {
    const pts = plot.boundaryPoints
    if (pts.length < 3) continue

    const [ce, cn] = centroid(pts)
    const cx = s.toSvgX(ce)
    const cy = s.toSvgY(cn)

    const areaText = `A = ${plot.area_ha.toFixed(4)} Ha`
    if (plot.isApprox) {
      const mainText = areaText
      const approxText = '(Approx)'
      const approxFontSize = mmToPx(2.2)
      svg += `<text x="${cx}" y="${cy - mmToPx(0.5)}" text-anchor="middle"` +
        ` font-family="${FONT_LABEL}" font-size="${labelFontSize}" fill="${C_BLACK}">` +
        `${escapeXml(mainText)}</text>`
      svg += `<text x="${cx}" y="${cy + mmToPx(2.2)}" text-anchor="middle"` +
        ` font-family="${FONT_LABEL}" font-size="${approxFontSize}" font-style="italic" fill="#555">` +
        `${escapeXml(approxText)}</text>`
    } else {
      svg += `<text x="${cx}" y="${cy + mmToPx(1)}" text-anchor="middle"` +
        ` font-family="${FONT_LABEL}" font-size="${labelFontSize}" fill="${C_BLACK}">` +
        `${escapeXml(areaText)}</text>`
    }

    // Plot ID label (watermark-style, larger, behind area text)
    const idFontSize = mmToPx(6)
    svg += `<text x="${cx}" y="${cy - mmToPx(5)}" text-anchor="middle"` +
      ` font-family="${FONT_LABEL}" font-size="${idFontSize}" font-weight="bold"` +
      ` fill="${C_BLACK}" opacity="0.15">${escapeXml(plot.id.toUpperCase())}</text>`
  }
  return svg
}

// ─── Layer 9: Road corridors ───────────────────────────────────────────────

function drawRoadCorridors(s: RenderState, data: MutationPlanData): string {
  let svg = ''
  const roadFontSize = mmToPx(3.2)
  const bearingFontSize = mmToPx(2.4)

  for (const road of data.roads) {
    if (road.centerline.length < 2) continue

    // Compute road polygon by offsetting centreline
    const roadPoly = computeRoadPolygon(road.centerline, road.width_m)
    if (roadPoly.length < 3) continue

    // Draw road polygon (very light fill)
    const coords = roadPoly.map((p) => `${s.toSvgX(p.easting)},${s.toSvgY(p.northing)}`).join(' ')
    svg += `<polygon points="${coords}" fill="#f0f0f0" stroke="${C_BLACK}" stroke-width="0.8"/>`

    // Centreline dashed
    const clCoords = road.centerline.map((p) => `${s.toSvgX(p.easting)},${s.toSvgY(p.northing)}`).join(' ')
    svg += `<polyline points="${clCoords}" fill="none" stroke="${C_BLACK}" stroke-width="0.4" stroke-dasharray="4,3" opacity="0.5"/>`

    // Road label — vertically stacked, centred at midpoint of centreline
    const [mcE, mcN] = centroid(road.centerline)
    const lx = s.toSvgX(mcE)
    const ly = s.toSvgY(mcN)

    // Split label into words, stack them
    const parts = road.label.split(' ')
    const lineH = mmToPx(3.8)
    const startY = ly - ((parts.length - 1) * lineH) / 2

    parts.forEach((part, i) => {
      svg += `<text x="${lx}" y="${startY + i * lineH + mmToPx(1)}" text-anchor="middle"` +
        ` font-family="${FONT_LABEL}" font-size="${roadFontSize}" font-weight="bold"` +
        ` fill="${C_BLACK}">${escapeXml(part)}</text>`
    })

    // Road bearing label near road edges
    if (road.bearing_dms) {
      // Place bearing near first point of centreline
      const firstPt = road.centerline[0]
      const bx = s.toSvgX(firstPt.easting)
      const by = s.toSvgY(firstPt.northing) - mmToPx(2)
      svg += `<text x="${bx}" y="${by}" text-anchor="middle"` +
        ` font-family="${FONT_LABEL}" font-size="${bearingFontSize}" font-style="italic"` +
        ` fill="#444">${escapeXml(road.bearing_dms)}</text>`
    }
  }
  return svg
}

/**
 * Offset a centreline polyline by half-width to produce a road polygon.
 * Returns array of left-edge points + reversed right-edge points.
 */
function computeRoadPolygon(
  centerline: Array<{ easting: number; northing: number }>,
  widthM: number,
): Array<{ easting: number; northing: number }> {
  const halfW = widthM / 2
  const leftEdge: Array<{ easting: number; northing: number }> = []
  const rightEdge: Array<{ easting: number; northing: number }> = []

  for (let i = 0; i < centerline.length; i++) {
    const prev = centerline[(i - 1 + centerline.length) % centerline.length]
    const curr = centerline[i]
    const next = centerline[(i + 1) % centerline.length]

    // Average direction
    const dx1 = curr.easting - prev.easting
    const dy1 = curr.northing - prev.northing
    const dx2 = next.easting - curr.easting
    const dy2 = next.northing - curr.northing
    const dx = dx1 + dx2
    const dy = dy1 + dy2
    const len = Math.sqrt(dx * dx + dy * dy) || 1

    // Perpendicular direction
    const perpE = -dy / len
    const perpN = dx / len

    leftEdge.push({
      easting: curr.easting + perpE * halfW,
      northing: curr.northing + perpN * halfW,
    })
    rightEdge.push({
      easting: curr.easting - perpE * halfW,
      northing: curr.northing - perpN * halfW,
    })
  }

  return [...leftEdge, ...rightEdge.reverse()]
}

// ─── Layer 10: Survey monuments ───────────────────────────────────────────

function drawSurveyMonuments(s: RenderState, data: MutationPlanData): string {
  let svg = ''
  const labelFontSize = mmToPx(2.2)
  const monumentSize = mmToPx(1.5)

  for (const m of data.monuments) {
    const cx = s.toSvgX(m.easting)
    const cy = s.toSvgY(m.northing)

    if (m.type === 'control') {
      // Filled square for control monuments
      svg += `<rect x="${cx - monumentSize}" y="${cy - monumentSize}"` +
        ` width="${monumentSize * 2}" height="${monumentSize * 2}"` +
        ` fill="none" stroke="${C_BLACK}" stroke-width="1"/>`
      svg += `<line x1="${cx - monumentSize * 0.6}" y1="${cy}" x2="${cx + monumentSize * 0.6}" y2="${cy}"` +
        ` stroke="${C_BLACK}" stroke-width="0.6"/>`
      svg += `<line x1="${cx}" y1="${cy - monumentSize * 0.6}" x2="${cx}" y2="${cy + monumentSize * 0.6}"` +
        ` stroke="${C_BLACK}" stroke-width="0.6"/>`
    } else {
      // Unfilled circle for intermediate
      svg += `<circle cx="${cx}" cy="${cy}" r="${monumentSize}" fill="none" stroke="${C_BLACK}" stroke-width="0.8"/>`
    }

    // Label
    svg += `<text x="${cx + monumentSize + mmToPx(1)}" y="${cy - mmToPx(0.5)}"` +
      ` font-family="${FONT_LABEL}" font-size="${labelFontSize}" font-weight="bold"` +
      ` fill="${C_BLACK}">${escapeXml(m.id)}</text>`
  }
  return svg
}

// ─── Layer 11: Bearing schedule table ──────────────────────────────────────

function drawBearingScheduleTable(s: RenderState, data: MutationPlanData): string {
  const schedule = data.bearingSchedule
  if (schedule.length === 0) return ''

  const marginInner = mmToPx(BORDER_INNER_INSET)
  const tableX = marginInner + mmToPx(4)
  const tableMaxW = mmToPx(95) // Max table width
  const rowH = mmToPx(4)
  const headerH = mmToPx(6)
  const maxRows = Math.min(schedule.length, 20)
  const tableH = headerH + maxRows * rowH + mmToPx(6) // +6 for title row
  const tableY = marginInner + mmToPx(4)
  const tableW = Math.min(tableMaxW, s.drawW * 0.28)

  const colWidths = [
    tableW * 0.12,  // #
    tableW * 0.18,  // From
    tableW * 0.18,  // To
    tableW * 0.34,  // Bearing
    tableW * 0.18,  // Distance
  ]
  const headerFontSize = mmToPx(2.2)
  const dataFontSize = mmToPx(2.0)
  const titleFontSize = mmToPx(2.8)

  let svg = `<g class="bearing-schedule">`

  // Table background
  svg += `<rect x="${tableX}" y="${tableY}" width="${tableW}" height="${tableH}"` +
    ` fill="white" fill-opacity="0.92" stroke="${C_BLACK}" stroke-width="0.5"/>`

  // Title
  svg += `<text x="${tableX + tableW / 2}" y="${tableY + mmToPx(3.5)}" text-anchor="middle"` +
    ` font-family="${FONT_FORM}" font-size="${titleFontSize}" font-weight="bold"` +
    ` fill="${C_BLACK}">BEARING SCHEDULE</text>`

  // Header row separator
  const hdrY = tableY + mmToPx(5)
  svg += `<line x1="${tableX}" y1="${hdrY}" x2="${tableX + tableW}" y2="${hdrY}"` +
    ` stroke="${C_BLACK}" stroke-width="0.5"/>`

  // Column headers
  const headers = ['Line', 'From', 'To', 'Bearing', 'Dist (m)']
  let hx = tableX
  headers.forEach((h, i) => {
    svg += `<text x="${hx + colWidths[i] / 2}" y="${hdrY + mmToPx(2.2)}" text-anchor="middle"` +
      ` font-family="${FONT_FORM}" font-size="${headerFontSize}" font-weight="bold"` +
      ` fill="#555">${h}</text>`
    hx += colWidths[i]
  })

  // Data rows
  const rows = schedule.slice(0, maxRows)
  rows.forEach((entry, i) => {
    const ry = hdrY + rowH * (i + 1)
    // Row separator
    if (i > 0) {
      svg += `<line x1="${tableX}" y1="${ry}" x2="${tableX + tableW}" y2="${ry}"` +
        ` stroke="${C_BLACK}" stroke-width="0.2" opacity="0.4"/>`
    }

    let cx = tableX
    const cells = [
      entry.lineId,
      entry.from,
      entry.to,
      entry.bearing_dms,
      entry.distance_m.toFixed(3),
    ]
    cells.forEach((cell, ci) => {
      svg += `<text x="${cx + colWidths[ci] / 2}" y="${ry + mmToPx(2)}" text-anchor="middle"` +
        ` font-family="${FONT_FORM}" font-size="${dataFontSize}" fill="${C_BLACK}">` +
        `${escapeXml(cell)}</text>`
      cx += colWidths[ci]
    })
  })

  svg += `</g>`
  return svg
}

// ─── Layer 12: Authentication block ────────────────────────────────────────

function drawAuthBlock(s: RenderState, data: MutationPlanData): string {
  const p = data.project
  const marginInner = mmToPx(BORDER_INNER_INSET)
  const blockW = mmToPx(130)
  const blockH = mmToPx(AUTH_BLOCK_H_MM)
  const blockX = s.pageW - marginInner - blockW
  const blockY = s.pageH - marginInner - mmToPx(TITLE_BLOCK_H_MM) - blockH - mmToPx(4)

  const headerFontSize = mmToPx(2.5)
  const fieldFontSize = mmToPx(2.2)
  const smallFontSize = mmToPx(1.8)
  const lineH = mmToPx(3.5)
  const labelFontSize = mmToPx(2.0)

  let svg = `<g class="auth-block">`

  // Block background
  svg += `<rect x="${blockX}" y="${blockY}" width="${blockW}" height="${blockH}"` +
    ` fill="white" fill-opacity="0.93" stroke="${C_BLACK}" stroke-width="0.5"/>`

  // Title
  svg += `<text x="${blockX + blockW / 2}" y="${blockY + mmToPx(4)}" text-anchor="middle"` +
    ` font-family="${FONT_FORM}" font-size="${headerFontSize}" font-weight="bold"` +
    ` fill="${C_BLACK}">AUTHENTICATION</text>`

  // Separator
  const sepY = blockY + mmToPx(5.5)
  svg += `<line x1="${blockX}" y1="${sepY}" x2="${blockX + blockW}" y2="${sepY}"` +
    ` stroke="${C_BLACK}" stroke-width="0.4"/>`

  // "FOR DIRECTOR OF SURVEYS" sub-header
  svg += `<text x="${blockX + blockW / 2}" y="${sepY + mmToPx(3)}" text-anchor="middle"` +
    ` font-family="${FONT_FORM}" font-size="${smallFontSize}" font-weight="bold"` +
    ` fill="#555">FOR DIRECTOR OF SURVEYS</text>`

  // Surveyor details section
  let y = sepY + mmToPx(6)
  const leftPad = blockX + mmToPx(4)
  const rightPad = blockX + blockW - mmToPx(4)

  svg += `<text x="${leftPad}" y="${y}" font-family="${FONT_FORM}" font-size="${labelFontSize}" font-weight="bold" fill="#555">SURVEYOR DETAILS</text>`
  y += lineH

  const surveyorFields = [
    ['Surveyor', p.surveyor_name || '________________________'],
    ['Licence No.', p.surveyor_licence ? `LS/${p.surveyor_licence}` : '________________________'],
    ['Date', p.date || '________________________'],
  ]

  surveyorFields.forEach(([label, value]) => {
    svg += `<text x="${leftPad}" y="${y}" font-family="${FONT_FORM}" font-size="${fieldFontSize}" fill="#555">${escapeXml(label)}:</text>`
    svg += `<text x="${rightPad}" y="${y}" text-anchor="end" font-family="${FONT_FORM}" font-size="${fieldFontSize}" font-weight="bold" fill="${C_BLACK}">${escapeXml(value)}</text>`
    y += lineH
  })

  // Signature line
  y += mmToPx(1)
  svg += `<line x1="${leftPad}" y1="${y}" x2="${rightPad}" y2="${y}" stroke="${C_BLACK}" stroke-width="0.4"/>`
  svg += `<text x="${leftPad}" y="${y + mmToPx(2.5)}" font-family="${FONT_FORM}" font-size="${smallFontSize}" fill="#555">Signature of Licensed Surveyor</text>`

  // Director of Surveys authentication fields
  y += mmToPx(6)
  svg += `<line x1="${leftPad}" y1="${y}" x2="${rightPad}" y2="${y}" stroke="${C_BLACK}" stroke-width="0.4"/>`

  y += mmToPx(3)
  const authFields = [
    ['Examined by', '________________________'],
    ['Approved by', '________________________'],
    ['Authenticated by', '________________________'],
  ]

  authFields.forEach(([label]) => {
    svg += `<text x="${leftPad}" y="${y}" font-family="${FONT_FORM}" font-size="${fieldFontSize}" fill="#555">${escapeXml(label)}:</text>`
    svg += `<text x="${rightPad}" y="${y}" text-anchor="end" font-family="${FONT_FORM}" font-size="${smallFontSize}" fill="#555">Date: ___________</text>`
    y += lineH
  })

  // Seal placeholder
  const sealW = mmToPx(25)
  const sealH = mmToPx(12)
  const sealX = rightPad - sealW
  const sealY = y + mmToPx(1)
  svg += `<rect x="${sealX}" y="${sealY}" width="${sealW}" height="${sealH}"` +
    ` fill="none" stroke="${C_BLACK}" stroke-width="0.3" stroke-dasharray="2,2"/>`
  svg += `<text x="${sealX + sealW / 2}" y="${sealY + mmToPx(5)}" text-anchor="middle"` +
    ` font-family="${FONT_FORM}" font-size="${smallFontSize}" fill="#888">SEAL OF SURVEY</text>`
  svg += `<text x="${sealX + sealW / 2}" y="${sealY + mmToPx(8)}" text-anchor="middle"` +
    ` font-family="${FONT_FORM}" font-size="${smallFontSize}" fill="#888">OF KENYA</text>`

  svg += `</g>`
  return svg
}

// ─── Layer 13: Title block (bottom strip) ──────────────────────────────────

function drawTitleBlock(s: RenderState, data: MutationPlanData): string {
  const p = data.project
  const marginInner = mmToPx(BORDER_INNER_INSET)
  const blockH = mmToPx(TITLE_BLOCK_H_MM)
  const blockY = s.pageH - marginInner - blockH
  const blockX = marginInner
  const blockW = s.pageW - 2 * marginInner

  const titleFontSize = mmToPx(4)
  const fieldFontSize = mmToPx(2.8)
  const smallFontSize = mmToPx(2.0)
  const labelFontSize = mmToPx(2.2)

  let svg = `<g class="title-block">`

  // Background
  svg += `<rect x="${blockX}" y="${blockY}" width="${blockW}" height="${blockH}"` +
    ` fill="#fafafa" stroke="${C_BLACK}" stroke-width="0.8"/>`

  // Top separator line (double)
  svg += `<line x1="${blockX}" y1="${blockY}" x2="${blockX + blockW}" y2="${blockY}"` +
    ` stroke="${C_BLACK}" stroke-width="1.5"/>`
  svg += `<line x1="${blockX}" y1="${blockY + mmToPx(1)}" x2="${blockX + blockW}" y2="${blockY + mmToPx(1)}"` +
    ` stroke="${C_BLACK}" stroke-width="0.4"/>`

  // Column layout: left (project info) | centre (form title) | right (folio/register)
  const leftSectionX = blockX + mmToPx(5)
  const centreSectionX = blockX + blockW * 0.35
  const rightSectionX = blockX + blockW * 0.65
  const rightEdgeX = blockX + blockW - mmToPx(5)

  let y = blockY + mmToPx(5)

  // ── Left section: project metadata ──
  const leftFields = [
    ['Registration District', p.registrationDistrict],
    ['Locality', p.locality],
    ['Location', p.location],
    ['Cadastral Sheet', p.cadastralSheet],
    ['RIM Reference', p.rimReference],
  ]

  leftFields.forEach(([label, value]) => {
    if (!value) return
    svg += `<text x="${leftSectionX}" y="${y}" font-family="${FONT_FORM}" font-size="${smallFontSize}" fill="#555">${escapeXml(label)}:</text>`
    svg += `<text x="${centreSectionX - mmToPx(3)}" y="${y}" text-anchor="end" font-family="${FONT_FORM}" font-size="${smallFontSize}" font-weight="bold" fill="${C_BLACK}">${escapeXml(value)}</text>`
    y += mmToPx(3.5)
  })

  // ── Centre section: form title & scale ──
  let cy = blockY + mmToPx(6)
  svg += `<text x="${centreSectionX + (rightSectionX - centreSectionX) / 2}" y="${cy}" text-anchor="middle"` +
    ` font-family="${FONT_LABEL}" font-size="${titleFontSize}" font-weight="bold"` +
    ` fill="${C_BLACK}">MUTATION SURVEY PLAN</text>`
  cy += mmToPx(5.5)

  svg += `<text x="${centreSectionX + (rightSectionX - centreSectionX) / 2}" y="${cy}" text-anchor="middle"` +
    ` font-family="${FONT_FORM}" font-size="${fieldFontSize}" font-weight="bold"` +
    ` fill="#333">Form No. 3</text>`
  cy += mmToPx(5)

  svg += `<text x="${centreSectionX + (rightSectionX - centreSectionX) / 2}" y="${cy}" text-anchor="middle"` +
    ` font-family="${FONT_FORM}" font-size="${smallFontSize}" fill="#555">Survey Act Cap. 299</text>`
  cy += mmToPx(3.5)

  // Datum & zone
  const datum = p.datum || 'ARC1960'
  const zone = `${p.utmZone || 37}${p.hemisphere || 'S'}`
  svg += `<text x="${centreSectionX + (rightSectionX - centreSectionX) / 2}" y="${cy}" text-anchor="middle"` +
    ` font-family="${FONT_FORM}" font-size="${smallFontSize}" fill="#555">${escapeXml(datum)} / UTM Zone ${escapeXml(zone)}</text>`
  cy += mmToPx(3.5)

  // Scale
  svg += `<text x="${centreSectionX + (rightSectionX - centreSectionX) / 2}" y="${cy}" text-anchor="middle"` +
    ` font-family="${FONT_FORM}" font-size="${fieldFontSize}" font-weight="bold"` +
    ` fill="${C_BLACK}">SCALE 1 : ${s.scale.toLocaleString()}</text>`
  cy += mmToPx(4)

  // Survey regulations reference
  svg += `<text x="${centreSectionX + (rightSectionX - centreSectionX) / 2}" y="${cy}" text-anchor="middle"` +
    ` font-family="${FONT_FORM}" font-size="${mmToPx(1.6)}" fill="#888">Survey Regulations 1994 | RDM 1.1 §5</text>`

  // ── Right section: folio / register numbers ──
  let ry = blockY + mmToPx(6)

  if (p.folioNumber) {
    svg += `<text x="${rightSectionX + (rightEdgeX - rightSectionX) / 2}" y="${ry}" text-anchor="middle"` +
      ` font-family="${FONT_LABEL}" font-size="${labelFontSize}" fill="#555">FOLIO No.</text>`
    ry += mmToPx(3.5)
    svg += `<text x="${rightSectionX + (rightEdgeX - rightSectionX) / 2}" y="${ry}" text-anchor="middle"` +
      ` font-family="${FONT_LABEL}" font-size="${fieldFontSize}" font-weight="bold"` +
      ` fill="${C_BLACK}">${escapeXml(p.folioNumber)}</text>`
    ry += mmToPx(5)
  }

  if (p.registerNumber) {
    svg += `<text x="${rightSectionX + (rightEdgeX - rightSectionX) / 2}" y="${ry}" text-anchor="middle"` +
      ` font-family="${FONT_LABEL}" font-size="${labelFontSize}" fill="#555">REGISTER No.</text>`
    ry += mmToPx(3.5)
    svg += `<text x="${rightSectionX + (rightEdgeX - rightSectionX) / 2}" y="${ry}" text-anchor="middle"` +
      ` font-family="${FONT_LABEL}" font-size="${fieldFontSize}" font-weight="bold"` +
      ` fill="${C_BLACK}">${escapeXml(p.registerNumber)}</text>`
    ry += mmToPx(5)
  }

  if (p.transactions) {
    svg += `<text x="${rightSectionX + (rightEdgeX - rightSectionX) / 2}" y="${ry}" text-anchor="middle"` +
      ` font-family="${FONT_LABEL}" font-size="${labelFontSize}" fill="#555">TRANSACTION(s)</text>`
    ry += mmToPx(3.5)
    svg += `<text x="${rightSectionX + (rightEdgeX - rightSectionX) / 2}" y="${ry}" text-anchor="middle"` +
      ` font-family="${FONT_LABEL}" font-size="${fieldFontSize}" font-weight="bold"` +
      ` fill="${C_BLACK}">${escapeXml(p.transactions)}</text>`
  }

  // Surveyor name & licence (right section bottom)
  ry = blockY + blockH - mmToPx(8)
  svg += `<text x="${rightSectionX + (rightEdgeX - rightSectionX) / 2}" y="${ry}" text-anchor="middle"` +
    ` font-family="${FONT_FORM}" font-size="${smallFontSize}" fill="#555">` +
    `${escapeXml(p.surveyor_name || '')}  |  LS/${escapeXml(p.surveyor_licence || '')}</text>`

  svg += `</g>`
  return svg
}

// ─── Layer 14: North arrow & scale bar ─────────────────────────────────────

function drawNorthArrowAndScaleBar(s: RenderState, _data: MutationPlanData): string {
  let svg = ''

  // ── North arrow (blue filled polygon) ──
  const arrowSize = mmToPx(18)
  const arrowX = s.drawX + s.drawW - mmToPx(18)
  const arrowY = s.drawY + mmToPx(18)
  const shaftW = mmToPx(1.2)
  const shaftH = arrowSize * 0.55
  const headW = arrowSize * 0.35
  const headH = arrowSize * 0.45
  const nLabelSize = mmToPx(4)

  // Arrow points upward (north). Tip at top.
  const tipY = arrowY - shaftH - headH
  const baseY = arrowY - shaftH

  svg += `<g class="north-arrow">`
  // Shaft
  svg += `<rect x="${arrowX - shaftW / 2}" y="${baseY}" width="${shaftW}" height="${shaftH}" fill="#1a5276"/>`
  // North arrowhead (filled blue)
  svg += `<polygon points="${arrowX},${tipY} ${arrowX - headW},${baseY} ${arrowX + headW},${baseY}" fill="#1a5276"/>`
  // South half (unfilled outline)
  const southBaseY = arrowY + headH
  svg += `<polygon points="${arrowX},${southBaseY} ${arrowX - headW},${arrowY} ${arrowX + headW},${arrowY}"` +
    ` fill="none" stroke="#1a5276" stroke-width="0.8"/>`
  // South shaft
  svg += `<rect x="${arrowX - shaftW / 2}" y="${arrowY}" width="${shaftW}" height="${headH}" fill="none" stroke="#1a5276" stroke-width="0.5"/>`
  // N label
  svg += `<text x="${arrowX}" y="${tipY - mmToPx(2)}" text-anchor="middle"` +
    ` font-family="${FONT_LABEL}" font-size="${nLabelSize}" font-weight="bold" fill="#1a5276">N</text>`
  svg += `</g>`

  // ── Scale bar ──
  const scaleBarW = mmToPx(50)
  const scaleBarH = mmToPx(3)
  const scaleBarX = s.drawX + s.drawW - mmToPx(18) - scaleBarW
  const scaleBarY = arrowY + arrowSize / 2 + mmToPx(8)
  const numSegments = 4

  // Determine what ground distance the bar represents
  const barGroundDist = (scaleBarW / PX_PER_MM) * s.scale / 1000 // km equivalent
  const segmentMetres = Math.round((barGroundDist * 1000) / numSegments)

  svg += `<g class="scale-bar">`
  for (let i = 0; i < numSegments; i++) {
    const segX = scaleBarX + i * (scaleBarW / numSegments)
    const segW = scaleBarW / numSegments
    if (i % 2 === 0) {
      svg += `<rect x="${segX}" y="${scaleBarY}" width="${segW}" height="${scaleBarH}" fill="${C_BLACK}"/>`
    } else {
      svg += `<rect x="${segX}" y="${scaleBarY}" width="${segW}" height="${scaleBarH}" fill="white" stroke="${C_BLACK}" stroke-width="0.5"/>`
    }
  }
  // Border
  svg += `<rect x="${scaleBarX}" y="${scaleBarY}" width="${scaleBarW}" height="${scaleBarH}" fill="none" stroke="${C_BLACK}" stroke-width="0.8"/>`

  // Labels below
  const labelY = scaleBarY + scaleBarH + mmToPx(3)
  const labelFontSize = mmToPx(2)
  for (let i = 0; i <= numSegments; i++) {
    const lx = scaleBarX + i * (scaleBarW / numSegments)
    const val = i * segmentMetres
    svg += `<text x="${lx}" y="${labelY}" text-anchor="middle"` +
      ` font-family="${FONT_FORM}" font-size="${labelFontSize}" fill="${C_BLACK}">${val}</text>`
  }

  // "METRES" label
  svg += `<text x="${scaleBarX + scaleBarW / 2}" y="${labelY + mmToPx(2.5)}" text-anchor="middle"` +
    ` font-family="${FONT_FORM}" font-size="${mmToPx(1.8)}" fill="#555">METRES</text>`

  // Scale text
  svg += `<text x="${scaleBarX + scaleBarW / 2}" y="${labelY + mmToPx(4.5)}" text-anchor="middle"` +
    ` font-family="${FONT_FORM}" font-size="${mmToPx(2.2)}" font-weight="bold" fill="${C_BLACK}">SCALE 1 : ${s.scale.toLocaleString()}</text>`

  svg += `</g>`

  return svg
}
