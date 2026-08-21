import Drawing from 'dxf-writer'
import type { SubmissionPackage } from '../types'
import { initialiseSokDXFLayers, DXF_LAYERS, formatPlanDate } from '@/lib/drawing/dxfLayers'

// ─── Bearing Computation ──────────────────────────────────────────────────────

/** Compute whole-circle bearing from North (clockwise) between two points. Returns bearing in decimal degrees [0, 360). */
function computeBearing(e1: number, n1: number, e2: number, n2: number): number {
  const dE = e2 - e1
  const dN = n2 - n1
  let bearing = (Math.atan2(dE, dN) * 180) / Math.PI
  if (bearing < 0) bearing += 360
  return bearing
}

/** Convert a whole-circle bearing to a quadrant bearing string: N/S angle E/W. */
function formatQuadrantBearing(wcb: number): string {
  const normalised = ((wcb % 360) + 360) % 360
  let quadrantAngle: number
  let prefix: string
  let suffix: string

  if (normalised <= 90) { prefix = 'N'; suffix = 'E'; quadrantAngle = normalised }
  else if (normalised <= 180) { prefix = 'S'; suffix = 'E'; quadrantAngle = 180 - normalised }
  else if (normalised <= 270) { prefix = 'S'; suffix = 'W'; quadrantAngle = normalised - 180 }
  else { prefix = 'N'; suffix = 'W'; quadrantAngle = 360 - normalised }

  const totalSeconds = Math.round(quadrantAngle * 3600)
  const d = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const dms = `${d}\u00B0${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}"`
  return `${prefix} ${dms} ${suffix}`
}

// ─── Data Extent Helpers ──────────────────────────────────────────────────────

interface Extent { minE: number; maxE: number; minN: number; maxN: number }

function computeExtent(points: { adjustedEasting: number; adjustedNorthing: number }[]): Extent {
  let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity
  for (const pt of points) {
    if (pt.adjustedEasting < minE) minE = pt.adjustedEasting
    if (pt.adjustedEasting > maxE) maxE = pt.adjustedEasting
    if (pt.adjustedNorthing < minN) minN = pt.adjustedNorthing
    if (pt.adjustedNorthing > maxN) maxN = pt.adjustedNorthing
  }
  return { minE, maxE, minN, maxN }
}

/** Choose a "nice" round scale-bar length given the data extent width. */
function chooseScaleBarLength(extentWidth: number): number {
  const targetFraction = 0.25
  const ideal = extentWidth * targetFraction
  const magnitude = Math.pow(10, Math.floor(Math.log10(ideal)))
  const candidates = [1, 2, 5, 10, 20, 50].map(m => m * magnitude)
  let best = candidates[0]
  for (const c of candidates) {
    if (Math.abs(c - ideal) < Math.abs(best - ideal)) best = c
  }
  return Math.max(best, 1)
}

// ─── Force-Directed Label Placement (Ground Coordinates) ──────────────────────

interface GroundLabel {
  segIndex: number; midE: number; midN: number
  perpE: number; perpN: number
  text: string; fontSize: number
  hw: number; hh: number; e: number; n: number
}

function groundTextExtent(text: string, fontSize: number): { hw: number; hh: number } {
  return { hw: text.length * fontSize * 0.35, hh: fontSize * 1.2 }
}

