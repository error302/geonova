/**
 * derivePlanGeometry — build a PlanGeometry from the largest drawn polygon on
 * the map so the print SheetLayout can show a correct scale label, north-arrow
 * context, area and perimeter (instead of the "As Noted" fallback).
 *
 * The draw layer stores geometries in the map projection (EPSG:3857). We
 * transform each vertex to the active UTM CRS (Kenya: EPSG:21037 / 32737) so
 * distances, area and scale are metric and correct.
 */

import type { PlanGeometry, AdjustedStation } from '@/lib/engine/planGeometry'
import { computePlanGeometry } from '@/lib/engine/planGeometry'
import { SRID_3857 } from '@/lib/map/projection'

/**
 * @param drawSource  OpenLayers VectorSource holding the drawn features.
 * @param utmEpsg     Target metric CRS, e.g. 'EPSG:21037' or 'EPSG:32737'.
 * @returns PlanGeometry for the largest polygon, or null if none is drawable.
 */
export async function derivePlanGeometryFromDrawSource(
  drawSource: unknown,
  utmEpsg: string,
): Promise<PlanGeometry | null> {
  const source = drawSource as { getFeatures?: () => unknown[] } | null
  if (!source || typeof source.getFeatures !== 'function') return null

  const features = source.getFeatures()
  if (!features || features.length === 0) return null

  const { transform } = await import('ol/proj')

  // Find the polygon with the most vertices (a proxy for the primary boundary).
  let bestRing: number[][] | null = null
  let bestVertexCount = 0

  for (const f of features) {
    const feature = f as { getGeometry?: () => unknown }
    const geom = feature.getGeometry?.() as
      | { getType?: () => string; getCoordinates?: () => unknown }
      | undefined
    if (!geom || typeof geom.getType !== 'function') continue
    if (geom.getType() !== 'Polygon') continue

    const coords = geom.getCoordinates?.() as number[][][] | undefined
    const ring = coords?.[0]
    if (!ring || ring.length < 3) continue
    if (ring.length > bestVertexCount) {
      bestVertexCount = ring.length
      bestRing = ring
    }
  }

  if (!bestRing) return null

  // OpenLayers closes rings (last point === first); drop the duplicate.
  let ring = bestRing
  if (ring.length > 1) {
    const first = ring[0]
    const last = ring[ring.length - 1]
    if (first[0] === last[0] && first[1] === last[1]) {
      ring = ring.slice(0, -1)
    }
  }
  if (ring.length < 3) return null

  const stations: AdjustedStation[] = ring.map((pt, i) => {
    const [e, n] = transform([pt[0], pt[1]], SRID_3857, utmEpsg) as [number, number]
    return {
      pointName: String(i + 1),
      originalEasting: e,
      originalNorthing: n,
      adjustedEasting: e,
      adjustedNorthing: n,
    }
  })

  return computePlanGeometry(stations)
}
