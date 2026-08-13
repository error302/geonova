/**
 * METARDU Web Worker — Survey Data Computation Engine
 * ====================================================
 * Runs heavy computation off the main thread to prevent UI freezing.
 * Handles: CSV parsing, coordinate transformations, bulk operations.
 *
 * Communication protocol:
 *   Main → Worker: { type: string, payload: any, id: string }
 *   Worker → Main: { type: string, payload: any, id: string, error?: string }
 */

// ─── Message Types ────────────────────────────────────────────────────────

export type WorkerRequestType =
  | 'PARSE_CSV_POINTS'
  | 'PARSE_CSV_OBSERVATIONS'
  | 'PARSE_CSV_LEVELING'
  | 'TRANSFORM_COORDINATES'
  | 'COMPUTE_BEARING_DISTANCE'
  | 'COMPUTE_AREA'
  | 'COMPUTE_TRAVERSE_ADJUSTMENT'
  | 'COMPUTE_LEVEL_NETWORK'
  | 'VALIDATE_FIELD_BOOK'
  | 'GENERATE_IDW_GRID'
  | 'PING'

export type WorkerResponseType =
  | 'PARSE_COMPLETE'
  | 'TRANSFORM_COMPLETE'
  | 'COMPUTE_COMPLETE'
  | 'VALIDATION_COMPLETE'
  | 'PROGRESS'
  | 'PONG'
  | 'ERROR'

export interface WorkerMessage<T = unknown> {
  type: WorkerRequestType | WorkerResponseType
  payload: T
  id: string
}

// ─── Coordinate Transform Implementation ─────────────────────────────────
// Simple Transverse Mercator / UTM inverse and forward using proj4 formulas
// For production, we use the actual proj4 library, but in the worker we
// implement a lightweight version to avoid module loading issues.

const PI = Math.PI
const DEG2RAD = PI / 180
const RAD2DEG = 180 / PI

interface CoordTransformParams {
  fromEpsg: number
  toEpsg: number
  coordinates: Array<{ latitude: number; longitude: number } | { northing: number; easting: number }>
}

/**
 * WGS84 to Arc1960 / UTM Zone 37S approximation
 * Uses simplified transformation parameters for Kenya
 */
export function wgs84ToArc1960UTM37S(lat: number, lng: number): { northing: number; easting: number } {
  // UTM Zone 37S parameters
  const a = 6378137.0       // WGS84 semi-major axis
  const f = 1 / 298.257223563
  const e2 = 2 * f - f * f
  const ePrime2 = e2 / (1 - e2)
  const k0 = 0.9996
  const lon0 = 39 * DEG2RAD // Central meridian Zone 37
  const N0 = 10000000       // False northing (southern hemisphere)

  const latRad = lat * DEG2RAD
  const lngRad = lng * DEG2RAD

  const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) * Math.sin(latRad))
  const T = Math.tan(latRad) * Math.tan(latRad)
  const C = ePrime2 * Math.cos(latRad) * Math.cos(latRad)
  const A = Math.cos(latRad) * (lngRad - lon0)
  const M = a * (
    (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256) * latRad
    - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * e2 * e2 * e2 / 1024) * Math.sin(2 * latRad)
    + (15 * e2 * e2 / 256 + 45 * e2 * e2 * e2 / 1024) * Math.sin(4 * latRad)
    - (35 * e2 * e2 * e2 / 3072) * Math.sin(6 * latRad)
  )

  const easting = k0 * N * (A + (1 - T + C) * A * A * A / 6
    + (5 - 18 * T + T * T + 72 * C - 58 * ePrime2) * A * A * A * A * A / 120) + 500000

  const northing = k0 * (M + N * Math.tan(latRad) * (
    A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A * A * A * A / 24
    + (61 - 58 * T + T * T + 600 * C - 330 * ePrime2) * A * A * A * A * A * A / 720
  )) + N0

  return { northing: Math.round(northing * 100) / 100, easting: Math.round(easting * 100) / 100 }
}

/**
 * Arc1960 / UTM Zone 37S to WGS84 inverse transformation
 */
