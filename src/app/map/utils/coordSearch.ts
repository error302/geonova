import type { MutableRefObject } from 'react'
import type Map from 'ol/Map'

/**
 * Navigates the map to coordinates parsed from a search string.
 *
 * Accepts formats:
 *  - Lat/Lon decimal (e.g. "-1.0, 37.0" or "-1.0 37.0")
 *  - DMS format (e.g. "1°15'30"S 37°45'20"E" or "1 15 30 S 37 45 20 E")
 *  - UTM Easting/Northing in EPSG:21037 (large numbers, e.g. "500000 9800000")
 *  - Beacon names (e.g. "Beacon 5" or "BM12")
 *  - Parcel numbers (e.g. "LR12345" or "Parcel 5")
 *
 * Note: The caller is responsible for clearing the search input after
 * this resolves, since the setter lives in component state.
 */

interface DMSResult {
  decimal: number
  hemisphere: string
}

/** Feature properties consulted by searchFeatureOnMap. */
interface SearchableFeatureProps {
  label?: unknown
  name?: unknown
  beacon_name?: unknown
  stationName?: unknown
  parcelNumber?: unknown
  parcel_number?: unknown
  parcelNo?: unknown
}

/**
 * Parse a single DMS (Degrees, Minutes, Seconds) string.
 * Examples:
 *   "1°15'30"S" → { decimal: -1.258333, hemisphere: 'S' }
 *   "37°45'20"E" → { decimal: 37.755556, hemisphere: 'E' }
 *   "1 15 30" → { decimal: 1.258333, hemisphere: '' }
 */
