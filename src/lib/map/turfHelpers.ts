/**
 * @module turfHelpers
 *
 * Pure-computation geospatial helpers wrapping @turf/turf for Kenyan cadastral
 * surveying on Metardu.
 *
 * **CRS convention** — every public API accepts and returns coordinates in a
 * Kenya UTM CRS (default EPSG:21037 / Arc 1960 / UTM Zone 37 South) expressed
 * as `{easting, northing}` (metres).  Internally, coordinates are round-tripped
 * through proj4 to/from WGS84 (EPSG:4326) so that turf can operate on
 * geographic [lon, lat] values.
 *
 * T1.5 FIX (2026-07-09): All functions now accept an optional `epsg` parameter
 * (default 'EPSG:21037'). Pass the project's actual UTM zone to avoid silent
 * wrong-coordinate bugs outside Zone 37S (Mombasa, Kisumu, Turkana).
 * Supported zones: EPSG:21036, EPSG:21037, EPSG:32736, EPSG:32737.
 *
 * No OpenLayers dependency — this module is safe for use in Node workers,
 * server-side code, and any environment where only numeric results are needed.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import type { Point2D } from '@/types/surveyPoint'

import type proj4Type from 'proj4'

/**
 * A survey point on the Kenya cadastral grid.
 *
 * Re-exported from the canonical `Point2D` for backwards compatibility with
 * existing call sites that import `{ SurveyPoint }` from this module. New
 * code should import `Point2D` directly from `@/types/surveyPoint`.
 */
export type SurveyPoint = Point2D

// ---------------------------------------------------------------------------
// Lazy-loaded turf & proj4 singletons
// ---------------------------------------------------------------------------

type TurfModule = typeof import('@turf/turf')

let _turf: TurfModule | null = null;
let _proj4: typeof proj4Type | null = null;

/**
 * T1.5 FIX (2026-07-09): Proj4 definitions for all Kenya UTM zones.
 * Previously only EPSG:21037 was registered — projects in Zone 36 (Kisumu,
 * Mombasa) would silently get wrong coordinates.
 */
const KENYA_UTM_DEFS: Record<string, string> = {
  'EPSG:21036': '+proj=utm +zone=36 +south +ellps=clrk80 +towgs84=-160,-6,-302,-0.807,0.339,-1.619,-2.554 +units=m +no_defs',
  'EPSG:21037': '+proj=utm +zone=37 +south +ellps=clrk80 +towgs84=-160,-6,-302,-0.807,0.339,-1.619,-2.554 +units=m +no_defs',
  // WGS 84 UTM zones are built into proj4js but we register for clarity
  'EPSG:32736': '+proj=utm +zone=36 +south +datum=WGS84 +units=m +no_defs',
  'EPSG:32737': '+proj=utm +zone=37 +south +datum=WGS84 +units=m +no_defs',
}

/**
 * Ensures turf and proj4 are loaded (once, lazily on first call).
 * Also registers all Kenya UTM zone definitions.
 * Idempotent — subsequent calls resolve instantly.
 */
async function ensureLoaded(): Promise<void> {
  if (!_turf || !_proj4) {
    const [turfMod, proj4Mod] = await Promise.all([
      import('@turf/turf'),
      import('proj4'),
    ]);
    _turf = turfMod as TurfModule;
    _proj4 = (proj4Mod.default ?? proj4Mod) as typeof proj4Type;
    // T1.5: Register ALL Kenya UTM zones, not just 21037
    for (const [code, def] of Object.entries(KENYA_UTM_DEFS)) {
      (_proj4 as typeof proj4Type).defs(code, def);
    }
  }
}

/** Narrow _turf after ensureLoaded. */
async function getTurf(): Promise<TurfModule> {
  await ensureLoaded();
  return _turf as TurfModule
}

/** Narrow _proj4 after ensureLoaded. */
async function getProj4(): Promise<typeof proj4Type> {
  await ensureLoaded();
  return _proj4 as typeof proj4Type
}

// ---------------------------------------------------------------------------
// CRS helpers — Kenya UTM <-> WGS84 [lon, lat]
// ---------------------------------------------------------------------------

/**
 * Convert a UTM (easting, northing) pair to a WGS84 [lon, lat]
 * coordinate suitable for use with turf.
 *
 * @param easting - Easting in metres.
 * @param northing - Northing in metres.
 * @param epsg - Source EPSG code (default 'EPSG:21037' for Arc 1960 / UTM 37S).
 * @returns Tuple `[longitude, latitude]` in degrees (WGS84).
 *
 * @example
 *   const [lon, lat] = await toTurfCoord(300000, 9840000);               // Zone 37S
 *   const [lon, lat] = await toTurfCoord(300000, 9840000, 'EPSG:21036'); // Zone 36S
 */
