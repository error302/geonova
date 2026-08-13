/**
 * METARDU Subdivision Map Layer
 *
 * Renders subdivided lots as colored polygons on an OpenLayers map.
 * Each lot gets a unique fill color, lot number label, and area label.
 * Split lines are rendered as dashed lines.
 * Road reserves are rendered with semi-transparent orange fill and hatched boundary.
 *
 * All OL imports are dynamic to match existing project patterns.
 */

import type { SubdivisionResult, SplitLine, RoadReserveInfo } from '@/types/subdivision'
import { to3857, arrayTo3857 } from '@/lib/map/projection'

/** Professional color palette for lot fills (RGBA with 0.25 alpha) */
const LOT_COLORS = [
  'rgba(96, 165, 250, 0.30)',   // light blue
  'rgba(74, 222, 128, 0.30)',   // light green
  'rgba(250, 204, 21, 0.30)',   // light yellow
  'rgba(251, 146, 160, 0.30)',  // light pink
  'rgba(196, 181, 253, 0.30)',  // light purple
  'rgba(103, 232, 249, 0.30)',  // light cyan
  'rgba(253, 186, 116, 0.30)',  // light orange
  'rgba(167, 139, 250, 0.30)',  // violet
]


/**
 * Create a subdivision overlay layer for the map.
 * Coordinates are converted from EPSG:21037 to EPSG:3857 for rendering.
 */
export async function createSubdivisionLayer(
  result: SubdivisionResult
): Promise<import('ol/layer/Vector').default> {
  const [
    { default: VectorLayer },
    { default: VectorSource },
    { default: Feature },
    { default: Polygon },
    { default: PointGeom },
    { default: Style },
    { default: Stroke },
    { default: Fill },
    { default: Text },
  ] = await Promise.all([
    import('ol/layer/Vector'),
    import('ol/source/Vector'),
    import('ol/Feature'),
    import('ol/geom/Polygon'),
    import('ol/geom/Point'),
    import('ol/style/Style'),
    import('ol/style/Stroke'),
    import('ol/style/Fill'),
    import('ol/style/Text'),
  ])

  const features: InstanceType<typeof Feature>[] = []

  // ─── Parent parcel boundary (dashed outline) ────────────────────────────
  const parentClosed = [...result.parentParcel.vertices, result.parentParcel.vertices[0]]
  const parentCoords3857 = await arrayTo3857(
    parentClosed.map(p => [p.easting, p.northing] as [number, number])
  )

  const parentFeature = new Feature({
    geometry: new Polygon([parentCoords3857]),
    type: 'parent-boundary',
  })
  parentFeature.setStyle(new Style({
    stroke: new Stroke({
      color: '#1B3A5C',
      width: 3,
      lineDash: [8, 4],
    }),
    fill: new Fill({ color: 'rgba(27, 58, 92, 0.04)' }),
  }))
  features.push(parentFeature)

  // ─── Lot polygons with labels ───────────────────────────────────────────
  for (const lot of result.lots) {
    const colorIdx = (lot.lotNumber - 1) % LOT_COLORS.length
    const fillColor = LOT_COLORS[colorIdx]

    // Close the polygon for rendering
    const closedLot = [...lot.vertices, lot.vertices[0]]
    const coords3857 = await arrayTo3857(
      closedLot.map(p => [p.easting, p.northing] as [number, number])
    )

    const lotFeature = new Feature({
      geometry: new Polygon([coords3857]),
      type: 'lot',
      lotNumber: lot.lotNumber,
    })
    lotFeature.setStyle(new Style({
      stroke: new Stroke({
        color: '#1B3A5C',
        width: 2.5,
      }),
      fill: new Fill({ color: fillColor }),
    }))
    features.push(lotFeature)

    // ─── Lot number label at centroid ────────────────────────────────────
    const centroidCoord = await to3857(lot.centroid.easting, lot.centroid.northing)

    const labelFeature = new Feature({
      geometry: new PointGeom(centroidCoord),
      type: 'lot-label',
    })
    labelFeature.setStyle(new Style({
      text: new Text({
        text: `LOT ${lot.lotNumber}\n${lot.areaHa.toFixed(4)} ha`,
        font: 'bold 12px Calibri, sans-serif',
        fill: new Fill({ color: '#1B3A5C' }),
        stroke: new Stroke({ color: '#FFFFFF', width: 4 }),
        textAlign: 'center',
        textBaseline: 'middle',
        offsetY: 0,
      }),
    }))
    features.push(labelFeature)
  }

  // ─── Road reserve polygon (if present) ─────────────────────────────────
  if (result.roadReserve && result.roadReserve.roadPolygon.length >= 3) {
    const rr = result.roadReserve
    const closedRR = [...rr.roadPolygon, rr.roadPolygon[0]]
    const rrCoords3857 = await arrayTo3857(
      closedRR.map(p => [p.easting, p.northing] as [number, number])
    )

    const roadFeature = new Feature({
      geometry: new Polygon([rrCoords3857]),
      type: 'road-reserve',
    })
    roadFeature.setStyle(new Style({
      fill: new Fill({ color: 'rgba(251, 146, 60, 0.35)' }),
      stroke: new Stroke({
        color: '#EA580C',
        width: 3,
        lineDash: [10, 5],
      }),
    }))
    features.push(roadFeature)

    // Road width label at centroid of road polygon
    let rrCx = 0, rrCy = 0
    for (const p of rr.roadPolygon) {
      rrCx += p.easting
      rrCy += p.northing
    }
    rrCx /= rr.roadPolygon.length
    rrCy /= rr.roadPolygon.length
    const rrCentroidCoord = await to3857(rrCx, rrCy)

    const rrLabelFeature = new Feature({
      geometry: new PointGeom(rrCentroidCoord),
      type: 'road-label',
    })
    rrLabelFeature.setStyle(new Style({
      text: new Text({
        text: `ROAD RESERVE\n${rr.width}m`,
        font: 'bold 11px Calibri, sans-serif',
        fill: new Fill({ color: '#9A3412' }),
        stroke: new Stroke({ color: '#FFFFFF', width: 4 }),
        textAlign: 'center',
        textBaseline: 'middle',
      }),
    }))
    features.push(rrLabelFeature)
  }

  const source = new VectorSource({ features })
  return new VectorLayer({ source, zIndex: 10 })
}

