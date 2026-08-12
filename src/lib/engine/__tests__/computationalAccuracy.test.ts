import { approxEqual } from '@/test-utils/approx'
/**
 * Tests for computationalAccuracy — Kahan summation, error propagation,
 * DMS conversion, Kenya bearing parsing, traverse precision standards.
 *
 * References:
 *   - Survey Act Cap 299 (Kenya)
 *   - "Elementary Surveying" by Ghilani & Wolf, 13th Ed.
 *   - RDM 1.1 (Kenya Survey Regulations)
 */

import {
  kahanSum,
  propagateAdditionError,
  propagateMultiplicationError,
  decimalToDMS,
  dmsToDecimal,
  parseKenyaBearing,
  TRAVERSE_PRECISION_STANDARDS,
  evaluateTraversePrecision,
  applyGridConvergence,
} from '../computationalAccuracy'

describe('kahanSum', () => {
  it('returns 0 for an empty array', () => {
    expect(kahanSum([])).toBe(0)
  })

  it('returns the value itself for a single-element array', () => {
    expect(kahanSum([42])).toBe(42)
  })

  it('correctly sums positive integers', () => {
    expect(kahanSum([1, 2, 3, 4, 5])).toBe(15)
  })

  it('correctly sums negative numbers', () => {
    expect(kahanSum([-1, -2, -3, 4, 5])).toBe(3)
  })

  it('matches simple summation for normal magnitudes', () => {
    const values = [1.5, 2.5, 3.5, 4.5]
    expect(approxEqual(kahanSum(values), values.reduce((a, b) => a + b, 0), 10 ** -10)).toBe(true)
  })

  it('reduces round-off error for mixed-magnitude sums', () => {
    const large = 1e8
    const small = 1e-8
    const values = [large, small, small, small, small, small, small, small, small, small]
    const kahan = kahanSum(values)
    const naive = values.reduce((a, b) => a + b, 0)
    expect(Math.abs(kahan - large)).toBeLessThanOrEqual(Math.abs(naive - large) + 1e-6)
  })
})

describe('propagateAdditionError', () => {
  it('adds errors in quadrature (RSS) for independent measurements', () => {
    expect(approxEqual(propagateAdditionError(3, 4), 5, 10 ** -6)).toBe(true)
  })

  it('returns the input for one zero error', () => {
    expect(approxEqual(propagateAdditionError(5, 0), 5, 10 ** -6)).toBe(true)
  })

  it('returns 0 for both zero errors', () => {
    expect(propagateAdditionError(0, 0)).toBe(0)
  })

  it('handles equal errors', () => {
    expect(approxEqual(propagateAdditionError(1, 1), Math.sqrt(2), 10 ** -6)).toBe(true)
  })
})

describe('propagateMultiplicationError', () => {
  it('returns both value and sigma', () => {
    const result = propagateMultiplicationError(10, 0.1, 20, 0.2)
    expect(result.value).toBe(200)
    expect(typeof result.sigma).toBe('number')
    expect(result.sigma).toBeGreaterThan(0)
  })

  it('returns sigma=0 when both inputs have zero error', () => {
    const result = propagateMultiplicationError(10, 0, 20, 0)
    expect(result.value).toBe(200)
    expect(result.sigma).toBe(0)
  })

  it('computes the correct relative error', () => {
    // x=10, sx=0.1 → rel=0.01
    // y=20, sy=0.2 → rel=0.01
    // combined rel = sqrt(0.0001 + 0.0002) = sqrt(0.0002) wait that's wrong
    // combined rel = sqrt(0.01^2 + 0.01^2) = sqrt(0.0001 + 0.0001) = sqrt(0.0002) ≈ 0.014142
    // abs sigma = 200 * 0.014142 ≈ 2.828
    const result = propagateMultiplicationError(10, 0.1, 20, 0.2)
    expect(approxEqual(result.sigma, 2.828427, 10 ** -4)).toBe(true)
  })
})

