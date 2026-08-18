/**
 * Tests for src/lib/compute/surfaceService.ts — the Python sidecar bridge for
 * TIN / contours / cut-fill volume.
 *
 * Covers:
 *   - Worker-contour and worker-volume normalizers (wire shapes → TS shapes)
 *   - Availability/threshold logic and the never-throw fallback contract
 *   - Local-engine paths (small clouds / offline) matching the source modules
 *   - Python↔TS parity: surface_processor.py vs the TS engines, skipped when
 *     a scipy-enabled interpreter isn't available.
 */

import { execFileSync } from 'node:child_process'
import * as path from 'node:path'

import { generateTIN as localGenerateTIN, type TINPoint } from '../tin'
import { generateContours as localGenerateContours } from '@/lib/engine/contours'
import { gridMethodVolume, stockpileVolume, type Point3D } from '../pointCloudVolume'
import {
  callSurfaceWorker,
  computeVolumeHeavy,
  generateContoursHeavy,
  generateTINHeavy,
  isSurfaceWorkerAvailable,
  normalizeWorkerContours,
  normalizeWorkerVolume,
  shouldUseSurfaceWorker,
  SURFACE_WORKER_HEAVY_THRESHOLD,
  type WorkerVolume,
} from '../surfaceService'

const WORKER_URL = 'http://127.0.0.1:8765'
const WORKER_SECRET = 'test-secret'

const realEnv = { ...process.env }

beforeEach(() => {
  process.env = { ...realEnv }
  delete process.env.PYTHON_COMPUTE_URL
  delete process.env.WORKER_SECRET
})

afterAll(() => {
  process.env = { ...realEnv }
})

// ─── Normalizers ────────────────────────────────────────────────────────────

describe('normalizeWorkerContours', () => {
  it('maps worker contour lines to the TS ContourLine shape', () => {
    const out = normalizeWorkerContours([
      { elevation: 101.5, points: [[0, 0], [10, 20]], is_index: true },
      { elevation: 102, points: [[5, 5]] },
    ])
    expect(out).toEqual([
      { elevation: 101.5, points: [{ easting: 0, northing: 0 }, { easting: 10, northing: 20 }], isIndex: true },
      { elevation: 102, points: [{ easting: 5, northing: 5 }], isIndex: false },
    ])
  })

  it('is safe with empty or missing point arrays', () => {
    const out = normalizeWorkerContours([
      { elevation: 100, points: [] },
      { elevation: 99, points: undefined as unknown as Array<[number, number]> },
    ])
    expect(out[0].points).toEqual([])
    expect(out[1].points).toEqual([])
  })
})

describe('normalizeWorkerVolume', () => {
  it('maps worker volume fields onto VolumeResult + cut/fill extras', () => {
    const raw: WorkerVolume = {
      cut: 12.5,
      fill: 3.25,
      net: 9.25,
      area: 100,
      method: 'grid',
      cellSize: 1.0,
      cutArea: 40,
      fillArea: 60,
      balanceElevation: 7.2,
    }
    expect(normalizeWorkerVolume(raw)).toEqual({
      cut: 12.5,
      fill: 3.25,
      net: 9.25,
      area: 100,
      method: 'grid',
      cellSize: 1.0,
      cutArea: 40,
      fillArea: 60,
      balanceElevation: 7.2,
    })
  })

  it('preserves tin-to-tin but coerces unknown methods to grid', () => {
    expect(normalizeWorkerVolume({ cut: 0, fill: 0, net: 0, area: 0, method: 'tin-to-tin' } as WorkerVolume).method)
      .toBe('tin-to-tin')
    expect(normalizeWorkerVolume({ cut: 0, fill: 0, net: 0, area: 0, method: 'garbage' } as WorkerVolume).method)
      .toBe('grid')
  })

  it('omits cellSize when the worker did not send one', () => {
    const out = normalizeWorkerVolume({ cut: 1, fill: 1, net: 0, area: 4, method: 'grid' } as WorkerVolume)
    expect('cellSize' in out).toBe(false)
  })
})

// ─── Availability / fallback contract ───────────────────────────────────────

