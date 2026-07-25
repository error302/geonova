/**
 * OSM Service — TypeScript client for Python worker OSM endpoints
 *
 * Wraps the Python worker's OSM endpoints with typed responses and
 * graceful fallbacks when the worker or PBF file is unavailable.
 *
 * Three capabilities:
 *   1. getOsmFeatures() — Pyrosm local PBF parsing (buildings, roads, POIs by bbox)
 *   2. streamExtract() — Pyosmium streaming extract (memory-efficient)
 *   3. getNearbyFeatures() / autoAbuttals() — OSMPythonTools Overpass queries
 */

const PYTHON_WORKER_URL = process.env.PYTHON_WORKER_URL || 'http://localhost:8001'
const NEXT_API_BASE = typeof window === 'undefined' ? '' : ''

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OsmFeatureCollection {
  type: 'FeatureCollection'
  features: OsmFeature[]
}

export interface OsmFeature {
  type: 'Feature'
  geometry: {
    type: 'Point' | 'LineString' | 'Polygon' | 'MultiPolygon'
    coordinates: number[] | number[][] | number[][][]
  }
  properties: Record<string, unknown>
}

export interface OsmFeaturesResult {
  success: boolean
  bbox: { minlon: number; minlat: number; maxlon: number; maxlat: number }
  counts: Record<string, number>
  features: {
    buildings?: OsmFeatureCollection
    roads?: OsmFeatureCollection
    pois?: OsmFeatureCollection
    natural?: OsmFeatureCollection
  }
  pbf_loaded: boolean
}

export interface OsmStatus {
  pyrosm_installed: boolean
  pbf_file_found: boolean
  pbf_path: string | null
  pbf_loaded: boolean
  pbf_size_mb: number | null
  setup_instructions?: string
}

export interface NearbyFeature {
  name: string
  type: string
  distance_m: number
  direction: string
  osm_id: number
}

export interface NearbyFeaturesResult {
  lat: number
  lon: number
  radius: number
  osm_tools_available: boolean
  roads?: NearbyFeature[]
  schools?: NearbyFeature[]
  health?: NearbyFeature[]
  water?: NearbyFeature[]
  boundaries?: NearbyFeature[]
}

export interface AutoAbuttalsResult {
  north: string
  south: string
  east: string
  west: string
}

export interface StreamExtractResult {
  success: boolean
  output_path: string
  total_features: number
  buildings: number
  roads: number
  pois: number
}

// ─── Worker Secret ──────────────────────────────────────────────────────────

const WORKER_SECRET = process.env.WORKER_SECRET || ''  // P0-5: fail-closed, no dev fallback

function workerHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Worker-Secret': WORKER_SECRET,
  }
}

// ─── 1. Pyrosm: Local PBF Feature Server ───────────────────────────────────

/**
 * Get OSM features (buildings, roads, POIs) within a bounding box from
 * the local PBF extract.
 *
 * Requires:
 *   - Python worker running with Pyrosm installed
 *   - Kenya PBF file at data/kenya-latest.osm.pbf
 *
 * @param bbox - Bounding box {minlon, minlat, maxlon, maxlat} in WGS84
 * @param types - Feature types to fetch (default: buildings, roads, pois)
 */
