/**
 * METARDU Scheme Data Layers
 *
 * Dedicated module for loading and rendering cadastral scheme data
 * (parcels, blocks, beacons) on an OpenLayers map.
 *
 * All OpenLayers imports are dynamic for SSR compatibility.
 * Coordinates are transformed from EPSG:21037 (Arc 1960 / UTM 37S)
 * to EPSG:3857 (Web Mercator) for display.
 *
 * @module schemeLayer
 * @see layers.ts — base layer factories
 * @see cadastralStyles.ts — status-aware styling
 * @see projection.ts — EPSG:21037 registration
 */

import type { OLMap, OLFeature, OLLayer, OLEvent, OLOverlay } from './olTypes'

import { registerProjections } from '@/lib/map/projection'
import {
  createParcelStyleFunction,
  createBeaconStyleFunction,
  type ParcelStatus,
  type BeaconType,
} from '@/lib/map/cadastralStyles'

// ─── Types ────────────────────────────────────────────────────────────────

/** GeoJSON FeatureCollection returned by /api/scheme/map */
export interface SchemeGeoJSON {
  type: 'FeatureCollection'
  features: SchemeFeature[]
  bounds: [number, number, number, number] | null
  crs: { type: 'string'; properties: { name: string } }
}

export interface SchemeFeature {
  type: 'Feature'
  properties: {
    type: 'parcel' | 'parcel_point' | 'block_label'
    parcel_id?: string
    parcel_number?: string
    lr_number?: string
    block_number?: string
    block_id?: string
    block_name?: string
    area_ha?: number
    status?: string
    station?: string
    parcel_count?: number
  }
  geometry: {
    type: 'Polygon' | 'Point'
    coordinates: number[][] | number[]
  }
}

/** Result of loading scheme data — contains created layers and metadata */
export interface SchemeLayerResult {
  parcelLayer: import('ol/layer/Vector').default
  blockLayer: import('ol/layer/Vector').default
  beaconLayer: import('ol/layer/Vector').default
  parcelCount: number
  blockCount: number
  beaconCount: number
  extent: number[] | null
}

/** Options for scheme layer creation */
export interface SchemeLayerOptions {
  /** Whether to show parcel number labels (default: true) */
  showParcelLabels?: boolean
  /** Whether to auto-zoom to scheme extent after loading (default: true) */
  autoZoom?: boolean
  /** Callback when a parcel feature is clicked */
  onParcelClick?: (properties: SchemeFeature['properties']) => void
  /** Callback when a beacon feature is clicked */
  onBeaconClick?: (properties: SchemeFeature['properties']) => void
  /** T1.5 FIX (2026-07-09): UTM EPSG for coordinate transforms (default 'EPSG:21037') */
  epsg?: string
}

// ─── Data Fetching ────────────────────────────────────────────────────────

/**
 * Fetch scheme GeoJSON data from the API.
 *
 * @param projectId - The project ID to load scheme data for
 * @returns GeoJSON FeatureCollection with EPSG:21037 coordinates
 * @throws Error if the API request fails
 */
