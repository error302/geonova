/**
 * Returns the URL to the TIN worker bundle.
 *
 * Webpack 5 (Next.js 14) detects the literal pattern
 * `new URL('./tinWorker.ts', import.meta.url)` and emits a separate chunk
 * for the worker at build time. This file is the ONLY place the
 * `import.meta.url` syntax appears, so it can be cleanly mocked in tests.
 *
 * In Jest (CommonJS), this module is mapped to `tests/__mocks__/tinWorkerUrl.ts`
 * which returns `null`, causing the client to fall back to the sync engine.
 */
export function getTinWorkerUrl(): URL {
  return new URL('./tinWorker.ts', import.meta.url)
}