describe('worker availability', () => {
  it('is unavailable when PYTHON_COMPUTE_URL is unset', () => {
    expect(isSurfaceWorkerAvailable()).toBe(false)
    expect(shouldUseSurfaceWorker(SURFACE_WORKER_HEAVY_THRESHOLD)).toBe(false)
  })

  it('is available and honors the heavy threshold when configured', () => {
    process.env.PYTHON_COMPUTE_URL = WORKER_URL
    process.env.WORKER_SECRET = WORKER_SECRET
    expect(isSurfaceWorkerAvailable()).toBe(true)
    expect(shouldUseSurfaceWorker(SURFACE_WORKER_HEAVY_THRESHOLD - 1)).toBe(false)
    expect(shouldUseSurfaceWorker(SURFACE_WORKER_HEAVY_THRESHOLD)).toBe(true)
  })

  it('trims trailing slashes from the worker URL', () => {
    process.env.PYTHON_COMPUTE_URL = `${WORKER_URL}/`
    process.env.WORKER_SECRET = WORKER_SECRET
    expect(isSurfaceWorkerAvailable()).toBe(true)
    expect(shouldUseSurfaceWorker(SURFACE_WORKER_HEAVY_THRESHOLD)).toBe(true)
  })
})

describe('callSurfaceWorker', () => {
  it('never throws when the sidecar is not configured', async () => {
    const res = await callSurfaceWorker('surface_tin', { points: [] })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.fallback).toBe(true)
      expect(res.error).toMatch(/PYTHON_COMPUTE_URL/)
    }
  })

  it('returns a fallback result on worker HTTP failure', async () => {
    process.env.PYTHON_COMPUTE_URL = 'http://127.0.0.1:1' // nothing listens here
    process.env.WORKER_SECRET = WORKER_SECRET
    const res = await callSurfaceWorker('surface_tin', { points: [] }, 500)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.fallback).toBe(true)
  })
})

// ─── Local engine paths ─────────────────────────────────────────────────────

function makeTINPoints(n: number, seed = 7): TINPoint[] {
  // Deterministic pseudo-random cloud: x,y in [0,100], z = plane + small noise.
  let s = seed
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
  const pts: TINPoint[] = []
  for (let i = 0; i < n; i++) {
    const x = rnd() * 100
    const y = rnd() * 100
    pts.push({ id: `p${i}`, x, y, z: 5 + 0.5 * x + 0.2 * y + (rnd() - 0.5) })
  }
  return pts
}

describe('generateTINHeavy (local path)', () => {
  it('uses the local engine below the heavy threshold', async () => {
    const points = makeTINPoints(50)
    const res = await generateTINHeavy(points)
    expect(res.source).toBe('local')
    expect(res.error).toBeUndefined()
    expect(res.triangles).toEqual(localGenerateTIN(points))
  })

  it('falls back to the local engine when the worker is unreachable', async () => {
    process.env.PYTHON_COMPUTE_URL = 'http://127.0.0.1:1'
    process.env.WORKER_SECRET = WORKER_SECRET
    const points = makeTINPoints(SURFACE_WORKER_HEAVY_THRESHOLD + 10)
    const res = await generateTINHeavy(points)
    expect(res.source).toBe('local')
    expect(res.triangles.length).toBeGreaterThan(0)
    expect(res.error).toBeDefined()
  })
})

