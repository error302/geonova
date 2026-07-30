/**
 * @module titleDimensionComparison
 *
 * Title dimension comparison + boundary dispute analysis.
 */

export interface TitleDimension {
  bearing: number
  distance: number
  label?: string
}

export interface SurveyedDimension {
  bearing: number
  distance: number
  label?: string
}

export interface DimensionComparison {
  label: string
  titleBearing: number
  surveyedBearing: number
  bearingDifference: number
  titleDistance: number
  surveyedDistance: number
  distanceDifference: number
  bearingWithinTolerance: boolean
  distanceWithinTolerance: boolean
  severity: 'ok' | 'warn' | 'error'
  message: string
}

export interface TitleComparisonResult {
  comparisons: DimensionComparison[]
  allWithinTolerance: boolean
  maxBearingError: number
  maxDistanceError: number
  summary: string
}

export function compareTitleDimensions(
  titleDimensions: TitleDimension[],
  surveyedDimensions: SurveyedDimension[],
  bearingToleranceSec: number = 60,
  distanceToleranceMm: number = 50,
): TitleComparisonResult {
  const comparisons: DimensionComparison[] = []
  let maxBearingError = 0
  let maxDistanceError = 0

  for (let i = 0; i < titleDimensions.length; i++) {
    const title = titleDimensions[i]
    const surveyed = surveyedDimensions[i] || surveyedDimensions.find(s => s.label === title.label)

    if (!surveyed) {
      comparisons.push({
        label: title.label || `Leg ${i + 1}`,
        titleBearing: title.bearing, surveyedBearing: 0, bearingDifference: 0,
        titleDistance: title.distance, surveyedDistance: 0, distanceDifference: title.distance * 1000,
        bearingWithinTolerance: false, distanceWithinTolerance: false,
        severity: 'error', message: `No surveyed dimension found for ${title.label || `leg ${i + 1}`}`,
      })
      continue
    }

    let bDiff = Math.abs(title.bearing - surveyed.bearing)
    if (bDiff > 180) bDiff = 360 - bDiff
    const bearingDiffSec = bDiff * 3600
    const distDiffMm = Math.abs(title.distance - surveyed.distance) * 1000
    const bearingOK = bearingDiffSec <= bearingToleranceSec
    const distOK = distDiffMm <= distanceToleranceMm

    let severity: 'ok' | 'warn' | 'error' = 'ok'
    let message = ''
    if (!bearingOK && !distOK) {
      severity = 'error'
      message = `Both bearing (${bearingDiffSec.toFixed(1)}") and distance (${distDiffMm.toFixed(1)}mm) exceed tolerance.`
    } else if (!bearingOK) {
      severity = bearingDiffSec > bearingToleranceSec * 2 ? 'error' : 'warn'
      message = `Bearing difference ${bearingDiffSec.toFixed(1)}" exceeds tolerance of ${bearingToleranceSec}".`
    } else if (!distOK) {
      severity = distDiffMm > distanceToleranceMm * 2 ? 'error' : 'warn'
      message = `Distance difference ${distDiffMm.toFixed(1)}mm exceeds tolerance of ${distanceToleranceMm}mm.`
    } else {
      message = `Within tolerance (bearing: ${bearingDiffSec.toFixed(1)}", distance: ${distDiffMm.toFixed(1)}mm).`
    }

    comparisons.push({
      label: title.label || surveyed.label || `Leg ${i + 1}`,
      titleBearing: title.bearing, surveyedBearing: surveyed.bearing, bearingDifference: bearingDiffSec,
      titleDistance: title.distance, surveyedDistance: surveyed.distance, distanceDifference: distDiffMm,
      bearingWithinTolerance: bearingOK, distanceWithinTolerance: distOK, severity, message,
    })

    maxBearingError = Math.max(maxBearingError, bearingDiffSec)
    maxDistanceError = Math.max(maxDistanceError, distDiffMm)
  }

  const allOK = comparisons.every(c => c.bearingWithinTolerance && c.distanceWithinTolerance)
  const errorCount = comparisons.filter(c => c.severity === 'error').length
  const warnCount = comparisons.filter(c => c.severity === 'warn').length
  const summary = allOK
    ? `All ${comparisons.length} dimensions within tolerance.`
    : `${errorCount} error(s), ${warnCount} warning(s) out of ${comparisons.length} dimensions. Max bearing error: ${maxBearingError.toFixed(1)}", max distance error: ${maxDistanceError.toFixed(1)}mm.`

  return { comparisons, allWithinTolerance: allOK, maxBearingError, maxDistanceError, summary }
}

