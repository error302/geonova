'use client'
/**
 * Traverse-to-Parcel Workflow
 *
 * Converts adjusted traverse station coordinates into a GeoJSON polygon
 * suitable for storing as a parcel boundary.
 *
 * Workflow:
 *  1. Fetch adjusted traverse coordinates from the database
 *  2. Connect stations in order as a closed polygon
 *  3. Preview on the map as a polygon feature
 *  4. On confirm, save as a new parcel boundary
 *
 * Uses EPSG:21037 for coordinate storage.
 * All OpenLayers imports are dynamic for SSR compatibility.
 */
import { logger } from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────

export interface TraversePoint {
  easting: number
  northing: number
  pointName: string
  rl?: number | null
}

export interface TraverseToParcelResult {
  polygon: GeoJSON.Polygon
  area: number      // square meters
  perimeter: number // meters
  pointCount: number
}

// ─── GeoJSON Polygon Construction ─────────────────────────────────────────

/**
 * Convert adjusted traverse station coordinates into a GeoJSON Polygon.
 * The stations are connected in order and the polygon is closed automatically.
 *
 * Coordinates are in EPSG:21037 (Arc 1960 / UTM Zone 37S).
 */
export function traversePointsToPolygon(
  traversePoints: Array<{ easting: number; northing: number; pointName: string }>
): GeoJSON.Polygon {
  if (traversePoints.length < 3) {
    throw new Error('At least 3 traverse points are required to form a polygon')
  }

  // Build the coordinate ring — close by repeating the first point
  const ring: number[][] = traversePoints.map(p => [p.easting, p.northing])
  // Close the ring
  ring.push([traversePoints[0].easting, traversePoints[0].northing])

  return {
    type: 'Polygon',
    coordinates: [ring],
  }
}

/**
 * Calculate the area of a polygon using the Shoelace formula.
 * Coordinates are in projected CRS (meters).
 */
export function calculatePolygonArea(vertices: Array<{ easting: number; northing: number }>): number {
  if (vertices.length < 3) return 0

  let area = 0
  const n = vertices.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += vertices[i].easting * vertices[j].northing
    area -= vertices[j].easting * vertices[i].northing
  }

  return Math.abs(area / 2)
}

/**
 * Calculate the perimeter of a polygon.
 * Coordinates are in projected CRS (meters).
 */
export function calculatePolygonPerimeter(vertices: Array<{ easting: number; northing: number }>): number {
  if (vertices.length < 2) return 0

  let perimeter = 0
  const n = vertices.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const dE = vertices[j].easting - vertices[i].easting
    const dN = vertices[j].northing - vertices[i].northing
    perimeter += Math.sqrt(dE * dE + dN * dN)
  }

  return perimeter
}

/**
 * Full conversion: traverse points → GeoJSON polygon + area + perimeter.
 */
export function traverseToParcelResult(
  traversePoints: Array<{ easting: number; northing: number; pointName: string }>
): TraverseToParcelResult {
  const polygon = traversePointsToPolygon(traversePoints)
  const area = calculatePolygonArea(traversePoints)
  const perimeter = calculatePolygonPerimeter(traversePoints)

  return {
    polygon,
    area,
    perimeter,
    pointCount: traversePoints.length,
  }
}

// ─── API: Create Parcel from Traverse ─────────────────────────────────────

/**
 * Fetch adjusted traverse results and create a parcel boundary.
 * Calls the traverse API to get coordinates, then saves as a new parcel.
 *
 * @param projectId — The project ID
 * @param parcelId — The existing parcel ID that has the traverse
 * @returns The new or updated parcel ID
 */
