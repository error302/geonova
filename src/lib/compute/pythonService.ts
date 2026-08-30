// src/lib/compute/pythonService.ts
//
// Two roles live in this file:
//
// 1. Edge Spatial Engine — local (browser/WASM) implementations of the
//    lightweight spatial ops (datum transform, contours, volumes) that
//    surveyors need offline (audit fix 2026-07-31: cloud-python versions
//    were ripped out for these).
//
// 2. callPythonCompute — the HTTP bridge to the FastAPI compute worker
//    (docker-compose service `metardu-worker`, PYTHON_COMPUTE_URL +
//    WORKER_SECRET). REVIVED 2026-08-31 after the audit-C9 "make it work"
//    pass: the worker now runs a real GNSS SPP engine (RINEX parsing,
//    IS-GPS-200 satellite positions, SP3 precise ephemeris, WLS solver —
//    see python_worker/gnss_processor.py), and this bridge actually
//    reaches it again.
//
//    Honesty rules for the bridge (audit C9 residue):
//      - When the worker is not configured or unreachable, callers get an
//        explicit error. Nothing is ever simulated or fabricated here.
//      - Worker-side task failures propagate verbatim.
//
// Call conventions supported (both used by existing routes):
//      callPythonCompute('task_name', params)        → POST {url}/compute {task, params}
//      callPythonCompute('/path', envelope)          → POST {url}{path} with the body as-is

import { transformCoordinates, type CoordSystem } from '@/lib/geo/transform'
import { generateContours as localGenerateContours, type SpotHeight } from '@/lib/engine/contours'
// Note: We avoid heavy turf imports here unless validateGeometry is used
// import * as turf from '@turf/turf'

export async function convertDatum(
  coords: Array<{id?: string, easting: number, northing: number, elevation?: number}>,
  fromDatum: string = 'WGS84',
  toDatum: string = 'ARC1960'
) {
  if (fromDatum === toDatum) return coords
  
  try {
    // Map the string datum names to the proj4 definitions
    // e.g. WGS84 -> WGS84, ARC1960 -> Arc1960-UTM37S (fallback to default zone if not specified)
    // The previous API just took "ARC1960" and guessed the zone from the coordinates.
    // For a local implementation, we assume Arc1960-UTM37S if strictly ARC1960 is passed.
    const mappedToDatum = toDatum === 'ARC1960' ? 'Arc1960-UTM37S' : toDatum;
    const mappedFromDatum = fromDatum === 'ARC1960' ? 'Arc1960-UTM37S' : fromDatum;

    const result = transformCoordinates({
      points: coords.map((c, i) => ({
        id: c.id || `pt-${i}`,
        x: c.easting,
        y: c.northing,
        z: c.elevation || 0
      })),
      fromCRS: mappedFromDatum as CoordSystem,
      toCRS: mappedToDatum as CoordSystem
    })
    
    return result.points.map((p, i) => ({
      ...coords[i],
      easting: p.x,
      northing: p.y,
      elevation: p.z,
      datum: toDatum
    }))
  } catch {
    return coords.map((c) => ({ ...c, datum: fromDatum, fallback: true }))
  }
}

export async function validateGeometry(params: {
  terrain: string
  designSpeed: number
  gradient: number
  radius: number
  ssd?: number
}) {
  // A simplified local validation for geometric design based on standard AASHTO / local guidelines.
  // We mock the most important checks that the python service used to do.
  try {
    const flags: string[] = []
    let status = 'PASS'
    
    // Example basic checks:
    if (params.gradient > 12) {
      flags.push('Gradient exceeds 12% maximum for standard terrain.')
      status = 'WARNING'
    }
    
    // Minimum radius check based on design speed (simplified eMax=8%, f=0.15)
    // R = V^2 / (127 * (e + f))
    const minRadius = Math.pow(params.designSpeed, 2) / (127 * (0.08 + 0.15))
    if (params.radius < minRadius) {
      flags.push(`Radius ${params.radius}m is below minimum ${minRadius.toFixed(1)}m for ${params.designSpeed}km/h.`)
      status = 'FAIL'
    }
    
    return { status, flags }
  } catch {
    return { status: 'UNKNOWN', flags: ['Local validation failed'], fallback: true }
  }
}

export async function generateContours(
  points: Array<{easting: number, northing: number, rl: number}>,
  interval: number = 1.0
) {
  try {
    const spotHeights: SpotHeight[] = points.map((p, i) => ({
      name: `P${i}`,
      easting: p.easting,
      northing: p.northing,
      elevation: p.rl
    }))
    
    // Generate contours entirely in browser using Delaunator (O(n log n))
    // Takes <200ms for 10,000 points.
    const contours = localGenerateContours(spotHeights, interval)
    
    return { contours }
  } catch {
    return { contours: [], fallback: true }
  }
}

