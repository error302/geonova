import { coordinateArea, trapezoidalArea, simpsonsArea } from '../area'
import { approxEqual } from '@/test-utils/approx'

describe('coordinateArea', () => {
  it('computes area of a unit square', () => {
    const points = [
      { easting: 0, northing: 0 },
      { easting: 1, northing: 0 },
      { easting: 1, northing: 1 },
      { easting: 0, northing: 1 },
    ]
    expect(approxEqual(coordinateArea(points).areaSqm, 1.0, 10 ** -6)).toBe(true)
  })

  it('computes area of a 3-4-5 right triangle = 6 m²', () => {
    const points = [
      { easting: 0, northing: 0 },
      { easting: 3, northing: 0 },
      { easting: 0, northing: 4 },
    ]
    expect(approxEqual(coordinateArea(points).areaSqm, 6.0, 10 ** -4)).toBe(true)
  })

  it('area is positive regardless of winding order', () => {
    const cw = [
      { easting: 0,  northing: 0  },
      { easting: 0,  northing: 10 },
      { easting: 10, northing: 10 },
      { easting: 10, northing: 0  },
    ]
    const ccw = [...cw].reverse()
    expect(approxEqual(coordinateArea(cw).areaSqm, 100, 10 ** -4)).toBe(true)
    expect(approxEqual(coordinateArea(ccw).areaSqm, 100, 10 ** -4)).toBe(true)
  })

  it('10x10 square = 100 m² = 0.01 ha', () => {
    const points = [
      { easting: 0, northing: 0 }, { easting: 10, northing: 0 },
      { easting: 10, northing: 10 }, { easting: 0, northing: 10 },
    ]
    const r = coordinateArea(points)
    expect(approxEqual(r.areaSqm, 100, 10 ** -4)).toBe(true)
    expect(approxEqual(r.areaHa, 0.01, 10 ** -6)).toBe(true)
  })

  it('returns zero for < 3 points', () => {
    expect(coordinateArea([{ easting: 0, northing: 0 }]).areaSqm).toBe(0)
  })
})

describe('trapezoidalArea', () => {
  it('computes area under a flat line (all equal ordinates)', () => {
    // 5 ordinates, interval 5m → 4 strips × 5m × 10m = 200m²
    const r = trapezoidalArea([10, 10, 10, 10, 10], 5)
    expect(approxEqual(r.areaSqm, 200, 10 ** -4)).toBe(true)
  })

  it('interval scales the area proportionally', () => {
    const a1 = trapezoidalArea([5, 5, 5], 10)
    const a2 = trapezoidalArea([5, 5, 5], 20)
    expect(approxEqual(a2.areaSqm, a1.areaSqm * 2, 10 ** -4)).toBe(true)
  })

  it('triangular profile gives correct area', () => {
    // Ordinates: 0, 10, 0 with interval 10 → area = 100m²
    const r = trapezoidalArea([0, 10, 0], 10)
    expect(approxEqual(r.areaSqm, 100, 10 ** -1)).toBe(true)
  })
})

describe('simpsonsArea', () => {
  it('gives area > 0 for valid input', () => {
    const r = simpsonsArea([2, 4, 6, 4, 2], 1)
    expect(r.areaSqm).toBeGreaterThan(0)
  })

  it('Simpson gives larger area than trapezoidal for convex curve', () => {
    const ordinates = [0, 8, 10, 8, 0]
    const trap = trapezoidalArea(ordinates, 1)
    const simp = simpsonsArea(ordinates, 1)
    expect(simp.areaSqm).toBeGreaterThanOrEqual(trap.areaSqm)
  })
})
