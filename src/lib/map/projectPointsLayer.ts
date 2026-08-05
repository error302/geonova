/**
 * Project Points Layer — loads survey points from a project and renders them
 * on the OpenLayers map with distinct styles for control points vs topo points.
 *
 * This is the #1 map gap: a surveying map that doesn't show your own field data
 * is broken. This module fetches from /api/project/[id]/points and creates a
 * VectorLayer with per-code styling.
 */

import type { Map } from 'ol'
import type { FeatureLike } from 'ol/Feature'

export interface ProjectPointsLayerResult {
  pointsLayer: import('ol/layer/Vector').default
  pointsSource: import('ol/source/Vector').default
  cleanup: () => void
  pointCount: number
  controlPointCount: number
}

/**
 * Raw database row shape for `survey_points` as returned by the
 * `/api/project/[id]/points` endpoint. Column names use snake_case.
 *
 * This is intentionally distinct from the canonical `SurveyPoint` interface
 * (which uses `name`, not `point_name`) — API/DB boundaries should map
 * between the two explicitly rather than pretending they're the same shape.
 */
interface SurveyPointRow {
  id: string
  point_name: string
  easting: number
  northing: number
  elevation: number | null
  code: string | null
  description: string | null
  is_control: boolean
}

/**
 * Project-level CRS metadata returned in `meta.project_crs` by the endpoint.
 * Used to derive the correct EPSG code for coordinate transforms.
 */
interface ProjectCrs {
  utm_zone: number | null
  hemisphere: string | null
  datum: string | null
}

/**
 * T1.5 FIX (2026-07-09): Derive the EPSG code from the project's CRS metadata
 * instead of hardcoding 'EPSG:21037'. Kenya spans UTM zones 36S and 37S; a
 * project in Mombasa (Zone 37S edge) or Kisumu (Zone 36S) would get silently
 * wrong coordinates if we always used 21037.
 *
 * Supported combinations (matches ProjectionSwitcher.tsx):
 *   Arc 1960 / UTM 36S → EPSG:21036
 *   Arc 1960 / UTM 37S → EPSG:21037
 *   WGS 84   / UTM 36S → EPSG:32736
 *   WGS 84   / UTM 37S → EPSG:32737
 *   (North zones are rare in Kenya but supported for completeness)
 */
function epsgFromProjectCrs(crs: ProjectCrs | null): string {
  if (!crs || !crs.utm_zone) return 'EPSG:21037' // default for central Kenya
  const zone = crs.utm_zone
  const isNorth = (crs.hemisphere || 'S').toUpperCase() === 'N'
  const isWgs84 = (crs.datum || '').toLowerCase().includes('wgs')

  if (isWgs84) {
    // WGS 84 UTM: 326xx (North), 327xx (South)
    return `EPSG:${isNorth ? 32600 : 32700}${zone}`
  }
  // Arc 1960 UTM: 2103x (South — Kenya standard), 2109x (North — rare)
  return `EPSG:${isNorth ? 21090 : 21000}${zone}`
}

/**
 * Load project survey points and create a styled vector layer.
 *
 * @param projectId The project ID
 * @param map The OpenLayers map instance
 * @returns Layer result with cleanup function
 */