function arc1960UTM37SToWGS84(northing: number, easting: number): { lat: number; lng: number } {
  const a = 6378137.0
  const f = 1 / 298.257223563
  const e2 = 2 * f - f * f
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2))
  const k0 = 0.9996
  const lon0 = 39 * DEG2RAD
  const N0 = 10000000
  const E0 = 500000

  const M = (northing - N0) / k0
  const mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256))

  const phi1 = mu + (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32) * Math.sin(2 * mu)
    + (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32) * Math.sin(4 * mu)
    + (151 * e1 * e1 * e1 / 96) * Math.sin(6 * mu)

  const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) * Math.sin(phi1))
  const T1 = Math.tan(phi1) * Math.tan(phi1)
  const C1 = (e2 / (1 - e2)) * Math.cos(phi1) * Math.cos(phi1)
  const R1 = a * (1 - e2) / Math.pow(1 - e2 * Math.sin(phi1) * Math.sin(phi1), 1.5)
  const D = (easting - E0) / (N1 * k0)

  const lat = phi1 - (N1 * Math.tan(phi1) / R1) * (
    D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * e2) * D * D * D * D / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * e2 - 3 * C1 * C1) * D * D * D * D * D * D / 720
  )

  const lng = lon0 + (
    D - (1 + 2 * T1 + C1) * D * D * D / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * e2 + 24 * T1 * T1) * D * D * D * D * D / 120
  ) / Math.cos(phi1)

  return {
    lat: Math.round(lat * RAD2DEG * 10000000) / 10000000,
    lng: Math.round(lng * RAD2DEG * 10000000) / 10000000
  }
}

// ─── CSV Parsing ─────────────────────────────────────────────────────────

interface CSVPoint {
  pointName: string
  northing: number
  easting: number
  elevation: number | null
  code: string
  latitude: number
  longitude: number
}

