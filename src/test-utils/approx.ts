/**
 * Shared numeric-comparison helper for tests.
 *
 * Use `approxEqual(actual, expected)` (optionally with an explicit tolerance)
 * instead of `expect(actual).toBeCloseTo(expected)` when comparing computed
 * survey/adjustment results, so every suite shares one consistent recipe.
 */
export function approxEqual(a: number, b: number, tol = 1e-6): boolean {
  return Math.abs(a - b) < tol
}
