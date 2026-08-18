/**
 * Surface Engine Bridge — Python sidecar for TIN / contours / cut-fill volume
 *
 * Routes heavy surface computation (Delaunay TIN, marching-triangle contours,
 * grid-method volume) to the Python worker when it is available
 * (`PYTHON_COMPUTE_URL` set), with an automatic fallback to the local
 * TypeScript engines so offline and small inputs behave exactly as before.
 *
 * Worker tasks (python_worker/surface_processor.py) are 1:1 ports of the TS
 * source-of-truth modules, so results agree within floating-point noise:
 *   - surface_tin      ↔ src/lib/compute/tin.ts
 *   - surface_contours ↔ src/lib/engine/contours.ts
 *   - surface_volume   ↔ src/lib/compute/pointCloudVolume.ts
 *
 * @module compute/surfaceService
 */

import { generateTIN as localGenerateTIN, type TINPoint, type TINTriangle } from './tin'
import {
  generateContours as localGenerateContours,
  type Breakline,
  type ContourLine,
  type SpotHeight,
} from '@/lib/engine/contours'
import {
  crossCheckVolume,
  gridMethodVolume,
  stockpileVolume,
  type Point3D,
  type VolumeResult,
} from './pointCloudVolume'

/** Above this many points, heavy compute prefers the Python sidecar. */
export const SURFACE_WORKER_HEAVY_THRESHOLD = 100_000

interface SurfaceWorkerConfig {
  url: string
  secret: string
}

/** Resolve the worker endpoint; null when the sidecar is not configured. */
export function getSurfaceWorkerConfig(): SurfaceWorkerConfig | null {
  const url = process.env.PYTHON_COMPUTE_URL?.trim()
  if (!url) return null
  return { url: url.replace(/\/+$/, ''), secret: process.env.WORKER_SECRET ?? '' }
}

export function isSurfaceWorkerAvailable(): boolean {
  return getSurfaceWorkerConfig() !== null
}

export type WorkerCallResult<T> =
  | { ok: true; value: T }
  | { ok: false; fallback: true; error: string }

/**
 * Call a worker task over HTTP. Never throws — failures (network, auth,
 * unknown task, timeout) return `{ ok: false, fallback: true }` so callers
 * can transparently fall back to the local engine.
 */
