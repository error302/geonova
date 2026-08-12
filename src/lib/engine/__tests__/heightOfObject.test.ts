import { heightOfObject } from '../heightOfObject'
import { approxEqual } from '@/test-utils/approx'

describe('heightOfObject', () => {
  it('computes height from horizontal distance and two vertical angles', () => {
    // D=50m, top angle=30°, base angle=10°, HI=1.5m
    const r = heightOfObject({ horizontalDistance: 50, angleTopDeg: 30, angleBaseDeg: 10, instrumentHeight: 1.5 })
    expect(Number.isFinite(r.heightFromHI)).toBe(true)
    expect(Number.isFinite(r.totalHeight)).toBe(true)
    expect(r.totalHeight).toBeGreaterThan(r.heightFromHI)
  })

  it('totalHeight = heightFromHI + instrumentHeight', () => {
    const r = heightOfObject({ horizontalDistance: 100, angleTopDeg: 20, angleBaseDeg: 5, instrumentHeight: 1.6 })
    expect(approxEqual(r.totalHeight, r.heightFromHI + 1.6, 10 ** -6)).toBe(true)
  })

  it('height is zero when both angles are equal', () => {
    const r = heightOfObject({ horizontalDistance: 100, angleTopDeg: 15, angleBaseDeg: 15, instrumentHeight: 0 })
    expect(approxEqual(r.heightFromHI, 0, 10 ** -6)).toBe(true)
  })

  it('height increases with larger top angle', () => {
    const base = heightOfObject({ horizontalDistance: 80, angleTopDeg: 25, angleBaseDeg: 5, instrumentHeight: 1.5 })
    const larger = heightOfObject({ horizontalDistance: 80, angleTopDeg: 40, angleBaseDeg: 5, instrumentHeight: 1.5 })
    expect(larger.heightFromHI).toBeGreaterThan(base.heightFromHI)
  })

  it('Basak example: D=80m, top=35°, base=10°, HI=1.45m', () => {
    const r = heightOfObject({ horizontalDistance: 80, angleTopDeg: 35, angleBaseDeg: 10, instrumentHeight: 1.45 })
    // H = 80*(tan35° - tan10°) ≈ 80*(0.7002 - 0.1763) ≈ 41.91m above HI
    expect(approxEqual(r.heightFromHI, 41.91, 10 ** -1)).toBe(true)
  })
})
