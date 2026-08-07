/**
 * Integration tests for RIM overlap detection using the REAL geospatial stack.
 *
 * These tests deliberately do NOT mock @turf/turf or proj4. The unit suites
 * (turfHelpers.test.ts, topologyChecker.test.ts) mock both, so they cannot
 * catch API-contract regressions like turf 7's intersect()/difference()
 * taking a single FeatureCollection — the old two-argument call silently
 * ignored the second polygon, so overlap checks never fired. The disjoint
 * case below is the regression guard: under the old bug it would report an
 * overlap (a parcel intersects itself) and fail. Running the real
 * lazy-loaded turf + proj4 pipeline end-to-end locks the fix in at the
 * overlapDetection level.
 *
 * Coordinates are simple Kenya UTM 37S squares (EPSG:21037, the default the
 * helpers use), so the transform stays lightweight while still exercising the
 * full UTM → WGS84 → turf → UTM round-trip.
 */

import { calculateIntersection } from '@/lib/map/turfHelpers'
import { shoelaceArea } from '@/lib/engine/area'
import { detectOverlaps, hasAnyOverlap, MIN_OVERLAP_AREA_SQM, type ParcelForOverlap } from '../overlapDetection'

// ─── Fixtures: 200 m × 200 m squares in UTM 37S ──────────────────────────
const NEW_PARCEL: ParcelForOverlap = {
  parcelNumber: 'LR 1000/1',
  vertices: [
    { easting: 200000, northing: 9900000 },
    { easting: 200000, northing: 9900200 },
    { easting: 200200, northing: 9900200 },
    { easting: 200200, northing: 9900000 },
  ],
}

/** Same square shifted +100 m east and +100 m north → 100 m × 100 m overlap. */
const OVERLAPPING_PARCEL: ParcelForOverlap = {
  parcelNumber: 'LR 1000/2',
  vertices: [
    { easting: 200100, northing: 9900100 },
    { easting: 200100, northing: 9900300 },
    { easting: 200300, northing: 9900300 },
    { easting: 200300, northing: 9900100 },
  ],
}

/** Square 5 km away — no possible intersection. */
const DISJOINT_PARCEL: ParcelForOverlap = {
  parcelNumber: 'LR 1000/3',
  vertices: [
    { easting: 205000, northing: 9900000 },
    { easting: 205000, northing: 9900200 },
    { easting: 205200, northing: 9900200 },
    { easting: 205200, northing: 9900000 },
  ],
}

/**
 * Square sharing NEW_PARCEL's eastern boundary edge exactly (both squares
 * lie on the line easting = 200200). Zero overlap area — a legitimate
 * shared RIM boundary between two abutting parcels. The sub-centimeter
 * noise threshold (MIN_OVERLAP_AREA_SQM = 0.01 m²) must NOT false-positive
 * on the numerical sliver the UTM → WGS84 → turf round-trip may produce.
 */
const EDGE_TOUCHING_PARCEL: ParcelForOverlap = {
  parcelNumber: 'LR 1000/4',
  vertices: [
    { easting: 200200, northing: 9900000 },
    { easting: 200200, northing: 9900200 },
    { easting: 200400, northing: 9900200 },
    { easting: 200400, northing: 9900000 },
  ],
}

/**
 * Square with a 5 mm gap (0.005 m) east of NEW_PARCEL's eastern boundary —
 * the tightest legitimate near-edge case. The UTM → WGS84 → turf round-trip
 * must not manufacture an above-threshold sliver here either.
 */
const NEAR_EDGE_PARCEL: ParcelForOverlap = {
  parcelNumber: 'LR 1000/5',
  vertices: [
    { easting: 200200.005, northing: 9900000 },
    { easting: 200200.005, northing: 9900200 },
    { easting: 200400.005, northing: 9900200 },
    { easting: 200400.005, northing: 9900000 },
  ],
}