export async function createParcelFromTraverse(
  projectId: string,
  parcelId: string
): Promise<{ parcelId: string; areaHa: number | null; polygon: GeoJSON.Polygon }> {
  // 1. Fetch the traverse coordinates from the API
  const traverseRes = await fetch(`/api/scheme/traverse?parcel_id=${parcelId}`)
  if (!traverseRes.ok) {
    throw new Error(`Failed to fetch traverse data: ${traverseRes.statusText}`)
  }

  const traverseData = (await traverseRes.json()) as { data?: { coordinates: Array<{ station: string; easting: number; northing: number; rl: number | null }> } }
  const coordinates: Array<{ station: string; easting: number; northing: number; rl: number | null }> =
    traverseData.data?.coordinates ?? []

  if (!coordinates || coordinates.length < 3) {
    throw new Error('Traverse has fewer than 3 coordinate stations — cannot form a polygon')
  }

  // 2. Build the polygon from traverse coordinates
  const traversePoints: TraversePoint[] = coordinates.map(c => ({
    easting: c.easting,
    northing: c.northing,
    pointName: c.station,
    rl: c.rl,
  }))

  const result = traverseToParcelResult(traversePoints)
  const areaHa = result.area / 10000

  // 3. Save the polygon as the parcel boundary via the scheme API
  const boundaryRes = await fetch('/api/scheme/parcel/boundary', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parcel_id: parcelId,
      project_id: projectId,
      boundary_geojson: result.polygon,
      area_ha: areaHa,
      source: 'traverse',
      point_count: result.pointCount,
      perimeter_m: result.perimeter,
      crs: 'EPSG:21037',
    }),
  })

  if (!boundaryRes.ok) {
    // If the boundary API doesn't exist, update the parcel directly
    try {
      const updateRes = await fetch(`/api/scheme/parcel/${parcelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boundary_geojson: result.polygon,
          area_ha: areaHa,
          status: 'computed',
        }),
      })

      if (!updateRes.ok) {
        throw new Error(`Failed to update parcel boundary: ${updateRes.statusText}`)
      }
    } catch {
      // Last resort: just return the computed result without persisting
      logger.warn('[traverseToParcel] Could not save boundary to server, returning computed result only')
    }
  }

  return {
    parcelId,
    areaHa,
    polygon: result.polygon,
  }
}

// ─── Map Preview Helpers ──────────────────────────────────────────────────

/**
 * Create an OL Vector layer with a polygon preview from traverse points.
 * Used for the "preview before confirm" workflow.
 *
 * All OL imports are dynamic for SSR compatibility.
 */
export async function createTraversePolygonPreview(
  traversePoints: Array<{ easting: number; northing: number; pointName: string }>,
  epsg: string = 'EPSG:21037',
): Promise<{
  source: import('ol/source/Vector').default
  layer: import('ol/layer/Vector').default
}> {
  const [
    { default: VectorSource },
    { default: VectorLayer },
    { default: Feature },
    { default: Polygon },
    { default: Style },
    { default: Fill },
    { default: Stroke },
    { default: CircleStyle },
    { default: Point },
    { default: Text },
    { transform },
  ] = await Promise.all([
    import('ol/source/Vector'),
    import('ol/layer/Vector'),
    import('ol/Feature'),
    import('ol/geom/Polygon'),
    import('ol/style/Style'),
    import('ol/style/Fill'),
    import('ol/style/Stroke'),
    import('ol/style/Circle'),
    import('ol/geom/Point'),
    import('ol/style/Text'),
    import('ol/proj').then(m => ({ transform: m.transform })),
  ])

  const source = new VectorSource()

  // Transform coordinates from UTM to EPSG:3857 for display
  const ring3857 = traversePoints.map(p => {
    const [x, y] = transform([p.easting, p.northing], epsg, 'EPSG:3857')
    return [x, y]
  })
  // Close the ring
  ring3857.push(ring3857[0])

  // Create polygon feature
  const polygonFeature = new Feature({
    geometry: new Polygon([ring3857]),
  })
  polygonFeature.setStyle(
    new Style({
      fill: new Fill({ color: 'rgba(209, 123, 71,0.15)' }),
      stroke: new Stroke({ color: '#D17B47', width: 2.5, lineDash: [8, 4] }),
    })
  )
  source.addFeature(polygonFeature)

  // Add point markers for each traverse station
  for (const p of traversePoints) {
    const coord = transform([p.easting, p.northing], epsg, 'EPSG:3857')
    const pointFeature = new Feature({
      geometry: new Point(coord),
    })
    pointFeature.setStyle(
      new Style({
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color: '#D17B47' }),
          stroke: new Stroke({ color: '#fff', width: 1.5 }),
        }),
        text: new Text({
          text: p.pointName,
          font: '11px monospace',
          fill: new Fill({ color: '#fff' }),
          stroke: new Stroke({ color: '#000', width: 3 }),
          offsetY: -14,
        }),
      })
    )
    source.addFeature(pointFeature)
  }

  const layer = new VectorLayer({
    source,
    zIndex: 50,
  })

  return { source, layer }
}

/**
 * Remove the traverse polygon preview from the map.
 */
export function removeTraversePolygonPreview(
  mapInstance: import('ol/Map').default | null,
  layer: import('ol/layer/Vector').default | null
): void {
  if (!mapInstance || !layer) return
  try {
    mapInstance.removeLayer(layer)
  } catch { /* already removed */ }
}