export async function createProjectPointsLayer(
  projectId: string,
  map: Map,
): Promise<ProjectPointsLayerResult> {
  // Fetch points from the API
  const res = await fetch(`/api/project/${projectId}/points`)
  if (!res.ok) {
    throw new Error(`Failed to load project points (${res.status})`)
  }
  const json = (await res.json()) as { data?: SurveyPointRow[]; meta?: { project_crs?: ProjectCrs | null } }
  const points: SurveyPointRow[] = json.data || []
  // T1.5 FIX: Derive EPSG from the project's CRS metadata, not hardcoded.
  const projCode = epsgFromProjectCrs(json.meta?.project_crs ?? null)

  if (points.length === 0) {
    // Return empty layer
    const { default: VectorLayer } = await import('ol/layer/Vector')
    const { default: VectorSource } = await import('ol/source/Vector')
    const emptySource = new VectorSource()
    const emptyLayer = new VectorLayer({ source: emptySource, zIndex: 25 })
    return {
      pointsLayer: emptyLayer,
      pointsSource: emptySource,
      cleanup: () => map.removeLayer(emptyLayer),
      pointCount: 0,
      controlPointCount: 0,
    }
  }

  // Dynamic imports (ESM-safe)
  const [
    { default: VectorLayer },
    { default: VectorSource },
    { default: Feature },
    { default: Point },
    { default: Style },
    { default: CircleStyle },
    { default: Fill },
    { default: Stroke },
    { default: Text },
    proj,
  ] = await Promise.all([
    import('ol/layer/Vector'),
    import('ol/source/Vector'),
    import('ol/Feature'),
    import('ol/geom/Point'),
    import('ol/style/Style'),
    import('ol/style/Circle'),
    import('ol/style/Fill'),
    import('ol/style/Stroke'),
    import('ol/style/Text'),
    import('ol/proj'),
  ])

  const source = new VectorSource()
  // projCode is derived from project CRS metadata above (T1.5 fix)

  let controlCount = 0

  for (const pt of points) {
    if (pt.easting == null || pt.northing == null) continue

    try {
      const coords3857 = proj.transform([pt.easting, pt.northing], projCode, 'EPSG:3857')
      const feature = new Feature({
        geometry: new Point(coords3857),
        pointName: pt.point_name,
        easting: pt.easting,
        northing: pt.northing,
        elevation: pt.elevation,
        code: pt.code,
        description: pt.description,
        isControl: pt.is_control,
        pointType: 'survey',
      })
      feature.set('projectId', projectId)
      source.addFeature(feature)
      if (pt.is_control) controlCount++
    } catch {
      // skip invalid coordinates
    }
  }

  // Style function: control points = sienna filled circle, topo = small dot
  const layer = new VectorLayer({
    source,
    style: (feature: FeatureLike) => {
      const isControl = feature.get('isControl') === true
      const code = feature.get('code') as string | null
      const name = feature.get('pointName') as string | null

      if (isControl) {
        // Control point: larger sienna circle with white border + label
        return new Style({
          image: new CircleStyle({
            radius: 7,
            fill: new Fill({ color: '#D17B47' }),
            stroke: new Stroke({ color: '#E8E4DE', width: 2.5 }),
          }),
          text: new Text({
            text: name || '',
            font: '11px "JetBrains Mono", monospace',
            fill: new Fill({ color: '#E8E4DE' }),
            stroke: new Stroke({ color: '#1A1816', width: 3 }),
            offsetY: -14,
          }),
        })
      }

      // Topo point: small dot, color by code
      let dotColor = '#A89E92' // default muted
      if (code) {
        const uc = code.toUpperCase()
        if (uc.includes('BLD') || uc.includes('BUILD')) dotColor = '#8FA67E' // sage = buildings
        if (uc.includes('ROAD') || uc.includes('RD')) dotColor = '#C89759' // ochre = roads
        if (uc.includes('FENCE')) dotColor = '#7A7066' // muted = fence
        if (uc.includes('TREE')) dotColor = '#5A7551' // dark sage = vegetation
        if (uc.includes('BOUND') || uc.includes('BDRY')) dotColor = '#D17B47' // accent = boundary
      }

      return new Style({
        image: new CircleStyle({
          radius: 4,
          fill: new Fill({ color: dotColor }),
          stroke: new Stroke({ color: '#1A1816', width: 1 }),
        }),
      })
    },
    zIndex: 25, // above basemap (0), below draw (50) and measure (45)
  })

  map.addLayer(layer)

  return {
    pointsLayer: layer,
    pointsSource: source,
    cleanup: () => map.removeLayer(layer),
    pointCount: points.length,
    controlPointCount: controlCount,
  }
}