export function parseCSVPoints(csvText: string, delimiter = ','): CSVPoint[] {
  const lines = csvText.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const headers = lines[0].toLowerCase().split(delimiter).map(h => h.trim().replace(/"/g, ''))
  const points: CSVPoint[] = []

  // Column detection
  const colMap: Record<string, number> = {}
  const aliasMap: Record<string, string[]> = {
    pointName: ['point', 'name', 'point_name', 'station', 'id', 'pt'],
    northing: ['north', 'northing', 'y', 'n', 'lat_north', 'n_coord'],
    easting: ['east', 'easting', 'x', 'e', 'lng_east', 'e_coord'],
    elevation: ['elev', 'elevation', 'rl', 'z', 'height', 'level', 'h'],
    code: ['code', 'type', 'beacon', 'mark', 'description'],
    latitude: ['lat', 'latitude', 'φ'],
    longitude: ['lng', 'lon', 'longitude', 'long', 'λ'],
  }

  for (const [key, aliases] of Object.entries(aliasMap)) {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i]
      // Exact alias match, or substring match only for multi-char aliases.
      // Single-letter aliases (n/e/x/y/h/z) must never match inside an
      // unrelated header ('point' contains 'n'; 'north' contains 'h').
      if (aliases.some(a => h === a || (a.length >= 3 && h.includes(a)))) {
        colMap[key] = i
        break
      }
    }
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = line.split(delimiter).map(v => v.trim().replace(/"/g, ''))
    const pointName = colMap.pointName !== undefined ? values[colMap.pointName] || `PT${i}` : `PT${i}`
    const northing = colMap.northing !== undefined ? parseFloat(values[colMap.northing]) : NaN
    const easting = colMap.easting !== undefined ? parseFloat(values[colMap.easting]) : NaN
    const elevStr = colMap.elevation !== undefined ? values[colMap.elevation] : ''
    const elevation = elevStr && elevStr !== '' && !isNaN(parseFloat(elevStr)) ? parseFloat(elevStr) : null
    const code = colMap.code !== undefined ? values[colMap.code] || 'PT' : 'PT'

    if (isNaN(northing) || isNaN(easting)) continue

    // If lat/lng provided, use them; otherwise compute from UTM
    let latitude: number
    let longitude: number
    if (colMap.latitude !== undefined && colMap.longitude !== undefined) {
      latitude = parseFloat(values[colMap.latitude]) || 0
      longitude = parseFloat(values[colMap.longitude]) || 0
    } else {
      // Assume Arc1960 UTM 37S, convert to WGS84 for storage
      const wgs = arc1960UTM37SToWGS84(northing, easting)
      latitude = wgs.lat
      longitude = wgs.lng
    }

    points.push({ pointName, northing, easting, elevation, code, latitude, longitude })
  }

  return points
}

// ─── Bearing & Distance ─────────────────────────────────────────────────

export function computeBearingDistance(from: { northing: number; easting: number }, to: { northing: number; easting: number }) {
  const dE = to.easting - from.easting
  const dN = to.northing - from.northing
  const distance = Math.sqrt(dE * dE + dN * dN)

  let bearing: number
  if (dE === 0 && dN === 0) {
    bearing = 0
  } else {
    bearing = (Math.atan2(dE, dN) * RAD2DEG + 360) % 360
  }

  return {
    bearing: Math.round(bearing * 10000) / 10000,
    distance: Math.round(distance * 10000) / 10000,
    dEasting: Math.round(dE * 10000) / 10000,
    dNorthing: Math.round(dN * 10000) / 10000,
  }
}

// ─── Area Computation (Shoelace Formula) ─────────────────────────────────

function computeArea(coordinates: Array<{ northing: number; easting: number }>) {
  let area = 0
  const n = coordinates.length
  if (n < 3) return { areaSqM: 0, areaHa: 0, areaAc: 0 }

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += coordinates[i].easting * coordinates[j].northing
    area -= coordinates[j].easting * coordinates[i].northing
  }

  area = Math.abs(area) / 2

  return {
    areaSqM: Math.round(area * 100) / 100,
    areaHa: Math.round(area / 10000 * 100) / 100,
    areaAc: Math.round(area / 4046.8564224 * 100) / 100,
  }
}

// ─── Traverse Adjustment (Bowditch) ─────────────────────────────────────

interface TraverseAdjustInput {
  legs: Array<{
    fromStation: string
    toStation: string
    angle: number      // decimal degrees
    distance: number
  }>
  startCoordinates: { northing: number; easting: number }
  startBearing: number  // decimal degrees
  closed: boolean
  endCoordinates?: { northing: number; easting: number }
}

function computeTraverseAdjustment(input: TraverseAdjustInput) {
  const { legs, startCoordinates, startBearing, closed } = input

  if (legs.length === 0) return { adjustedLegs: [], misclosure: { linear: 0, angular: 0, bearing: 0, ratio: '0:1' } }

  let currentBearing = startBearing
  let totalLatitude = 0
  let totalDeparture = 0

  // Compute bearings with correct back-bearing propagation.
  // FIXED: Previous version was missing the +180° back-bearing in WCB propagation.
  // Source: Basak, Chapter 10 — WCB(forward) = back_bearing(previous line) + observed angle
  // back_bearing(x) = x + 180°
  // DO NOT round intermediate values — this loses precision on long traverses.
  const computedLegs = legs.map((leg: { fromStation: string; toStation: string; angle: number; distance: number }) => {
    // Forward bearing = back bearing of previous + observed angle
    currentBearing = (currentBearing + leg.angle) % 360
    if (currentBearing < 0) currentBearing += 360

    const bearingRad = currentBearing * DEG2RAD
    const dLatitude = leg.distance * Math.cos(bearingRad)
    const dDeparture = leg.distance * Math.sin(bearingRad)

    totalLatitude += dLatitude
    totalDeparture += dDeparture

    const forwardBearing = currentBearing

    // Update currentBearing to BACK BEARING for next iteration
    // This was the critical bug: the old code didn't add 180° here,
    // causing all subsequent bearings to be wrong by 180°.
    currentBearing = (currentBearing + 180) % 360

    return {
      ...leg,
      computedBearing: forwardBearing,
      dLatitude,
      dDeparture,
    }
  })

  // Compute misclosure
  let errorNorthing: number
  let errorEasting: number

  if (closed && input.endCoordinates) {
    errorNorthing = input.endCoordinates.northing - (startCoordinates.northing + totalLatitude)
    errorEasting = input.endCoordinates.easting - (startCoordinates.easting + totalDeparture)
  } else {
    errorNorthing = 0
    errorEasting = 0
  }

  const linearMisclosure = Math.sqrt(errorNorthing * errorNorthing + errorEasting * errorEasting)
  const totalDistance = legs.reduce((sum: number, leg: { distance: number }) => sum + leg.distance, 0)
  const ratio = linearMisclosure > 0 && totalDistance > 0
    ? `1:${Math.round(totalDistance / linearMisclosure)}`
    : 'Perfect'

  // Apply Bowditch adjustment
  const adjustedLegs = computedLegs.map((leg) => {
    const correctionN = totalDistance > 0 ? (leg.distance / totalDistance) * (-errorNorthing) : 0
    const correctionE = totalDistance > 0 ? (leg.distance / totalDistance) * (-errorEasting) : 0

    const adjN = leg.dLatitude + correctionN
    const adjE = leg.dDeparture + correctionE
    const adjDist = Math.sqrt(adjN * adjN + adjE * adjE)
    const adjBearing = (Math.atan2(adjE, adjN) * RAD2DEG + 360) % 360

    return {
      ...leg,
      adjustedBearing: Math.round(adjBearing * 10000) / 10000,
      adjustedDistance: Math.round(adjDist * 1000) / 1000,
      adjustedDLatitude: Math.round(adjN * 1000) / 1000,
      adjustedDDeparture: Math.round(adjE * 1000) / 1000,
    }
  })

  return {
    adjustedLegs,
    misclosure: {
      linear: Math.round(linearMisclosure * 1000) / 1000,
      angular: 0,
      bearing: 0,
      ratio,
    }
  }
}

// ─── IDW Interpolation Grid ─────────────────────────────────────────────

export interface IDWParams {
  points: Array<{ x: number; y: number; value: number }>
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  resolution: number // grid cell size
  power?: number // IDW power (default 2)
}

export function generateIDWGrid(params: IDWParams): { grid: number[][], rows: number, cols: number, bounds: typeof params.bounds } {
  const { points, bounds, resolution, power = 2 } = params
  const cols = Math.ceil((bounds.maxX - bounds.minX) / resolution) + 1
  const rows = Math.ceil((bounds.maxY - bounds.minY) / resolution) + 1

  const grid: number[][] = []

  for (let r = 0; r < rows; r++) {
    const row: number[] = []
    const y = bounds.minY + r * resolution

    for (let c = 0; c < cols; c++) {
      const x = bounds.minX + c * resolution

      let weightedSum = 0
      let weightSum = 0

      for (const pt of points) {
        const dx = x - pt.x
        const dy = y - pt.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < 0.0001) {
          weightedSum = pt.value
          weightSum = 1
          break
        }

        const w = 1 / Math.pow(dist, power)
        weightedSum += w * pt.value
        weightSum += w
      }

      row.push(weightedSum / weightSum)
    }
    grid.push(row)
  }

  return { grid, rows, cols, bounds }
}

