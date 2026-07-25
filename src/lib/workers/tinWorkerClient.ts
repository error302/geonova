/**
 * TIN Worker Client — Promise-based wrapper around the TIN Web Worker with
 * automatic fallback to the synchronous engine when Workers are unavailable.
 *
 * Roadmap reference: docs/ROADMAP.md → Tier 2 → "Web Worker TIN generator"
 * (auto-fallback mode per user spec).
 *
 * Usage:
 *   const triangles = await triangulateAsync(points, breaklines)
 *   const surface   = await buildTINSurfaceAsync(points, breaklines)
 *   const contours  = await generateContoursAsync(points, 1.0, { onProgress })
 *
 * Behaviour:
 *   - First call lazily spawns the Worker via
 *     `new Worker(new URL('./tinWorker.ts', import.meta.url))`.
 *   - If Worker construction throws (e.g., jsdom test env, CSP blocks,
 *     older browser), the client permanently switches to sync mode and
 *     reuses the synchronous engines from `@/lib/engine/contours`.
 *   - Each call gets a unique id; concurrent calls multiplex over the
 *     single worker via id-keyed response handlers.
 *   - Optional `onProgress` callback fires with 0..1 as the worker reports.
 *   - 30 s default timeout; falls back to sync on timeout.
 */

import {
  triangulate,
  buildTINSurface,
  generateContours,
  type SpotHeight,
  type Breakline,
  type Triangle,
  type TINSurface,
  type ContourLine,
} from '@/lib/engine/contours'
import { getTinWorkerUrl } from '@/lib/workers/tinWorkerUrl'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AsyncOptions {
  /** Progress callback, fires with 0..1. */
  onProgress?: (p: number) => void
  /** Per-call timeout in milliseconds. Default 30000. */
  timeoutMs?: number
  /** Force sync mode for this call (skips worker). */
  forceSync?: boolean
}

// ─── Worker Singleton ───────────────────────────────────────────────────────

let workerInstance: Worker | null = null
let workerUnavailable = false

/** Pending request handlers keyed by request id. */
interface PendingHandler {
  resolve: (result: unknown) => void
  reject: (err: Error) => void
  onProgress?: (p: number) => void
  timer: ReturnType<typeof setTimeout>
}
const pending = new Map<string, PendingHandler>()

let nextId = 0
function nextRequestId(): string {
  nextId += 1
  return `tin-${Date.now()}-${nextId}`
}

/**
 * Lazily construct the worker. Returns null if Workers are unavailable
 * (server-side render, jsdom test, CSP-blocked, etc.).
 */
function getWorker(): Worker | null {
  if (workerUnavailable) return null
  if (workerInstance) return workerInstance
  if (typeof self === 'undefined' || typeof Worker === 'undefined') {
    workerUnavailable = true
    return null
  }
  try {
    // Webpack 5 detects the `new URL('./tinWorker.ts', import.meta.url)`
    // pattern inside `tinWorkerUrl.ts` and emits a separate worker chunk.
    // In test environments the module is mocked to return null, so we
    // fall back to the synchronous engine.
    const workerUrl = getTinWorkerUrl()
    if (!workerUrl) {
      workerUnavailable = true
      return null
    }
    workerInstance = new Worker(workerUrl)
    workerInstance.onmessage = (e: MessageEvent) => {
      const msg = e.data as {
        id: string
        ok?: boolean
        result?: unknown
        error?: string
        progress?: number
      }
      const handler = pending.get(msg.id)
      if (!handler) return
      if (typeof msg.progress === 'number') {
        handler.onProgress?.(msg.progress)
        return
      }
      clearTimeout(handler.timer)
      pending.delete(msg.id)
      if (msg.ok === true) {
        handler.resolve(msg.result)
      } else {
        handler.reject(new Error(msg.error || 'Worker error'))
      }
    }
    workerInstance.onerror = (err: ErrorEvent) => {
      // Reject ALL pending requests — the worker is dead
      for (const [id, handler] of pending) {
        clearTimeout(handler.timer)
        handler.reject(new Error(err.message || 'Worker crashed'))
        pending.delete(id)
      }
      workerInstance = null
      workerUnavailable = true
    }
    return workerInstance
  } catch {
    workerUnavailable = true
    return null
  }
}