describe('decimalToDMS', () => {
  it('converts 0° to 0°0\'0"', () => {
    const r = decimalToDMS(0)
    expect(r.degrees).toBe(0)
    expect(r.minutes).toBe(0)
    expect(approxEqual(r.seconds, 0, 10 ** -6)).toBe(true)
  })

  it('converts 90° to 90°0\'0"', () => {
    const r = decimalToDMS(90)
    expect(r.degrees).toBe(90)
    expect(r.minutes).toBe(0)
    expect(approxEqual(r.seconds, 0, 10 ** -6)).toBe(true)
  })

  it('converts 45.5° to 45°30\'0"', () => {
    const r = decimalToDMS(45.5)
    expect(r.degrees).toBe(45)
    expect(r.minutes).toBe(30)
    expect(approxEqual(r.seconds, 0, 10 ** -6)).toBe(true)
  })

  it('returns a formatted string', () => {
    const r = decimalToDMS(45.5)
    expect(r.formatted).toContain("45")
    expect(r.formatted).toContain("30")
  })

  it('normalizes angles > 360°', () => {
    const r = decimalToDMS(360)
    // 360 % 360 = 0
    expect(r.degrees).toBe(0)
  })

  it('normalizes negative angles', () => {
    const r = decimalToDMS(-90)
    // -90 + 360 = 270
    expect(r.degrees).toBe(270)
  })
})

describe('dmsToDecimal', () => {
  it('converts 0°0\'0" to 0', () => {
    expect(dmsToDecimal(0, 0, 0)).toBe(0)
  })

  it('converts 90°0\'0" to 90', () => {
    expect(dmsToDecimal(90, 0, 0)).toBe(90)
  })

  it('converts 45°30\'0" to 45.5', () => {
    expect(approxEqual(dmsToDecimal(45, 30, 0), 45.5, 10 ** -6)).toBe(true)
  })

  it('converts 45°1\'0" to 45.016667', () => {
    expect(approxEqual(dmsToDecimal(45, 1, 0), 45 + 1 / 60, 10 ** -6)).toBe(true)
  })

  it('is approximately the inverse of decimalToDMS', () => {
    const original = 123.456
    const dms = decimalToDMS(original)
    const back = dmsToDecimal(dms.degrees, dms.minutes, dms.seconds)
    expect(approxEqual(back, original, 10 ** -4)).toBe(true)
  })
})

describe('parseKenyaBearing', () => {
  it('parses a plain decimal bearing', () => {
    expect(approxEqual(parseKenyaBearing('45.5'), 45.5, 10 ** -6)).toBe(true)
  })

  it('parses the Kenya DDD.MMSS format', () => {
    // 45.3015 = 45°30'15"
    // = 45 + 30/60 + 15/3600 = 45.504167°
    expect(approxEqual(parseKenyaBearing('45.3015'), 45 + 30 / 60 + 15 / 3600, 10 ** -6)).toBe(true)
  })

  it('parses the Kenya DDD.MM format (no seconds)', () => {
    // 45.30 = 45°30'00" = 45.5°
    expect(approxEqual(parseKenyaBearing('45.30'), 45.5, 10 ** -6)).toBe(true)
  })

  it('parses 0', () => {
    expect(parseKenyaBearing('0')).toBe(0)
  })

  it('returns null for invalid input', () => {
    expect(parseKenyaBearing('not a bearing')).toBeNull()
  })

  it('strips degree/minute/second symbols', () => {
    // After stripping symbols, "45.5" parses as decimal
    const result = parseKenyaBearing("45.5°")
    expect(approxEqual(result, 45.5, 10 ** -6)).toBe(true)
  })
})

