import { polar2D, polar3D } from '../polar'
import { approxEqual } from '@/test-utils/approx'

describe('polar2D', () => {
  it('bearing 0° (north) moves point northward', () => {
    const r = polar2D({ station: { easting: 500, northing: 500 }, bearing: 0, horizontalDistance: 100 })
    expect(approxEqual(r.easting, 500, 10 ** -3)).toBe(true)
    expect(approxEqual(r.northing, 600, 10 ** -3)).toBe(true)
  })

  it('bearing 90° (east) moves point eastward', () => {
    const r = polar2D({ station: { easting: 500, northing: 500 }, bearing: 90, horizontalDistance: 100 })
    expect(approxEqual(r.easting, 600, 10 ** -3)).toBe(true)
    expect(approxEqual(r.northing, 500, 10 ** -3)).toBe(true)
  })

  it('bearing 180° (south) moves point southward', () => {
    const r = polar2D({ station: { easting: 500, northing: 500 }, bearing: 180, horizontalDistance: 100 })
    expect(approxEqual(r.easting, 500, 10 ** -3)).toBe(true)
    expect(approxEqual(r.northing, 400, 10 ** -3)).toBe(true)
  })

  it('45° bearing gives equal easting and northing increment', () => {
    const r = polar2D({ station: { easting: 0, northing: 0 }, bearing: 45, horizontalDistance: 100 })
    expect(Math.abs(r.easting - r.northing)).toBeLessThan(0.001)
  })
})

describe('polar3D', () => {
  it('level sight (0° vertical) gives same result as polar2D', () => {
    const station = { easting: 100, northing: 200, elevation: 50 }
    const p2 = polar2D({ station, bearing: 60, horizontalDistance: 80 })
    const p3 = polar3D({ station, bearing: 60, slopeDistance: 80, verticalAngle: 0 })
    expect(approxEqual(p3.easting, p2.easting, 10 ** -2)).toBe(true)
    expect(approxEqual(p3.northing, p2.northing, 10 ** -2)).toBe(true)
  })

  it('positive vertical angle raises elevation', () => {
    const station = { easting: 0, northing: 0, elevation: 100 }
    const r = polar3D({ station, bearing: 0, slopeDistance: 100, verticalAngle: 30 })
    expect(r.elevation).toBeGreaterThan(100)
  })

  it('negative vertical angle lowers elevation', () => {
    const station = { easting: 0, northing: 0, elevation: 100 }
    const r = polar3D({ station, bearing: 0, slopeDistance: 100, verticalAngle: -30 })
    expect(r.elevation).toBeLessThan(100)
  })
})
