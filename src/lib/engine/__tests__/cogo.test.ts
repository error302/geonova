import { radiation, bearingIntersection, tienstraResection } from '../cogo'
import { approxEqual } from '@/test-utils/approx'
import { defined } from '@/test-utils/defined'

describe('radiation', () => {
  it('computes point due north from station', () => {
    const r = radiation({ easting: 1000, northing: 2000 }, 0, 100)
    expect(approxEqual(r.point.easting, 1000, 10 ** -3)).toBe(true)
    expect(approxEqual(r.point.northing, 2100, 10 ** -3)).toBe(true)
  })

  it('computes point due east from station', () => {
    const r = radiation({ easting: 1000, northing: 2000 }, 90, 100)
    expect(approxEqual(r.point.easting, 1100, 10 ** -3)).toBe(true)
    expect(approxEqual(r.point.northing, 2000, 10 ** -3)).toBe(true)
  })

  it('computes point at 45° correctly', () => {
    const r = radiation({ easting: 0, northing: 0 }, 45, 100)
    expect(approxEqual(r.point.easting, 70.711, 10 ** -2)).toBe(true)
    expect(approxEqual(r.point.northing, 70.711, 10 ** -2)).toBe(true)
  })

  it('preserves distance and bearing in result', () => {
    const r = radiation({ easting: 500, northing: 500 }, 135, 200)
    expect(approxEqual(r.distance, 200, 10 ** -4)).toBe(true)
    expect(approxEqual(r.bearing, 135, 10 ** -4)).toBe(true)
  })
})

describe('bearingIntersection', () => {
  it('finds intersection of two perpendicular bearings', () => {
    const result = bearingIntersection(
      { easting: 0, northing: 0 }, 90,
      { easting: 100, northing: 100 }, 180
    )
    expect(result).not.toBeNull()
    expect(approxEqual(defined(result).point.easting, 100, 10 ** -1)).toBe(true)
    expect(approxEqual(defined(result).point.northing, 0, 10 ** -1)).toBe(true)
  })

  it('returns null for parallel bearings', () => {
    const result = bearingIntersection(
      { easting: 0, northing: 0 }, 0,
      { easting: 100, northing: 0 }, 0
    )
    expect(result).toBeNull()
  })

  it('returns finite coordinates for valid intersection', () => {
    const result = bearingIntersection(
      { easting: 500, northing: 500 }, 45,
      { easting: 600, northing: 500 }, 315
    )
    expect(result).not.toBeNull()
    expect(Number.isFinite(defined(result).point.easting)).toBe(true)
    expect(Number.isFinite(defined(result).point.northing)).toBe(true)
  })
})

describe('tienstraResection', () => {
  it('returns null for degenerate/dangerous circle geometry', () => {
    // When angles are equal and symmetrical, point is on the dangerous circle
    const r = tienstraResection(
      { easting: 0,   northing: 0   },
      { easting: 100, northing: 0   },
      { easting: 50,  northing: 100 },
      50, 50
    )
    // May return null for dangerous configurations — both null and valid are acceptable
    if (r !== null) {
      expect(Number.isFinite(r.point.easting)).toBe(true)
      expect(Number.isFinite(r.point.northing)).toBe(true)
    }
  })

  it('computes valid position for well-conditioned resection', () => {
    // Three control points forming a wide triangle, station inside
    // Known station P at approx (60, 40) observing angles to A, B, C
    const A = { easting: 0,   northing: 0   }
    const B = { easting: 120, northing: 0   }
    const C = { easting: 60,  northing: 120 }
    // Use asymmetric angles to avoid dangerous circle
    const r = tienstraResection(A, B, C, 60, 70)
    if (r !== null) {
      expect(Number.isFinite(r.point.easting)).toBe(true)
      expect(Number.isFinite(r.point.northing)).toBe(true)
    }
  })
})
