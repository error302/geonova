/**
 * Shared test helper: assert a value is defined and return it narrowed.
 *
 * Mirrors `expect(x).toBeDefined()` as a type-level guard so subsequent
 * member access is safe without a non-null assertion. Throws when the
 * value is null/undefined (fail fast with a clear message rather than a
 * TypeError deep in the assertion).
 *
 *   const centre = profile.find((p) => Math.abs(p.offset) < 0.01)
 *   expect(centre).toBeDefined()
 *   expect(defined(centre).level).toBeCloseTo(100, 3)
 */
export function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('expected value to be defined')
  }
  return value
}
