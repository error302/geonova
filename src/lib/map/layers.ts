/**
 * METARDU Map Layer Factories
 *
 * Provides factory functions for creating OpenLayers layers used by the
 * global map. All OL imports are dynamic for SSR compatibility.
 *
 * Layer hierarchy (zIndex):
 *   0  — OSM basemap
 *   1  — KenCORS control stations
 *   2  — Simple parcel layer (legacy, coord-based)
 *   3  — Beacon markers (legacy, station-based)
 *   20 — Scheme parcel polygons (from API)
 *   25 — Scheme block labels (from API)
 *   30 — Scheme beacon points (from API)
 *
 * @module layers
 * @see schemeLayer.ts — enhanced scheme data layers with API integration
 */

import { registerProjections } from '@/lib/map/projection'
import { createParcelStyleFunction, type ParcelStatus } from '@/lib/map/cadastralStyles'

// Scheme map API GeoJSON shapes (mirrors src/app/api/scheme/map/route.ts)
interface SchemeParcelProperties {
  type: string
  parcel_id?: string
  parcel_number?: string | null
  lr_number?: string | null
  block_number?: string | null
  area_ha?: string | number | null
  status?: string | null
  station?: string
}

interface SchemeFeature {
  type: 'Feature'
  properties: SchemeParcelProperties
  geometry: {
    type: string
    coordinates: number[] | number[][] | number[][][]
  }
}

interface SchemeMapResponse {
  features: SchemeFeature[]
}

// Hover state attached to the scheme parcel layer for later cleanup
interface SchemeLayerHoverState {
  highlightStyle: import('ol/style/Style').default
  getHoverState: () => {
    hoveredFeature: import('ol/Feature').default | null
    originalStyle: import('ol/style/Style').default | null
  }
  setHoverState: (
    feature: import('ol/Feature').default | null,
    style: import('ol/style/Style').default | null,
  ) => void
}

// ─── OSM Basemap ──────────────────────────────────────────────────────────

export async function createOSMLayer() {
  const { default: TileLayer } = await import('ol/layer/Tile');
  const { default: OSM } = await import('ol/source/OSM');
  return new TileLayer({ source: new OSM(), zIndex: 0 });
}

// ─── Simple Parcel Layer (legacy, coord-based) ───────────────────────────

export async function createParcelLayer(
  coords3857: Array<[number, number]>
): Promise<import('ol/layer/Vector').default> {
  const [
    { default: VectorLayer },
    { default: VectorSource },
    { default: Feature },
    { default: Polygon },
    { default: Style },
    { default: Stroke },
    { default: Fill },
  ] = await Promise.all([
    import('ol/layer/Vector'),
    import('ol/source/Vector'),
    import('ol/Feature'),
    import('ol/geom/Polygon'),
    import('ol/style/Style'),
    import('ol/style/Stroke'),
    import('ol/style/Fill'),
  ]);

  const polygon = new Polygon([coords3857]);
  const feature = new Feature({ geometry: polygon, type: 'parcel' });

  const source = new VectorSource({ features: [feature] });

  return new VectorLayer({
    source,
    zIndex: 2,
    style: new Style({
      stroke: new Stroke({ color: '#1B3A5C', width: 2.5 }),
      fill: new Fill({ color: 'rgba(27, 58, 92, 0.08)' }),
    }),
  });
}

// ─── Enhanced Parcel Layer (API-based, with projectId) ────────────────────

/**
 * Create a parcel layer that fetches GeoJSON data from the scheme map API.
 *
 * Accepts a `projectId` parameter, fetches parcel boundaries from
 * `/api/scheme/map?project_id=...`, transforms coordinates from
 * EPSG:21037 to EPSG:3857, and styles parcels with the existing
 * cadastral styles from `cadastralStyles.ts`.
 *
 * Features include:
 * - Status-aware parcel styling (approved/pending/rejected/default)
 * - Parcel number labels at interior points
 * - Click handler for parcel selection (popup with parcel details)
 * - Hover highlight effect (orange stroke + fill)
 *
 * @param projectId - The project ID to fetch scheme data for
 * @param options - Optional configuration
 * @param options.showLabels - Whether to show parcel number labels (default: true)
 * @returns Promise resolving to a VectorLayer with scheme parcel features
 */