describe('TRAVERSE_PRECISION_STANDARDS', () => {
  it('defines 4 categories (urban, rural, topographic, control)', () => {
    expect(Object.keys(TRAVERSE_PRECISION_STANDARDS)).toContain('urban')
    expect(Object.keys(TRAVERSE_PRECISION_STANDARDS)).toContain('rural')
    expect(Object.keys(TRAVERSE_PRECISION_STANDARDS)).toContain('topographic')
    expect(Object.keys(TRAVERSE_PRECISION_STANDARDS)).toContain('control')
  })

  it('control surveys have the highest precision requirement', () => {
    expect(TRAVERSE_PRECISION_STANDARDS.control.minPrecision).toBeGreaterThan(
      TRAVERSE_PRECISION_STANDARDS.topographic.minPrecision,
    )
  })

  it('urban surveys require 1:10,000 minimum precision', () => {
    expect(TRAVERSE_PRECISION_STANDARDS.urban.minPrecision).toBe(10000)
  })

  it('each category defines a maxAngularMisclosure function', () => {
    expect(typeof TRAVERSE_PRECISION_STANDARDS.urban.maxAngularMisclosure).toBe('function')
    expect(typeof TRAVERSE_PRECISION_STANDARDS.rural.maxAngularMisclosure).toBe('function')
    expect(typeof TRAVERSE_PRECISION_STANDARDS.topographic.maxAngularMisclosure).toBe('function')
    expect(typeof TRAVERSE_PRECISION_STANDARDS.control.maxAngularMisclosure).toBe('function')
  })

  it('angular misclosure scales with √n (number of stations)', () => {
    const one = TRAVERSE_PRECISION_STANDARDS.urban.maxAngularMisclosure(1)
    const four = TRAVERSE_PRECISION_STANDARDS.urban.maxAngularMisclosure(4)
    // √4 = 2, so misclosure at 4 stations should be 2x at 1 station
    expect(approxEqual(four / one, 2, 10 ** -4)).toBe(true)
  })
})

describe('evaluateTraversePrecision', () => {
  it('returns a structured precision check', () => {
    const result = evaluateTraversePrecision(0.010, 1000, 5, 4, 'urban')
    expect(result).toHaveProperty('category')
    expect(result).toHaveProperty('linearPrecision')
    expect(result).toHaveProperty('overallPass')
    expect(result).toHaveProperty('report')
  })

  it('passes for a high-precision urban traverse', () => {
    // 1km traverse with 10mm misclosure = 1:100,000 (passes 1:10,000)
    // 4 stations, 5" misclosure (passes 15"√4 = 30")
    const result = evaluateTraversePrecision(0.010, 1000, 5, 4, 'urban')
    expect(result.passesLinear).toBe(true)
    expect(result.passesAngular).toBe(true)
    expect(result.overallPass).toBe(true)
  })

  it('fails linear for a low-precision traverse', () => {
    // 1km traverse with 1m misclosure = 1:1,000 (fails 1:10,000)
    const result = evaluateTraversePrecision(1.0, 1000, 5, 4, 'urban')
    expect(result.passesLinear).toBe(false)
  })

  it('fails angular for excessive misclosure', () => {
    // 4 stations, 60" misclosure (fails 30" max for urban)
    const result = evaluateTraversePrecision(0.010, 1000, 60, 4, 'urban')
    expect(result.passesAngular).toBe(false)
  })

  it('defaults to urban category', () => {
    const result = evaluateTraversePrecision(0.010, 1000, 5, 4)
    expect(result.category).toBe('urban')
  })
})

describe('applyGridConvergence', () => {
  it('subtracts positive grid convergence (east of CM)', () => {
    // True = Grid - Convergence
    expect(approxEqual(applyGridConvergence(90, 0.5), 89.5, 10 ** -6)).toBe(true)
  })

  it('adds negative grid convergence (west of CM)', () => {
    expect(approxEqual(applyGridConvergence(90, -0.5), 90.5, 10 ** -6)).toBe(true)
  })

  it('returns the bearing unchanged for zero convergence', () => {
    expect(approxEqual(applyGridConvergence(45, 0), 45, 10 ** -6)).toBe(true)
  })

  it('wraps around 360° correctly', () => {
    // 1° - 2° = -1° → +360 = 359°
    expect(approxEqual(applyGridConvergence(1, 2), 359, 10 ** -6)).toBe(true)
  })

  it('wraps around 0° correctly', () => {
    // 359° - (-2°) = 361° → -360 = 1°
    expect(approxEqual(applyGridConvergence(359, -2), 1, 10 ** -6)).toBe(true)
  })

  it('returns 0 for 360° input with 0 convergence', () => {
    // 360 - 0 = 360, then 360 >= 360 → 0
    expect(approxEqual(applyGridConvergence(360, 0), 0, 10 ** -6)).toBe(true)
  })
})
