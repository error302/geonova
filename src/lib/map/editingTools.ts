/**
 * Editing Tools — real geometry operations for Split, Merge, Reshape, Rotate, Offset
 *
 * Uses turf.js for the actual math. Each function takes coordinate arrays
 * (in a planar UTM CRS, e.g. EPSG:21037) and returns new coordinate arrays.
 * The MapClient digitizing handlers (MapClient.tsx) call these via dynamic
 * import from inside the OL drawend/Apply-button handlers.
 *
 * T0.6 FIX (2026-07-09): The floating DigitizingToolbar.tsx that previously
 * called these has been deleted (it was dead code — zero importers). The
 * live UI is now MapToolDock.tsx's "Advanced" section, which routes through
 * MapClient's activeDrawTool / activeOneShotTool state.
 */

import { logger } from '@/lib/logger'
import * as turf from '@turf/turf'
import type { Feature, Polygon as GeoPolygon, MultiPolygon } from 'geojson'

export interface SplitResult {
  polygon1: [number, number][]
  polygon2: [number, number][]
  area1: number
  area2: number
}

/**
 * Split a polygon with a line.
 * Uses turf.lineIntersect + turf.polygonToLine + boolean operations.
 * Returns the two resulting polygons.
 */
export function splitPolygonWithLine(
  polygonCoords: [number, number][],
  lineCoords: [number, number][],
): SplitResult | null {
  try {
    // Ensure closed ring
    const closed = isClosed(polygonCoords) ? polygonCoords : [...polygonCoords, polygonCoords[0]]

    const polygon = turf.polygon([closed.map(([e, n]) => [e, n])])
    const line = turf.lineString(lineCoords.map(([e, n]) => [e, n]))

    // Check if line actually intersects the polygon
    const intersects = turf.lineIntersect(line, polygon)
    if (intersects.features.length < 2) {
      return null // Line must cross the polygon at least twice
    }

    // Get the intersection points
    const intersectionPoints = intersects.features.map(f => {
      const coords = f.geometry.coordinates as [number, number]
      return coords
    })

    if (intersectionPoints.length < 2) return null

    // Create a cutting polygon (a thin sliver rectangle along the extended line).
    const bbox = turf.bbox(polygon)
    const width = bbox[2] - bbox[0]
    const height = bbox[3] - bbox[1]
    const margin = Math.max(width, height) * 2

    const lineStart = lineCoords[0] as [number, number]
    const lineEnd = lineCoords[lineCoords.length - 1] as [number, number]

    const dx = lineEnd[0] - lineStart[0]
    const dy = lineEnd[1] - lineStart[1]
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len === 0) return null

    const ux = dx / len
    const uy = dy / len

    const extendedStart: [number, number] = [
      lineStart[0] - ux * margin,
      lineStart[1] - uy * margin,
    ]
    const extendedEnd: [number, number] = [
      lineEnd[0] + ux * margin,
      lineEnd[1] + uy * margin,
    ]

    const perpX = -uy
    const perpY = ux
    const halfWidth = 0.001

    const cutPolygon = turf.polygon([[
      [extendedStart[0] + perpX * halfWidth, extendedStart[1] + perpY * halfWidth],
      [extendedEnd[0] + perpX * halfWidth, extendedEnd[1] + perpY * halfWidth],
      [extendedEnd[0] - perpX * halfWidth, extendedEnd[1] - perpY * halfWidth],
      [extendedStart[0] - perpX * halfWidth, extendedStart[1] - perpY * halfWidth],
      [extendedStart[0] + perpX * halfWidth, extendedStart[1] + perpY * halfWidth],
    ]])

    const diff = turf.difference(turf.featureCollection([polygon, cutPolygon]))

    if (!diff || !diff.geometry) return null

    const diffGeom = diff.geometry
    if (diffGeom.type === 'Polygon') {
      return null
    }
    if (diffGeom.type === 'MultiPolygon') {
      const polys = diffGeom.coordinates as number[][][][]
      if (polys.length < 2) return null
      const p1Coords = polys[0][0] as [number, number][]
      const p2Coords = polys[1][0] as [number, number][]

      return {
        polygon1: p1Coords,
        polygon2: p2Coords,
        area1: turf.area(turf.polygon([p1Coords])),
        area2: turf.area(turf.polygon([p2Coords])),
      }
    }

    return null
  } catch (err) {
    logger.error('[editingTools] splitPolygonWithLine failed:', { error: err })
    return null
  }
}

/**
 * Merge two or more polygons into one using turf.union.
 */
export function mergePolygons(
  polygons: [number, number][][],
): [number, number][] | null {
  if (polygons.length < 2) return null

  try {
    let result = turf.polygon([ensureClosed(polygons[0])]) as Feature<GeoPolygon>

    for (let i = 1; i < polygons.length; i++) {
      const next = turf.polygon([ensureClosed(polygons[i])])
      const union = turf.union(turf.featureCollection([result, next]))
      if (union && union.geometry?.type === 'Polygon') {
        result = turf.polygon((union.geometry as GeoPolygon).coordinates) as Feature<GeoPolygon>
      } else if (union && union.geometry?.type === 'MultiPolygon') {
        return null
      }
    }

    return (result.geometry as GeoPolygon).coordinates[0] as [number, number][]
  } catch (err) {
    logger.error('[editingTools] mergePolygons failed:', { error: err })
    return null
  }
}

