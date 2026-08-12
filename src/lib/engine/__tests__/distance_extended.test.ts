import { slopeDistance, horizontalDistance, verticalDistance, gradient, polarPoint } from '../distance'
import { approxEqual } from '@/test-utils/approx'

describe('slopeDistance', () => {
  it('returns horizontal distance for 0° vertical angle', () => {
    expect(approxEqual(slopeDistance(100, 0), 100, 10 ** -4)).toBe(true)
  })

  it('slope distance is longer than horizontal for elevated angle', () => {
    expect(slopeDistance(100, 30)).toBeGreaterThan(100)
  })
})

describe('horizontalDistance', () => {
  it('level slope gives same horizontal distance', () => {
    expect(approxEqual(horizontalDistance(100, 0), 100, 10 ** -4)).toBe(true)
  })

  it('inverse of slopeDistance', () => {
    const sd = slopeDistance(80, 20)
    expect(approxEqual(horizontalDistance(sd, 20), 80, 10 ** -3)).toBe(true)
  })
})

describe('verticalDistance', () => {
  it('returns zero for 0° angle', () => {
    expect(approxEqual(verticalDistance(100, 0), 0, 10 ** -6)).toBe(true)
  })

  it('returns slope distance for 90° angle', () => {
    expect(approxEqual(verticalDistance(100, 90), 100, 10 ** -3)).toBe(true)
  })

  it('positive for elevated angles', () => {
    expect(verticalDistance(100, 30)).toBeGreaterThan(0)
  })
})

describe('gradient', () => {
  it('5m rise over 100m gives 5%', () => {
    expect(approxEqual(gradient(5, 100).percentage, 5, 10 ** -4)).toBe(true)
  })

  it('negative rise gives negative gradient', () => {
    expect(approxEqual(gradient(-10, 100).percentage, -10, 10 ** -4)).toBe(true)
  })

  it('degrees and percentage are consistent', () => {
    const g = gradient(10, 100)
    expect(approxEqual(Math.tan(g.degrees * Math.PI / 180) * 100, 10, 10 ** -3)).toBe(true)
  })

  it('returns zero for zero horizontal distance', () => {
    const g = gradient(10, 0)
    expect(g.percentage).toBe(0)
  })
})

describe('polarPoint', () => {
  it('bearing 0° moves point north', () => {
    const r = polarPoint({ easting: 100, northing: 100 }, 0, 50)
    expect(approxEqual(r.easting, 100, 10 ** -3)).toBe(true)
    expect(approxEqual(r.northing, 150, 10 ** -3)).toBe(true)
  })

  it('bearing 90° moves point east', () => {
    const r = polarPoint({ easting: 100, northing: 100 }, 90, 50)
    expect(approxEqual(r.easting, 150, 10 ** -3)).toBe(true)
    expect(approxEqual(r.northing, 100, 10 ** -3)).toBe(true)
  })
})
