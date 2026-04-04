import { dmsToDeg } from './units'
import type { BeaconPoint, BoundaryLine } from './types'

export interface Point2D { x: number; y: number }

export function computePositions(
  beacons: BeaconPoint[],
  boundaries: BoundaryLine[]
): Map<string, Point2D> {
  const hasCoords = beacons.every(b => b.easting !== undefined && b.northing !== undefined)

  if (hasCoords) {
    const map = new Map<string, Point2D>()
    beacons.forEach((b: any) => {
      map.set(b.id, { x: b.easting!, y: b.northing! })
    })
    return map
  }

  const map = new Map<string, Point2D>()
  let cursor: Point2D = { x: 0, y: 0 }

  if (beacons.length === 0) return map
  map.set(beacons[0].id, cursor)

  for (const line of boundaries) {
    if (!map.has(line.fromBeaconId)) continue
    cursor = map.get(line.fromBeaconId)!
    const bearingRad = (dmsToDeg(line.bearingDMS) * Math.PI) / 180
    const next: Point2D = {
      x: cursor.x + line.distanceMeters * Math.sin(bearingRad),
      y: cursor.y + line.distanceMeters * Math.cos(bearingRad),
    }
    if (!map.has(line.toBeaconId)) {
      map.set(line.toBeaconId, next)
    }
  }
  return map
}

export function normalizeToViewport(
  positions: Map<string, Point2D>,
  viewportW: number,
  viewportH: number,
  padding: number = 80
): Map<string, Point2D> {
  const pts = Array.from(positions.values())
  if (pts.length === 0) return positions

  const minX = Math.min(...pts.map((p: any) => p.x))
  const maxX = Math.max(...pts.map((p: any) => p.x))
  const minY = Math.min(...pts.map((p: any) => p.y))
  const maxY = Math.max(...pts.map((p: any) => p.y))

  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const scale = Math.min(
    (viewportW - 2 * padding) / rangeX,
    (viewportH - 2 * padding) / rangeY
  )

  const result = new Map<string, Point2D>()
  positions.forEach((pt, id) => {
    result.set(id, {
      x: padding + (pt.x - minX) * scale,
      y: viewportH - padding - (pt.y - minY) * scale,
    })
  })
  return result
}

export function polygonCentroid(
  beaconIds: string[],
  positions: Map<string, Point2D>
): Point2D {
  const pts = beaconIds.map((id: any) => positions.get(id)).filter(Boolean) as Point2D[]
  if (pts.length === 0) return { x: 0, y: 0 }
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  }
}
