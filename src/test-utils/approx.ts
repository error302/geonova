/**
 * Shared numeric-comparison helper for tests.
 *
 * Use `approxEqual(actual, expected)` (optionally with an explicit tolerance)
 * instead of `expect(actual).toBeCloseTo(expected)` when comparing computed
 * survey/adjustment results, so every suite shares one consistent recipe.
 *
 * Nullable inputs are accepted and coerced to NaN — a missing/null value can
 * never be within tolerance, so the assertion still fails loudly.
 */
export function approxEqual(a: number | null | undefined, b: number | null | undefined, tol = 1e-6): boolean {
  return Math.abs((a ?? NaN) - (b ?? NaN)) < tol
}