function parseDMS(dmsStr: string): DMSResult | null {
  // Pattern: degrees°minutes'seconds"hemisphere (or variations)
  // Handles: 1°15'30"S, 1° 15' 30" S, 1 15 30 S, S1°15'30"
  const dmsRegex = /([NSEW])?\s*(\d+(?:\.\d+)?)\s*[°\s]\s*(\d+(?:\.\d+)?)\s*['′\s]\s*(\d+(?:\.\d+)?)\s*["″]?\s*([NSEW])?/i
  const match = dmsStr.trim().match(dmsRegex)

  if (!match) return null

  const prefixHem = (match[1] || '').toUpperCase()
  const degrees = parseFloat(match[2])
  const minutes = parseFloat(match[3])
  const seconds = parseFloat(match[4])
  const suffixHem = (match[5] || '').toUpperCase()

  if (isNaN(degrees) || isNaN(minutes) || isNaN(seconds)) return null
  if (degrees < 0 || degrees > 180 || minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60) return null

  const hemisphere = suffixHem || prefixHem
  let decimal = degrees + minutes / 60 + seconds / 3600

  if (hemisphere === 'S' || hemisphere === 'W') decimal = -decimal

  return { decimal, hemisphere }
}

/**
 * Try to parse a full coordinate string as DMS.
 * Supports patterns like:
 *   "1°15'30"S 37°45'20"E"
 *   "S1°15'30" E37°45'20""
 *   "1 15 30 S 37 45 20 E"
 *   "1°15'30" 37°45'20"" (assumes Kenya: S lat, E lon)
 */
function tryParseDMS(input: string): { lat: number; lon: number } | null {
  // Try splitting by comma or whitespace between two DMS groups
  // Pattern: two DMS groups separated by comma or space

  // First, try comma-separated
  const commaParts = input.split(',').map(s => s.trim()).filter(Boolean)
  if (commaParts.length === 2) {
    const lat = parseDMS(commaParts[0])
    const lon = parseDMS(commaParts[1])
    if (lat && lon) {
      let latVal = lat.decimal
      let lonVal = lon.decimal
      // Kenya default: if no hemisphere specified, assume S for lat, E for lon
      if (!lat.hemisphere && latVal > 0) latVal = -latVal
      if (!lon.hemisphere && lonVal < 0) lonVal = Math.abs(lonVal)
      return { lat: latVal, lon: lonVal }
    }
  }

  // Try space-separated with hemisphere indicators
  // e.g. "1°15'30"S 37°45'20"E"
  const spaceParts = input.trim().split(/\s+/)

  // Try to find two DMS groups
  // Strategy: try different split points
  for (let splitAt = 1; splitAt < spaceParts.length; splitAt++) {
    const leftStr = spaceParts.slice(0, splitAt).join(' ')
    const rightStr = spaceParts.slice(splitAt).join(' ')
    const lat = parseDMS(leftStr)
    const lon = parseDMS(rightStr)
    if (lat && lon) {
      let latVal = lat.decimal
      let lonVal = lon.decimal
      if (!lat.hemisphere && latVal > 0) latVal = -latVal
      if (!lon.hemisphere && lonVal < 0) lonVal = Math.abs(lonVal)
      return { lat: latVal, lon: lonVal }
    }
  }

  // Try the whole string as two DMS groups without spaces between them
  // This handles "S1°15'30"E37°45'20"
  const twoGroupsRegex = /([NSEW])?\s*(\d+)\s*[°]\s*(\d+)\s*['′]\s*(\d+(?:\.\d+)?)\s*["″]?\s*([NSEW])?\s*([NSEW])?\s*(\d+)\s*[°]\s*(\d+)\s*['′]\s*(\d+(?:\.\d+)?)\s*["″]?\s*([NSEW])?/i
  const twoMatch = input.match(twoGroupsRegex)
  if (twoMatch) {
    const lat = parseDMS(`${twoMatch[1] || ''}${twoMatch[2]}°${twoMatch[3]}'${twoMatch[4]}"${twoMatch[5] || ''}`)
    const lon = parseDMS(`${twoMatch[6] || ''}${twoMatch[7]}°${twoMatch[8]}'${twoMatch[9]}"${twoMatch[10] || ''}`)
    if (lat && lon) {
      let latVal = lat.decimal
      let lonVal = lon.decimal
      if (!lat.hemisphere && latVal > 0) latVal = -latVal
      if (!lon.hemisphere && lonVal < 0) lonVal = Math.abs(lonVal)
      return { lat: latVal, lon: lonVal }
    }
  }

  return null
}

/**
 * Flash a feature on the map by briefly toggling its style.
 * Creates a highlight overlay that fades after a short duration.
 */
async function flashFeature(
  mapInstance: MutableRefObject<Map | null>,
  feature: import('ol/Feature').default,
): Promise<void> {
  try {
    const [{ default: Style }, { default: Stroke }, { default: Fill }, { default: CircleStyle }] =
      await Promise.all([
        import('ol/style/Style'),
        import('ol/style/Stroke'),
        import('ol/style/Fill'),
        import('ol/style/Circle'),
      ])

    const originalStyle = feature.getStyle() as import('ol/style/Style').StyleLike | null | undefined
    const flashStyle = new Style({
      stroke: new Stroke({ color: '#D17B47', width: 4 }),
      fill: new Fill({ color: 'rgba(209, 123, 71, 0.3)' }),
      image: new CircleStyle({
        radius: 12,
        fill: new Fill({ color: 'rgba(209, 123, 71, 0.5)' }),
        stroke: new Stroke({ color: '#D17B47', width: 3 }),
      }),
    })

    feature.setStyle(flashStyle)
    setTimeout(() => {
      feature.setStyle((originalStyle as import('ol/style/Style').StyleLike) ?? undefined)
    }, 1500)
  } catch {
    // Flash is best-effort
  }
}

/**
 * Search all VectorLayer sources on the map for a feature whose label/name/number
 * matches the given search term.
 */
async function searchFeatureOnMap(
  mapInstance: MutableRefObject<Map | null>,
  searchTerm: string,
  options: { parcelOnly?: boolean; beaconOnly?: boolean } = {},
): Promise<import('ol/Feature').default | null> {
  if (!mapInstance.current) return null
  const map = mapInstance.current

  const { default: VectorLayer } = await import('ol/layer/Vector')
  const layers = map.getLayers().getArray()
  const term = searchTerm.toLowerCase().trim()

  for (const layer of layers) {
    if (!(layer instanceof VectorLayer)) continue
    const source = (layer as import('ol/layer/Vector').default)
      .getSource() as import('ol/source/Vector').default | null
    if (!source || typeof source.getFeatures !== 'function') continue

    const features = source.getFeatures()
    for (const feature of features) {
      // Check various feature properties for a match
      const props = (feature.getProperties() || {}) as SearchableFeatureProps
      const label = String(props.label || props.name || props.beacon_name || props.stationName || '')
        .toLowerCase()
      const parcelNumber = String(props.parcelNumber || props.parcel_number || props.parcelNo || '')
        .toLowerCase()

      if (options.beaconOnly) {
        // Match beacon-like names: "Beacon 5", "BM12", etc.
        if (label && (label === term || label.includes(term))) {
          return feature
        }
      } else if (options.parcelOnly) {
        // Match parcel numbers: "LR12345", "Parcel 5", etc.
        if (
          parcelNumber &&
          (parcelNumber === term || parcelNumber.includes(term) || term.includes(parcelNumber))
        ) {
          return feature
        }
        if (label && (label === term || label.includes(term))) {
          return feature
        }
      }
    }
  }

  return null
}

/**
 * Check if the search term looks like a beacon name (e.g. "Beacon 5", "BM12").
 */
function looksLikeBeaconName(input: string): boolean {
  const t = input.trim()
  return /^(beacon|bm|b)\s*\d+/i.test(t) || /^bm\d+/i.test(t)
}

/**
 * Check if the search term looks like a parcel number (e.g. "LR12345", "Parcel 5").
 */
function looksLikeParcelNumber(input: string): boolean {
  const t = input.trim()
  return /^(parcel|lot|lr|plot)\s*\d+/i.test(t) || /^lr\d+/i.test(t)
}

export async function handleCoordSearch(
  searchInput: string,
  mapInstance: MutableRefObject<Map | null>,
  epsg: string = 'EPSG:21037',
): Promise<void> {
  if (!mapInstance.current || !searchInput.trim()) return
  const map = mapInstance.current

  // ── Try beacon name search ──
  if (looksLikeBeaconName(searchInput)) {
    const feature = await searchFeatureOnMap(mapInstance, searchInput, { beaconOnly: true })
    if (feature) {
      const geom = feature.getGeometry()
      if (geom) {
        const coord = geom.getType() === 'Point'
          ? (geom as import('ol/geom/SimpleGeometry').default).getCoordinates() ?? [0, 0]
          : geom.getClosestPoint(map.getView().getCenter() ?? [0, 0])
        map.getView().animate({ center: coord, zoom: 18, duration: 600 })
        flashFeature(mapInstance, feature)
        return
      }
    }
  }

  // ── Try parcel number search ──
  if (looksLikeParcelNumber(searchInput)) {
    const feature = await searchFeatureOnMap(mapInstance, searchInput, { parcelOnly: true })
    if (feature) {
      const geom = feature.getGeometry()
      if (geom) {
        const extent = geom.getExtent()
        if (extent && extent[0] !== Infinity) {
          map.getView().fit(extent, { padding: [100, 100, 100, 100], maxZoom: 18, duration: 600 })
        }
        flashFeature(mapInstance, feature)
        return
      }
    }
  }

  // ── Try DMS format ──
  const dmsResult = tryParseDMS(searchInput)
  if (dmsResult) {
    const { fromLonLat } = await import('ol/proj')
    const center = fromLonLat([dmsResult.lon, dmsResult.lat])
    map.getView().animate({ center, zoom: 16, duration: 600 })
    return
  }

  // ── Try decimal lat/lon or UTM ──
  const parts = searchInput.trim().split(/[,\s]+/).map(Number).filter(n => !isNaN(n))

  if (parts.length >= 2) {
    let lon = parts[1]
    let lat = parts[0]

    // If values look like Eastings/Northings (large numbers), treat differently
    if (Math.abs(parts[0]) > 100 && Math.abs(parts[1]) > 100) {
      // Likely UTM coordinates - try to transform from the active UTM zone
      try {
        const { transform } = await import('ol/proj')
        const [x, y] = transform([parts[0], parts[1]], epsg, 'EPSG:3857')
        map.getView().animate({ center: [x, y], zoom: 16, duration: 600 })
      } catch { /* fallback */ }
    } else {
      if (lon > lat) { [lon, lat] = [lat, lon] } // common swap
      const { fromLonLat } = await import('ol/proj')
      const center = fromLonLat([lon, lat])
      map.getView().animate({ center, zoom: 16, duration: 600 })
    }
  }
}