describe('computeVolumeHeavy (local path)', () => {
  const asPoint3D = (pts: TINPoint[]): Point3D[] =>
    pts.map((p) => ({ easting: p.x, northing: p.y, elevation: p.z }))

  it('cut/fill matches gridMethodVolume when the worker is offline', async () => {
    const s1 = asPoint3D(makeTINPoints(60, 11))
    const s2 = s1.map((p) => ({ ...p, elevation: p.elevation - 1.5 }))
    const res = await computeVolumeHeavy({ surface1: s1, surface2: s2, cellSize: 2.0 })
    expect(res.source).toBe('local')
    const expected = gridMethodVolume(s1, s2, 2.0)
    expect(res.result.cut).toBeCloseTo(expected.cut, 6)
    expect(res.result.fill).toBeCloseTo(expected.fill, 6)
    expect(res.result.net).toBeCloseTo(expected.net, 6)
  })

  it('stockpile mode matches stockpileVolume', async () => {
    const s1 = asPoint3D(makeTINPoints(60, 13))
    const res = await computeVolumeHeavy({ surface1: s1, mode: 'stockpile', baseElevation: 4 })
    expect(res.source).toBe('local')
    const expected = stockpileVolume(s1, 4)
    expect(res.result.cut).toBeCloseTo(expected.cut, 6)
  })

  it('synthesizes a flat base surface when surface2 is omitted', async () => {
    const s1 = asPoint3D(makeTINPoints(40, 17))
    const res = await computeVolumeHeavy({ surface1: s1, mode: 'cutfill', cellSize: 2.0, baseElevation: 6 })
    expect(res.source).toBe('local')
    const base = s1.map((p) => ({ ...p, elevation: 6 }))
    const expected = gridMethodVolume(s1, base, 2.0)
    expect(res.result.net).toBeCloseTo(expected.net, 6)
  })
})

describe('generateContoursHeavy (local path)', () => {
  it('matches the local engine below the heavy threshold', async () => {
    const points = makeTINPoints(80, 19).map((p) => ({
      name: p.id,
      easting: p.x,
      northing: p.y,
      elevation: p.z,
    }))
    const res = await generateContoursHeavy(points, 1.0, 5.0)
    expect(res.source).toBe('local')
    expect(res.contours).toEqual(localGenerateContours(points, 1.0, 5.0))
  })
})

// ─── Python ↔ TS parity ─────────────────────────────────────────────────────
//
// The TS engines import the real `delaunator` package, which jest replaces with
// a fan-triangulation mock (see moduleNameMapper in jest.config.js). To compare
// against the real engine, the reference values are computed by a tsx child
// process (repo cwd, real delaunator) rather than through jest's module graph.
// Both parity tests skip when either runtime is unavailable.

interface ParityReference {
  tinCount: number
  tinArea: number
  contourCount: number
  contourLength: number
  cut: number
  fill: number
  net: number
  area: number
}

/** Locate a python interpreter that can import the worker's deps. */
function findPython(): string | null {
  const candidates = [process.env.PYTHON, 'python3', 'python'].filter(
    (c): c is string => typeof c === 'string' && c.length > 0,
  )
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['-c', 'import scipy, numpy'], { stdio: 'ignore', timeout: 30_000 })
      return candidate
    } catch {
      // try the next candidate
    }
  }
  return null
}

/** True when the real TS engine is runnable via the cached tsx binary. */
function hasTsxRunner(): boolean {
  try {
    // shell:true so the npx.cmd shim resolves on Windows.
    execFileSync('npx --no-install tsx --version', { stdio: 'ignore', timeout: 30_000, shell: true })
    return true
  } catch {
    return false
  }
}

const PYTHON = findPython()
const TSX_OK = hasTsxRunner()
const REPO_ROOT = path.join(__dirname, '..', '..', '..', '..')
const WORKER_DIR = path.join(REPO_ROOT, 'python_worker')

const parityIt = PYTHON && TSX_OK
  ? it
  : (name: string, fn: () => void) => it.skip(name, fn)

/** Run the real TS engines (real delaunator) via a tsx stdin script. */
function runTsReference(points: TINPoint[], surface2: Array<{ x: number; y: number; z: number }>): ParityReference {
  const script = `
import { generateTIN } from './src/lib/compute/tin'
import { generateContours } from './src/lib/engine/contours'
import { gridMethodVolume } from './src/lib/compute/pointCloudVolume'

const points = ${JSON.stringify(points)}
const surface2 = ${JSON.stringify(surface2)}
const toP3 = (p: { x: number; y: number; z: number }) => ({
  easting: p.x, northing: p.y, elevation: p.z,
})
const lengthOf = (pts: Array<{ easting: number; northing: number }>) =>
  pts.reduce((sum, p, i, arr) => {
    if (i === 0) return sum
    const prev = arr[i - 1]
    return sum + Math.hypot(p.easting - prev.easting, p.northing - prev.northing)
  }, 0)
const tin = generateTIN(points)
const spot = points.map((p) => ({ easting: p.x, northing: p.y, elevation: p.z }))
const contours = generateContours(spot, 1.0, 5.0)
const vol = gridMethodVolume(points.map(toP3), surface2.map(toP3), 1.0)
console.log(JSON.stringify({
  tinCount: tin.length,
  tinArea: tin.reduce((s, t) => s + t.area_m2, 0),
  contourCount: contours.length,
  contourLength: contours.reduce((s, c) => s + lengthOf(c.points), 0),
  cut: vol.cut,
  fill: vol.fill,
  net: vol.net,
  area: vol.area,
}))
`
  const out = execFileSync('npx --no-install tsx -', {
    input: script,
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 60_000,
    shell: true,
  })
  return JSON.parse(out.trim()) as ParityReference
}

