import {
  calculateTrianglePlanArea,
  calculateTriangle3DArea,
  computeFacetPrismoidalVolume,
  computeTinSurfaceToDatumVolume,
  type TriangleFacet,
} from '../constrainedDelaunay'

describe('Exact TIN Prismoidal Volume Engine', () => {
  const p1 = { easting: 0, northing: 0, elevation: 10 }
  const p2 = { easting: 10, northing: 0, elevation: 10 }
  const p3 = { easting: 0, northing: 10, elevation: 10 }

  test('calculates 2D plan area of right triangle (10x10) correctly', () => {
    const area = calculateTrianglePlanArea(p1, p2, p3)
    expect(area).toBe(50.0) // 0.5 * 10 * 10 = 50
  })

  test('calculates 3D spatial area of sloped triangle correctly', () => {
    const p3Sloped = { easting: 0, northing: 10, elevation: 20 }
    const area3D = calculateTriangle3DArea(p1, p2, p3Sloped)
    expect(area3D).toBeGreaterThan(50.0)
    expect(area3D).toBeCloseTo(70.71, 1) // 50 * sqrt(2) ≈ 70.71
  })

  test('computes pure fill prismoidal volume correctly', () => {
    // Design datum = 12m, existing = 10m (dz = +2m everywhere)
    // Volume = Area * height = 50 * 2 = 100 m³
    const res = computeFacetPrismoidalVolume(p1, p2, p3, 2, 2, 2)
    expect(res.fillVol).toBe(100.0)
    expect(res.cutVol).toBe(0.0)
    expect(res.fillArea).toBe(50.0)
  })

  test('computes pure cut prismoidal volume correctly', () => {
    // Design datum = 7m, existing = 10m (dz = -3m everywhere)
    // Volume = Area * height = 50 * 3 = 150 m³
    const res = computeFacetPrismoidalVolume(p1, p2, p3, -3, -3, -3)
    expect(res.cutVol).toBe(150.0)
    expect(res.fillVol).toBe(0.0)
    expect(res.cutArea).toBe(50.0)
  })

  test('computes mixed cut and fill with exact zero-line daylight split', () => {
    // p1 has dz = +2m (fill), p2 has dz = -2m (cut), p3 has dz = -2m (cut)
    const res = computeFacetPrismoidalVolume(p1, p2, p3, 2, -2, -2)
    expect(res.fillVol).toBeGreaterThan(0)
    expect(res.cutVol).toBeGreaterThan(0)
    expect(res.fillArea + res.cutArea).toBeCloseTo(50.0, 4)
    expect(res.zeroLength).toBeGreaterThan(0)
  })

  test('computes full TIN surface to datum volume', () => {
    const triangles: TriangleFacet[] = [
      { p1, p2, p3 },
      {
        p1: { easting: 10, northing: 0, elevation: 10 },
        p2: { easting: 10, northing: 10, elevation: 10 },
        p3: { easting: 0, northing: 10, elevation: 10 },
      },
    ]

    const result = computeTinSurfaceToDatumVolume(triangles, 12.0)
    expect(result.totalPlanArea).toBe(100.0) // 10x10 square
    expect(result.totalFillVolume).toBe(200.0) // 100 * 2 = 200 m³
    expect(result.totalCutVolume).toBe(0.0)
    expect(result.triangleCount).toBe(2)
  })
})