export async function toTurfCoord(
  easting: number,
  northing: number,
  epsg: string = 'EPSG:21037',
): Promise<[number, number]> {
  await ensureLoaded();
  // ensureLoaded() guarantees _proj4 is set
  const p4 = _proj4 as typeof proj4Type
  const [lon, lat] = p4(epsg, 'EPSG:4326', [easting, northing]);
  return [lon, lat];
}

/**
 * Convert a WGS84 [lon, lat] coordinate (turf format) back to UTM.
 *
 * @param coord - `[longitude, latitude]` in degrees (WGS84).
 * @param epsg - Target EPSG code (default 'EPSG:21037').
 * @returns Object with `easting` and `northing` in metres.
 *
 * @example
 *   const { easting, northing } = await fromTurfCoord([36.82, -1.28]);
 *   const { easting, northing } = await fromTurfCoord([34.75, -0.10], 'EPSG:21036');
 */
export async function fromTurfCoord(
  coord: [number, number],
  epsg: string = 'EPSG:21037',
): Promise<SurveyPoint> {
  await ensureLoaded();
  const [easting, northing] = (await getProj4())('EPSG:4326', epsg, coord);
  return { easting, northing };
}

/**
 * Convert an array of UTM survey points to a turf {@link Polygon}.
 *
 * The ring is automatically closed if the first and last vertices differ.
 *
 * @param vertices - Array of `{easting, northing}` objects.
 * @param epsg - Source EPSG code (default 'EPSG:21037').
 * @returns A turf Polygon GeoJSON in WGS84.
 */
export async function polygonToTurf(
  vertices: SurveyPoint[],
  epsg: string = 'EPSG:21037',
): Promise<any> {
  await ensureLoaded();
  const p4 = await getProj4();
  const ring = vertices.map((v) =>
    p4(epsg, 'EPSG:4326', [v.easting, v.northing]),
  );
  // Ensure the ring is closed
  if (ring.length > 0) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push([...first]);
    }
  }
  return (await getTurf()).polygon([ring]);
}

/**
 * Convert an array of UTM survey points to a turf {@link LineString}.
 *
 * @param vertices - Array of `{easting, northing}` objects.
 * @param epsg - Source EPSG code (default 'EPSG:21037').
 * @returns A turf LineString GeoJSON in WGS84.
 */
export async function lineStringToTurf(
  vertices: SurveyPoint[],
  epsg: string = 'EPSG:21037',
): Promise<any> {
  await ensureLoaded();
  const p4 = await getProj4();
  const coords = vertices.map((v) =>
    p4(epsg, 'EPSG:4326', [v.easting, v.northing]),
  );
  return (await getTurf()).lineString(coords);
}

// ---------------------------------------------------------------------------
// Internal: convert a turf geometry (Polygon / MultiPolygon) back to
// UTM vertices.  Returns the exterior ring of the first polygon.
// ---------------------------------------------------------------------------

/**
 * Extract the outer-ring vertices from a turf Polygon or MultiPolygon and
 * convert them to UTM.
 *
 * For a MultiPolygon, only the first polygon's exterior ring is returned.
 *
 * @param geo - A turf Polygon or MultiPolygon GeoJSON.
 * @param epsg - Target EPSG code (default 'EPSG:21037').
 * @returns Array of `{easting, northing}` vertices (ring is **not** closed).
 */
async function turfToVertices(geo: any, epsg: string = 'EPSG:21037'): Promise<SurveyPoint[]> {
  await ensureLoaded();

  let exteriorRing: number[][];

  if (geo.geometry) {
    geo = geo.geometry;
  }

  if (geo.type === 'Polygon') {
    exteriorRing = geo.coordinates[0];
  } else if (geo.type === 'MultiPolygon') {
    exteriorRing = geo.coordinates[0][0];
  } else {
    throw new Error(
      `turfToVertices: unsupported geometry type "${geo.type}"`,
    );
  }

  const p4 = await getProj4();
  return exteriorRing.map((c: number[]) => {
    const [easting, northing] = p4('EPSG:4326', epsg, c);
    return { easting, northing };
  });
}

// ---------------------------------------------------------------------------
// Survey analysis functions
// ---------------------------------------------------------------------------

/**
 * Calculate the area of a parcel in **square metres** using
 * {@link https://turfjs.org/docs/#area turf.area}.
 *
 * @param vertices - Parcel boundary as `{easting, northing}` vertices.
 * @param epsg - Source EPSG code (default 'EPSG:21037').
 * @returns Area in m². Returns `0` when fewer than 3 vertices are supplied.
 */
