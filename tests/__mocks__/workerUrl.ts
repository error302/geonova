/**
 * Jest mock for `@/workers/workerUrl`.
 *
 * Returns a stable fake URL so the WorkerBridge tests can assert the
 * constructor args without relying on `import.meta` (which the jest CJS
 * runtime cannot evaluate). Mapped via jest.config.js `moduleNameMapper`.
 */
export function getComputeWorkerUrl(): URL {
  return new URL('mock://compute.worker.ts')
}