// ─── Boundary Dispute Analysis ──────────────────────────────────────────────

export interface BoundaryPoint { easting: number; northing: number }

export interface DisputeAnalysisResult {
  encroachmentArea: number
  encroachmentPercent: number
  legalArea: number
  occupiedArea: number
  overlapArea: number
  underOccupiedArea: number
  overOccupiedArea: number
  maxEncroachmentDistance: number
  maxEncroachmentPoint: BoundaryPoint | null
  hasEncroachment: boolean
  severity: 'none' | 'minor' | 'major'
  summary: string
}

export function analyzeBoundaryDispute(
  legalBoundary: BoundaryPoint[],
  occupiedBoundary: BoundaryPoint[],
): DisputeAnalysisResult {
  const legalArea = shoelaceArea(legalBoundary)
  const occupiedArea = shoelaceArea(occupiedBoundary)
  const overlapArea = computeOverlap(legalBoundary, occupiedBoundary)
  const underOccupiedArea = Math.max(0, legalArea - overlapArea)
  const overOccupiedArea = Math.max(0, occupiedArea - overlapArea)
  const encroachmentArea = overOccupiedArea
  const encroachmentPercent = legalArea > 0 ? (encroachmentArea / legalArea) * 100 : 0

  let maxDist = 0
  let maxPoint: BoundaryPoint | null = null
  for (const p of occupiedBoundary) {
    if (!pointInPolygon(p, legalBoundary)) {
      const dist = distanceToPolygon(p, legalBoundary)
      if (dist > maxDist) { maxDist = dist; maxPoint = p }
    }
  }

  const hasEncroachment = encroachmentArea > 0.5
  let severity: 'none' | 'minor' | 'major' = 'none'
  if (encroachmentPercent > 5 || maxDist > 0.5) severity = 'major'
  else if (encroachmentPercent > 0.5 || maxDist > 0.1) severity = 'minor'

  const summary = !hasEncroachment
    ? 'No significant encroachment detected. Physical occupation matches legal boundary.'
    : severity === 'major'
      ? `Major encroachment: ${encroachmentArea.toFixed(2)} m² (${encroachmentPercent.toFixed(2)}% of legal area). Max distance: ${maxDist.toFixed(3)}m. Legal action recommended.`
      : `Minor encroachment: ${encroachmentArea.toFixed(2)} m² (${encroachmentPercent.toFixed(2)}% of legal area). Max distance: ${maxDist.toFixed(3)}m. Negotiated settlement recommended.`

  return {
    encroachmentArea, encroachmentPercent, legalArea, occupiedArea, overlapArea,
    underOccupiedArea, overOccupiedArea, maxEncroachmentDistance: maxDist,
    maxEncroachmentPoint: maxPoint, hasEncroachment, severity, summary,
  }
}

function shoelaceArea(points: BoundaryPoint[]): number {
  if (points.length < 3) return 0
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    area += points[i].easting * points[j].northing
    area -= points[j].easting * points[i].northing
  }
  return Math.abs(area / 2)
}

function pointInPolygon(point: BoundaryPoint, polygon: BoundaryPoint[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].easting, yi = polygon[i].northing
    const xj = polygon[j].easting, yj = polygon[j].northing
    const intersect = ((yi > point.northing) !== (yj > point.northing)) &&
      (point.easting < (xj - xi) * (point.northing - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

function computeOverlap(poly1: BoundaryPoint[], poly2: BoundaryPoint[]): number {
  let insideCount = 0
  for (const p of poly2) { if (pointInPolygon(p, poly1)) insideCount++ }
  const ratio = poly2.length > 0 ? insideCount / poly2.length : 0
  return shoelaceArea(poly2) * ratio
}

function distanceToPolygon(point: BoundaryPoint, polygon: BoundaryPoint[]): number {
  let minDist = Infinity
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length
    const dist = pointToSegmentDistance(point.easting, point.northing, polygon[i].easting, polygon[i].northing, polygon[j].easting, polygon[j].northing)
    minDist = Math.min(minDist, dist)
  }
  return minDist
}

function pointToSegmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}