export async function calculateParcelAreaSqM(
  vertices: SurveyPoint[],
  epsg: string = 'EPSG:21037',
): Promise<number> {
  if (vertices.length < 3) return 0;
  const poly = await polygonToTurf(vertices, epsg);
  return (await getTurf()).area(poly);
}

/**
 * Calculate the perimeter of a parcel in **metres** using
 * {@link https://turfjs.org/docs/#length turf.length}.
 *
 * @param vertices - Parcel boundary as `{easting, northing}` vertices.
 * @param epsg - Source EPSG code (default 'EPSG:21037').
 * @returns Perimeter in metres. Returns `0` when fewer than 2 vertices are supplied.
 */
export async function calculateParcelPerimeterM(
  vertices: SurveyPoint[],
  epsg: string = 'EPSG:21037',
): Promise<number> {
  if (vertices.length < 2) return 0;
  const line = await lineStringToTurf(vertices, epsg);
  return (await getTurf()).length(line, { units: 'meters' });
}

/**
 * Buffer a single survey point by a given radius.
 *
 * Produces a polygon in the given EPSG that approximates a circle of the
 * requested radius on the ground.
 *
 * @param easting  - Easting of the centre point (m).
 * @param northing - Northing of the centre point (m).
 * @param radiusM  - Buffer radius in metres.
 * @param epsg - Source/target EPSG code (default 'EPSG:21037').
 * @returns Array of `{easting, northing}` vertices describing the buffer
 *          polygon.
 */
export async function bufferPoint(
  easting: number,
  northing: number,
  radiusM: number,
  epsg: string = 'EPSG:21037',
): Promise<SurveyPoint[]> {
  await ensureLoaded();
  const [lon, lat] = await toTurfCoord(easting, northing, epsg);
  const pt = (await getTurf()).point([lon, lat]);
  const buffered = (await getTurf()).buffer(pt, radiusM, { units: 'meters', steps: 32 });
  return turfToVertices(buffered, epsg);
}

/**
 * Buffer a parcel polygon by a given distance.
 *
 * A positive `distanceM` expands the parcel; a negative value contracts it.
 *
 * @param vertices  - Parcel boundary vertices.
 * @param distanceM - Buffer distance in metres (negative to shrink).
 * @param epsg - Source/target EPSG code (default 'EPSG:21037').
 * @returns New array of vertices representing the buffered parcel.
 */
export async function bufferParcel(
  vertices: SurveyPoint[],
  distanceM: number,
  epsg: string = 'EPSG:21037',
): Promise<SurveyPoint[]> {
  const poly = await polygonToTurf(vertices, epsg);
  const buffered = (await getTurf()).buffer(poly, distanceM, {
    units: 'meters',
    steps: 32,
  });
  return turfToVertices(buffered, epsg);
}

/**
 * Calculate the geometric intersection of two parcels.
 *
 * @param parcel1 - First parcel boundary vertices.
 * @param parcel2 - Second parcel boundary vertices.
 * @param epsg - Source/target EPSG code (default 'EPSG:21037').
 * @returns Vertices of the intersection polygon, or `null` if the parcels
 *          do not overlap (or the intersection is degenerate).
 */
export async function calculateIntersection(
  parcel1: SurveyPoint[],
  parcel2: SurveyPoint[],
  epsg: string = 'EPSG:21037',
): Promise<SurveyPoint[] | null> {
  const [poly1, poly2] = await Promise.all([
    polygonToTurf(parcel1, epsg),
    polygonToTurf(parcel2, epsg),
  ]);
  const turf = await getTurf();
  const intersection = turf.intersect(turf.featureCollection([poly1, poly2]));
  if (!intersection) return null;

  // intersect can return a GeometryCollection with no area (runtime reality
  // despite turf's narrower TS types)
  const interGeom = intersection.geometry as
    | { type: 'GeometryCollection'; geometries: Array<{ type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][][] | number[][][] }> }
    | { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown }
  if (interGeom.type === 'GeometryCollection') {
    // Try to find a polygon inside the collection
    const polys = interGeom.geometries.filter(
      (g): g is { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] } =>
        g.type === 'Polygon' || g.type === 'MultiPolygon',
    );
    if (polys.length === 0) return null;
    // Rebuild from the first valid polygon
    const first = polys[0];
    const rebuilt =
      first.type === 'MultiPolygon'
        ? (await getTurf()).multiPolygon(first.coordinates)
        : (await getTurf()).polygon(first.coordinates);
    return turfToVertices(rebuilt, epsg);
  }

  return turfToVertices(intersection, epsg);
}

