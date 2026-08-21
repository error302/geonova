/**
 * Force-directed label placement solver for survey plan boundary labels.
 *
 * Solves the label-overlap problem common on dense subdivision plans by
 * iteratively pushing colliding labels apart and generating dimension
 * leaders when a parcel leg is too short to fit the text inline.
 */

import {
  PX_PER_M,
  bearingFromDelta,
  distance,
  segmentAngle,
  formatBearingDegMinSec,
} from './geometry'
import { escapeXml } from './symbols'

// ─── Types ──────────────────────────────────────────────────────────────────

/** A single label candidate to place. */
export interface LabelCandidate {
  /** Segment index in the boundary polygon. */
  segIndex: number
  /** Bearing of the segment in decimal degrees [0,360). */
  bearing: number
  /** Distance of the segment in metres. */
  segLength: number
  /** Midpoint of the segment (ground coords). */
  midE: number
  midN: number
  /** Perpendicular unit vector (ground coords, pointing left of travel). */
  perpE: number
  perpN: number
  /** Segment angle in degrees for text rotation. */
  angleDeg: number
  /** Bearing string to render. */
  bearingStr: string
  /** Distance string to render. */
  distStr: string
}

/** Final rendered label with position and leader information. */
export interface PlacedLabel {
  /** SVG x of label centre (px). */
  svgX: number
  /** SVG y of label centre (px). */
  svgY: number
  /** Text rotation angle in degrees. */
  textAngle: number
  /** Bounding box width for the background rect (px). */
  boxWidth: number
  /** Bounding box height for the background rect (px). */
  boxHeight: number
  /** Bearing text. */
  bearingStr: string
  /** Distance text. */
  distStr: string
  /** Whether a dimension leader was generated. */
  hasLeader: boolean
  /** Leader line anchor on the segment (ground coords). */
  anchorE?: number
  anchorN?: number
  /** Segment index. */
  segIndex: number
}