function placeLabelsInGround(
  legs: Array<{
    segIndex: number; midE: number; midN: number
    perpE: number; perpN: number; legLen: number
    text: string; fontSize: number
  }>,
  minLegLength: number,
  maxOffset: number,
): GroundLabel[] {
  const labels: GroundLabel[] = legs.map((leg) => {
    const { hw, hh } = groundTextExtent(leg.text, leg.fontSize)
    const needsLeader = leg.legLen < minLegLength
    const offsetM = needsLeader
      ? Math.max(leg.legLen * 0.5, leg.fontSize * 3)
      : leg.fontSize * 2.5
    return {
      segIndex: leg.segIndex, midE: leg.midE, midN: leg.midN,
      perpE: leg.perpE, perpN: leg.perpN,
      text: leg.text, fontSize: leg.fontSize, hw, hh,
      e: leg.midE + leg.perpE * offsetM,
      n: leg.midN + leg.perpN * offsetM,
    }
  })

  for (let iter = 0; iter < 20; iter++) {
    let anyOverlap = false
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i], b = labels[j]
        const dx = b.e - a.e, dy = b.n - a.n
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01
        const overlapX = (a.hw + b.hw) - Math.abs(dx)
        const overlapY = (a.hh + b.hh) - Math.abs(dy)
        if (overlapX > 0 && overlapY > 0) {
          anyOverlap = true
          const force = 80 * (overlapX * overlapY) / (dist * dist)
          const pushE = (dx / dist) * force, pushN = (dy / dist) * force
          const aDot = pushE * a.perpE + pushN * a.perpN
          const bDot = pushE * b.perpE + pushN * b.perpN
          a.e += a.perpE * aDot * 0.5; a.n += a.perpN * aDot * 0.5
          b.e -= b.perpE * bDot * 0.5; b.n -= b.perpN * bDot * 0.5
          for (const lbl of [a, b]) {
            const offE = lbl.e - lbl.midE, offN = lbl.n - lbl.midN
            const offDist = Math.sqrt(offE * offE + offN * offN)
            if (offDist > maxOffset) {
              const scale = maxOffset / offDist
              lbl.e = lbl.midE + offE * scale
              lbl.n = lbl.midN + offN * scale
            }
          }
        }
      }
    }
    if (!anyOverlap) break
  }
  return labels
}

function drawDimLeader(
  drawing: InstanceType<typeof Drawing>,
  fromE: number, fromN: number,
  toE: number, toN: number,
  perpE: number, perpN: number,
  stubHalf: number,
) {
  drawing.drawLine(fromE, fromN, toE, toN)
  drawing.drawLine(toE + perpE * stubHalf, toN + perpN * stubHalf, toE - perpE * stubHalf, toN - perpN * stubHalf)
}

// ─── Main Generator ───────────────────────────────────────────────────────────