/**
 * Send a request to the worker. Returns a Promise that resolves with the
 * worker's result, or rejects on error / timeout.
 */
function dispatch<T>(
  op: string,
  payload: Record<string, unknown>,
  options: AsyncOptions = {}
): Promise<T> {
  const forceSync = options.forceSync || workerUnavailable
  const worker = forceSync ? null : getWorker()

  if (!worker) {
    // Sync fallback — run the synchronous engine in the current thread.
    return Promise.resolve(syncFallback<T>(op, payload))
  }

  return new Promise<T>((resolve, reject) => {
    const id = nextRequestId()
    const timer = setTimeout(() => {
      pending.delete(id)
      // On timeout, fall back to sync for this call only (don't kill worker)
      try {
        resolve(syncFallback<T>(op, payload))
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }, options.timeoutMs ?? 30000)

    pending.set(id, {
      resolve: (r: unknown) => resolve(r as T),
      reject,
      onProgress: options.onProgress,
      timer,
    })

    worker.postMessage({ id, op, ...payload })
  })
}

/** Run the equivalent sync engine in-process. */
function syncFallback<T>(op: string, payload: Record<string, unknown>): T {
  switch (op) {
    case 'triangulate': {
      const { points, breaklines } = payload as {
        points: SpotHeight[]
        breaklines?: Breakline[]
      }
      if (breaklines && breaklines.length > 0) {
        const surface = buildTINSurface(points, breaklines)
        return surface.triangles as unknown as T
      }
      return triangulate(points) as unknown as T
    }
    case 'buildTINSurface': {
      const { points, breaklines } = payload as {
        points: SpotHeight[]
        breaklines?: Breakline[]
      }
      return buildTINSurface(points, breaklines) as unknown as T
    }
    case 'generateContours': {
      const { points, interval, indexInterval, breaklines } = payload as {
        points: SpotHeight[]
        interval: number
        indexInterval?: number
        breaklines?: Breakline[]
      }
      return generateContours(points, interval, indexInterval, breaklines) as unknown as T
    }
    default:
      throw new Error(`Unknown op in sync fallback: ${op}`)
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Triangulate spot heights to a Delaunay TIN. Uses the worker when available;
 * falls back to the synchronous `triangulate` from `@/lib/engine/contours`.
 */
export function triangulateAsync(
  points: SpotHeight[],
  breaklines?: Breakline[],
  options?: AsyncOptions
): Promise<Triangle[]> {
  return dispatch<Triangle[]>('triangulate', { points, breaklines }, options)
}

/**
 * Build a full TIN surface object with bounds metadata and breakline enforcement.
 */
export function buildTINSurfaceAsync(
  points: SpotHeight[],
  breaklines?: Breakline[],
  options?: AsyncOptions
): Promise<TINSurface> {
  return dispatch<TINSurface>('buildTINSurface', { points, breaklines }, options)
}

/**
 * Generate contour lines via marching triangles. Uses the worker when available.
 */
export function generateContoursAsync(
  points: SpotHeight[],
  interval: number,
  options?: { indexInterval?: number; breaklines?: Breakline[] } & AsyncOptions
): Promise<ContourLine[]> {
  const { indexInterval, breaklines, ...asyncOpts } = options ?? {}
  return dispatch<ContourLine[]>(
    'generateContours',
    { points, interval, indexInterval, breaklines },
    asyncOpts
  )
}

// ─── Test Helpers (exported for unit tests) ─────────────────────────────────

/**
 * Returns true if the worker is currently available. Mainly useful for tests
 * and for the UI to display a "running in background" badge.
 */
export function isWorkerAvailable(): boolean {
  return !workerUnavailable && getWorker() !== null
}

/**
 * Force the client into sync mode for the rest of the session. Used in tests
 * to exercise the sync fallback path without spawning real workers.
 */
export function _forceSyncModeForTests(): void {
  workerUnavailable = true
  if (workerInstance) {
    workerInstance.terminate()
    workerInstance = null
  }
  for (const [id, handler] of pending) {
    clearTimeout(handler.timer)
    handler.reject(new Error('Forced into sync mode'))
    pending.delete(id)
  }
}

/**
 * Reset module state (tests only).
 */
export function _resetForTests(): void {
  workerUnavailable = false
  if (workerInstance) {
    workerInstance.terminate()
    workerInstance = null
  }
  pending.clear()
}
