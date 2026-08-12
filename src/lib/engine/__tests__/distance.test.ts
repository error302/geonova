import { distanceBearing } from '../distance'
import { approxEqual } from '@/test-utils/approx'

describe('distanceBearing', () => {
  it('calculates distance due north', () => {
    const r = distanceBearing({ easting: 0, northing: 0 }, { easting: 0, northing: 100 })
    expect(approxEqual(r.distance, 100, 10 ** -4)).toBe(true)
    expect(approxEqual(r.bearing, 0, 10 ** -4)).toBe(true)
  })

  it('calculates bearing due east (90°)', () => {
    const r = distanceBearing({ easting: 0, northing: 0 }, { easting: 100, northing: 0 })
    expect(approxEqual(r.bearing, 90, 10 ** -4)).toBe(true)
    expect(approxEqual(r.distance, 100, 10 ** -4)).toBe(true)
  })

  it('calculates bearing due south (180°)', () => {
    const r = distanceBearing({ easting: 0, northing: 100 }, { easting: 0, northing: 0 })
    expect(approxEqual(r.bearing, 180, 10 ** -4)).toBe(true)
  })

  it('calculates bearing due west (270°)', () => {
    const r = distanceBearing({ easting: 100, northing: 0 }, { easting: 0, northing: 0 })
    expect(approxEqual(r.bearing, 270, 10 ** -4)).toBe(true)
  })

  it('back bearing = forward bearing + 180', () => {
    const r = distanceBearing({ easting: 300, northing: 500 }, { easting: 450, northing: 650 })
    expect(approxEqual(Math.abs(r.backBearing - r.bearing), 180, 10 ** -1)).toBe(true)
  })

  it('3-4-5 triangle gives distance 5', () => {
    const r = distanceBearing({ easting: 0, northing: 0 }, { easting: 3, northing: 4 })
    expect(approxEqual(r.distance, 5, 10 ** -6)).toBe(true)
  })

  it('deltaE and deltaN are correct', () => {
    const r = distanceBearing({ easting: 1000, northing: 2000 }, { easting: 1300, northing: 2400 })
    expect(approxEqual(r.deltaE, 300, 10 ** -4)).toBe(true)
    expect(approxEqual(r.deltaN, 400, 10 ** -4)).toBe(true)
    expect(approxEqual(r.distance, 500, 10 ** -1)).toBe(true)
  })
})