// ─── Message Handler ────────────────────────────────────────────────────

self.onmessage = function (event: MessageEvent) {
  const { type, payload, id } = event.data as WorkerMessage

  try {
    switch (type) {
      case 'PING':
        self.postMessage({ type: 'PONG', payload: null, id })
        break

      case 'PARSE_CSV_POINTS': {
        const { csvText, delimiter } = payload as { csvText: string; delimiter?: string }
        const points = parseCSVPoints(csvText, delimiter || ',')
        self.postMessage({ type: 'PARSE_COMPLETE', payload: { points, count: points.length }, id })
        break
      }

      case 'TRANSFORM_COORDINATES': {
        const { coordinates } = payload as CoordTransformParams
        const results = coordinates.map((coord) => {
          if ('latitude' in coord && 'longitude' in coord) {
            // WGS84 → UTM
            return wgs84ToArc1960UTM37S(coord.latitude, coord.longitude)
          } else {
            // UTM → WGS84
            return arc1960UTM37SToWGS84(coord.northing, coord.easting)
          }
        })
        self.postMessage({ type: 'TRANSFORM_COMPLETE', payload: { coordinates: results, count: results.length }, id })
        break
      }

      case 'COMPUTE_BEARING_DISTANCE': {
        const { from, to } = payload as { from: { northing: number; easting: number }; to: { northing: number; easting: number } }
        const result = computeBearingDistance(from, to)
        self.postMessage({ type: 'COMPUTE_COMPLETE', payload: result, id })
        break
      }

      case 'COMPUTE_AREA': {
        const { coordinates } = payload as { coordinates: Array<{ northing: number; easting: number }> }
        const result = computeArea(coordinates)
        self.postMessage({ type: 'COMPUTE_COMPLETE', payload: result, id })
        break
      }

      case 'COMPUTE_TRAVERSE_ADJUSTMENT': {
        const result = computeTraverseAdjustment(payload as TraverseAdjustInput)
        self.postMessage({ type: 'COMPUTE_COMPLETE', payload: result, id })
        break
      }

      case 'GENERATE_IDW_GRID': {
        const result = generateIDWGrid(payload as IDWParams)
        self.postMessage({ type: 'COMPUTE_COMPLETE', payload: result, id })
        break
      }

      default:
        self.postMessage({ type: 'ERROR', payload: `Unknown message type: ${type}`, id })
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      payload: error instanceof Error ? error.message : String(error),
      id
    })
  }
}