/**
 * Create a split-line preview layer (dashed red line).
 */
export async function createSplitLineLayer(
  splitLine: SplitLine | null
): Promise<import('ol/layer/Vector').default | null> {
  if (!splitLine) return null

  const [
    { default: VectorLayer },
    { default: VectorSource },
    { default: Feature },
    { default: LineString },
    { default: Style },
    { default: Stroke },
  ] = await Promise.all([
    import('ol/layer/Vector'),
    import('ol/source/Vector'),
    import('ol/Feature'),
    import('ol/geom/LineString'),
    import('ol/style/Style'),
    import('ol/style/Stroke'),
  ])

  const coords3857 = await arrayTo3857([
    [splitLine.startPoint.easting, splitLine.startPoint.northing] as [number, number],
    [splitLine.endPoint.easting, splitLine.endPoint.northing] as [number, number],
  ])

  const feature = new Feature({
    geometry: new LineString(coords3857),
    type: 'split-line',
  })
  feature.setStyle(new Style({
    stroke: new Stroke({
      color: '#DC2626',
      width: 2,
      lineDash: [6, 4],
    }),
  }))

  const source = new VectorSource({ features: [feature] })
  return new VectorLayer({ source, zIndex: 11 })
}

/**
 * Create a road reserve preview layer (semi-transparent orange polygon with hatched boundary).
 * Used for previewing the road reserve before executing the subdivision.
 */
export async function createRoadReservePreviewLayer(
  roadReserve: RoadReserveInfo
): Promise<import('ol/layer/Vector').default> {
  const [
    { default: VectorLayer },
    { default: VectorSource },
    { default: Feature },
    { default: Polygon },
    { default: PointGeom },
    { default: Style },
    { default: Stroke },
    { default: Fill },
    { default: Text },
  ] = await Promise.all([
    import('ol/layer/Vector'),
    import('ol/source/Vector'),
    import('ol/Feature'),
    import('ol/geom/Polygon'),
    import('ol/geom/Point'),
    import('ol/style/Style'),
    import('ol/style/Stroke'),
    import('ol/style/Fill'),
    import('ol/style/Text'),
  ])

  const features: InstanceType<typeof Feature>[] = []

  // Road corridor polygon
  const closed = [...roadReserve.roadPolygon, roadReserve.roadPolygon[0]]
  const coords3857 = await arrayTo3857(
    closed.map(p => [p.easting, p.northing] as [number, number])
  )

  const roadFeature = new Feature({
    geometry: new Polygon([coords3857]),
    type: 'road-reserve-preview',
  })
  roadFeature.setStyle(new Style({
    fill: new Fill({ color: 'rgba(251, 146, 60, 0.35)' }),
    stroke: new Stroke({
      color: '#EA580C',
      width: 3,
      lineDash: [10, 5],
    }),
  }))
  features.push(roadFeature)

  // Road width label at centroid
  let cx = 0, cy = 0
  for (const p of roadReserve.roadPolygon) {
    cx += p.easting
    cy += p.northing
  }
  cx /= roadReserve.roadPolygon.length
  cy /= roadReserve.roadPolygon.length
  const centroidCoord = await to3857(cx, cy)

  const labelFeature = new Feature({
    geometry: new PointGeom(centroidCoord),
    type: 'road-label-preview',
  })
  labelFeature.setStyle(new Style({
    text: new Text({
      text: `ROAD RESERVE\n${roadReserve.width}m`,
      font: 'bold 11px Calibri, sans-serif',
      fill: new Fill({ color: '#9A3412' }),
      stroke: new Stroke({ color: '#FFFFFF', width: 4 }),
      textAlign: 'center',
      textBaseline: 'middle',
    }),
  }))
  features.push(labelFeature)

  const source = new VectorSource({ features })
  return new VectorLayer({ source, zIndex: 12 })
}