/**
 * Calculate the geometric union of two parcels.
 *
 * @param parcel1 - First parcel boundary vertices.
 * @param parcel2 - Second parcel boundary vertices.
 * @param epsg - Source/target EPSG code (default 'EPSG:21037').
 * @returns Vertices of the combined (union) parcel.
 */
export async function calculateUnion(
  parcel1: SurveyPoint[],
  parcel2: SurveyPoint[],
  epsg: string = 'EPSG:21037',
): Promise<SurveyPoint[]> {
  const [poly1, poly2] = await Promise.all([
    polygonToTurf(parcel1, epsg),
    polygonToTurf(parcel2, epsg),
  ]);
  const union = (await getTurf()).union(poly1, poly2);
  return turfToVertices(union, epsg);
}

/**
 * Calculate the geometric difference of two parcels (parcel1 minus parcel2).
 *
 * @param parcel1 - Source parcel (the parcel to subtract *from*).
 * @param parcel2 - Subtract parcel (the parcel to remove).
 * @param epsg - Source/target EPSG code (default 'EPSG:21037').
 * @returns Vertices of the resulting parcel, or `null` if parcel2 fully
 *          contains parcel1 (nothing remains).
 */
export async function calculateDifference(
  parcel1: SurveyPoint[],
  parcel2: SurveyPoint[],
  epsg: string = 'EPSG:21037',
): Promise<SurveyPoint[] | null> {
  const [poly1, poly2] = await Promise.all([
    polygonToTurf(parcel1, epsg),
    polygonToTurf(parcel2, epsg),
  ]);
  const turf = await getTurf();
  const diff = turf.difference(turf.featureCollection([poly1, poly2]));
  if (!diff) return null;

  // difference can return a GeometryCollection when there's nothing left
  // (runtime reality despite turf's narrower TS types)
  const diffGeom = diff.geometry as
    | { type: 'GeometryCollection'; geometries: Array<{ type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][][] | number[][][] }> }
    | { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown }
  if (diffGeom.type === 'GeometryCollection') {
    const polys = diffGeom.geometries.filter(
      (g): g is { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] } =>
        g.type === 'Polygon' || g.type === 'MultiPolygon',
    );
    if (polys.length === 0) return null;
    const first = polys[0];
    const rebuilt =
      first.type === 'MultiPolygon'
        ? (await getTurf()).multiPolygon(first.coordinates)
        : (await getTurf()).polygon(first.coordinates);
    return turfToVertices(rebuilt, epsg);
  }

  return turfToVertices(diff, epsg);
}

/**
 * Test whether a survey point lies inside a parcel boundary.
 *
 * Uses {@link https://turfjs.org/docs/#booleanPointInPolygon
 * turf.booleanPointInPolygon}.
 *
 * @param easting        - Easting of the query point (m).
 * @param northing       - Northing of the query point (m).
 * @param parcelVertices - Parcel boundary vertices.
 * @param epsg - Source EPSG code (default 'EPSG:21037').
 * @returns `true` if the point is inside (or on the boundary of) the parcel.
 */
export async function isPointInParcel(
  easting: number,
  northing: number,
  parcelVertices: SurveyPoint[],
  epsg: string = 'EPSG:21037',
): Promise<boolean> {
  if (parcelVertices.length < 3) return false;
  const [lon, lat] = await toTurfCoord(easting, northing, epsg);
  const pt = (await getTurf()).point([lon, lat]);
  const poly = await polygonToTurf(parcelVertices, epsg);
  return (await getTurf()).booleanPointInPolygon(pt, poly);
}

/**
 * Calculate the Polsby-Popper compactness score for a parcel.
 *
 * The score ranges from 0 (highly elongated / irregular) to 1 (a perfect
 * circle).  It is defined as:
 *
 * ```
 * C = 4π × A / P²
 * ```
 *
 * where *A* is the area in m² and *P* is the perimeter in m.
 *
 * Useful for flagging unusually shaped parcels that may indicate boundary
 * disputes or survey errors in Kenyan land records.
 *
 * @param vertices - Parcel boundary vertices.
 * @param epsg - Source EPSG code (default 'EPSG:21037').
 * @returns Compactness score between 0 and 1. Returns `0` when fewer than 3
 *          vertices are supplied.
 */
export async function calculateCompactness(
  vertices: SurveyPoint[],
  epsg: string = 'EPSG:21037',
): Promise<number> {
  if (vertices.length < 3) return 0;

  const [areaSqM, perimeterM] = await Promise.all([
    calculateParcelAreaSqM(vertices, epsg),
    calculateParcelPerimeterM(vertices, epsg),
  ]);

  if (perimeterM === 0) return 0;

  return (4 * Math.PI * areaSqM) / (perimeterM * perimeterM);
}

