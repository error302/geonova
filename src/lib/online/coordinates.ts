/**
 * Live Coordinate Transformation Service
 * Phase 7 - Online Power Features
 * Transforms coordinates between different CRS in real-time
 */

import { DATUM_REGISTRY, DatumParameters } from '../engine/datums'
import { geographicToUTM, utmToGeographic } from '../engine/coordinates'

const COORD_TO_DATUM: Record<CoordinateSystem, string> = {
  WGS84: 'WGS84',
  UTM: 'WGS84',
  ARC1960: 'ARC1960',
  HARTEBEESTHOEK94: 'HARTEBEESTHOEK94',
  ADINDAN: 'ADINDAN',
  CAPE: 'CAPE',
  ED50: 'ED50',
  PSAD56: 'PSAD56',
}

function getDatum(system: CoordinateSystem): DatumParameters {
  const key = COORD_TO_DATUM[system]
  return DATUM_REGISTRY[key] ?? DATUM_REGISTRY['WGS84']
}

export type CoordinateSystem = 
  | 'WGS84' 
  | 'UTM' 
  | 'ARC1960' 
  | 'HARTEBEESTHOEK94' 
  | 'ADINDAN' 
  | 'CAPE'
  | 'ED50'
  | 'PSAD56'

export interface CoordinateInput {
  latitude?: number
  longitude?: number
  easting?: number
  northing?: number
  zone?: number
  hemisphere?: 'N' | 'S'
}

export interface TransformResult {
  success: boolean
  result?: {
    latitude?: number
    longitude?: number
    easting?: number
    northing?: number
    zone?: number
    hemisphere?: 'N' | 'S'
  }
  error?: string
  precision?: string
}

function helmertTransform(
  x: number, y: number, z: number,
  fromDatum: DatumParameters,
  toDatum: DatumParameters = DATUM_REGISTRY['WGS84']
): { x: number; y: number; z: number } {
  const dx = toDatum.dx - fromDatum.dx
  const dy = toDatum.dy - fromDatum.dy
  const dz = toDatum.dz - fromDatum.dz
  
  const rx = (toDatum.rx - fromDatum.rx) * Math.PI / 648000
  const ry = (toDatum.ry - fromDatum.ry) * Math.PI / 648000
  const rz = (toDatum.rz - fromDatum.rz) * Math.PI / 648000
  
  const scale = (toDatum.scale - fromDatum.scale) / 1e6 + 1
  
  const tx = dx + x * scale - z * rz + y * ry
  const ty = dy + y * scale + z * rx - x * rz
  const tz = dz + z * scale - y * rx + x * ry
  
  return { x: tx, y: ty, z: tz }
}

function ecefToGeodetic(x: number, y: number, z: number): { lat: number; lon: number; h: number } {
  const a = 6378137.0
  const f = 1 / 298.257223563
  const e2 = 2 * f - f * f
  
  const lon = Math.atan2(y, x)
  const p = Math.sqrt(x * x + y * y)
  let lat = Math.atan2(z, p * (1 - e2))
  
  let latPrev = 0
  let h = 0
  let iter = 0
  
  while (Math.abs(lat - latPrev) > 1e-12 && iter < 10) {
    latPrev = lat
    const N = a / Math.sqrt(1 - e2 * Math.sin(lat) * Math.sin(lat))
    h = p / Math.cos(lat) - N
    lat = Math.atan2(z, p * (1 - e2 * N / (N + h)))
    iter++
  }
  
  return { lat, lon, h }
}

function geodeticToEcef(lat: number, lon: number, h: number): { x: number; y: number; z: number } {
  const a = 6378137.0
  const f = 1 / 298.257223563
  const e2 = 2 * f - f * f
  
  const N = a / Math.sqrt(1 - e2 * Math.sin(lat) * Math.sin(lat))
  const x = (N + h) * Math.cos(lat) * Math.cos(lon)
  const y = (N + h) * Math.cos(lat) * Math.sin(lon)
  const z = (N * (1 - e2) + h) * Math.sin(lat)
  
  return { x, y, z }
}