export async function computeVolumes(
  sections: Array<{chainage: number, cut_area: number, fill_area: number}>,
  shrinkageFactor: number = 0.85
) {
  try {
    // Average End Area Method - computed instantly on edge
    let totalCut = 0
    let totalFill = 0
    const details = []

    // Sort by chainage just in case
    const sorted = [...sections].sort((a, b) => a.chainage - b.chainage)

    for (let i = 0; i < sorted.length - 1; i++) {
      const s1 = sorted[i]
      const s2 = sorted[i + 1]
      const L = s2.chainage - s1.chainage
      
      const cutVol = (L * (s1.cut_area + s2.cut_area)) / 2
      const fillVol = (L * (s1.fill_area + s2.fill_area)) / 2
      
      totalCut += cutVol
      totalFill += fillVol
      
      details.push({
        chainage_start: s1.chainage,
        chainage_end: s2.chainage,
        length: L,
        cut_volume: cutVol,
        fill_volume: fillVol
      })
    }
    
    const adjustedFill = totalFill * shrinkageFactor
    const netVolume = totalCut - adjustedFill
    
    return {
      sections: details,
      totals: {
        raw_cut: totalCut,
        raw_fill: totalFill,
        adjusted_fill: adjustedFill,
        net_volume: netVolume,
        shrinkage_factor: shrinkageFactor
      }
    }
  } catch {
    return { sections: [], totals: {}, fallback: true }
  }
}

// ─── Python compute worker bridge ──────────────────────────────────────────

export type PythonComputeResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: string; fallback?: boolean; details?: unknown }

const DEFAULT_TIMEOUT_MS = 120_000

interface WorkerEnvelope {
  success: boolean
  data?: unknown
  error?: string
  detail?: string
}

/**
 * Call the Python compute worker (FastAPI, docker service `metardu-worker`).
 *
 * Two calling conventions:
 *  - `callPythonCompute('task_name', params)` → POST {PYTHON_COMPUTE_URL}/compute
 *    with `{ task, params }` (the worker's task registry dispatch)
 *  - `callPythonCompute('/path', envelope)` → POST {PYTHON_COMPUTE_URL}{path}
 *    with the body passed through unchanged (legacy envelope callers)
 *
 * Errors are ALWAYS explicit — this bridge never fabricates results and
 * never flags a failure as a "simulation" (audit C9).
 */
export async function callPythonCompute<T>(
  taskOrPath: string,
  body: unknown,
  opts?: { timeoutMs?: number }
): Promise<PythonComputeResult<T>> {
  const baseUrl = (process.env.PYTHON_COMPUTE_URL || '').replace(/\/+$/, '')
  const secret = process.env.WORKER_SECRET || ''

  if (!baseUrl) {
    return {
      ok: false,
      status: 503,
      error:
        'Python compute worker is not configured (PYTHON_COMPUTE_URL is not set). ' +
        'Server-side GNSS/RINEX processing is unavailable in this deployment.',
    }
  }

  const isPath = taskOrPath.startsWith('/')
  const url = isPath ? `${baseUrl}${taskOrPath}` : `${baseUrl}/compute`
  const payload: unknown = isPath ? body : { task: taskOrPath, params: body }
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Worker-Secret': secret,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      // egress to the internal worker network only — never cached
      cache: 'no-store',
    })

    if (res.status === 403) {
      return {
        ok: false,
        status: 502,
        error: 'Compute worker rejected the request (authentication failed — check WORKER_SECRET).',
      }
    }
    if (res.status === 503) {
      return {
        ok: false,
        status: 502,
        error: 'Compute worker is running but not accepting requests (WORKER_SECRET not configured on the worker).',
      }
    }

    // NOTE: res.ok is not reliable across fetch implementations (jest's
    // jsdom polyfill omits it) — use the explicit status range.
    const statusOk = res.status >= 200 && res.status < 300

    let envelope: WorkerEnvelope | null = null
    try {
      envelope = (await res.json()) as WorkerEnvelope
    } catch {
      return {
        ok: false,
        status: 502,
        error: `Compute worker returned a non-JSON response (HTTP ${res.status}).`,
      }
    }

    if (!statusOk) {
      return {
        ok: false,
        status: res.status,
        error: envelope?.detail || envelope?.error || `Compute worker HTTP ${res.status}.`,
      }
    }
    if (envelope && envelope.success === false) {
      // The worker executed but the task itself failed — propagate verbatim.
      return {
        ok: false,
        status: 422,
        error: envelope.error || 'Compute worker task failed.',
      }
    }
    return { ok: true, value: (envelope?.data ?? null) as T }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        ok: false,
        status: 504,
        error: `Compute worker timed out after ${Math.round(timeoutMs / 1000)} s.`,
      }
    }
    return {
      ok: false,
      status: 502,
      error:
        'Could not reach the Python compute worker. It may be down or ' +
        'starting up — retry shortly. (' +
        (err instanceof Error ? err.message : 'network error') +
        ')',
    }
  } finally {
    clearTimeout(timer)
  }
}