export async function getOsmFeatures(
  bbox: { minlon: number; minlat: number; maxlon: number; maxlat: number },
  types: Array<'buildings' | 'roads' | 'pois' | 'natural'> = ['buildings', 'roads', 'pois'],
): Promise<OsmFeaturesResult | null> {
  try {
    const params = new URLSearchParams({
      minlon: String(bbox.minlon),
      minlat: String(bbox.minlat),
      maxlon: String(bbox.maxlon),
      maxlat: String(bbox.maxlat),
      types: types.join(','),
    })
    const res = await fetch(`${PYTHON_WORKER_URL}/osm/features?${params}`, {
      headers: workerHeaders(),
    })
    if (!res.ok) {
      console.warn(`[osm] Feature fetch failed: ${res.status}`)
      return null
    }
    return await res.json() as OsmFeaturesResult
  } catch (err) {
    console.warn('[osm] Worker unavailable — features disabled:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Check if the OSM PBF is loaded and the worker is ready.
 */
export async function getOsmStatus(): Promise<OsmStatus | null> {
  try {
    const res = await fetch(`${PYTHON_WORKER_URL}/osm/status`, {
      headers: workerHeaders(),
    })
    if (!res.ok) return null
    return await res.json() as OsmStatus
  } catch {
    return null
  }
}

// ─── 2. Pyosmium: Streaming Extract ────────────────────────────────────────

/**
 * Stream-extract features from the PBF file to a GeoJSON file on disk.
 *
 * Memory-efficient: processes the PBF node-by-node without loading
 * the whole file into RAM.
 *
 * @param outputPath - Where to write the output GeoJSON
 * @param bbox - Optional bounding box [minlon, minlat, maxlon, maxlat]
 * @param filters - What to extract: { buildings: true, roads: [...], pois: [...] }
 */
export async function streamExtract(
  outputPath: string,
  bbox?: [number, number, number, number],
  filters?: {
    buildings?: boolean
    roads?: string[] | true
    pois?: string[] | true
  },
): Promise<StreamExtractResult | null> {
  try {
    const res = await fetch(`${PYTHON_WORKER_URL}/osm/stream-extract`, {
      method: 'POST',
      headers: workerHeaders(),
      body: JSON.stringify({ output_path: outputPath, bbox, filters }),
    })
    if (!res.ok) {
      console.warn(`[osm] Stream extract failed: ${res.status}`)
      return null
    }
    return await res.json() as StreamExtractResult
  } catch (err) {
    console.warn('[osm] Stream extract unavailable:', err instanceof Error ? err.message : err)
    return null
  }
}

// ─── 3. OSMPythonTools: Overpass Queries for Deed Plans ─────────────────────

/**
 * Find named OSM features near a point using the Overpass API.
 *
 * Returns roads, schools, health facilities, water bodies, and
 * administrative boundaries within the specified radius.
 *
 * Used for auto-populating deed plan abuttals and survey descriptions.
 *
 * @param lat - Latitude (WGS84)
 * @param lon - Longitude (WGS84)
 * @param radius - Search radius in meters (default 500m)
 * @param featureTypes - What to search for
 */
export async function getNearbyFeatures(
  lat: number,
  lon: number,
  radius: number = 500,
  featureTypes: Array<'roads' | 'schools' | 'health' | 'water' | 'boundaries'> = ['roads', 'schools', 'health', 'water', 'boundaries'],
): Promise<NearbyFeaturesResult | null> {
  try {
    const res = await fetch(`${PYTHON_WORKER_URL}/osm/nearby-features`, {
      method: 'POST',
      headers: workerHeaders(),
      body: JSON.stringify({ lat, lon, radius, feature_types: featureTypes }),
    })
    if (!res.ok) {
      console.warn(`[osm] Nearby features fetch failed: ${res.status}`)
      return null
    }
    return await res.json() as NearbyFeaturesResult
  } catch (err) {
    console.warn('[osm] Overpass unavailable:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Auto-populate deed plan abuttals (N/S/E/W) based on nearby OSM features.
 *
 * Returns a dict with north/south/east/west descriptions ready to paste
 * into a deed plan. Uses the closest road or natural feature in each
 * direction.
 *
 * @param lat - Latitude of the parcel centroid (WGS84)
 * @param lon - Longitude of the parcel centroid (WGS84)
 * @param radius - Search radius in meters (default 200m)
 */
export async function autoAbuttals(
  lat: number,
  lon: number,
  radius: number = 200,
): Promise<AutoAbuttalsResult | null> {
  try {
    const res = await fetch(`${PYTHON_WORKER_URL}/osm/auto-abuttals`, {
      method: 'POST',
      headers: workerHeaders(),
      body: JSON.stringify({ lat, lon, radius }),
    })
    if (!res.ok) {
      console.warn(`[osm] Auto-abuttals failed: ${res.status}`)
      return null
    }
    return await res.json() as AutoAbuttalsResult
  } catch (err) {
    console.warn('[osm] Auto-abuttals unavailable:', err instanceof Error ? err.message : err)
    return null
  }
}

// ─── Next.js API Proxy (for client-side calls without worker secret) ────────

/**
 * Client-side proxy for getting OSM features via the Next.js API.
 * Use this from browser code (doesn't expose the worker secret).
 */
export async function getOsmFeaturesViaApi(
  bbox: { minlon: number; minlat: number; maxlon: number; maxlat: number },
  types: Array<'buildings' | 'roads' | 'pois' | 'natural'> = ['buildings', 'roads', 'pois'],
): Promise<OsmFeaturesResult | null> {
  try {
    const params = new URLSearchParams({
      minlon: String(bbox.minlon),
      minlat: String(bbox.minlat),
      maxlon: String(bbox.maxlon),
      maxlat: String(bbox.maxlat),
      types: types.join(','),
    })
    const res = await fetch(`${NEXT_API_BASE}/api/osm/features?${params}`)
    if (!res.ok) return null
    return await res.json() as OsmFeaturesResult
  } catch {
    return null
  }
}

/**
 * Client-side proxy for getting nearby features via the Next.js API.
 */
export async function getNearbyFeaturesViaApi(
  lat: number,
  lon: number,
  radius: number = 500,
  featureTypes: Array<'roads' | 'schools' | 'health' | 'water' | 'boundaries'> = ['roads', 'schools', 'health', 'water', 'boundaries'],
): Promise<NearbyFeaturesResult | null> {
  try {
    const res = await fetch(`${NEXT_API_BASE}/api/osm/nearby-features`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lon, radius, feature_types: featureTypes }),
    })
    if (!res.ok) return null
    return await res.json() as NearbyFeaturesResult
  } catch {
    return null
  }
}

/**
 * Client-side proxy for auto-abuttals via the Next.js API.
 */
export async function autoAbuttalsViaApi(
  lat: number,
  lon: number,
  radius: number = 200,
): Promise<AutoAbuttalsResult | null> {
  try {
    const res = await fetch(`${NEXT_API_BASE}/api/osm/auto-abuttals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lon, radius }),
    })
    if (!res.ok) return null
    return await res.json() as AutoAbuttalsResult
  } catch {
    return null
  }
}
