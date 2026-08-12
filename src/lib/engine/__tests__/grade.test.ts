import { gradeFromElevations } from '../grade'
import { approxEqual } from '@/test-utils/approx'

describe('computeGrade', () => {
  it('computes 5% grade for 5m rise over 100m', () => {
    const r = gradeFromElevations({ elev1: 100, elev2: 105, horizontalDistance: 100 })
    expect(approxEqual(r.gradientPercent, 5, 10 ** -4)).toBe(true)
  })

  it('computes negative grade for downhill', () => {
    const r = gradeFromElevations({ elev1: 110, elev2: 100, horizontalDistance: 100 })
    expect(approxEqual(r.gradientPercent, -10, 10 ** -4)).toBe(true)
  })

  it('computes ratio correctly', () => {
    const r = gradeFromElevations({ elev1: 0, elev2: 1, horizontalDistance: 100 })
    expect(approxEqual(r.ratio, 100, 10 ** -2)).toBe(true) // 1:100
  })

  it('flat ground gives zero grade', () => {
    const r = gradeFromElevations({ elev1: 50, elev2: 50, horizontalDistance: 100 })
    expect(approxEqual(r.gradientPercent, 0, 10 ** -6)).toBe(true)
  })

  it('angle in degrees is correct', () => {
    // 45° slope: rise = distance
    const r = gradeFromElevations({ elev1: 0, elev2: 100, horizontalDistance: 100 })
    expect(approxEqual(r.slopeAngleDeg, 45, 10 ** -2)).toBe(true)
  })
})
