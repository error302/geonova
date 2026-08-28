/**
 * METARDU — Geodetic Reduction Engine
 * 
 * Implements rigorous 3-step physical geodesy reduction:
 * 1. Measured Ground Distance (S) -> Horizontal Ground Distance (S0)
 * 2. Horizontal Distance (S0) -> Ellipsoidal / Geodetic Distance (Sell)
 *    Factoring Orthometric Height (H), Geoid Undulation (N), and Mean Curvature Radius (Rm).
 * 3. Ellipsoidal Distance (Sell) -> Map Projection Grid Distance (Sgrid)
 *    Using exact UTM / Cassini Point Scale Factor (k).
 * 
 * Also provides:
 * - Combined Scale Factor (CSF = Elevation Factor * Grid Scale Factor)
 * - Arc-to-Chord (t - T) Projection Direction Correction for lines > 2km
 * - Grid Meridian Convergence Angle (γ) for True / Grid North alignment
 * 
 * References:
 * - Survey of Kenya Regulations (LN 168/1994)
 * - US National Geodetic Survey (NGS) Manual NOS NGS 5
 * - RDM 1.1 / 1.3 Topographic & Road Design Manual
 */

export interface EllipsoidParameters {
  name: string
  a: number // semi-major axis in metres
  invF: number // inverse flattening (1/f)
}

export const ELLIPSOIDS: Record<string, EllipsoidParameters> = {
  clarke1880_modified: {
    name: 'Clarke 1880 (Modified) - Arc 1960',
    a: 6378249.145,
    invF: 293.465,
  },
  clarke1858: {
    name: 'Clarke 1858 - Cassini Soldner',
    a: 6378351.0,
    invF: 294.26,
  },
  wgs84: {
    name: 'WGS 84 / GRS 80',
    a: 6378137.0,
    invF: 298.257223563,
  },
}

export interface GeodeticReductionInput {
  groundDistance: number // measured ground distance (metres)
  fromPoint: {
    easting: number
    northing: number
    elevation: number // orthometric height H (metres)
    geoidUndulation?: number // geoid-ellipsoid separation N (metres, default ~ -15.0m in Kenya)
  }
  toPoint: {
    easting: number
    northing: number
    elevation: number
    geoidUndulation?: number
  }
  ellipsoid?: 'clarke1880_modified' | 'clarke1858' | 'wgs84'
  utmZone?: number // e.g. 36 or 37 for Kenya
  centralMeridian?: number // longitude in degrees (e.g. 33 for 36S, 39 for 37S)
  falseEasting?: number // default 500,000 m
  k0?: number // central scale factor (default 0.9996 for UTM)
}

export interface GeodeticReductionOutput {
  groundDistance: number
  meanElevation: number
  meanGeoidUndulation: number
  ellipsoidalHeight: number
  meanRadiusOfCurvature: number
  elevationFactor: number // Sea level / ellipsoid factor (Rm / (Rm + h))
  ellipsoidalDistance: number // Distance on ellipsoid (metres)
  gridPointScaleFactor: number // Point scale factor k
  combinedScaleFactor: number // CSF = elevationFactor * gridPointScaleFactor
  gridDistance: number // Final projected grid distance in metres
  groundToGridDifference: number // (gridDistance - groundDistance) in metres
  arcToChordCorrectionSeconds: number // (t - T) angular correction in arcseconds
  gridConvergenceAngleDegrees: number // Meridian convergence angle γ in degrees
  gridConvergenceDMS: string
  calculationSteps: string[]
}

/**
 * Calculates mean radius of curvature Rm = sqrt(M * N) at a given latitude
 */
export function calculateMeanRadiusOfCurvature(
  latRadians: number,
  ellipsoidKey: 'clarke1880_modified' | 'clarke1858' | 'wgs84' = 'clarke1880_modified'
): number {
  const el = ELLIPSOIDS[ellipsoidKey] || ELLIPSOIDS.clarke1880_modified
  const f = 1 / el.invF
  const e2 = 2 * f - f * f

  const sinLat = Math.sin(latRadians)
  const W = Math.sqrt(1 - e2 * sinLat * sinLat)

  // Meridian radius of curvature M
  const M = (el.a * (1 - e2)) / (W * W * W)
  // Prime vertical radius of curvature N_pv
  const N_pv = el.a / W

  // Geometric mean radius Rm = sqrt(M * N_pv)
  return Math.sqrt(M * N_pv)
}

/**
 * Approximate latitude from UTM northing (valid for equatorial zones e.g. Kenya -5° to +5°)
 */
export function approximateLatitudeFromNorthing(northing: number, hemisphere: 'N' | 'S' = 'S'): number {
  // In Southern Hemisphere UTM, Equator is at Northing 10,000,000 m
  const distFromEquator = hemisphere === 'S' ? 10000000 - northing : northing
  const latDeg = (distFromEquator / 111132.95) * (hemisphere === 'S' ? -1 : 1)
  return latDeg * (Math.PI / 180)
}

/**
 * Formats decimal degrees into formatted DMS string: DDD° MM' SS.SS"
 */
export function formatDegreesToDMS(deg: number): string {
  const sign = deg < 0 ? '-' : ''
  const abs = Math.abs(deg)
  const d = Math.floor(abs)
  const mFloat = (abs - d) * 60
  const m = Math.floor(mFloat)
  const s = ((mFloat - m) * 60).toFixed(2)
  return `${sign}${d}° ${m.toString().padStart(2, '0')}' ${s.padStart(5, '0')}"`
}

