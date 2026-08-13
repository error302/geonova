/**
 * Compute-worker script URL.
 *
 * Isolated in its own module because `import.meta` cannot be evaluated by
 * jest's CJS runtime — tests stub this module via `moduleNameMapper` (the
 * same pattern as `tinWorkerUrl`).
 */
export function getComputeWorkerUrl(): URL {
  return new URL('./compute.worker.ts', import.meta.url)
}