/** Run the Python port via a -c script; the payload is passed in argv. */
function runPython(script: string, payload: unknown): unknown {
  const out = execFileSync(
    PYTHON as string,
    [
      '-c',
      [
        'import json, sys',
        'sys.path.insert(0, sys.argv[1])',
        'from surface_processor import generate_tin, generate_contours, compute_grid_volume',
        script,
        'print(json.dumps(result))',
      ].join('\n'),
      WORKER_DIR,
      JSON.stringify(payload),
    ],
    { encoding: 'utf8', timeout: 60_000 },
  )
  return JSON.parse(out.trim())
}

describe('Python ↔ TS parity (surface_processor.py)', () => {
  const points = makeTINPoints(120, 23)
  const surface2 = points.map((p) => ({ x: p.x, y: p.y, z: p.z - 1.5 }))

  let reference: ParityReference
  beforeAll(() => {
    reference = runTsReference(points, surface2)
  })

  parityIt('TIN: same triangle count and surface area', () => {
    const result = runPython(
      `points = json.loads(sys.argv[2]); result = generate_tin(points)`,
      points,
    ) as { triangles: Array<{ area_m2: number }> }

    // Delaunator and scipy triangulations agree exactly for generic point sets;
    // tolerate a single differing triangle if a set is (near-)cocircular.
    expect(Math.abs(result.triangles.length - reference.tinCount)).toBeLessThanOrEqual(1)
    const pyArea = result.triangles.reduce((sum, t) => sum + t.area_m2, 0)
    // Python rounds each triangle area to 6 dp; total over ~220 triangles.
    expect(pyArea).toBeCloseTo(reference.tinArea, 3)
  })

  parityIt('contours: same polylines within segment-threading tolerance', () => {
    const result = runPython(
      `points = json.loads(sys.argv[2]); result = generate_contours(points, 1.0, 5.0)`,
      points,
    ) as { contours: Array<{ elevation: number; points: Array<[number, number]>; is_index: boolean }> }

    const pyLength = result.contours.reduce(
      (sum, c) =>
        sum +
        c.points.reduce((s, [x1, y1], i, arr) => {
          if (i === 0) return s
          const [x0, y0] = arr[i - 1]
          return s + Math.hypot(x1 - x0, y1 - y0)
        }, 0),
      0,
    )
    expect(result.contours.length).toBe(reference.contourCount)
    // Same contour geometry; polyline point order may differ slightly.
    expect(pyLength).toBeCloseTo(reference.contourLength, 1)
  })

  parityIt('volume: cut/fill/net agree with gridMethodVolume', () => {
    const payload = { s1: points, s2: surface2 }
    const result = runPython(
      `d = json.loads(sys.argv[2]); result = compute_grid_volume(d["s1"], d["s2"], 1.0)`,
      payload,
    ) as { cut: number; fill: number; net: number; area: number }

    // 1:1 port — only floating-point noise (Kahan vs numpy summation) allowed.
    expect(Math.abs(result.cut - reference.cut)).toBeLessThanOrEqual(0.001 * Math.max(1, reference.cut))
    expect(Math.abs(result.fill - reference.fill)).toBeLessThanOrEqual(0.001 * Math.max(1, reference.fill))
    expect(Math.abs(result.net - reference.net)).toBeLessThanOrEqual(0.001 * Math.max(1, Math.abs(reference.net)))
    expect(Math.abs(result.area - reference.area)).toBeLessThanOrEqual(1e-6)
  })
})
