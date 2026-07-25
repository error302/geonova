/**
 * P2-6: LAMBDA method tests
 *
 * Tests the TypeScript-native LAMBDA implementation against known
 * cases and edge cases. The LAMBDA method is the standard algorithm
 * for GNSS integer ambiguity resolution (Teunissen 1995).
 */

import { lambdaResolve, resolveSingleAmbiguity } from '../lambda'

describe('P2-6: LAMBDA integer ambiguity resolution', () => {
  describe('single ambiguity (n=1)', () => {
    test('clean integer — resolves immediately', () => {
      const result = lambdaResolve({
        floatAmbiguities: [5.0],
        covariance: [[0.1]],
      })
      expect(result.fixedAmbiguities).toEqual([5])
      expect(result.validated).toBe(true)
    })

    test('near-integer — rounds correctly', () => {
      const result = lambdaResolve({
        floatAmbiguities: [5.05],
        covariance: [[0.01]],
      })
      expect(result.fixedAmbiguities).toEqual([5])
      expect(result.validated).toBe(true) // very small variance → high ratio
    })

    test('halfway between integers — low confidence', () => {
      const result = lambdaResolve({
        floatAmbiguities: [5.5],
        covariance: [[0.01]],
        ratioThreshold: 2.0,
      })
      // 5.5 is equidistant from 5 and 6 — ratio ≈ 1, not validated
      // The search may return either 5 or 6 (both are equidistant)
      expect(result.fixedAmbiguities[0]).toBeGreaterThanOrEqual(5)
      expect(result.fixedAmbiguities[0]).toBeLessThanOrEqual(6)
      expect(result.validated).toBe(false)
    })

    test('resolveSingleAmbiguity convenience function', () => {
      const result = resolveSingleAmbiguity(5.05, 0.01)
      expect(result.fixed).toBe(5)
      expect(result.validated).toBe(true)
    })
  })

  describe('two ambiguities (n=2)', () => {
    test('clean integers — resolves immediately', () => {
      const result = lambdaResolve({
        floatAmbiguities: [10.0, 20.0],
        covariance: [
          [0.1, 0.05],
          [0.05, 0.1],
        ],
      })
      expect(result.fixedAmbiguities).toEqual([10, 20])
      expect(result.validated).toBe(true)
    })

    test('near-integers with correlation — resolves correctly', () => {
      const result = lambdaResolve({
        floatAmbiguities: [10.1, 19.9],
        covariance: [
          [0.2, 0.15],
          [0.15, 0.2],
        ],
        ratioThreshold: 2.0,
      })
      expect(result.fixedAmbiguities).toEqual([10, 20])
      expect(result.validated).toBe(true)
    })

    test('uncorrelated — standard case', () => {
      const result = lambdaResolve({
        floatAmbiguities: [3.85, 7.12],
        covariance: [
          [0.5, 0],
          [0, 0.5],
        ],
        ratioThreshold: 2.0,
      })
      expect(result.fixedAmbiguities).toEqual([4, 7])
      // With variance 0.5, the ratio might be marginal
      // Just check we get the right integers
    })
  })

  describe('three ambiguities (n=3)', () => {
    test('typical GPS L1 case', () => {
      // 3 satellite ambiguities, moderate variance, some correlation
      const result = lambdaResolve({
        floatAmbiguities: [5.85, 9.12, -3.07],
        covariance: [
          [0.12, 0.09, 0.07],
          [0.09, 0.15, 0.06],
          [0.07, 0.06, 0.10],
        ],
        ratioThreshold: 2.0,
      })
      expect(result.fixedAmbiguities).toEqual([6, 9, -3])
      expect(result.validated).toBe(true)
    })

    test('high variance — may not validate', () => {
      const result = lambdaResolve({
        floatAmbiguities: [5.5, 9.5, -3.5],
        covariance: [
          [1.0, 0.5, 0.3],
          [0.5, 1.0, 0.4],
          [0.3, 0.4, 1.0],
        ],
        ratioThreshold: 2.0,
      })
      // Half-integer values with high variance → low ratio
      // Should still return integers, just might not validate
      expect(result.fixedAmbiguities).toHaveLength(3)
      result.fixedAmbiguities.forEach(v => {
        expect(Number.isInteger(v)).toBe(true)
      })
    })
  })

  describe('edge cases', () => {
    test('empty ambiguity vector throws', () => {
      expect(() =>
        lambdaResolve({
          floatAmbiguities: [],
          covariance: [],
        }),
      ).toThrow('empty')
    })

    test('mismatched covariance dimensions throws', () => {
      expect(() =>
        lambdaResolve({
          floatAmbiguities: [1, 2],
          covariance: [[1]],
        }),
      ).toThrow('2×2')
    })

    test('Z-transformation matrix is unimodular (det = ±1)', () => {
      const result = lambdaResolve({
        floatAmbiguities: [5.85, 9.12, -3.07],
        covariance: [
          [0.12, 0.09, 0.07],
          [0.09, 0.15, 0.06],
          [0.07, 0.06, 0.10],
        ],
      })
      // det(Z) should be ±1 (integer unimodular)
      const det = determinant3x3(result.Z)
      expect(Math.abs(det)).toBe(1)
    })

    test('ratio is always >= 1 when solution exists', () => {
      const result = lambdaResolve({
        floatAmbiguities: [10.1, 19.9],
        covariance: [
          [0.2, 0.15],
          [0.15, 0.2],
        ],
      })
      expect(result.ratio).toBeGreaterThanOrEqual(1)
    })

    test('bestQuadForm <= secondBestQuadForm', () => {
      const result = lambdaResolve({
        floatAmbiguities: [5.85, 9.12, -3.07],
        covariance: [
          [0.12, 0.09, 0.07],
          [0.09, 0.15, 0.06],
          [0.07, 0.06, 0.10],
        ],
      })
      expect(result.bestQuadForm).toBeLessThanOrEqual(result.secondBestQuadForm)
    })
  })

  describe('validation behavior', () => {
    test('high ratio threshold rejects marginal solutions', () => {
      // Near-integer with moderate variance — ratio is decent but not huge
      const result = lambdaResolve({
        floatAmbiguities: [5.2, 9.1],
        covariance: [
          [0.3, 0.1],
          [0.1, 0.3],
        ],
        ratioThreshold: 100, // impossibly high threshold
      })
      expect(result.fixedAmbiguities).toEqual([5, 9])
      expect(result.validated).toBe(false) // can't pass ratio=100
    })

    test('zero threshold always validates', () => {
      const result = lambdaResolve({
        floatAmbiguities: [5.5], // halfway, normally fails
        covariance: [[0.01]],
        ratioThreshold: 0,
      })
      expect(result.validated).toBe(true) // ratio >= 0 is always true
    })
  })
})

/** Compute determinant of a 3×3 matrix. */
function determinant3x3(m: number[][]): number {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  )
}
