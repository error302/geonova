/**
 * Cross-Section SVG Renderer
 *
 * Renders road cross-section plots showing ground profile, formation line,
 * camber curve, and cut/fill areas as SVG. Used by the corridor UI
 * for visual verification of earthworks design.
 *
 * References:
 *   - Kenya RDM 1.1 2025, §8 — Road cross-section design
 *   - AASHTO A Policy on Geometric Design of Highways and Streets
 */

import type { ProfilePoint } from './crossSectionGeometry'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CrossSectionPlotData {
  /** Chainage of this section (metres). */
  chainage: number
  /** Natural ground profile points. */
  groundPoints: ProfilePoint[]
  /** Formation line points (road template). */
  formationPoints: ProfilePoint[]
  /** Cut area (m², positive). 0 if fill section. */
  cutArea: number
  /** Fill area (m², positive). 0 if cut section. */
  fillArea: number
  /** Section classification. */
  sectionType: 'cut' | 'fill' | 'mixed'
}

export interface CrossSectionPlotOptions {
  /** SVG width in pixels. Default 600. */
  width?: number
  /** SVG height in pixels. Default 300. */
  height?: number
  /** Horizontal scale (px per metre). Auto-computed if omitted. */
  hScale?: number
  /** Vertical scale (px per metre). Auto-computed if omitted. */
  vScale?: number
  /** Carriageway width in metres for reference line. */
  carriagewayWidth?: number
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MARGIN = { top: 30, right: 30, bottom: 40, left: 50 }
const COLORS = {
  ground: '#5D4037',
  formation: '#1565C0',
  cutArea: 'rgba(244, 67, 54, 0.25)',
  fillArea: 'rgba(33, 150, 243, 0.25)',
  cutStroke: '#D32F2F',
  fillStroke: '#1976D2',
  grid: '#E0E0E0',
  axis: '#424242',
  text: '#212121',
  label: '#616161',
  camber: '#FF9800',
}

// ─── Rendering ──────────────────────────────────────────────────────────────

/**
 * Render a single cross-section as an SVG string.
 */
export function renderCrossSectionPlot(
  data: CrossSectionPlotData,
  options: CrossSectionPlotOptions = {},
): string {
  const w = options.width ?? 600
  const h = options.height ?? 300
  const plotW = w - MARGIN.left - MARGIN.right
  const plotH = h - MARGIN.top - MARGIN.bottom

  const allPoints = [...data.groundPoints, ...data.formationPoints]
  if (allPoints.length === 0) return emptySVG(w, h)

  // Compute data extents
  const offsets = allPoints.map(p => p.offset)
  const levels = allPoints.map(p => p.level)
  const minOffset = Math.min(...offsets)
  const maxOffset = Math.max(...offsets)
  const minLevel = Math.min(...levels) - 0.5
  const maxLevel = Math.max(...levels) + 0.5

  const dataRangeX = maxOffset - minOffset || 1
  const dataRangeY = maxLevel - minLevel || 1

  const hScale = options.hScale ?? (plotW / dataRangeX) * 0.85
  const vScale = options.vScale ?? (plotH / dataRangeY) * 0.8

  // Transform functions: data → SVG
  const toX = (offset: number) => MARGIN.left + (offset - minOffset) * hScale + (plotW - dataRangeX * hScale) / 2
  const toY = (level: number) => MARGIN.top + plotH - (level - minLevel) * vScale

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="font-family: 'JetBrains Mono', monospace;">`

  // Background
  svg += `<rect x="0" y="0" width="${w}" height="${h}" fill="white"/>`

  // Grid lines
  svg += renderGrid(minOffset, maxOffset, minLevel, maxLevel, hScale, vScale, toX, toY, w, h)

  // Axes
  svg += renderAxes(toX(0), MARGIN.top, toX(0), MARGIN.top + plotH, 'Centreline')
  svg += renderAxes(MARGIN.left, toY(minLevel) + 5, MARGIN.left + plotW, toY(minLevel) + 5, 'Offset (m)')
  svg += renderAxes(MARGIN.left - 5, MARGIN.top, MARGIN.left - 5, MARGIN.top + plotH, 'Level (RL)')

  // Cut/fill areas
  if (data.cutArea > 0 || data.fillArea > 0) {
    svg += renderCutFillArea(data.groundPoints, data.formationPoints, toX, toY, data.sectionType)
  }

  // Formation line
  svg += renderProfileLine(data.formationPoints, toX, toY, COLORS.formation, 2, '8,4')

  // Ground profile
  svg += renderProfileLine(data.groundPoints, toX, toY, COLORS.ground, 2.5)

  // Ground points (dots)
  for (const p of data.groundPoints) {
    svg += `<circle cx="${toX(p.offset)}" cy="${toY(p.level)}" r="3" fill="${COLORS.ground}"/>`
  }

  // Title and info
  const chainageStr = data.chainage >= 1000
    ? `${Math.floor(data.chainage / 1000)}+${(data.chainage % 1000).toFixed(3).padStart(6, '0')}`
    : data.chainage.toFixed(3)
  svg += `<text x="${w / 2}" y="18" text-anchor="middle" font-size="12" font-weight="bold" fill="${COLORS.text}">Section at ${chainageStr}</text>`

  // Area labels
  if (data.cutArea > 0) {
    svg += `<text x="${w - 10}" y="18" text-anchor="end" font-size="10" fill="${COLORS.cutStroke}">Cut: ${data.cutArea.toFixed(2)} m\u00B2</text>`
  }
  if (data.fillArea > 0) {
    svg += `<text x="${w - 10}" y="${data.cutArea > 0 ? 30 : 18}" text-anchor="end" font-size="10" fill="${COLORS.fillStroke}">Fill: ${data.fillArea.toFixed(2)} m\u00B2</text>`
  }

  // Legend
  svg += renderLegend(w - 140, h - 50)

  svg += '</svg>'
  return svg
}

/**
 * Render a corridor summary (long-section + volume bar chart).
 */
export function renderCorridorSummary(
  sections: CrossSectionPlotData[],
  volumes: Array<{ chainage: number; cutVolume: number; fillVolume: number }>,
  options: CrossSectionPlotOptions = {},
): string {
  const w = options.width ?? 800
  const h = options.height ?? 250
  const plotW = w - MARGIN.left - MARGIN.right
  const plotH = h - MARGIN.top - MARGIN.bottom

  if (sections.length === 0) return emptySVG(w, h)

  const chainages = sections.map(s => s.chainage)
  const minCh = Math.min(...chainages)
  const maxCh = Math.max(...chainages)
  const chRange = maxCh - minCh || 1

  const toX = (ch: number) => MARGIN.left + ((ch - minCh) / chRange) * plotW

  // Volume data for bar chart
  const maxVol = Math.max(...volumes.map(v => Math.max(v.cutVolume, v.fillVolume)), 1)
  const barH = plotH / 2 - 10
  const toBarH = (vol: number) => (vol / maxVol) * barH

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="font-family: 'JetBrains Mono', monospace;">`
  svg += `<rect x="0" y="0" width="${w}" height="${h}" fill="white"/>`
  svg += `<text x="${w / 2}" y="18" text-anchor="middle" font-size="12" font-weight="bold" fill="${COLORS.text}">Corridor Volume Summary</text>`

  // Chainage axis
  svg += `<line x1="${MARGIN.left}" y1="${MARGIN.top + plotH}" x2="${MARGIN.left + plotW}" y2="${MARGIN.top + plotH}" stroke="${COLORS.axis}" stroke-width="1"/>`
  for (const ch of chainages) {
    const x = toX(ch)
    svg += `<line x1="${x}" y1="${MARGIN.top + plotH - 3}" x2="${x}" y2="${MARGIN.top + plotH + 3}" stroke="${COLORS.axis}" stroke-width="1"/>`
    const label = ch >= 1000 ? `${Math.floor(ch / 1000)}+${(ch % 1000).toFixed(0)}` : ch.toFixed(0)
    svg += `<text x="${x}" y="${MARGIN.top + plotH + 15}" text-anchor="middle" font-size="8" fill="${COLORS.label}">${label}</text>`
  }

  // Cut bars (above midline, red)
  const midY = MARGIN.top + barH + 10
  for (const v of volumes) {
    const x = toX(v.chainage)
    const barW = Math.max(plotW / volumes.length * 0.35, 4)
    const cutH = toBarH(v.cutVolume)
    if (cutH > 0) {
      svg += `<rect x="${x - barW}" y="${midY - cutH}" width="${barW}" height="${cutH}" fill="${COLORS.cutStroke}" opacity="0.6"/>`
    }
    const fillH = toBarH(v.fillVolume)
    if (fillH > 0) {
      svg += `<rect x="${x}" y="${midY}" width="${barW}" height="${fillH}" fill="${COLORS.fillStroke}" opacity="0.6"/>`
    }
  }

  // Midline
  svg += `<line x1="${MARGIN.left}" y1="${midY}" x2="${MARGIN.left + plotW}" y2="${midY}" stroke="${COLORS.grid}" stroke-width="0.5" stroke-dasharray="4,2"/>`
  svg += `<text x="${MARGIN.left - 5}" y="${midY - barH - 5}" text-anchor="end" font-size="8" fill="${COLORS.cutStroke}">Cut (m\u00B3)</text>`
  svg += `<text x="${MARGIN.left - 5}" y="${midY + barH + 12}" text-anchor="end" font-size="8" fill="${COLORS.fillStroke}">Fill (m\u00B3)</text>`

  // Legend
  svg += `<rect x="${w - 120}" y="${h - 25}" width="10" height="10" fill="${COLORS.cutStroke}" opacity="0.6"/>`
  svg += `<text x="${w - 105}" y="${h - 16}" font-size="9" fill="${COLORS.text}">Cut</text>`
  svg += `<rect x="${w - 60}" y="${h - 25}" width="10" height="10" fill="${COLORS.fillStroke}" opacity="0.6"/>`
  svg += `<text x="${w - 45}" y="${h - 16}" font-size="9" fill="${COLORS.text}">Fill</text>`

  svg += '</svg>'
  return svg
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

function emptySVG(w: number, h: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="white"/><text x="${w / 2}" y="${h / 2}" text-anchor="middle" font-size="12" fill="#999">No cross-section data</text></svg>`
}

function renderGrid(
  minOffset: number, maxOffset: number,
  minLevel: number, maxLevel: number,
  hScale: number, vScale: number,
  toX: (o: number) => number, toY: (l: number) => number,
  w: number, h: number,
): string {
  let svg = ''
  // Vertical grid lines (offsets)
  const offsetStep = Math.max(Math.ceil((maxOffset - minOffset) / 8), 1)
  for (let o = Math.ceil(minOffset / offsetStep) * offsetStep; o <= maxOffset; o += offsetStep) {
    const x = toX(o)
    svg += `<line x1="${x}" y1="${MARGIN.top}" x2="${x}" y2="${MARGIN.top + h - MARGIN.top - MARGIN.bottom}" stroke="${COLORS.grid}" stroke-width="0.5"/>`
    svg += `<text x="${x}" y="${MARGIN.top + h - MARGIN.bottom + 12}" text-anchor="middle" font-size="8" fill="${COLORS.label}">${o.toFixed(0)}</text>`
  }
  // Horizontal grid lines (levels)
  const levelStep = Math.max(Math.ceil((maxLevel - minLevel) / 6 * 2) / 2, 0.5)
  for (let l = Math.ceil(minLevel / levelStep) * levelStep; l <= maxLevel; l += levelStep) {
    const y = toY(l)
    svg += `<line x1="${MARGIN.left}" y1="${y}" x2="${MARGIN.left + w - MARGIN.left - MARGIN.right}" y2="${y}" stroke="${COLORS.grid}" stroke-width="0.5"/>`
    svg += `<text x="${MARGIN.left - 8}" y="${y + 3}" text-anchor="end" font-size="8" fill="${COLORS.label}">${l.toFixed(1)}</text>`
  }
  return svg
}

function renderAxes(x1: number, y1: number, x2: number, y2: number, label: string): string {
  let svg = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${COLORS.axis}" stroke-width="1"/>`
  // Arrowhead for horizontal axes
  if (Math.abs(y1 - y2) < 1 && x2 > x1) {
    svg += `<polygon points="${x2},${y2} ${x2 - 6},${y2 - 3} ${x2 - 6},${y2 + 3}" fill="${COLORS.axis}"/>`
  }
  return svg
}

function renderProfileLine(
  points: ProfilePoint[],
  toX: (o: number) => number,
  toY: (l: number) => number,
  color: string,
  strokeWidth: number,
  dashArray?: string,
): string {
  if (points.length < 2) return ''
  const sorted = [...points].sort((a, b) => a.offset - b.offset)
  const coords = sorted.map(p => `${toX(p.offset).toFixed(1)},${toY(p.level).toFixed(1)}`).join(' ')
  const dash = dashArray ? ` stroke-dasharray="${dashArray}"` : ''
  return `<polyline points="${coords}" fill="none" stroke="${color}" stroke-width="${strokeWidth}"${dash}/>`
}

function renderCutFillArea(
  groundPoints: ProfilePoint[],
  formationPoints: ProfilePoint[],
  toX: (o: number) => number,
  toY: (l: number) => number,
  sectionType: 'cut' | 'fill' | 'mixed',
): string {
  const sortedGround = [...groundPoints].sort((a, b) => a.offset - b.offset)
  const sortedFormation = [...formationPoints].sort((a, b) => a.offset - b.offset)

  // Combine all offsets for alignment
  const offsets = new Set<number>()
  for (const p of sortedGround) offsets.add(p.offset)
  for (const p of sortedFormation) offsets.add(p.offset)
  const sortedOffsets = Array.from(offsets).sort((a, b) => a - b)

  function interpLevel(profile: ProfilePoint[], offset: number): number {
    if (offset <= profile[0].offset) return profile[0].level
    if (offset >= profile[profile.length - 1].offset) return profile[profile.length - 1].level
    for (let i = 0; i < profile.length - 1; i++) {
      if (profile[i].offset <= offset && profile[i + 1].offset >= offset) {
        const segLen = profile[i + 1].offset - profile[i].offset
        if (segLen < 1e-12) return profile[i].level
        const t = (offset - profile[i].offset) / segLen
        return profile[i].level + t * (profile[i + 1].level - profile[i].level)
      }
    }
    return profile[profile.length - 1].level
  }

  // Build polygon: ground left→right, formation right→left
  let polygonCoords = ''
  for (const offset of sortedOffsets) {
    polygonCoords += `${toX(offset).toFixed(1)},${toY(interpLevel(sortedGround, offset)).toFixed(1)} `
  }
  for (let i = sortedOffsets.length - 1; i >= 0; i--) {
    polygonCoords += `${toX(sortedOffsets[i]).toFixed(1)},${toY(interpLevel(sortedFormation, sortedOffsets[i])).toFixed(1)} `
  }

  const fillColor = sectionType === 'fill' ? COLORS.fillArea : COLORS.cutArea
  const strokeColor = sectionType === 'fill' ? COLORS.fillStroke : COLORS.cutStroke

  return `<polygon points="${polygonCoords.trim()}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="0.5" opacity="0.6"/>`
}

function renderLegend(x: number, y: number): string {
  let svg = `<g transform="translate(${x},${y})">`
  svg += `<rect x="0" y="0" width="130" height="40" fill="white" stroke="#DDD" stroke-width="0.5" rx="3"/>`
  // Ground
  svg += `<line x1="8" y1="12" x2="28" y2="12" stroke="${COLORS.ground}" stroke-width="2.5"/>`
  svg += `<text x="34" y="15" font-size="8" fill="${COLORS.text}">Ground</text>`
  // Formation
  svg += `<line x1="8" y1="28" x2="28" y2="28" stroke="${COLORS.formation}" stroke-width="2" stroke-dasharray="8,4"/>`
  svg += `<text x="34" y="31" font-size="8" fill="${COLORS.text}">Formation</text>`
  svg += '</g>'
  return svg
}
