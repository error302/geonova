/**
 * Error Ellipse Map Layer
 *
 * Renders the 95% confidence error ellipses of an LSA network adjustment on
 * the survey map. The ellipses come from the covariance matrices the
 * adjustment already computes: `network_adjustments.adjusted_stations`
 * (saved by NetworkAdjustmentPanel via POST /api/project/[id]/network-adjustment)
 * carries per-station semi-major / semi-minor axes (1σ, metres) and the
 * orientation of the major axis.
 *
 * Orientation convention (matches the LSA engine's eigenvector output):
 * decimal degrees **from East, counter-clockwise** in the (E, N) plane —
 * the angle of the major-axis eigenvector of the 2×2 covariance matrix
 * (t = ½·atan2(2·σ_EN, σ_EE − σ_NN)).
 *
 * Survey-grade ellipses are cm-level, so they are drawn at an EXAGGERATION
 * factor (default 100×) that preserves relative size and orientation — the
 * surveyor reads direction + relative magnitude, while absolute values stay
 * available in the feature properties.
 *
 * @module map/errorEllipseLayer
 */

import { registerProjections } from '@/lib/map/projection'

/** One error ellipse to draw, centered on an adjusted station. */
export interface MapErrorEllipseStation {
  pointName: string
  easting: number
  northing: number
  /** 1σ semi-major axis (metres) — as computed by the LSA. */
  semiMajor: number
  /** 1σ semi-minor axis (metres). */
  semiMinor: number
  /** Major-axis orientation, degrees from East, counter-clockwise (E-N plane). */
  orientation: number
  /** Display confidence for the drawn ellipse (default 0.95 → ×2.447). */
  confidence?: number
}

/** Chi-square multipliers for a 2-DOF error ellipse (√χ²₂(1−α)). */
export const ELLIPSE_CONFIDENCE_MULTIPLIERS: Record<number, number> = {
  0.394: 1.0, // 1σ
  0.632: 1.414,
  0.865: 2.0,
  0.95: 2.447, // 95% (√5.991)
  0.99: 3.035,
}

/** Scale factor that turns a 1σ ellipse into the requested confidence ellipse. */
export function ellipseConfidenceMultiplier(confidence = 0.95): number {
  const exact = ELLIPSE_CONFIDENCE_MULTIPLIERS[confidence]
  if (exact !== undefined) return exact
  // Closest tabulated value (keeps the drawn ellipse honest and predictable).
  const keys = Object.keys(ELLIPSE_CONFIDENCE_MULTIPLIERS)
    .map(Number)
    .sort((a, b) => Math.abs(a - confidence) - Math.abs(b - confidence))
  return ELLIPSE_CONFIDENCE_MULTIPLIERS[keys[0]] ?? 2.447
}

/** Loose row shape of `network_adjustments.adjusted_stations` (JSONB). */
export interface AdjustedStationsRow {
  name?: string | null
  pointName?: string | null
  easting?: number | null
  northing?: number | null
  semiMajor?: number | null
  semiMinor?: number | null
  orientation?: number | null
  isFixed?: boolean | null
}

/**
 * Normalize stored LSA adjusted stations into drawable error ellipses.
 *
 * Fixed stations and stations without a computed ellipse (zero/absent axes)
 * are excluded — they carry no covariance.
 */
export function normalizeAdjustedStationsToEllipses(
  adjusted: Array<AdjustedStationsRow | null | undefined>,
): MapErrorEllipseStation[] {
  const ellipses: MapErrorEllipseStation[] = []
  for (const s of adjusted) {
    if (!s) continue
    const semiMajor = Number(s.semiMajor ?? 0)
    const semiMinor = Number(s.semiMinor ?? 0)
    if (s.isFixed) continue // fixed stations have no covariance
    if (!(semiMajor > 0) || !(semiMinor > 0)) continue // no ellipse computed
    ellipses.push({
      pointName: s.pointName ?? s.name ?? 'STN',
      easting: Number(s.easting ?? 0),
      northing: Number(s.northing ?? 0),
      semiMajor,
      semiMinor,
      orientation: Number(s.orientation ?? 0),
    })
  }
  return ellipses
}