export async function transformCoordinates(
  input: CoordinateInput,
  fromSystem: CoordinateSystem,
  toSystem: CoordinateSystem
): Promise<TransformResult> {
  try {
    if (fromSystem === toSystem) {
      return {
        success: true,
        result: {
          latitude: input.latitude,
          longitude: input.longitude,
          easting: input.easting,
          northing: input.northing,
          zone: input.zone,
          hemisphere: input.hemisphere
        },
        precision: 'exact'
      }
    }

    let latVal: number, lonVal: number

    if (fromSystem === 'UTM') {
      if (!input.easting || !input.northing || !input.zone || !input.hemisphere) {
        return { success: false, error: 'Missing UTM parameters' }
      }
      const wgs = utmToGeographic(input.easting, input.northing, input.zone, input.hemisphere)
      latVal = wgs.lat
      lonVal = wgs.lon
    } else if (fromSystem === 'WGS84') {
      if (input.latitude === undefined || input.longitude === undefined) {
        return { success: false, error: 'Missing WGS84 coordinates' }
      }
      latVal = input.latitude
      lonVal = input.longitude
    } else {
      const datum = getDatum(fromSystem)
      if (!datum) {
        return { success: false, error: `Unknown datum: ${fromSystem}` }
      }
      
      if (input.easting !== undefined && input.northing !== undefined && input.zone && input.hemisphere) {
        const wgs = utmToGeographic(input.easting, input.northing, input.zone, input.hemisphere)
        latVal = wgs.lat
        lonVal = wgs.lon
      } else if (input.latitude !== undefined && input.longitude !== undefined) {
        latVal = input.latitude
        lonVal = input.longitude
      } else {
        return { success: false, error: 'Invalid input for datum transformation' }
      }
      
      const fromEcef = geodeticToEcef(latVal * Math.PI / 180, lonVal * Math.PI / 180, 0)
      const wgsEcef = helmertTransform(fromEcef.x, fromEcef.y, fromEcef.z, datum)
      const wgs = ecefToGeodetic(wgsEcef.x, wgsEcef.y, wgsEcef.z)
      latVal = wgs.lat * 180 / Math.PI
      lonVal = wgs.lon * 180 / Math.PI
    }

    if (toSystem === 'WGS84') {
      return {
        success: true,
        result: { latitude: latVal, longitude: lonVal },
        precision: '0.001m'
      }
    }

    if (toSystem === 'UTM') {
      const zone = Math.floor((lonVal + 180) / 6) + 1
      const hemisphere: 'N' | 'S' = latVal >= 0 ? 'N' : 'S'
      const utm = geographicToUTM(latVal, lonVal)
      return {
        success: true,
        result: {
          easting: utm.easting,
          northing: utm.northing,
          zone,
          hemisphere
        },
        precision: '0.001m'
      }
    }

    const toDatum = getDatum(toSystem)
    if (!toDatum) {
      return { success: false, error: `Unknown target datum: ${toSystem}` }
    }

    const wgsEcef = geodeticToEcef(latVal * Math.PI / 180, lonVal * Math.PI / 180, 0)
    const targetEcef = helmertTransform(wgsEcef.x, wgsEcef.y, wgsEcef.z, DATUM_REGISTRY['WGS84'], toDatum)
    const target = ecefToGeodetic(targetEcef.x, targetEcef.y, targetEcef.z)
    
    const utm = geographicToUTM(target.lat * 180 / Math.PI, target.lon * 180 / Math.PI)
    const zone = Math.floor((target.lon * 180 / Math.PI + 180) / 6) + 1
    const hemisphere: 'N' | 'S' = target.lat >= 0 ? 'N' : 'S'

    return {
      success: true,
      result: {
        latitude: target.lat * 180 / Math.PI,
        longitude: target.lon * 180 / Math.PI,
        easting: utm.easting,
        northing: utm.northing,
        zone,
        hemisphere
      },
      precision: '0.01m'
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Transformation failed'
    }
  }
}

export function getSupportedSystems(): { id: string; name: string; type: string }[] {
  return [
    { id: 'WGS84', name: 'WGS84 (GPS)', type: 'geodetic' },
    { id: 'UTM', name: 'Universal Transverse Mercator', type: 'projected' },
    { id: 'ARC1960', name: 'Arc 1960 (Kenya, Uganda, Tanzania)', type: 'local' },
    { id: 'HARTEBEESTHOEK94', name: 'Hartebeesthoek94 (South Africa)', type: 'local' },
    { id: 'ADINDAN', name: 'Adindan (Ethiopia, Sudan)', type: 'local' },
    { id: 'CAPE', name: 'Cape (South Africa)', type: 'local' },
    { id: 'ED50', name: 'European Datum 1950', type: 'local' },
    { id: 'PSAD56', name: 'Provisional South American 1956', type: 'local' }
  ]
}
