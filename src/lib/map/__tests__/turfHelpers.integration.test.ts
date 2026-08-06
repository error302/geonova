/**
 * Integration tests for the turfHelpers boolean-geometry trio —
 * calculateIntersection, calculateUnion, calculateDifference — using the
 * REAL geospatial stack (lazy-loaded @turf/turf + proj4).
 *
 * These tests deliberately do NOT mock @turf/turf or proj4. The unit suite
 * (turfHelpers.test.ts) mocks both, so it can only assert the API contract
 * (e.g. that intersect/difference/union are called with a single
 * FeatureCollection). It cannot catch behavioural regressions like turf 7's
 * intersect()/difference() silently no-op'ing on invalid arguments, or a
 * caller passing the wrong polygon order and getting an empty/absent result.
 *
 * The overlapping cases below are the regression guards: for every function
 * the measured area of the result is asserted, so any bug that drops one of
 * the input polygons (e.g. the old two-argument call form, which ignored the
 * second feature) yields the wrong area and fails.
 *
 * Coordinates are simple Kenya UTM 37S squares (EPSG:21037 — the default the
 * helpers use), so the transform stays lightweight while still exercising the
 * full UTM → WGS84 → turf → UTM round-trip.
 *
 * NOTE ON PRECISION: the round-trip drifts result vertices by a few tenths of
 * a millimetre past their nominal positions (e.g. 200200.0005 instead of
 * 200200). Every geometric assertion therefore uses a 1 cm tolerance — the
 * same sub-centimetre philosophy as MIN_OVERLAP_AREA_SQM in overlapDetection.
 */

import {
  calculateDifference,
  calculateIntersection,
  calculateParcelAreaSqM,
  calculateUnion,
  type SurveyPoint,
} from '../turfHelpers'

// ─── Fixtures: 200 m × 200 m squares in UTM 37S ──────────────────────────
/** 200 × 200 m square; area 40,000 m² (≈ 40,122 m² as turf.area measures it). */
const NEW_PARCEL: SurveyPoint[] = [
  { easting: 200000, northing: 9900000 },
  { easting: 200000, northing: 9900200 },
  { easting: 200200, northing: 9900200 },
  { easting: 200200, northing: 9900000 },
]

/** Same square shifted +100 m east and +100 m north → 100 × 100 m overlap. */
const OVERLAPPING_PARCEL: SurveyPoint[] = [
  { easting: 200100, northing: 9900100 },
  { easting: 200100, northing: 9900300 },
  { easting: 200300, northing: 9900300 },
  { easting: 200300, northing: 9900100 },
]

/** Square 5 km away — no possible intersection. */
const DISJOINT_PARCEL: SurveyPoint[] = [
  { easting: 205000, northing: 9900000 },
  { easting: 205000, northing: 9900200 },
  { easting: 205200, northing: 9900200 },
  { easting: 205200, northing: 9900000 },
]

/** 50 × 50 m square fully inside NEW_PARCEL; area 2,500 m². */
const CONTAINED_PARCEL: SurveyPoint[] = [
  { easting: 200050, northing: 9900050 },
  { easting: 200050, northing: 9900100 },
  { easting: 200100, northing: 9900100 },
  { easting: 200100, northing: 9900050 },
]

/** 300 × 300 m square that fully contains NEW_PARCEL; area 90,000 m². */
const CONSUMING_PARCEL: SurveyPoint[] = [
  { easting: 199900, northing: 9899900 },
  { easting: 199900, northing: 9900300 },
  { easting: 200300, northing: 9900300 },
  { easting: 200300, northing: 9900000 },
]

/** Square sharing NEW_PARCEL's eastern boundary exactly (zero overlap area). */
const EDGE_TOUCHING_PARCEL: SurveyPoint[] = [
  { easting: 200200, northing: 9900000 },
  { easting: 200200, northing: 9900200 },
  { easting: 200400, northing: 9900200 },
  { easting: 200400, northing: 9900000 },
]