export async function createParcelLayerFromScheme(
  projectId: string,
  options: { showLabels?: boolean; epsg?: string } = {},
): Promise<import('ol/layer/Vector').default> {
  const { showLabels = true, epsg = 'EPSG:21037' } = options

  // Ensure projections are registered before any coordinate transforms
  await registerProjections()

  const [
    { default: VectorLayer },
    { default: VectorSource },
    { default: Feature },
    { default: Polygon },
    { default: Style },
    { default: Stroke },
    { default: Fill },
  ] = await Promise.all([
    import('ol/layer/Vector'),
    import('ol/source/Vector'),
    import('ol/Feature'),
    import('ol/geom/Polygon'),
    import('ol/style/Style'),
    import('ol/style/Stroke'),
    import('ol/style/Fill'),
  ])

  const { transform } = await import('ol/proj')

  // Fetch GeoJSON from the scheme map API
  const response = await fetch(`/api/scheme/map?project_id=${encodeURIComponent(projectId)}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch scheme data: ${response.status}`)
  }

  const data = (await response.json()) as SchemeMapResponse

  if (!data || !data.features || !Array.isArray(data.features)) {
    throw new Error('Invalid scheme data response')
  }

  // Create the status-aware parcel style function
  const parcelStyleFn = await createParcelStyleFunction({
    showLabel: showLabels,
    strokeWidth: 2.5,
    zIndex: 20,
  })

  const features: InstanceType<typeof Feature>[] = []

  // Process each feature from the API response
  for (const feat of data.features) {
    // Only process parcel polygon features
    if (feat.properties?.type !== 'parcel') continue
    if (feat.geometry?.type !== 'Polygon') continue

    const rings = feat.geometry.coordinates as number[][][]
    const transformedRings: Array<Array<[number, number]>> = []

    for (const ring of rings) {
      const transformedRing: Array<[number, number]> = ring.map((coord: number[]) => {
        return transform([coord[0], coord[1]], epsg, 'EPSG:3857') as [number, number]
      })
      transformedRings.push(transformedRing)
    }

    const olFeature = new Feature({
      geometry: new Polygon(transformedRings),
      type: 'scheme-parcel',
      parcelId: feat.properties.parcel_id,
      parcelNumber: feat.properties.parcel_number,
      lrNumber: feat.properties.lr_number,
      blockNumber: feat.properties.block_number,
      areaHa: feat.properties.area_ha,
      status: (feat.properties.status || 'default') as ParcelStatus,
    })

    olFeature.setId(`parcel-${feat.properties.parcel_id || features.length}`)
    features.push(olFeature)
  }

  const source = new VectorSource({ features })

  const layer = new VectorLayer({
    source,
    style: parcelStyleFn as import('ol/style/Style').StyleFunction,
    zIndex: 20,
    visible: true,
    properties: { name: 'scheme-parcels', projectId },
  })

  // ── Hover highlight effect ───────────────────────────────────────────
  // The highlight style is applied on hover, restoring the original style
  // when the mouse moves away.
  const highlightStyle = new Style({
    stroke: new Stroke({ color: '#D17B47', width: 3.5 }),
    fill: new Fill({ color: 'rgba(209, 123, 71, 0.18)' }),
  })

  let hoveredFeature: import('ol/Feature').default | null = null
  let originalStyle: import('ol/style/Style').default | null = null

  // Store hover listeners on the layer for later cleanup
  ;(layer as import('ol/layer/Vector').default & { _hoverSetup: SchemeLayerHoverState })._hoverSetup = {
    highlightStyle,
    getHoverState: () => ({ hoveredFeature, originalStyle }),
    setHoverState: (f, s) => { hoveredFeature = f; originalStyle = s },
  }

  return layer
}

// ─── Beacon Layer (legacy, station-based) ─────────────────────────────────

export async function createBeaconLayer(
  stations: Array<{ label: string; coord3857: [number, number] }>
): Promise<import('ol/layer/Vector').default> {
  const [
    { default: VectorLayer },
    { default: VectorSource },
    { default: Feature },
    { default: Point },
    { default: Style },
    { default: CircleStyle },
    { default: Stroke },
    { default: Fill },
    { default: Text },
  ] = await Promise.all([
    import('ol/layer/Vector'),
    import('ol/source/Vector'),
    import('ol/Feature'),
    import('ol/geom/Point'),
    import('ol/style/Style'),
    import('ol/style/Circle'),
    import('ol/style/Stroke'),
    import('ol/style/Fill'),
    import('ol/style/Text'),
  ]);

  const features = stations.map(({ label, coord3857 }) => {
    const f = new Feature({ geometry: new Point(coord3857), label });
    f.setStyle(new Style({
      image: new CircleStyle({
        radius: 6,
        stroke: new Stroke({ color: '#1B3A5C', width: 2 }),
        fill: new Fill({ color: '#FFFFFF' }),
      }),
      text: new Text({
        text: label,
        offsetX: 10,
        offsetY: -10,
        font: 'bold 11px Calibri, sans-serif',
        fill: new Fill({ color: '#1B3A5C' }),
        stroke: new Stroke({ color: '#FFFFFF', width: 3 }),
      }),
    }));
    return f;
  });

  const source = new VectorSource({ features });
  return new VectorLayer({ source, zIndex: 3 });
}

// ─── KenCORS Layer ────────────────────────────────────────────────────────

export async function createKenCORSLayer(
  stations: Array<{ id: string; name: string; coord3857: [number, number]; distanceKm: number; status: string }>
): Promise<import('ol/layer/Vector').default> {
  const [
    { default: VectorLayer },
    { default: VectorSource },
    { default: Feature },
    { default: Point },
    { default: Style },
    { default: RegularShape },
    { default: Stroke },
    { default: Fill },
    { default: Text },
  ] = await Promise.all([
    import('ol/layer/Vector'),
    import('ol/source/Vector'),
    import('ol/Feature'),
    import('ol/geom/Point'),
    import('ol/style/Style'),
    import('ol/style/RegularShape'),
    import('ol/style/Stroke'),
    import('ol/style/Fill'),
    import('ol/style/Text'),
  ]);

  const features = stations.map(({ id, name, coord3857, distanceKm, status }) => {
    const f = new Feature({ geometry: new Point(coord3857), id, name, distanceKm });
    f.setStyle(new Style({
      image: new RegularShape({
        points: 3,
        radius: 8,
        stroke: new Stroke({ color: status === 'active' ? '#006400' : '#888888', width: 2 }),
        fill: new Fill({ color: status === 'active' ? 'rgba(0,100,0,0.15)' : 'rgba(136,136,136,0.15)' }),
      }),
      text: new Text({
        text: `${id}\n${distanceKm.toFixed(1)} km`,
        offsetY: 18,
        font: '10px Calibri, sans-serif',
        fill: new Fill({ color: status === 'active' ? '#006400' : '#888888' }),
        stroke: new Stroke({ color: '#FFFFFF', width: 2 }),
        textAlign: 'center',
      }),
    }));
    return f;
  });

  const source = new VectorSource({ features });
  return new VectorLayer({ source, zIndex: 1 });
}