export interface SolverOptions {
  /** Minimum segment length (metres) below which a dimension leader is generated. Default 3. */
  minLegLength?: number
  /** Maximum perpendicular offset (metres) for label displacement. Default 15. */
  maxOffset?: number
  /** Number of force-directed iterations. Default 25. */
  iterations?: number
  /** Repulsion force constant (px^2 per overlap area). Default 120. */
  repulsionK?: number
  /** Minimum gap between label bounding boxes (px). Default 3. */
  minGap?: number
  /** Font size for bearing text (px). Default 8.5. */
  bearingFontSize?: number
  /** Font size for distance text (px). Default 8. */
  distFontSize?: number
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Average character width ratio (px per font-size unit) for JetBrains Mono. */
const CHAR_WIDTH_RATIO = 0.55
/** Background rect horizontal padding (px). */
const BOX_PAD_X = 8
/** Background rect vertical padding (px). */
const BOX_PAD_Y = 4
/** Default minimum leg length before generating a dimension leader. */
const DEFAULT_MIN_LEG_LENGTH = 3
/** Default max perpendicular offset for label displacement. */
const DEFAULT_MAX_OFFSET = 15
/** Number of force-directed iterations. */
const DEFAULT_ITERATIONS = 25
/** Default repulsion constant. */
const DEFAULT_REPULSION_K = 120
/** Default minimum gap between labels. */
const DEFAULT_MIN_GAP = 3
/** Default bearing font size. */
const DEFAULT_BEARING_FONT_SIZE = 8.5
/** Default distance font size. */
const DEFAULT_DIST_FONT_SIZE = 8
/** Leader line stub length (metres). */
const LEADER_STUB_M = 0.6

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Compute the half-width and half-height of the label text block (px). */
function measureLabel(
  bearingStr: string,
  distStr: string,
  bearingFontSize: number,
  distFontSize: number,
): { hw: number; hh: number } {
  const bearingW = bearingStr.length * CHAR_WIDTH_RATIO * bearingFontSize
  const distW = distStr.length * CHAR_WIDTH_RATIO * distFontSize
  const hw = (Math.max(bearingW, distW) + BOX_PAD_X) / 2
  // Two lines of text + gap
  const hh = (bearingFontSize + distFontSize + BOX_PAD_Y * 2) / 2
  return { hw, hh }
}

/** Compute the AABB of a rotated rectangle. */
function rotatedAABB(
  cx: number, cy: number,
  hw: number, hh: number,
  angleDeg: number,
): { minX: number; maxX: number; minY: number; maxY: number } {
  const rad = (angleDeg * Math.PI) / 180
  const cosA = Math.abs(Math.cos(rad))
  const sinA = Math.abs(Math.sin(rad))
  const rhw = hw * cosA + hh * sinA
  const rhh = hw * sinA + hh * cosA
  return { minX: cx - rhw, maxX: cx + rhw, minY: cy - rhh, maxY: cy + rhh }
}

// ─── Solver ─────────────────────────────────────────────────────────────────

/**
 * Build label candidates from boundary polygon segments.
 */
export function buildLabelCandidates(
  points: Array<{ easting: number; northing: number }>,
): LabelCandidate[] {
  const candidates: LabelCandidate[] = []
  for (let i = 0; i < points.length; i++) {
    const from = points[i]
    const to = points[(i + 1) % points.length]
    const segLen = distance(from.easting, from.northing, to.easting, to.northing)
    if (segLen < 0.01) continue // skip degenerate segments
    const bearing = bearingFromDelta(to.easting - from.easting, to.northing - from.northing)
    const angleDeg = segmentAngle(from.easting, from.northing, to.easting, to.northing)
    const dE = to.easting - from.easting
    const dN = to.northing - from.northing
    const len = Math.sqrt(dE * dE + dN * dN)
    const perpE = len > 0 ? -dN / len : 0
    const perpN = len > 0 ? dE / len : 1
    const bearingStr = formatBearingDegMinSec(bearing)
    const distStr = segLen.toFixed(2) + ' m'

    candidates.push({
      segIndex: i,
      bearing,
      segLength: segLen,
      midE: (from.easting + to.easting) / 2,
      midN: (from.northing + to.northing) / 2,
      perpE,
      perpN,
      angleDeg,
      bearingStr,
      distStr,
    })
  }
  return candidates
}

/**
 * Run the force-directed label placement solver.
 *
 * Returns placed labels with collision-free positions and leader lines
 * for short legs.
 */
export function solveLabelPlacement(
  candidates: LabelCandidate[],
  toSvgX: (e: number) => number,
  toSvgY: (n: number) => number,
  options: SolverOptions = {},
): PlacedLabel[] {
  const maxOffset = options.maxOffset ?? DEFAULT_MAX_OFFSET
  const iterations = options.iterations ?? DEFAULT_ITERATIONS
  const repulsionK = options.repulsionK ?? DEFAULT_REPULSION_K
  const minGap = options.minGap ?? DEFAULT_MIN_GAP
  const bearingFontSize = options.bearingFontSize ?? DEFAULT_BEARING_FONT_SIZE
  const distFontSize = options.distFontSize ?? DEFAULT_DIST_FONT_SIZE

  // ── Phase 1: Compute initial SVG positions ──────────────────────────────
  interface LabelState {
    sx: number
    sy: number
    perpE: number
    perpN: number
    needsLeader: boolean
    candidate: LabelCandidate
    hw: number
    hh: number
    textAngle: number
    midSx: number
    midSy: number
  }

  const states: LabelState[] = candidates.map((cand) => {
    const { hw, hh } = measureLabel(cand.bearingStr, cand.distStr, bearingFontSize, distFontSize)
    const midSx = toSvgX(cand.midE)
    const midSy = toSvgY(cand.midN)
    const needsLeader = cand.segLength < (options.minLegLength ?? DEFAULT_MIN_LEG_LENGTH)
    // Initial offset: 4/PX_PER_M ground metres (same as legacy)
    const initOffsetM = 4 / PX_PER_M
    return {
      sx: midSx + cand.perpE * initOffsetM * PX_PER_M,
      sy: midSy + cand.perpN * initOffsetM * PX_PER_M,
      perpE: cand.perpE,
      perpN: cand.perpN,
      needsLeader,
      candidate: cand,
      hw,
      hh,
      textAngle: (() => {
        let a = cand.angleDeg
        if (a > 90 || a < -90) a += 180
        return a
      })(),
      midSx,
      midSy,
    }
  })

  // ── Phase 2: Force-directed collision resolution ────────────────────────
  for (let iter = 0; iter < iterations; iter++) {
    let totalOverlap = 0

    for (let i = 0; i < states.length; i++) {
      for (let j = i + 1; j < states.length; j++) {
        const a = states[i]
        const b = states[j]

        const bboxA = rotatedAABB(a.sx, a.sy, a.hw, a.hh, a.textAngle)
        const bboxB = rotatedAABB(b.sx, b.sy, b.hw, b.hh, b.textAngle)

        const overlapX = Math.min(bboxA.maxX, bboxB.maxX) - Math.max(bboxA.minX, bboxB.minX)
        const overlapY = Math.min(bboxA.maxY, bboxB.maxY) - Math.max(bboxA.minY, bboxB.minY)

        if (overlapX > minGap && overlapY > minGap) {
          totalOverlap += overlapX * overlapY

          const dx = b.sx - a.sx
          const dy = b.sy - a.sy
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const overlapArea = overlapX * overlapY
          const force = repulsionK * overlapArea / (dist * dist)

          const pushX = (dx / dist) * force
          const pushY = (dy / dist) * force

          const aPerpPxX = a.perpE * PX_PER_M
          const aPerpPxY = a.perpN * PX_PER_M
          const bPerpPxX = b.perpE * PX_PER_M
          const bPerpPxY = b.perpN * PX_PER_M

          const aProj = pushX * aPerpPxX + pushY * aPerpPxY
          const bProj = pushX * bPerpPxX + pushY * bPerpPxY

          a.sx += aPerpPxX * aProj * 0.5
          a.sy += aPerpPxY * aProj * 0.5
          b.sx -= bPerpPxX * bProj * 0.5
          b.sy -= bPerpPxY * bProj * 0.5

          // Clamp offset from midpoint
          const maxOffsetPx = maxOffset * PX_PER_M
          for (const lbl of [a, b]) {
            const offPx = Math.sqrt((lbl.sx - lbl.midSx) ** 2 + (lbl.sy - lbl.midSy) ** 2)
            if (offPx > maxOffsetPx) {
              const scale = maxOffsetPx / offPx
              lbl.sx = lbl.midSx + (lbl.sx - lbl.midSx) * scale
              lbl.sy = lbl.midSy + (lbl.sy - lbl.midSy) * scale
            }
          }
        }
      }
    }

    if (totalOverlap === 0) break
  }

  // ── Phase 3: Generate placed labels with leaders for short legs ─────────
  return states.map((state) => {
    const leaderOffsetM = Math.max(state.candidate.segLength * 0.6, LEADER_STUB_M + 0.5)
    const finalSx = state.needsLeader
      ? state.midSx + state.perpE * leaderOffsetM * PX_PER_M
      : state.sx
    const finalSy = state.needsLeader
      ? state.midSy + state.perpN * leaderOffsetM * PX_PER_M
      : state.sy

    return {
      svgX: finalSx,
      svgY: finalSy,
      textAngle: state.textAngle,
      boxWidth: state.hw * 2,
      boxHeight: state.hh * 2,
      bearingStr: state.candidate.bearingStr,
      distStr: state.candidate.distStr,
      hasLeader: state.needsLeader,
      anchorE: state.needsLeader ? state.candidate.midE : undefined,
      anchorN: state.needsLeader ? state.candidate.midN : undefined,
      segIndex: state.candidate.segIndex,
    }
  })
}

// ─── SVG Rendering ──────────────────────────────────────────────────────────

/**
 * Render a single placed label as SVG (text + background rect).
 */
function renderLabelSVG(label: PlacedLabel, bearingFontSize: number, distFontSize: number): string {
  const tw = label.boxWidth
  const th = label.boxHeight

  let svg = `<g transform="translate(${label.svgX},${label.svgY})">`
  svg += `<g transform="rotate(${label.textAngle})">`
  svg += `<rect x="${-tw / 2}" y="${-th / 2}" width="${tw}" height="${th}" fill="white" opacity="0.85" stroke="none"/>`
  svg += `<text x="0" y="-3" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="${bearingFontSize}" font-weight="bold" fill="#000000">${escapeXml(label.bearingStr)}</text>`
  svg += `<text x="0" y="${bearingFontSize + 2}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="${distFontSize}" fill="#222222">${escapeXml(label.distStr)}</text>`
  svg += `</g></g>`

  return svg
}

/**
 * Render a dimension leader line from the label back to the segment midpoint.
 */
function renderLeaderSVG(
  label: PlacedLabel,
  toSvgX: (e: number) => number,
  toSvgY: (n: number) => number,
  cand: LabelCandidate,
): string {
  if (!label.hasLeader || label.anchorE === undefined || label.anchorN === undefined) return ''

  const anchorSx = toSvgX(label.anchorE)
  const anchorSy = toSvgY(label.anchorN)

  // Dashed line from label to anchor
  let svg = `<line x1="${label.svgX}" y1="${label.svgY}" x2="${anchorSx}" y2="${anchorSy}" stroke="#000" stroke-width="0.4" stroke-dasharray="3,2"/>`

  // Stub at the midpoint perpendicular to the segment
  const stubHalf = LEADER_STUB_M / 2
  const stubSx1 = toSvgX(label.anchorE + cand.perpE * stubHalf)
  const stubSy1 = toSvgY(label.anchorN + cand.perpN * stubHalf)
  const stubSx2 = toSvgX(label.anchorE - cand.perpE * stubHalf)
  const stubSy2 = toSvgY(label.anchorN - cand.perpN * stubHalf)
  svg += `<line x1="${stubSx1}" y1="${stubSy1}" x2="${stubSx2}" y2="${stubSy2}" stroke="#000" stroke-width="0.6"/>`

  // Small arrowheads at the stub ends
  const arrowLen = LEADER_STUB_M * 0.25
  for (const sign of [1, -1] as const) {
    const tipE = label.anchorE + cand.perpE * (stubHalf * sign)
    const tipN = label.anchorN + cand.perpN * (stubHalf * sign)
    const tipSx = toSvgX(tipE)
    const tipSy = toSvgY(tipN)
    const a1E = tipE - cand.perpE * arrowLen
    const a1N = tipN - cand.perpN * arrowLen
    const a2E = tipE - cand.perpE * arrowLen + (cand.perpN * arrowLen * 0.5)
    const a2N = tipN - cand.perpN * arrowLen - (cand.perpE * arrowLen * 0.5)
    svg += `<polygon points="${tipSx},${tipSy} ${toSvgX(a1E)},${toSvgY(a1N)} ${toSvgX(a2E)},${toSvgY(a2N)}" fill="#000"/>`
  }

  return svg
}

/**
 * Render all placed labels as an SVG group.
 */
export function renderPlacedLabels(
  placedLabels: PlacedLabel[],
  candidates: LabelCandidate[],
  toSvgX: (e: number) => number,
  toSvgY: (n: number) => number,
  options: SolverOptions = {},
): string {
  const bearingFontSize = options.bearingFontSize ?? DEFAULT_BEARING_FONT_SIZE
  const distFontSize = options.distFontSize ?? DEFAULT_DIST_FONT_SIZE

  let svg = '<g class="boundary-labels">'

  // Render leaders first (behind labels)
  for (const label of placedLabels) {
    if (label.hasLeader) {
      const cand = candidates[label.segIndex]
      svg += renderLeaderSVG(label, toSvgX, toSvgY, cand)
    }
  }

  // Render labels on top
  for (const label of placedLabels) {
    svg += renderLabelSVG(label, bearingFontSize, distFontSize)
  }

  svg += '</g>'
  return svg
}

/**
 * High-level entry point: build candidates, solve, and render to SVG.
 */
export function solveAndRenderBoundaryLabels(
  points: Array<{ easting: number; northing: number }>,
  toSvgX: (e: number) => number,
  toSvgY: (n: number) => number,
  options: SolverOptions = {},
): string {
  const candidates = buildLabelCandidates(points)
  if (candidates.length === 0) return ''
  const placedLabels = solveLabelPlacement(candidates, toSvgX, toSvgY, options)
  return renderPlacedLabels(placedLabels, candidates, toSvgX, toSvgY, options)
}