export async function loadSchemeData(projectId: string): Promise<SchemeGeoJSON> {
  const response = await fetch(`/api/scheme/map?project_id=${encodeURIComponent(projectId)}`)

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Failed to load scheme data: ${response.status} ${text}`)
  }

  const data = await response.json() as unknown as SchemeGeoJSON

  if (!data || !data.features) {
    throw new Error('Invalid scheme data response')
  }

  return data
}

// ─── Coordinate Transformation ────────────────────────────────────────────

/**
 * Transform a GeoJSON polygon ring from EPSG:21037 to EPSG:3857.
 */
async function transformRing(
  ring: number[][],
  epsg: string = 'EPSG:21037',
): Promise<Array<[number, number]>> {
  const { transform } = await import('ol/proj')
  return ring.map(coord => {
    const transformed = transform(
      [coord[0], coord[1]],
      epsg,
      'EPSG:3857',
    ) as [number, number]
    return transformed
  })
}

/**
 * Transform a single coordinate from EPSG:21037 to EPSG:3857.
 */
async function transformCoord(
  coord: number[],
  epsg: string = 'EPSG:21037',
): Promise<[number, number]> {
  const { transform } = await import('ol/proj')
  return transform([coord[0], coord[1]], epsg, 'EPSG:3857') as [number, number]
}

// ─── Layer Factories ──────────────────────────────────────────────────────

/**
 * Create a vector layer for scheme parcel polygons.
 *
 * Features are styled with status-aware cadastral styles from
 * `cadastralStyles.ts`. Each parcel polygon includes its number
 * as a label at the interior point.
 *
 * @param projectId - The project ID to fetch scheme data for
 * @param options - Configuration options
 * @returns Promise resolving to a VectorLayer with parcel features
 */
export async function createSchemeParcelLayer(
  projectId: string,
  options: SchemeLayerOptions = {},
): Promise<import('ol/layer/Vector').default> {
  const { showParcelLabels = true, epsg = 'EPSG:21037' } = options

  // Ensure projections are registered before any transforms
  await registerProjections()

  const [
    { default: VectorLayer },
    { default: VectorSource },
    { default: Feature },
    { default: Polygon },
  ] = await Promise.all([
    import('ol/layer/Vector'),
    import('ol/source/Vector'),
    import('ol/Feature'),
    import('ol/geom/Polygon'),
  ])

  // Fetch and parse scheme data
  const data = await loadSchemeData(projectId)

  // Create the status-aware parcel style function
  const parcelStyleFn = await createParcelStyleFunction({
    showLabel: showParcelLabels,
    strokeWidth: 2.5,
    zIndex: 20,
  })

  const features: InstanceType<typeof Feature>[] = []

  // Process parcel polygon features
  for (const feat of data.features) {
    if (feat.properties.type !== 'parcel') continue
    if (feat.geometry.type !== 'Polygon') continue

    const rings = feat.geometry.coordinates as unknown as number[][][]
    const transformedRings: Array<Array<[number, number]>> = []

    for (const ring of rings) {
      const transformedRing = await transformRing(ring, epsg)
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
    style: parcelStyleFn as unknown as undefined,
    zIndex: 20,
    visible: true,
    properties: { name: 'scheme-parcels', projectId },
  })

  return layer
}

/**
 * Create a vector layer for scheme block labels.
 *
 * Block features are rendered as point markers with the block name
 * and parcel count as text labels.
 *
 * @param projectId - The project ID to fetch scheme data for
 * @returns Promise resolving to a VectorLayer with block features
 */
export async function createSchemeBlockLayer(
  projectId: string,
  epsg: string = 'EPSG:21037',
): Promise<import('ol/layer/Vector').default> {
  await registerProjections()

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
  ])

  const data = await loadSchemeData(projectId)

  const features: InstanceType<typeof Feature>[] = []

  for (const feat of data.features) {
    if (feat.properties.type !== 'block_label') continue
    if (feat.geometry.type !== 'Point') continue

    const coord = feat.geometry.coordinates as number[]
    const [x, y] = await transformCoord(coord, epsg)

    const olFeature = new Feature({
      geometry: new Point([x, y]),
      type: 'scheme-block',
      blockId: feat.properties.block_id,
      blockNumber: feat.properties.block_number,
      blockName: feat.properties.block_name,
      parcelCount: feat.properties.parcel_count,
    })

    // Style: circle marker + text label
    const labelText = feat.properties.block_name || `Block ${feat.properties.block_number}`
    const countLabel = feat.properties.parcel_count
      ? `${feat.properties.parcel_count} parcels`
      : ''

    olFeature.setStyle(new Style({
      image: new CircleStyle({
        radius: 10,
        fill: new Fill({ color: 'rgba(209, 123, 71, 0.25)' }),
        stroke: new Stroke({ color: '#D17B47', width: 2 }),
      }),
      text: new Text({
        text: countLabel ? `${labelText}\n${countLabel}` : labelText,
        font: 'bold 12px Calibri, sans-serif',
        fill: new Fill({ color: '#D17B47' }),
        stroke: new Stroke({ color: '#FFFFFF', width: 3.5 }),
        textAlign: 'center',
        textBaseline: 'middle',
        offsetY: -20,
      }),
    }))

    features.push(olFeature)
  }

  const source = new VectorSource({ features })

  return new VectorLayer({
    source,
    zIndex: 25,
    visible: true,
    properties: { name: 'scheme-blocks', projectId },
  })
}

/**
 * Create a vector layer for scheme beacon points.
 *
 * Beacon features come from `parcel_point` type features in the API response.
 * These are styled with SoK-compliant beacon markers from `cadastralStyles.ts`.
 *
 * @param projectId - The project ID to fetch scheme data for
 * @returns Promise resolving to a VectorLayer with beacon features
 */
export async function createSchemeBeaconLayer(
  projectId: string,
  epsg: string = 'EPSG:21037',
): Promise<import('ol/layer/Vector').default> {
  await registerProjections()

  const [
    { default: VectorLayer },
    { default: VectorSource },
    { default: Feature },
    { default: Point },
  ] = await Promise.all([
    import('ol/layer/Vector'),
    import('ol/source/Vector'),
    import('ol/Feature'),
    import('ol/geom/Point'),
  ])

  const data = await loadSchemeData(projectId)

  // Create the beacon style function
  const beaconStyleFn = await createBeaconStyleFunction({
    radius: 6,
    showDescription: false,
    labelOffsetX: 12,
    labelOffsetY: -12,
  })

  const features: InstanceType<typeof Feature>[] = []
  const seenStations = new Set<string>()

  for (const feat of data.features) {
    if (feat.properties.type !== 'parcel_point') continue
    if (feat.geometry.type !== 'Point') continue

    // Deduplicate by station name (beacons shared between parcels)
    const stationKey = feat.properties.station || `${(feat.geometry.coordinates as number[])[0]}_${(feat.geometry.coordinates as number[])[1]}`
    if (seenStations.has(stationKey)) continue
    seenStations.add(stationKey)

    const coord = feat.geometry.coordinates as number[]
    const [x, y] = await transformCoord(coord, epsg)

    const olFeature = new Feature({
      geometry: new Point([x, y]),
      type: 'scheme-beacon',
      beacon_type: 'boundary' as BeaconType,
      label: feat.properties.station || `Stn ${features.length + 1}`,
      parcelId: feat.properties.parcel_id,
      parcelNumber: feat.properties.parcel_number,
      blockNumber: feat.properties.block_number,
    })

    // Store original EPSG:21037 coordinates for vertex editing / COGO
    olFeature.set('easting', coord[0])
    olFeature.set('northing', coord[1])

    features.push(olFeature)
  }

  const source = new VectorSource({ features })

  return new VectorLayer({
    source,
    style: beaconStyleFn as unknown as undefined,
    zIndex: 30,
    visible: true,
    properties: { name: 'scheme-beacons', projectId },
  })
}

// ─── Popup Overlay Factory ────────────────────────────────────────────────

/**
 * Create a popup overlay for displaying feature info on the map.
 *
 * Returns the Overlay instance and the popup container element.
 * The popup is positioned at feature coordinates on click.
 *
 * @returns Object with the Overlay and helper functions
 */
export async function createSchemePopup() {
  const { default: Overlay } = await import('ol/Overlay')

  const popupElement = document.createElement('div')
  popupElement.className = 'hidden'

  const overlay = new Overlay({
    element: popupElement,
    autoPan: { animation: { duration: 250 } },
    positioning: 'bottom-center' as const,
    offset: [0, -12],
  })

  const hidePopup = () => {
    overlay.setPosition(undefined)
    popupElement.className = 'hidden'
    popupElement.replaceChildren()
  }

  return { overlay, popupElement, hidePopup }
}

/**
 * Render scheme feature popup content into a DOM element.
 *
 * This creates styled popup cards matching the existing map theme
 * (dark glass morphism with orange accents).
 */
export function renderSchemePopup(
  popupElement: HTMLDivElement,
  featureType: 'parcel' | 'beacon' | 'block',
  properties: Record<string, unknown>,
  hidePopup: () => void,
): void {
  popupElement.replaceChildren()
  popupElement.className = ''

  const card = document.createElement('div')
  card.className = 'bg-[#14141e]/95 border border-[#D17B47]/30 rounded-xl shadow-2xl backdrop-blur-xl p-4 min-w-[220px] max-w-[340px]'

  // Header
  const header = document.createElement('div')
  header.className = 'flex items-start justify-between mb-2'

  const labelWrap = document.createElement('div')
  labelWrap.className = 'flex items-center gap-2'
  const dot = document.createElement('div')
  dot.className = 'w-1.5 h-1.5 rounded-full bg-[#D17B47]'

  const typeLabels: Record<string, string> = {
    parcel: 'Parcel',
    beacon: 'Beacon',
    block: 'Block',
  }

  const label = document.createElement('span')
  label.className = 'text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold'
  label.textContent = typeLabels[featureType] || 'Feature'
  labelWrap.append(dot, label)

  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.className = 'text-gray-600 hover:text-white transition-colors p-0.5'
  closeButton.textContent = '\u00d7'
  closeButton.addEventListener('click', hidePopup)
  header.append(labelWrap, closeButton)
  card.append(header)

  // Content fields based on feature type
  const addField = (key: string, value: unknown, label: string, color?: string) => {
    if (value == null || value === '') return
    const wrap = document.createElement('div')
    wrap.className = 'mb-1'
    // XSS guard (2026-08-03): labels are constant here, but build with
    // textContent so no markup is ever parsed into the popup.
    const lbl = document.createElement('span')
    lbl.className = 'text-[10px] text-gray-600 uppercase tracking-wider'
    lbl.textContent = label
    const val = document.createElement('p')
    val.className = `text-sm font-semibold ${color || 'text-white'}`
    val.textContent = String(value)
    wrap.append(lbl, val)
    card.append(wrap)
  }

  if (featureType === 'parcel') {
    addField('parcelNumber', properties.parcelNumber, 'Parcel No.', 'text-[#D17B47]')
    addField('lrNumber', properties.lrNumber, 'LR Number')
    addField('blockNumber', properties.blockNumber, 'Block')
    addField('areaHa', properties.areaHa != null ? `${Number(properties.areaHa).toFixed(4)} ha` : null, 'Area')
    addField('status', properties.status, 'Status',
      properties.status === 'approved' ? 'text-green-500' :
      properties.status === 'pending' ? 'text-red-400' :
      properties.status === 'rejected' ? 'text-red-600' : 'text-gray-300'
    )
  } else if (featureType === 'beacon') {
    addField('label', properties.label, 'Station', 'text-[#D17B47]')
    addField('parcelNumber', properties.parcelNumber, 'Parcel')
    addField('blockNumber', properties.blockNumber, 'Block')
  } else if (featureType === 'block') {
    addField('blockName', properties.blockName, 'Block Name', 'text-[#D17B47]')
    addField('blockNumber', properties.blockNumber, 'Block No.')
    addField('parcelCount', properties.parcelCount ? `${properties.parcelCount} parcels` : null, 'Parcels')
  }

  popupElement.append(card)
}

// ─── Interaction Helpers ──────────────────────────────────────────────────

/**
 * Add a hover highlight interaction to scheme layers.
 *
 * When the mouse hovers over a parcel feature, it gets a highlight
 * style with increased opacity. The cursor changes to a pointer.
 *
 * @param map - The OpenLayers map instance
 * @param parcelLayer - The parcel vector layer
 * @returns Cleanup function to remove the interaction
 */
export async function addSchemeHoverInteraction(
  map: OLMap,
  parcelLayer: import('ol/layer/Vector').default,
): Promise<() => void> {
  const [
    { default: Style },
    { default: Stroke },
    { default: Fill },
  ] = await Promise.all([
    import('ol/style/Style'),
    import('ol/style/Stroke'),
    import('ol/style/Fill'),
  ])

  let hoveredFeature: OLFeature | null = null
  let originalStyle: unknown = null

  const highlightStyle = new Style({
    stroke: new Stroke({ color: '#D17B47', width: 3.5 }),
    fill: new Fill({ color: 'rgba(209, 123, 71, 0.18)' }),
  })

  let lastMoveTime = 0

  const onMouseMove = (evt: OLEvent) => {
    const target = map.getTarget()
    if (!target) return

    // Throttle: only process hover detection every 50ms to reduce CPU load
    // forEachFeatureAtPixel is expensive on large scheme datasets
    const now = Date.now()
    if (now - lastMoveTime < 50) return
    lastMoveTime = now

    const pixel = map.getEventPixel(evt.originalEvent ?? new Event('mousemove'))
    const hit = map.forEachFeatureAtPixel(
      pixel,
      (f: OLFeature, layer: OLLayer) => {
        if (layer === parcelLayer && f.get('type') === 'scheme-parcel') {
          return f
        }
        return undefined
      },
      { hitTolerance: 3 },
    )

    const viewport = map.getViewport()
    if (hit) {
      const hitFeature = hit as OLFeature
      viewport.style.cursor = 'pointer'
      if (hoveredFeature !== hitFeature) {
        // Restore previous
        if (hoveredFeature && originalStyle != null) {
          hoveredFeature.setStyle(originalStyle)
        }
        hoveredFeature = hitFeature
        originalStyle = hitFeature.getStyle() ?? null
        hitFeature.setStyle(highlightStyle)
      }
    } else {
      viewport.style.cursor = ''
      if (hoveredFeature && originalStyle != null) {
        hoveredFeature.setStyle(originalStyle)
      }
      hoveredFeature = null
      originalStyle = null
    }
  }

  const onMouseOut = () => {
    if (hoveredFeature && originalStyle != null) {
      hoveredFeature.setStyle(originalStyle)
    }
    hoveredFeature = null
    originalStyle = null
    const viewport = map.getViewport()
    if (viewport) viewport.style.cursor = ''
  }

  map.on('pointermove', onMouseMove)
  map.getViewport().addEventListener('mouseout', onMouseOut)

  // Return cleanup function
  return () => {
    map.un('pointermove', onMouseMove)
    map.getViewport()?.removeEventListener('mouseout', onMouseOut)
    if (hoveredFeature && originalStyle != null) {
      hoveredFeature.setStyle(originalStyle)
    }
  }
}

/**
 * Add a click interaction to scheme layers that shows a popup
 * with feature details.
 *
 * @param map - The OpenLayers map instance
 * @param layers - Object with parcel, block, and beacon layers
 * @param overlay - The popup overlay
 * @param popupElement - The popup container element
 * @param hidePopup - Function to hide the popup
 * @returns Cleanup function to remove the interaction
 */
export function addSchemeClickInteraction(
  map: OLMap,
  layers: {
    parcelLayer: import('ol/layer/Vector').default
    blockLayer: import('ol/layer/Vector').default
    beaconLayer: import('ol/layer/Vector').default
  },
  overlay: import('ol/Overlay').default,
  popupElement: HTMLDivElement,
  hidePopup: () => void,
): () => void {
  const onClick = (evt: OLEvent) => {
    // Check if we hit a scheme feature
    const feature = map.forEachFeatureAtPixel(
      evt.pixel,
      (f: OLFeature, layer: OLLayer) => {
        if (
          layer === layers.parcelLayer ||
          layer === layers.blockLayer ||
          layer === layers.beaconLayer
        ) {
          return { feature: f, layer }
        }
        return undefined
      },
      { hitTolerance: 5 },
    )

    if (!feature) return

    const { feature: f, layer } = feature as { feature: OLFeature; layer: OLLayer }
    const featureType = f.get('type')

    let popupType: 'parcel' | 'beacon' | 'block' = 'parcel'
    if (featureType === 'scheme-beacon') popupType = 'beacon'
    else if (featureType === 'scheme-block') popupType = 'block'
    else if (featureType === 'scheme-parcel') popupType = 'parcel'
    else return

    const properties: Record<string, unknown> = {}
    const keys = f.getKeys()
    for (const key of keys) {
      if (key !== 'geometry' && key !== 'type') {
        properties[key] = f.get(key)
      }
    }

    renderSchemePopup(popupElement, popupType, properties, hidePopup)
    overlay.setPosition(evt.coordinate)
  }

  map.on('singleclick', onClick)

  return () => {
    map.un('singleclick', onClick)
  }
}

// ─── Auto-zoom ────────────────────────────────────────────────────────────

/**
 * Zoom the map to fit the scheme data extent.
 *
 * @param map - The OpenLayers map instance
 * @param extent - The extent in EPSG:3857 coordinates, or null to skip
 * @param padding - Padding around the extent (default: [80, 80, 80, 80])
 */
export async function zoomToSchemeExtent(
  map: OLMap,
  extent: number[] | null,
  padding: [number, number, number, number] = [80, 80, 80, 80],
): Promise<void> {
  if (!extent || extent[0] === Infinity || extent[2] === -Infinity) return

  map.getView().fit(extent, {
    padding,
    maxZoom: 18,
    duration: 800,
  })
}

// ─── Data-Driven Layer Builders (single fetch, shared data) ────────────────

/**
 * Build a parcel layer from pre-fetched scheme data.
 * This avoids redundant API calls when all layers share the same data.
 */
async function buildParcelLayerFromData(
  data: SchemeGeoJSON,
  options: { showParcelLabels?: boolean; epsg?: string } = {},
): Promise<import('ol/layer/Vector').default> {
  const { showParcelLabels = true, epsg = 'EPSG:21037' } = options

  const [
    { default: VectorLayer },
    { default: VectorSource },
    { default: Feature },
    { default: Polygon },
  ] = await Promise.all([
    import('ol/layer/Vector'),
    import('ol/source/Vector'),
    import('ol/Feature'),
    import('ol/geom/Polygon'),
  ])

  const parcelStyleFn = await createParcelStyleFunction({
    showLabel: showParcelLabels,
    strokeWidth: 2.5,
    zIndex: 20,
  })

  const features: InstanceType<typeof Feature>[] = []

  for (const feat of data.features) {
    if (feat.properties.type !== 'parcel') continue
    if (feat.geometry.type !== 'Polygon') continue

    const rings = feat.geometry.coordinates as unknown as number[][][]
    const transformedRings: Array<Array<[number, number]>> = []

    for (const ring of rings) {
      const transformedRing = await transformRing(ring, epsg)
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

  return new VectorLayer({
    source,
    style: parcelStyleFn as unknown as undefined,
    zIndex: 20,
    visible: true,
    properties: { name: 'scheme-parcels' },
  })
}

/**
 * Build a block layer from pre-fetched scheme data.
 */
async function buildBlockLayerFromData(
  data: SchemeGeoJSON,
  epsg: string = 'EPSG:21037',
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
  ])

  const features: InstanceType<typeof Feature>[] = []

  for (const feat of data.features) {
    if (feat.properties.type !== 'block_label') continue
    if (feat.geometry.type !== 'Point') continue

    const coord = feat.geometry.coordinates as number[]
    const [x, y] = await transformCoord(coord, epsg)

    const olFeature = new Feature({
      geometry: new Point([x, y]),
      type: 'scheme-block',
      blockId: feat.properties.block_id,
      blockNumber: feat.properties.block_number,
      blockName: feat.properties.block_name,
      parcelCount: feat.properties.parcel_count,
    })

    const labelText = feat.properties.block_name || `Block ${feat.properties.block_number}`
    const countLabel = feat.properties.parcel_count
      ? `${feat.properties.parcel_count} parcels`
      : ''

    olFeature.setStyle(new Style({
      image: new CircleStyle({
        radius: 10,
        fill: new Fill({ color: 'rgba(209, 123, 71, 0.25)' }),
        stroke: new Stroke({ color: '#D17B47', width: 2 }),
      }),
      text: new Text({
        text: countLabel ? `${labelText}\n${countLabel}` : labelText,
        font: 'bold 12px Calibri, sans-serif',
        fill: new Fill({ color: '#D17B47' }),
        stroke: new Stroke({ color: '#FFFFFF', width: 3.5 }),
        textAlign: 'center',
        textBaseline: 'middle',
        offsetY: -20,
      }),
    }))

    features.push(olFeature)
  }

  const source = new VectorSource({ features })

  return new VectorLayer({
    source,
    zIndex: 25,
    visible: true,
    properties: { name: 'scheme-blocks' },
  })
}

/**
 * Build a beacon layer from pre-fetched scheme data.
 */
async function buildBeaconLayerFromData(
  data: SchemeGeoJSON,
  epsg: string = 'EPSG:21037',
): Promise<import('ol/layer/Vector').default> {
  const [
    { default: VectorLayer },
    { default: VectorSource },
    { default: Feature },
    { default: Point },
  ] = await Promise.all([
    import('ol/layer/Vector'),
    import('ol/source/Vector'),
    import('ol/Feature'),
    import('ol/geom/Point'),
  ])

  const beaconStyleFn = await createBeaconStyleFunction({
    radius: 6,
    showDescription: false,
    labelOffsetX: 12,
    labelOffsetY: -12,
  })

  const features: InstanceType<typeof Feature>[] = []
  const seenStations = new Set<string>()

  for (const feat of data.features) {
    if (feat.properties.type !== 'parcel_point') continue
    if (feat.geometry.type !== 'Point') continue

    const stationKey = feat.properties.station || `${(feat.geometry.coordinates as number[])[0]}_${(feat.geometry.coordinates as number[])[1]}`
    if (seenStations.has(stationKey)) continue
    seenStations.add(stationKey)

    const coord = feat.geometry.coordinates as number[]
    const [x, y] = await transformCoord(coord, epsg)

    const olFeature = new Feature({
      geometry: new Point([x, y]),
      type: 'scheme-beacon',
      beacon_type: 'boundary' as BeaconType,
      label: feat.properties.station || `Stn ${features.length + 1}`,
      parcelId: feat.properties.parcel_id,
      parcelNumber: feat.properties.parcel_number,
      blockNumber: feat.properties.block_number,
    })

    // Store original EPSG:21037 coordinates for vertex editing / COGO
    olFeature.set('easting', coord[0])
    olFeature.set('northing', coord[1])

    features.push(olFeature)
  }

  const source = new VectorSource({ features })

  return new VectorLayer({
    source,
    style: beaconStyleFn as unknown as undefined,
    zIndex: 30,
    visible: true,
    properties: { name: 'scheme-beacons' },
  })
}

// ─── Convenience: Create All Scheme Layers ────────────────────────────────

/**
 * Create all scheme layers (parcels, blocks, beacons) and set up
 * interactions in one call.
 *
 * This is the main entry point for wiring scheme data to the map.
 * Data is fetched ONCE and shared across all three layers, avoiding
 * the triple API call that would occur if creating layers individually.
 *
 * @param projectId - The project ID
 * @param map - The OpenLayers map instance
 * @param options - Configuration options
 * @returns Object with all layers, interaction cleanup functions, and metadata
 */
export async function createSchemeLayers(
  projectId: string,
  map: OLMap,
  options: SchemeLayerOptions = {},
): Promise<{
  parcelLayer: import('ol/layer/Vector').default
  blockLayer: import('ol/layer/Vector').default
  beaconLayer: import('ol/layer/Vector').default
  popup: { overlay: import('ol/Overlay').default; popupElement: HTMLDivElement; hidePopup: () => void }
  cleanup: () => void
  parcelCount: number
  blockCount: number
  beaconCount: number
  extent: number[] | null
}> {
  const { autoZoom = true, showParcelLabels = true, epsg = 'EPSG:21037' } = options

  // Ensure projections are registered
  await registerProjections()

  // Fetch data ONCE and share across all layers (prevents triple API call)
  const data = await loadSchemeData(projectId)

  // Create all three layers using the shared data
  const [parcelLayer, blockLayer, beaconLayer] = await Promise.all([
    buildParcelLayerFromData(data, { showParcelLabels, epsg }),
    buildBlockLayerFromData(data, epsg),
    buildBeaconLayerFromData(data, epsg),
  ])

  // Add layers to map
  map.addLayer(parcelLayer as unknown as OLLayer)
  map.addLayer(blockLayer as unknown as OLLayer)
  map.addLayer(beaconLayer as unknown as OLLayer)

  // Create popup overlay
  const popup = await createSchemePopup()
  map.addOverlay(popup.overlay as unknown as OLOverlay)

  // Add interactions
  const removeHover = await addSchemeHoverInteraction(map, parcelLayer)
  const removeClick = addSchemeClickInteraction(
    map,
    { parcelLayer, blockLayer, beaconLayer },
    popup.overlay,
    popup.popupElement,
    popup.hidePopup,
  )

  // Compute counts
  const parcelSource = parcelLayer.getSource()
  const blockSource = blockLayer.getSource()
  const beaconSource = beaconLayer.getSource()

  const parcelCount = parcelSource?.getFeatures().length ?? 0
  const blockCount = blockSource?.getFeatures().length ?? 0
  const beaconCount = beaconSource?.getFeatures().length ?? 0

  // Compute combined extent from all layers
  let extent: number[] | null = null
  try {
    const parcelExtent = parcelSource?.getExtent()
    if (parcelExtent && parcelExtent[0] !== Infinity) {
      extent = [...parcelExtent]
    }
  } catch { /* ignore */ }

  // Auto-zoom
  if (autoZoom && extent) {
    await zoomToSchemeExtent(map, extent)
  }

  // Cleanup function
  const cleanup = () => {
    removeHover()
    removeClick()
    map.removeLayer(parcelLayer as unknown as OLLayer)
    map.removeLayer(blockLayer as unknown as OLLayer)
    map.removeLayer(beaconLayer as unknown as OLLayer)
    map.removeOverlay(popup.overlay)
  }

  return {
    parcelLayer,
    blockLayer,
    beaconLayer,
    popup,
    cleanup,
    parcelCount,
    blockCount,
    beaconCount,
    extent,
  }
}