export async function callSurfaceWorker<T>(
  task: string,
  params: unknown,
  timeoutMs = 180_000,
): Promise<WorkerCallResult<T>> {
  const config = getSurfaceWorkerConfig()
  if (!config) {
    return { ok: false, fallback: true, error: 'PYTHON_COMPUTE_URL not set — Python sidecar unavailable' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${config.url}/compute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Worker-Secret': config.secret,
        'X-Request-Id': `surface_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      },
      body: JSON.stringify({ task, params }),
      signal: controller.signal,
    })

    if (!response.ok) {
      return { ok: false, fallback: true, error: `Worker responded HTTP ${response.status}` }
    }

    const body = (await response.json()) as { success?: boolean; data?: T; error?: string }
    if (body.success !== true || body.data === undefined) {
      return { ok: false, fallback: true, error: body.error ?? 'Worker returned an empty result' }
    }
    return { ok: true, value: body.data }
  } catch (error) {
    return {
      ok: false,
      fallback: true,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    clearTimeout(timer)
  }
}

/** True when a payload of `count` points should go to the sidecar. */
export function shouldUseSurfaceWorker(count: number): boolean {
  return isSurfaceWorkerAvailable() && count >= SURFACE_WORKER_HEAVY_THRESHOLD
}

// ─── TIN ────────────────────────────────────────────────────────────────────

export interface TINResult {
  triangles: TINTriangle[]
  source: 'worker' | 'local'
  error?: string
}

/**
 * Generate a Delaunay TIN. Large clouds go to the Python sidecar; small
 * clouds and offline environments use the local Delaunator engine.
 */
export async function generateTINHeavy(points: TINPoint[]): Promise<TINResult> {
  if (shouldUseSurfaceWorker(points.length)) {
    const res = await callSurfaceWorker<{ triangles?: TINTriangle[] }>('surface_tin', { points })
    if (res.ok) {
      const triangles = res.value.triangles
      if (Array.isArray(triangles) && triangles.length > 0) {
        return { triangles: triangles as TINTriangle[], source: 'worker' }
      }
      return {
        triangles: points.length < 3 ? [] : localGenerateTIN(points),
        source: 'local',
        error: 'Worker returned no triangles',
      }
    }
    if (points.length < 3) {
      return { triangles: [], source: 'local', error: 'TIN requires at least 3 points' }
    }
    return { triangles: localGenerateTIN(points), source: 'local', error: res.error }
  }
  return { triangles: localGenerateTIN(points), source: 'local' }
}

// ─── Contours ───────────────────────────────────────────────────────────────

export interface ContourResult {
  contours: ContourLine[]
  triangleCount?: number
  source: 'worker' | 'local'
  error?: string
}

interface WorkerContourLine {
  elevation: number
  points: Array<[number, number]>
  is_index: boolean
}

export function normalizeWorkerContours(
  raw: Array<{ elevation: number; points: Array<[number, number]>; is_index?: boolean }>,
): ContourLine[] {
  return raw.map((c) => ({
    elevation: c.elevation,
    points: (c.points ?? []).map(([easting, northing]) => ({ easting, northing })),
    isIndex: c.is_index ?? false,
  }))
}

/**
 * Generate contour lines from spot heights. Large clouds go to the sidecar's
 * marching-triangles engine; small/offline inputs use the local engine.
 */
export async function generateContoursHeavy(
  points: SpotHeight[],
  interval: number,
  indexInterval?: number,
  breaklines?: Breakline[],
): Promise<ContourResult> {
  if (shouldUseSurfaceWorker(points.length)) {
    const params: Record<string, unknown> = {
      points: points.map((p) => ({ x: p.easting, y: p.northing, z: p.elevation })),
      interval,
      index_interval: indexInterval,
    }
    if (breaklines && breaklines.length > 0) {
      params.breaklines = breaklines.map((bl) => ({
        start: { x: bl.start.easting, y: bl.start.northing, z: bl.start.elevation },
        end: { x: bl.end.easting, y: bl.end.northing, z: bl.end.elevation },
      }))
    }
    const res = await callSurfaceWorker<{
      contours?: WorkerContourLine[]
      triangle_count?: number
    }>('surface_contours', params)
    if (res.ok) {
      const contours = res.value.contours
      if (Array.isArray(contours)) {
        return {
          contours: normalizeWorkerContours(contours),
          triangleCount: res.value.triangle_count,
          source: 'worker',
        }
      }
    }
    return {
      contours: localGenerateContours(points, interval, indexInterval, breaklines),
      source: 'local',
      error: res.ok ? 'Worker returned no contours' : res.error,
    }
  }
  return {
    contours: localGenerateContours(points, interval, indexInterval, breaklines),
    source: 'local',
  }
}

// ─── Volume ─────────────────────────────────────────────────────────────────

export interface VolumeHeavyInput {
  surface1: Point3D[]
  surface2?: Point3D[]
  cellSize?: number
  baseElevation?: number
  mode?: 'cutfill' | 'stockpile'
  crossCheck?: boolean
}

export interface VolumeHeavyResult {
  result: VolumeResult & {
    cutArea?: number
    fillArea?: number
    balanceElevation?: number | null
  }
  crossCheck?: ReturnType<typeof crossCheckVolume> | null
  source: 'worker' | 'local'
  error?: string
}

export interface WorkerVolume {
  cut: number
  fill: number
  net: number
  area: number
  method: string
  cellSize?: number
  cutArea?: number
  fillArea?: number
  balanceElevation?: number | null
  cross_check?: {
    gridResult: WorkerVolume
    tinResult: WorkerVolume
    agree: boolean
    difference: number
    differencePercent: number
  }
}

const toXYZ = (p: Point3D): { x: number; y: number; z: number } => ({
  x: p.easting,
  y: p.northing,
  z: p.elevation,
})

export function normalizeWorkerVolume(raw: WorkerVolume): VolumeHeavyResult['result'] {
  return {
    cut: raw.cut,
    fill: raw.fill,
    net: raw.net,
    area: raw.area,
    method: raw.method === 'tin-to-tin' ? 'tin-to-tin' : 'grid',
    ...(raw.cellSize !== undefined ? { cellSize: raw.cellSize } : {}),
    cutArea: raw.cutArea,
    fillArea: raw.fillArea,
    balanceElevation: raw.balanceElevation,
  }
}

/**
 * Compute cut/fill (or stockpile) volume. Large clouds go to the sidecar's
 * grid-method engine (with optional grid-vs-TIN cross-check); small/offline
 * inputs use the local pointCloudVolume engine.
 */
export async function computeVolumeHeavy(
  input: VolumeHeavyInput,
): Promise<VolumeHeavyResult> {
  const { surface1, mode = 'cutfill' } = input
  const heavy = shouldUseSurfaceWorker(surface1.length)

  if (heavy) {
    const params: Record<string, unknown> = {
      mode,
      surface1: surface1.map(toXYZ),
      cross_check: input.crossCheck === true,
    }
    if (mode === 'stockpile') {
      params.base_elevation = input.baseElevation ?? 0
    } else {
      params.surface2 = (input.surface2 ?? surface1).map(toXYZ)
      params.cell_size = input.cellSize ?? 1.0
    }

    const res = await callSurfaceWorker<WorkerVolume>('surface_volume', params)
    if (res.ok) {
      return {
        result: normalizeWorkerVolume(res.value),
        crossCheck: res.value.cross_check
          ? {
              gridResult: normalizeWorkerVolume(res.value.cross_check.gridResult),
              tinResult: normalizeWorkerVolume(res.value.cross_check.tinResult),
              agree: res.value.cross_check.agree,
              difference: res.value.cross_check.difference,
              differencePercent: res.value.cross_check.differencePercent,
            }
          : null,
        source: 'worker',
      }
    }
    // Fall through to the local engine
  }

  const baseSurface: Point3D[] =
    input.surface2 ??
    surface1.map((p) => ({ ...p, elevation: input.baseElevation ?? 0 }))

  if (mode === 'stockpile') {
    const result = stockpileVolume(surface1, input.baseElevation ?? 0)
    return { result, crossCheck: null, source: 'local' }
  }

  const result = gridMethodVolume(surface1, baseSurface, input.cellSize ?? 1.0)
  const crossCheck = input.crossCheck ? crossCheckVolume(surface1, baseSurface) : null
  return { result, crossCheck, source: 'local' }
}
