'use client';
/**
 * Projection Registration — EPSG:21037 (Arc 1960 / UTM 37S) + Zone 36S
 *
 * Registers Kenyan cadastral projections via proj4:
 *  - EPSG:21037 — Arc 1960 / UTM Zone 37S (Nairobi, Mombasa, eastern Kenya)
 *  - EPSG:21036 — Arc 1960 / UTM Zone 36S (Kisumu, Eldoret, western Kenya)
 *  - EPSG:32736 — WGS84 / UTM Zone 36S (geodetic, Zone 36)
 *  - EPSG:32737 — WGS84 / UTM Zone 37S (geodetic, Zone 37, already common)
 *
 * Also provides autoDetectUtmZone() for automatic zone selection based on longitude.
 */
import { logger } from '@/lib/logger'

export const EPSG_21037_DEF =
  '+proj=utm +zone=37 +south +ellps=clrk80 +towgs84=-160,-6,-302,-0.807,0.339,-1.619,-2.554 +units=m +no_defs';

// T1.5c FIX (2026-07-10): Zone 36 was using a DIFFERENT datum shift
// (-143,-268,33,0,0,0,0 — a 3-parameter translation-only set, possibly from
// an old Tanzania variant) while Zone 37 uses the national-standard 7-parameter
// Bursa-Wolf (-160,-6,-302,-0.807,0.339,-1.619,-2.554). This means a surveyor
// in Kisumu (Zone 36) got a different datum shift than one in Nairobi (Zone 37)
// — a statutory inconsistency. Now both zones use the same national-standard
// 7-parameter from EPSG transformation 1165 (Arc 1960 → WGS84, Kenya).
export const EPSG_21036_DEF =
  '+proj=utm +zone=36 +south +ellps=clrk80 +towgs84=-160,-6,-302,-0.807,0.339,-1.619,-2.554 +units=m +no_defs';

export const EPSG_32736_DEF =
  '+proj=utm +zone=36 +south +datum=WGS84 +units=m +no_defs';

export const EPSG_32737_DEF =
  '+proj=utm +zone=37 +south +datum=WGS84 +units=m +no_defs';

export const SRID_21037 = 'EPSG:21037';
export const SRID_21036 = 'EPSG:21036';
export const SRID_32736 = 'EPSG:32736';
export const SRID_32737 = 'EPSG:32737';
export const SRID_3857  = 'EPSG:3857';
export const SRID_4326  = 'EPSG:4326';

let registered = false;
let _registrationFailed = false;

export function isProjectionRegistered(): boolean {
  return registered;
}

/**
 * Register all Kenyan cadastral projections with proj4 and OpenLayers.
 * Safe to call multiple times — will only register once.
 */
export async function registerProjections(): Promise<void> {
  if (registered || typeof window === 'undefined') return;

  try {
    const [proj4Module, { register }] = await Promise.all([
      import('proj4'),
      import('ol/proj/proj4'),
    ]);

    const proj4 = proj4Module.default;

    // Arc 1960 / UTM Zone 37S (primary — Nairobi, Mombasa, eastern Kenya)
    proj4.defs(SRID_21037, EPSG_21037_DEF);

    // Arc 1960 / UTM Zone 36S (western Kenya — Kisumu, Eldoret, Kakamega, Nakuru west)
    proj4.defs(SRID_21036, EPSG_21036_DEF);

    // WGS84 / UTM Zone 36S (geodetic / GNSS workflows)
    proj4.defs(SRID_32736, EPSG_32736_DEF);

    // WGS84 / UTM Zone 37S (geodetic / GNSS workflows)
    proj4.defs(SRID_32737, EPSG_32737_DEF);

    register(proj4);

    registered = true;
  } catch (err) {
    _registrationFailed = true;
    logger.error('[projection] Projection registration failed:', { error: err });
  }
}

// ─── UTM Zone Auto-Detection ──────────────────────────────────────────────

export interface UtmZoneResult {
  /** WGS84 UTM EPSG code (e.g., 'EPSG:32737') */
  wgs84: string
  /** Arc 1960 UTM EPSG code (e.g., 'EPSG:21037') */
  arc1960: string
  /** Zone number (36 or 37 for Kenya) */
  zone: number
  /** Hemisphere ('S' for Kenya) */
  hemisphere: 'N' | 'S'
}

/**
 * Auto-detect the appropriate UTM zone based on longitude.
 *
 * Kenya's UTM zones:
 *  - Zone 36S: longitude 30°E to 36°E (western Kenya: Kisumu, Eldoret, Kakamega, Nakuru west)
 *  - Zone 37S: longitude 36°E to 42°E (central/eastern Kenya: Nairobi, Mombasa, Meru)
 *
 * @param lng — Longitude in decimal degrees (WGS84)
 * @returns UtmZoneResult with both WGS84 and Arc 1960 EPSG codes
 */
export function autoDetectUtmZone(lng: number): UtmZoneResult {
  let zone: number
  if (lng >= 30 && lng < 36) {
    zone = 36
  } else if (lng >= 36 && lng < 42) {
    zone = 37
  } else {
    // Fallback: compute zone mathematically for anywhere in the world
    zone = Math.floor((lng + 180) / 6) + 1
  }

  const hemisphere: 'N' | 'S' = 'S' // Kenya is in the southern hemisphere

  const wgs84Epsg = `EPSG:32${hemisphere === 'S' ? '7' : '6'}${zone}`
  const arc1960Epsg = `EPSG:210${zone}`

  return {
    wgs84: wgs84Epsg,
    arc1960: arc1960Epsg,
    zone,
    hemisphere,
  }
}

// ─── Coordinate Transform Helpers ─────────────────────────────────────────

export async function to3857(easting: number, northing: number, fromSrid: string = SRID_21037): Promise<[number, number]> {
  const { transform } = await import('ol/proj');
  return transform([easting, northing], fromSrid, SRID_3857) as [number, number];
}

export async function arrayTo3857(
  coords: Array<[number, number]>,
  fromSrid: string = SRID_21037
): Promise<Array<[number, number]>> {
  const { transform } = await import('ol/proj');
  return coords.map(([e, n]) => transform([e, n], fromSrid, SRID_3857) as [number, number]);
}

export async function to21037(x: number, y: number): Promise<[number, number]> {
  const { transform } = await import('ol/proj');
  return transform([x, y], SRID_3857, SRID_21037) as [number, number];
}

export async function to21036(x: number, y: number): Promise<[number, number]> {
  const { transform } = await import('ol/proj');
  return transform([x, y], SRID_3857, SRID_21036) as [number, number];
}

/**
 * Transform from EPSG:4326 (WGS84 lat/lon) to the auto-detected Arc 1960 UTM zone.
 */
export async function toArc1960(lon: number, lat: number): Promise<{ easting: number; northing: number; srid: string }> {
  const zoneResult = autoDetectUtmZone(lon)
  const { transform } = await import('ol/proj')
  const [easting, northing] = transform([lon, lat], SRID_4326, zoneResult.arc1960) as [number, number]
  return { easting, northing, srid: zoneResult.arc1960 }
}