/**
 * Build the polygon ring (in source CRS units = metres) of one error ellipse.
 *
 * The 1σ axes are scaled to the display confidence (e.g. ×2.447 for 95%) and
 * then multiplied by `exaggeration` so cm-level ellipses stay visible.
 *
 * @returns closed ring of [easting, northing] pairs
 */
export function buildErrorEllipseRing(
  centerEasting: number,
  centerNorthing: number,
  semiMajor: number,
  semiMinor: number,
  orientationDeg: number,
  exaggeration = 100,
  confidence = 0.95,
  segments = 64,
): Array<[number, number]> {
  const multiplier = ellipseConfidenceMultiplier(confidence)
  const a = semiMajor * multiplier * exaggeration
  const b = semiMinor * multiplier * exaggeration
  const theta = (orientationDeg * Math.PI) / 180

  const ring: Array<[number, number]> = []
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * 2 * Math.PI
    const x = a * Math.cos(angle)
    const y = b * Math.sin(angle)
    // Rotate by the major-axis orientation (from East, CCW)
    const rx = x * Math.cos(theta) - y * Math.sin(theta)
    const ry = x * Math.sin(theta) + y * Math.cos(theta)
    ring.push([centerEasting + rx, centerNorthing + ry])
  }
  ring.push([...ring[0]])
  return ring
}

/**
 * Build OpenLayers features (rotated polygons in EPSG:3857) for the ellipses.
 * SSR-safe: OL imports are dynamic.
 */
export async function buildErrorEllipseFeatures(options: {
  stations: MapErrorEllipseStation[]
  epsg: string
  exaggeration?: number
  confidence?: number
}): Promise<Array<import('ol/Feature').default>> {
  const { stations, epsg, exaggeration = 100, confidence = 0.95 } = options
  if (stations.length === 0) return []

  await registerProjections()
  const [{ default: Feature }, { default: Polygon }] = await Promise.all([
    import('ol/Feature'),
    import('ol/geom/Polygon'),
  ])

  return stations.map((s) => {
    const ring = buildErrorEllipseRing(
      s.easting,
      s.northing,
      s.semiMajor,
      s.semiMinor,
      s.orientation,
      exaggeration,
      s.confidence ?? confidence,
    )
    const geometry = new Polygon([ring])
    geometry.transform(epsg, 'EPSG:3857')
    const feature = new Feature({ geometry })
    feature.setProperties({
      layerType: 'errorEllipse',
      pointName: s.pointName,
      semiMajor: s.semiMajor,
      semiMinor: s.semiMinor,
      orientation: s.orientation,
      confidence: s.confidence ?? confidence,
      exaggeration,
      formatted: `±${(s.semiMajor * ellipseConfidenceMultiplier(s.confidence ?? confidence)).toFixed(3)}m × ±${(s.semiMinor * ellipseConfidenceMultiplier(s.confidence ?? confidence)).toFixed(3)}m @ ${s.orientation.toFixed(1)}°`,
    })
    return feature
  })
}

/**
 * Create the error-ellipse vector layer. Layer stack (zIndex) is chosen so the
 * ellipses sit above the parcel polygon and below the beacon markers.
 */
export async function createErrorEllipseLayer(options: {
  stations: MapErrorEllipseStation[]
  epsg: string
  exaggeration?: number
  confidence?: number
  visible?: boolean
  zIndex?: number
}): Promise<import('ol/layer/Vector').default> {
  const {
    stations,
    epsg,
    exaggeration = 100,
    confidence = 0.95,
    visible = true,
    zIndex = 3,
  } = options

  const [
    { default: VectorLayer },
    { default: VectorSource },
    { default: Style },
    { default: Stroke },
    { default: Fill },
  ] = await Promise.all([
    import('ol/layer/Vector'),
    import('ol/source/Vector'),
    import('ol/style/Style'),
    import('ol/style/Stroke'),
    import('ol/style/Fill'),
  ])

  const features = await buildErrorEllipseFeatures({ stations, epsg, exaggeration, confidence })

  const layer = new VectorLayer({
    source: new VectorSource({ features }),
    visible,
    zIndex,
    style: new Style({
      stroke: new Stroke({ color: '#B3452A', width: 1.5, lineDash: [4, 3] }),
      fill: new Fill({ color: 'rgba(209, 123, 71, 0.16)' }),
    }),
  })
  layer.set('layerType', 'errorEllipse')
  return layer
}