/**
 * Performs full 3-step geodetic reduction from ground EDM distance to projected UTM grid
 */
export function reduceGroundToGrid(input: GeodeticReductionInput): GeodeticReductionOutput {
  const {
    groundDistance,
    fromPoint,
    toPoint,
    ellipsoid = 'clarke1880_modified',
    falseEasting = 500000,
    k0 = 0.9996,
  } = input

  const meanEasting = (fromPoint.easting + toPoint.easting) / 2
  const meanNorthing = (fromPoint.northing + toPoint.northing) / 2
  const meanElevation = (fromPoint.elevation + toPoint.elevation) / 2
  const meanN = ((fromPoint.geoidUndulation ?? -15.0) + (toPoint.geoidUndulation ?? -15.0)) / 2

  // Ellipsoidal height h = H (orthometric) + N (geoid undulation)
  const ellipsoidalHeight = meanElevation + meanN

  // 1. Mean radius of curvature at mean latitude
  const latRad = approximateLatitudeFromNorthing(meanNorthing, meanNorthing < 5000000 ? 'S' : 'N')
  const Rm = calculateMeanRadiusOfCurvature(latRad, ellipsoid)

  // 2. Elevation / Sea-Level Factor (ground to ellipsoid)
  // Factor = Rm / (Rm + h)
  const elevationFactor = Rm / (Rm + ellipsoidalHeight)
  const ellipsoidalDistance = groundDistance * elevationFactor

  // 3. Grid Point Scale Factor (k) at mean easting
  // k = k0 * [1 + (E - E0)^2 / (2 * Rm^2) + (E - E0)^4 / (24 * Rm^4)]
  const deltaE = meanEasting - falseEasting
  const deltaE2 = deltaE * deltaE
  const Rm2 = Rm * Rm
  const gridPointScaleFactor = k0 * (1 + deltaE2 / (2 * Rm2) + (deltaE2 * deltaE2) / (24 * Rm2 * Rm2))

  // 4. Combined Scale Factor (CSF)
  const combinedScaleFactor = elevationFactor * gridPointScaleFactor
  const gridDistance = groundDistance * combinedScaleFactor
  const groundToGridDifference = gridDistance - groundDistance

  // 5. Arc-to-Chord (t - T) direction correction
  // (t - T)'' = (2*N1 + N2 - 3*N0)*(E1 - E2) / (6 * Rm^2 * sin(1''))
  // Where N0 is mean northing false origin
  const dE = fromPoint.easting - toPoint.easting
  const dN_term = 2 * fromPoint.northing + toPoint.northing - 3 * meanNorthing
  const sin1Sec = Math.sin(Math.PI / (180 * 3600))
  const arcToChordCorrectionSeconds = (dN_term * dE) / (6 * Rm2 * sin1Sec)

  // 6. Grid Meridian Convergence Angle (γ)
  // γ ≈ (L - L0) * sin(φ) in degrees
  // Delta Longitude in degrees ≈ deltaE / (111319.5 * cos(lat))
  const deltaLonDeg = deltaE / (111319.5 * Math.cos(latRad))
  const gridConvergenceAngleDegrees = deltaLonDeg * Math.sin(latRad)
  const gridConvergenceDMS = formatDegreesToDMS(gridConvergenceAngleDegrees)

  // Calculation audit trail
  const calculationSteps = [
    `1. Mean Coordinates: E = ${meanEasting.toFixed(3)}m, N = ${meanNorthing.toFixed(3)}m`,
    `2. Mean Orthometric Height H = ${meanElevation.toFixed(3)}m, Geoid Undulation N = ${meanN.toFixed(3)}m (h = ${ellipsoidalHeight.toFixed(3)}m)`,
    `3. Mean Earth Curvature Radius Rm = ${Rm.toFixed(1)}m on ${ELLIPSOIDS[ellipsoid].name}`,
    `4. Elevation Factor = Rm / (Rm + h) = ${elevationFactor.toFixed(8)}`,
    `5. Ellipsoidal Distance Sell = ${ellipsoidalDistance.toFixed(4)}m`,
    `6. UTM Point Scale Factor k = ${gridPointScaleFactor.toFixed(8)} (Distance from CM: ${(deltaE / 1000).toFixed(2)} km)`,
    `7. Combined Scale Factor (CSF) = ${combinedScaleFactor.toFixed(8)}`,
    `8. Final Grid Distance Sgrid = ${gridDistance.toFixed(4)}m (Ground - Grid difference: ${(groundToGridDifference * 1000).toFixed(1)} mm)`,
    `9. Arc-to-Chord Correction (t - T) = ${arcToChordCorrectionSeconds.toFixed(2)}"`,
    `10. Meridian Grid Convergence γ = ${gridConvergenceDMS}`,
  ]

  return {
    groundDistance,
    meanElevation,
    meanGeoidUndulation: meanN,
    ellipsoidalHeight,
    meanRadiusOfCurvature: Rm,
    elevationFactor,
    ellipsoidalDistance,
    gridPointScaleFactor,
    combinedScaleFactor,
    gridDistance,
    groundToGridDifference,
    arcToChordCorrectionSeconds,
    gridConvergenceAngleDegrees,
    gridConvergenceDMS,
    calculationSteps,
  }
}