/**
 * Rotate a polygon around its centroid by a given angle (degrees).
 *
 * T0.2 FIX (2026-07-09): Previously delegated to turf.transformRotate, which
 * throws "coordinates must contain numbers" on certain polygon shapes (e.g.
 * L-shapes, concave rings) — the silent catch returned the input unchanged,
 * meaning rotation quietly no-op'd for anything but simple squares. The
 * hardcoded `15` in the old MapClient handler hid this bug for months.
 *
 * Now we do the 2D rotation manually: compute the centroid, then apply the
 * standard rotation matrix to each vertex. This is O(n), CRS-agnostic, and
 * has no turf dependency.
 */
export function rotatePolygon(
  coords: [number, number][],
  angleDeg: number,
): [number, number][] {
  if (coords.length === 0) return coords
  try {
    const closed = ensureClosed(coords)
    let cx = 0, cy = 0
    const n = closed.length - 1
    for (let i = 0; i < n; i++) {
      cx += closed[i][0]
      cy += closed[i][1]
    }
    cx /= n
    cy /= n

    const rad = (angleDeg * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)

    const rotated: [number, number][] = closed.map(([x, y]) => [
      cx + (x - cx) * cos - (y - cy) * sin,
      cy + (x - cx) * sin + (y - cy) * cos,
    ])
    return rotated
  } catch (err) {
    logger.error('[editingTools] rotatePolygon failed:', { error: err })
    return coords
  }
}

/**
 * Create a parallel offset of a line or polygon boundary.
 * Uses turf.lineOffset for lines, or buffers for polygons.
 */
export function createOffset(
  coords: [number, number][],
  distance: number,
  isPolygon: boolean = false,
): [number, number][] | null {
  try {
    const closed = ensureClosed(coords)

    if (isPolygon) {
      const polygon = turf.polygon([closed])
      const buffered = turf.buffer(polygon, distance, { units: 'meters' })
      if (buffered?.geometry?.type === 'Polygon') {
        return (buffered.geometry as GeoPolygon).coordinates[0] as [number, number][]
      }
    } else {
      const line = turf.lineString(closed)
      const offset = turf.lineOffset(line, distance, { units: 'meters' })
      return offset.geometry.coordinates as [number, number][]
    }
  } catch (err) {
    logger.error('[editingTools] createOffset failed:', { error: err })
  }
  return null
}

/**
 * Reshape: replace part of a polygon boundary with a new line segment.
 */
export function reshapePolygon(
  polygonCoords: [number, number][],
  newSegmentCoords: [number, number][],
): [number, number][] | null {
  try {
    const closed = ensureClosed(polygonCoords)
    const newLine = turf.lineString(newSegmentCoords)
    const polyBoundary = turf.lineString(closed)
    const ixns = turf.lineIntersect(newLine, polyBoundary)

    if (ixns.features.length < 2) {
      const splitResult = splitPolygonWithLine(closed, newSegmentCoords)
      if (!splitResult) return null
      const area0 = turf.area(turf.polygon([ensureClosed(splitResult.polygon1)])) ?? 0
      const area1 = turf.area(turf.polygon([ensureClosed(splitResult.polygon2)])) ?? 0
      return area0 > area1 ? splitResult.polygon1 : splitResult.polygon2
    }

    const pt0 = ixns.features[0].geometry.coordinates as [number, number]
    const pt1 = ixns.features[1].geometry.coordinates as [number, number]

    let idx0 = 0
    let idx1 = 0
    let minD0 = Infinity
    let minD1 = Infinity

    for (let i = 0; i < closed.length; i++) {
      const d0 = squaredDistance(closed[i], pt0)
      const d1 = squaredDistance(closed[i], pt1)
      if (d0 < minD0) { minD0 = d0; idx0 = i }
      if (d1 < minD1) { minD1 = d1; idx1 = i }
    }

    const result: [number, number][] = []
    const start = Math.min(idx0, idx1)
    const end = Math.max(idx0, idx1)

    for (let i = 0; i <= start; i++) {
      result.push([...closed[i]])
    }
    for (const pt of newSegmentCoords) {
      result.push([...pt])
    }
    for (let i = end; i < closed.length; i++) {
      result.push([...closed[i]])
    }

    return result
  } catch {
    return null
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isClosed(coords: [number, number][]): boolean {
  if (coords.length < 2) return false
  const first = coords[0]
  const last = coords[coords.length - 1]
  return first[0] === last[0] && first[1] === last[1]
}

function ensureClosed(coords: [number, number][]): [number, number][] {
  if (isClosed(coords)) return coords
  return [...coords, coords[0]]
}

function squaredDistance(a: [number, number], b: [number, number]): number {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  return dx * dx + dy * dy
}