// ─── Helpers ─────────────────────────────────────────────────────────────
/** Area (m²) of a vertex ring computed through the real turf pipeline. */
async function areaOf(vertices: SurveyPoint[]): Promise<number> {
  return calculateParcelAreaSqM(vertices, 'EPSG:21037')
}

/** Assert `value` equals `target` within the 1 cm round-trip tolerance. */
function expectNear(value: number, target: number, tolerance = 0.01): void {
  expect(Math.abs(value - target)).toBeLessThanOrEqual(tolerance)
}

interface BBox {
  minE: number
  maxE: number
  minN: number
  maxN: number
}

function bboxOf(vertices: SurveyPoint[]): BBox {
  return {
    minE: Math.min(...vertices.map((v) => v.easting)),
    maxE: Math.max(...vertices.map((v) => v.easting)),
    minN: Math.min(...vertices.map((v) => v.northing)),
    maxN: Math.max(...vertices.map((v) => v.northing)),
  }
}

describe('turfHelpers boolean geometry (real turf + proj4 integration)', () => {
  // ── calculateIntersection ──────────────────────────────────────────────
  describe('calculateIntersection', () => {
    it('returns the 100 × 100 m overlap polygon for overlapping parcels', async () => {
      const result = await calculateIntersection(NEW_PARCEL, OVERLAPPING_PARCEL)
      expect(result).not.toBeNull()
      const ring = result as SurveyPoint[]

      const box = bboxOf(ring)
      expectNear(box.minE, 200100)
      expectNear(box.maxE, 200200)
      expectNear(box.minN, 9900100)
      expectNear(box.maxN, 9900200)

      // 100 m × 100 m intersection; turf round-trips through lon/lat
      const area = await areaOf(ring)
      expect(area).toBeGreaterThan(9500)
      expect(area).toBeLessThan(10500)
    })

    it('returns the contained parcel itself when one parcel is fully inside the other', async () => {
      const result = await calculateIntersection(NEW_PARCEL, CONTAINED_PARCEL)
      expect(result).not.toBeNull()
      const ring = result as SurveyPoint[]

      // The intersection of a parcel with a strictly contained parcel is the
      // contained parcel: 50 × 50 m = 2,500 m².
      const area = await areaOf(ring)
      expect(area).toBeGreaterThan(2400)
      expect(area).toBeLessThan(2600)

      const box = bboxOf(ring)
      expectNear(box.minE, 200050)
      expectNear(box.maxE, 200100)
      expectNear(box.minN, 9900050)
      expectNear(box.maxN, 9900100)
    })

    it('returns null for disjoint parcels', async () => {
      const result = await calculateIntersection(NEW_PARCEL, DISJOINT_PARCEL)
      expect(result).toBeNull()
    })

    it('returns null for edge-touching parcels (shared boundary, zero area)', async () => {
      // A legitimate shared RIM boundary must yield no intersection — the
      // degenerate zero-area result turf can produce must map to null, not a
      // hairline polygon.
      const result = await calculateIntersection(NEW_PARCEL, EDGE_TOUCHING_PARCEL)
      expect(result).toBeNull()
    })
  })

  // ── calculateUnion ─────────────────────────────────────────────────────
  describe('calculateUnion', () => {
    it('merges overlapping parcels into the combined 70,000 m² footprint', async () => {
      const result = await calculateUnion(NEW_PARCEL, OVERLAPPING_PARCEL)

      // 40,000 + 40,000 − 10,000 shared = 70,000 m². Under the old two-arg
      // union call the second parcel was silently ignored and this read
      // 40,000 — the area assertion is the regression guard.
      const area = await areaOf(result)
      expect(area).toBeGreaterThan(69000)
      expect(area).toBeLessThan(71000)

      // Union spans both outer corners: easting 200000–200300, northing 9900000–9900300
      const box = bboxOf(result)
      expectNear(box.minE, 200000)
      expectNear(box.maxE, 200300)
      expectNear(box.minN, 9900000)
      expectNear(box.maxN, 9900300)
    })

    it('returns the larger parcel unchanged when one contains the other', async () => {
      const result = await calculateUnion(NEW_PARCEL, CONTAINED_PARCEL)
      const area = await areaOf(result)
      expect(area).toBeGreaterThan(39000)
      expect(area).toBeLessThan(41000)

      const box = bboxOf(result)
      expectNear(box.minE, 200000)
      expectNear(box.maxE, 200200)
      expectNear(box.minN, 9900000)
      expectNear(box.maxN, 9900200)
    })

    it('resolves for disjoint parcels (MultiPolygon, first member returned)', async () => {
      // Disjoint inputs produce a turf MultiPolygon. turfToVertices extracts
      // the first polygon's exterior ring, so the documented behaviour is
      // "one of the two squares" — the important guard is that the call
      // resolves without throwing and yields valid ring geometry.
      const result = await calculateUnion(NEW_PARCEL, DISJOINT_PARCEL)
      expect(result.length).toBeGreaterThanOrEqual(4)

      const area = await areaOf(result)
      expect(area).toBeGreaterThan(39000)
      expect(area).toBeLessThan(41000)
    })
  })

  // ── calculateDifference ────────────────────────────────────────────────
  describe('calculateDifference', () => {
    it('subtracts the 10,000 m² overlap, leaving 30,000 m²', async () => {
      const result = await calculateDifference(NEW_PARCEL, OVERLAPPING_PARCEL)
      expect(result).not.toBeNull()
      const ring = result as SurveyPoint[]

      // 40,000 − 10,000 shared = 30,000 m². Under the old two-arg difference
      // call the subtracted parcel was ignored and this read 40,000.
      const area = await areaOf(ring)
      expect(area).toBeGreaterThan(29000)
      expect(area).toBeLessThan(31000)

      // The removed region is the north-east quadrant (easting > 200100,
      // northing > 9900100). The remainder is an L-shape: its bottom bar
      // still spans the full 200000–200200 width, and its west bar keeps the
      // full height up to northing 9900200 (the notch only cuts the
      // north-east quadrant).
      const box = bboxOf(ring)
      expectNear(box.minE, 200000)
      expectNear(box.maxE, 200200)
      expectNear(box.minN, 9900000)
      expectNear(box.maxN, 9900200)
    })

    it('cutting out a contained parcel leaves the container exterior ring (hole not represented)', async () => {
      const result = await calculateDifference(NEW_PARCEL, CONTAINED_PARCEL)
      expect(result).not.toBeNull()
      const ring = result as SurveyPoint[]

      // turf.difference returns a Polygon with an interior hole. The public
      // API returns SurveyPoint[] — a single ring — and turfToVertices
      // extracts only the exterior ring (coordinates[0]), so the hole is
      // dropped and the area is the container's ~40,000 m², NOT 37,500 m².
      // This documents the current contract; callers must not rely on
      // interior cuts producing a smaller area through this function.
      const area = await areaOf(ring)
      expect(area).toBeGreaterThan(39000)
      expect(area).toBeLessThan(41000)

      const box = bboxOf(ring)
      expectNear(box.minE, 200000)
      expectNear(box.maxE, 200200)
      expectNear(box.minN, 9900000)
      expectNear(box.maxN, 9900200)
    })

    it('returns null when parcel2 fully contains parcel1 (nothing remains)', async () => {
      const result = await calculateDifference(NEW_PARCEL, CONSUMING_PARCEL)
      expect(result).toBeNull()
    })

    it('returns the source parcel unchanged for disjoint inputs', async () => {
      const result = await calculateDifference(NEW_PARCEL, DISJOINT_PARCEL)
      expect(result).not.toBeNull()
      const ring = result as SurveyPoint[]

      const area = await areaOf(ring)
      expect(area).toBeGreaterThan(39000)
      expect(area).toBeLessThan(41000)
    })
  })
})