export function generateWorkingDiagramDXF(pkg: SubmissionPackage): string {
  const drawing = new Drawing()
  initialiseSokDXFLayers(drawing)

  const points = pkg.traverse.points
  if (points.length === 0) return drawing.toDxfString()

  const extent = computeExtent(points)
  const extentWidth = extent.maxE - extent.minE
  const extentHeight = extent.maxN - extent.minN

  const pad = Math.max(extentWidth, extentHeight) * 0.12
  const padAbs = Math.max(pad, 5)

  // 1. BOUNDARY LINES (WORKING layer)
  drawing.setActiveLayer(DXF_LAYERS.WORKING.name)
  for (let i = 0; i < points.length; i++) {
    const pt = points[i]
    const nextPt = points[(i + 1) % points.length]
    drawing.drawLine(pt.adjustedEasting, pt.adjustedNorthing, nextPt.adjustedEasting, nextPt.adjustedNorthing)
  }

  // 2. BEACONS (BEACONS layer)
  drawing.setActiveLayer(DXF_LAYERS.BEACONS.name)
  const beaconRadius = Math.max(padAbs * 0.04, 0.3)
  const labelHeight = Math.max(padAbs * 0.06, 0.5)
  const labelOffset = beaconRadius * 2.5

  for (const pt of points) {
    drawing.drawCircle(pt.adjustedEasting, pt.adjustedNorthing, beaconRadius)
    drawing.drawText(pt.adjustedEasting + labelOffset, pt.adjustedNorthing + labelOffset, labelHeight, 0, pt.pointName)
  }

  // 3-4. COLLISION-FREE DISTANCE + BEARING labels with dimension leaders
  const distLabelHeight = Math.max(padAbs * 0.05, 0.4)
  const bearingLabelHeight = Math.max(padAbs * 0.05, 0.4)
  const minLegLen = Math.max(padAbs * 0.3, 3)
  const maxLabelOff = padAbs * 2

  const distLegs: Array<{ segIndex: number; midE: number; midN: number; perpE: number; perpN: number; legLen: number; text: string; fontSize: number }> = []
  const bearingLegs: Array<{ segIndex: number; midE: number; midN: number; perpE: number; perpN: number; legLen: number; text: string; fontSize: number }> = []

  for (let i = 0; i < points.length; i++) {
    const pt = points[i]
    const nextPt = points[(i + 1) % points.length]
    const dE = nextPt.adjustedEasting - pt.adjustedEasting
    const dN = nextPt.adjustedNorthing - pt.adjustedNorthing
    const legLen = Math.sqrt(dE * dE + dN * dN)
    const perpE = legLen > 0 ? -dN / legLen : 0
    const perpN = legLen > 0 ? dE / legLen : 1
    const midE = (pt.adjustedEasting + nextPt.adjustedEasting) / 2
    const midN = (pt.adjustedNorthing + nextPt.adjustedNorthing) / 2
    distLegs.push({ segIndex: i, midE, midN, perpE, perpN, legLen, text: `${pt.observedDistance.toFixed(2)}m`, fontSize: distLabelHeight })
    const wcb = computeBearing(pt.adjustedEasting, pt.adjustedNorthing, nextPt.adjustedEasting, nextPt.adjustedNorthing)
    bearingLegs.push({ segIndex: i, midE, midN, perpE: -perpE, perpN: -perpN, legLen, text: formatQuadrantBearing(wcb), fontSize: bearingLabelHeight })
  }

  const placedDist = placeLabelsInGround(distLegs, minLegLen, maxLabelOff)
  const placedBearing = placeLabelsInGround(bearingLegs, minLegLen, maxLabelOff)

  // Draw dimension leaders behind labels
  drawing.setActiveLayer(DXF_LAYERS.WORKING.name)
  for (const lbl of [...placedDist, ...placedBearing]) {
    const leg = lbl.segIndex < distLegs.length ? distLegs[lbl.segIndex] : bearingLegs[lbl.segIndex]
    const offE = lbl.e - lbl.midE, offN = lbl.n - lbl.midN
    if (Math.sqrt(offE * offE + offN * offN) > leg.fontSize * 4) {
      drawDimLeader(drawing, lbl.e, lbl.n, lbl.midE, lbl.midN, leg.perpE, leg.perpN, leg.legLen * 0.15)
    }
  }

  // Draw distance labels
  drawing.setActiveLayer(DXF_LAYERS.DISTANCES.name)
  for (const lbl of placedDist) drawing.drawText(lbl.e, lbl.n, lbl.fontSize, 0, lbl.text)

  // Draw bearing labels
  drawing.setActiveLayer(DXF_LAYERS.BEARINGS.name)
  for (const lbl of placedBearing) drawing.drawText(lbl.e, lbl.n, lbl.fontSize, 0, lbl.text)

  // 5. NORTH ARROW
  drawing.setActiveLayer(DXF_LAYERS.NORTH_ARR.name)
  const arrowX = extent.maxE + padAbs * 2.5
  const arrowBaseN = extent.maxN + padAbs * 0.3
  const arrowLen = padAbs * 1.5
  const arrowTipN = arrowBaseN + arrowLen
  const arrowHeadSize = arrowLen * 0.2
  drawing.drawLine(arrowX, arrowBaseN, arrowX, arrowTipN)
  drawing.drawLine(arrowX, arrowTipN, arrowX - arrowHeadSize, arrowTipN - arrowHeadSize)
  drawing.drawLine(arrowX, arrowTipN, arrowX + arrowHeadSize, arrowTipN - arrowHeadSize)
  drawing.drawText(arrowX, arrowTipN + arrowHeadSize * 1.5, labelHeight * 1.2, 0, 'N')

  // 6. SCALE BAR
  drawing.setActiveLayer(DXF_LAYERS.SCL_BAR.name)
  const scaleBarLength = chooseScaleBarLength(extentWidth)
  const scaleBarX = extent.minE + padAbs
  const scaleBarY = extent.minN - padAbs * 2
  const scaleBarHeight = padAbs * 0.15
  drawing.drawLine(scaleBarX, scaleBarY, scaleBarX + scaleBarLength, scaleBarY)
  drawing.drawLine(scaleBarX, scaleBarY - scaleBarHeight, scaleBarX, scaleBarY + scaleBarHeight)
  drawing.drawLine(scaleBarX + scaleBarLength, scaleBarY - scaleBarHeight, scaleBarX + scaleBarLength, scaleBarY + scaleBarHeight)
  const midScaleX = scaleBarX + scaleBarLength / 2
  drawing.drawLine(midScaleX, scaleBarY - scaleBarHeight * 0.7, midScaleX, scaleBarY + scaleBarHeight * 0.7)
  drawing.drawRect(scaleBarX, scaleBarY - scaleBarHeight * 0.5, midScaleX, scaleBarY + scaleBarHeight * 0.5)
  drawing.drawText(scaleBarX, scaleBarY - scaleBarHeight * 3, distLabelHeight, 0, '0')
  drawing.drawText(midScaleX, scaleBarY - scaleBarHeight * 3, distLabelHeight, 0, `${scaleBarLength / 2}`)
  drawing.drawText(scaleBarX + scaleBarLength, scaleBarY - scaleBarHeight * 3, distLabelHeight, 0, `${scaleBarLength}m`)

  // 7. TITLE BLOCK
  drawing.setActiveLayer(DXF_LAYERS.TITLE_BLK.name)
  const tbOriginX = extent.minE - padAbs
  const tbOriginY = extent.minN - padAbs * 5
  const tbWidth = extentWidth + padAbs * 3
  const titleHeight = labelHeight * 1.5
  const rowHeight = titleHeight * 2.2
  const smallText = labelHeight * 0.9
  drawing.drawRect(tbOriginX, tbOriginY, tbOriginX + tbWidth, tbOriginY + rowHeight * 10)
  const headerRows: [number, string][] = [
    [rowHeight * 9, 'REPUBLIC OF KENYA'],
    [rowHeight * 8, 'SURVEY OF KENYA'],
    [rowHeight * 7, 'WORKING DIAGRAM'],
  ]
  for (const [yOff, text] of headerRows) {
    drawing.drawText(tbOriginX + tbWidth / 2, tbOriginY + yOff, titleHeight, 0, text, 'center')
  }
  drawing.drawLine(tbOriginX, tbOriginY + rowHeight * 6.5, tbOriginX + tbWidth, tbOriginY + rowHeight * 6.5)
  const areaHa = (pkg.parcel.areaM2 / 10000).toFixed(4)
  const surveyDate = formatPlanDate(pkg.generatedAt)
  const detailRows: [number, string][] = [
    [rowHeight * 6, `LR No: ${pkg.parcel.lrNumber}`],
    [rowHeight * 5, `Area: ${areaHa} Ha  |  Perimeter: ${pkg.traverse.perimeterM.toFixed(2)} m`],
    [rowHeight * 4, `Surveyor: ${pkg.surveyor.fullName}`],
    [rowHeight * 3, `ISK No: ${pkg.surveyor.iskNumber}  |  Reg: ${pkg.surveyor.registrationNumber}`],
    [rowHeight * 2, `Date: ${surveyDate}  |  Ref: ${pkg.submissionRef}  |  Rev: ${pkg.revision}`],
    [rowHeight * 1, `Survey Act Cap 299  |  ${pkg.subtype.replace(/_/g, ' ').toUpperCase()}`],
  ]
  for (const [yOff, text] of detailRows) {
    drawing.drawText(tbOriginX + tbWidth / 2, tbOriginY + yOff, smallText, 0, text, 'center')
  }

  // 8. ANNOTATIONS
  drawing.setActiveLayer(DXF_LAYERS.NOTES_TXT.name)
  const noteX = extent.minE - padAbs
  const noteY = extent.maxN + padAbs
  drawing.drawText(noteX, noteY, smallText, 0, `Angular Misclosure: ${pkg.traverse.angularMisclosure.toFixed(4)}\u00B3`)
  drawing.drawText(noteX, noteY - smallText * 2.5, smallText, 0, `Linear Misclosure: ${pkg.traverse.linearMisclosure.toFixed(4)} m`)
  drawing.drawText(noteX, noteY - smallText * 5, smallText, 0, `Precision Ratio: 1 : ${pkg.traverse.precisionRatio}`)
  drawing.drawText(noteX, noteY - smallText * 7.5, smallText, 0, `Adjustment: ${pkg.traverse.adjustmentMethod.charAt(0).toUpperCase() + pkg.traverse.adjustmentMethod.slice(1)}`)

  return drawing.toDxfString()
}
