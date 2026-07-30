/**
 * Jest mock for `@/lib/workers/tinWorkerUrl`.
 *
 * Returns `null` so the TIN worker client falls back to the synchronous
 * engine. Mapped via jest.config.js `moduleNameMapper`.
 */
export function getTinWorkerUrl(): URL | null {
  return null
}