describe('RIM overlap detection (real turf + proj4 integration)', () => {
  it('flags a genuinely overlapping parcel as an overlap', async () => {
    await expect(
      hasAnyOverlap({ newParcel: NEW_PARCEL, existingParcels: [OVERLAPPING_PARCEL] })
    ).resolves.toBe(true)
  })

  it('reports disjoint parcels as no overlap', async () => {
    await expect(
      hasAnyOverlap({ newParcel: NEW_PARCEL, existingParcels: [DISJOINT_PARCEL] })
    ).resolves.toBe(false)
  })

  it('reports edge-touching parcels (shared boundary, zero area) as no overlap', async () => {
    // Two parcels that share only a boundary line must NOT be flagged — this
    // is the legitimate abutting-parcels case on a RIM sheet. Before the
    // sub-centimeter threshold existed, the transform round-trip could
    // produce a hairline sliver that looked like a real overlap.
    await expect(
      hasAnyOverlap({ newParcel: NEW_PARCEL, existingParcels: [EDGE_TOUCHING_PARCEL] })
    ).resolves.toBe(false)
  })

  it('detectOverlaps checks edge-touching parcels fully and reports no overlap', async () => {
    const result = await detectOverlaps({
      newParcel: NEW_PARCEL,
      existingParcels: [EDGE_TOUCHING_PARCEL],
    })

    // The abutting parcel is valid geometry (not skipped) and the check runs
    // to completion — it just must not produce a flagged overlap.
    expect(result.hasOverlaps).toBe(false)
    expect(result.overlaps).toHaveLength(0)
    expect(result.checkedCount).toBe(1)
    expect(result.skippedCount).toBe(0)
  })

  it('detectOverlaps reports exactly the real overlap with its area and percent', async () => {
    const result = await detectOverlaps({
      newParcel: NEW_PARCEL,
      existingParcels: [OVERLAPPING_PARCEL, DISJOINT_PARCEL],
    })

    expect(result.hasOverlaps).toBe(true)
    expect(result.overlaps).toHaveLength(1)
    expect(result.overlaps[0].existingParcelNumber).toBe('LR 1000/2')
    // 100 m × 100 m intersection; turf round-trips through lon/lat, so allow distortion
    expect(result.overlaps[0].overlapAreaSqm).toBeGreaterThan(9500)
    expect(result.overlaps[0].overlapAreaSqm).toBeLessThan(10500)
    // 10,000 m² / 40,000 m² = 25%
    expect(result.overlaps[0].overlapPercent).toBeCloseTo(25, 1)
    expect(result.newParcelAreaSqm).toBe(40000)
    expect(result.checkedCount).toBe(2)
    expect(result.skippedCount).toBe(0)
  })

  it('detectOverlaps returns a clean result when nothing overlaps', async () => {
    const result = await detectOverlaps({
      newParcel: NEW_PARCEL,
      existingParcels: [DISJOINT_PARCEL],
    })

    expect(result.hasOverlaps).toBe(false)
    expect(result.overlaps).toHaveLength(0)
    expect(result.checkedCount).toBe(1)
    expect(result.skippedCount).toBe(0)
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0)
  })

  it('reports a parcel 5 mm from the boundary (0.005 m gap) as no overlap', async () => {
    // Near-edge stress: a 5 mm gap is close enough that coordinate rounding in
    // the UTM → WGS84 → turf round-trip could manufacture a hairline sliver,
    // but far enough that it must never be treated as a boundary conflict
    // (real RIM parcels routinely abut within survey tolerance).
    await expect(
      hasAnyOverlap({ newParcel: NEW_PARCEL, existingParcels: [NEAR_EDGE_PARCEL] })
    ).resolves.toBe(false)
  })

  it('keeps raw slivers at near-edge separations below MIN_OVERLAP_AREA_SQM (contract pin)', async () => {
    // Measure the raw intersections directly (bypassing hasAnyOverlap) and pin
    // them below the exported threshold. The 5 mm gap is a no-false-positive
    // guard; the shared-edge pair is where the UTM → WGS84 → turf round-trip
    // can actually manufacture a hairline sliver. Because both assertions
    // reference the real constant, loosening MIN_OVERLAP_AREA_SQM below the
    // measured sliver magnitude fails the test — the noise floor is guarded
    // at the contract level, not by a magic number.
    const nearEdgeSliver = await calculateIntersection(
      NEW_PARCEL.vertices,
      NEAR_EDGE_PARCEL.vertices
    )
    expect(shoelaceArea(nearEdgeSliver ?? [])).toBeLessThan(MIN_OVERLAP_AREA_SQM)

    const touchingSliver = await calculateIntersection(
      NEW_PARCEL.vertices,
      EDGE_TOUCHING_PARCEL.vertices
    )
    expect(shoelaceArea(touchingSliver ?? [])).toBeLessThan(MIN_OVERLAP_AREA_SQM)

    const result = await detectOverlaps({
      newParcel: NEW_PARCEL,
      existingParcels: [NEAR_EDGE_PARCEL],
    })
    expect(result.hasOverlaps).toBe(false)
    expect(result.overlaps).toHaveLength(0)
    expect(result.checkedCount).toBe(1)
    expect(result.skippedCount).toBe(0)
  })
})
