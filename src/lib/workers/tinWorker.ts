/**
 * TIN Web Worker — offloads Delaunay triangulation and contour generation
 * to a background thread to keep the UI responsive on large datasets.
 *
 * Roadmap reference: docs/ROADMAP.md → Tier 2 → "Web Worker TIN generator".
 *
 * Wire format:
 *
 *   Main → Worker:
 *     { id: string, op: 'triangulate', points: SpotHeight[], breaklines?: Breakline[] }
 *     { id: string, op: 'buildTINSurface', points: SpotHeight[], breaklines?: Breakline[] }
 *     { id: string, op: 'generateContours',
 *       points: SpotHeight[], interval: number,
 *       indexInterval?: number, breaklines?: Breakline[] }
 *
 *   Worker → Main:
 *     { id: string, ok: true, result: ... }
 *     { id: string, ok: false, error: string }
 *     { id: string, progress: number }   // 0..1, optional
 *
 * The worker is intentionally side-effect-free and re-uses the synchronous
 * engines from `@/lib/engine/contours`. Webpack 5 (used by Next.js 14)
 * bundles this file separately when loaded via
 * `new Worker(new URL('./tinWorker.ts', import.meta.url))`.
 */

/// <reference lib="webworker" />

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

interface TriangulateRequest {
  id: string
  op: 'triangulate'
  points: SpotHeight[]
  breaklines?: Breakline[]
}

interface BuildTINSurfaceRequest {
  id: string
  op: 'buildTINSurface'
  points: SpotHeight[]
  breaklines?: Breakline[]
}

interface GenerateContoursRequest {
  id: string
  op: 'generateContours'
  points: SpotHeight[]
  interval: number
  indexInterval?: number
  breaklines?: Breakline[]
}

type Request =
  | TriangulateRequest
  | BuildTINSurfaceRequest
  | GenerateContoursRequest

interface OkResponse<T> {
  id: string
  ok: true
  result: T
}

interface ErrorResponse {
  id: string
  ok: false
  error: string
}

interface ProgressResponse {
  id: string
  progress: number
}

type Response<T = unknown> = OkResponse<T> | ErrorResponse | ProgressResponse

function postToMainThread(msg: unknown): void {
  const w = self as { postMessage?: (m: unknown, t?: unknown) => void }
  if (typeof w.postMessage !== 'function') return
  // In a real Worker: postMessage(message, transferList?) accepts 1+ args.
  // In jsdom test env: window.postMessage(message, targetOrigin) requires 2.
  // Try the 1-arg form first; fall back to 2-arg with '*' targetOrigin.
  try {
    w.postMessage(msg)
  } catch {
    try {
      w.postMessage(msg, '*')
    } catch {
      // give up — message lost (test env only)
    }
  }
}

function postProgress(id: string, progress: number) {
  const msg: ProgressResponse = { id, progress }
  postToMainThread(msg)
}

function handleRequest(req: Request): unknown {
  switch (req.op) {
    case 'triangulate': {
      // Breaklines are honoured inside triangulate() when supplied
      postProgress(req.id, 0.1)
      if (req.breaklines && req.breaklines.length > 0) {
        // buildTINSurface enforces breaklines; pull triangles off it
        const surface = buildTINSurface(req.points, req.breaklines)
        postProgress(req.id, 1)
        return surface.triangles satisfies Triangle[]
      }
      const triangles = triangulate(req.points)
      postProgress(req.id, 1)
      return triangles
    }
    case 'buildTINSurface': {
      postProgress(req.id, 0.1)
      const surface = buildTINSurface(req.points, req.breaklines)
      postProgress(req.id, 1)
      return surface satisfies TINSurface
    }
    case 'generateContours': {
      postProgress(req.id, 0.1)
      const contours = generateContours(
        req.points,
        req.interval,
        req.indexInterval,
        req.breaklines
      )
      postProgress(req.id, 1)
      return contours satisfies ContourLine[]
    }
    default: {
      throw new Error(`Unknown op: ${(req as Request).op}`)
    }
  }
}

self.onmessage = (e: MessageEvent<Request>) => {
  const req = e.data
  if (!req || !req.id || !req.op) {
    const msg: ErrorResponse = {
      id: req?.id ?? 'unknown',
      ok: false,
      error: 'Malformed request: missing id or op',
    }
    postToMainThread(msg)
    return
  }
  try {
    const result = handleRequest(req)
    const msg: OkResponse<unknown> = { id: req.id, ok: true, result }
    postToMainThread(msg)
  } catch (err) {
    const msg: ErrorResponse = {
      id: req.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
    postToMainThread(msg)
  }
}

// Export for testing (worker module is also importable as a plain module
// when Worker is unavailable — the client uses this as a sync fallback path)
export { handleRequest as _handleRequest }
export type { Request as TINWorkerRequest, Response as TINWorkerResponse }
