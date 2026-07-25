/**
 * Tests for tinWorkerClient.ts
 *
 * Strategy:
 *   - The Jest jsdom environment does not ship a real Web Worker, so
 *     `getWorker()` returns null and the client falls back to sync mode.
 *     We verify the sync fallback produces identical output to the
 *     synchronous engine.
 *   - We also exercise the worker message-handler (`_handleRequest` from
 *     tinWorker.ts) directly to verify wire-format compliance.
 */

import {
  triangulateAsync,
  buildTINSurfaceAsync,
  generateContoursAsync,
  isWorkerAvailable,
  _forceSyncModeForTests,
  _resetForTests,
} from '../tinWorkerClient'
import { _handleRequest } from '../tinWorker'
import {
  triangulate,
  buildTINSurface,
  generateContours,
  type SpotHeight,
} from '@/lib/engine/contours'

// Force sync mode for all tests — Jest jsdom has no real Worker.
beforeAll(() => _forceSyncModeForTests())
afterAll(() => _resetForTests())

const SAMPLE_POINTS: SpotHeight[] = [
  { name: 'P1', easting: 0, northing: 0, elevation: 100 },
  { name: 'P2', easting: 10, northing: 0, elevation: 110 },
  { name: 'P3', easting: 10, northing: 10, elevation: 105 },
  { name: 'P4', easting: 0, northing: 10, elevation: 95 },
  { name: 'P5', easting: 5, northing: 5, elevation: 115 }, // peak
  { name: 'P6', easting: 15, northing: 5, elevation: 100 },
]

describe('isWorkerAvailable (under Jest, no real Worker)', () => {
  it('reports the worker as unavailable after _forceSyncModeForTests', () => {
    expect(isWorkerAvailable()).toBe(false)
  })
})

describe('triangulateAsync (sync fallback)', () => {
  it('returns the same triangles as the sync engine', async () => {
    const syncResult = triangulate(SAMPLE_POINTS)
    const asyncResult = await triangulateAsync(SAMPLE_POINTS)
    expect(asyncResult.length).toBe(syncResult.length)
    // Triangle vertex sets should match (order may differ)
    const canonical = (tris: typeof syncResult) =>
      tris
        .map(t => [t.p1.name, t.p2.name, t.p3.name].sort().join('|'))
        .sort()
    expect(canonical(asyncResult)).toEqual(canonical(syncResult))
  })

  it('returns an empty array for fewer than 3 points', async () => {
    const result = await triangulateAsync([SAMPLE_POINTS[0], SAMPLE_POINTS[1]])
    expect(result).toEqual([])
  })
})

describe('buildTINSurfaceAsync (sync fallback)', () => {
  it('builds a surface with bounds matching the sync engine', async () => {
    const syncSurface = buildTINSurface(SAMPLE_POINTS)
    const asyncSurface = await buildTINSurfaceAsync(SAMPLE_POINTS)
    expect(asyncSurface.bounds).toEqual(syncSurface.bounds)
    expect(asyncSurface.points.length).toBe(SAMPLE_POINTS.length)
    expect(asyncSurface.triangles.length).toBe(syncSurface.triangles.length)
  })

  it('enforces breaklines via the sync path', async () => {
    const breaklines = [
      {
        start: SAMPLE_POINTS[0],
        end: SAMPLE_POINTS[2],
      },
    ]
    const syncSurface = buildTINSurface(SAMPLE_POINTS, breaklines)
    const asyncSurface = await buildTINSurfaceAsync(SAMPLE_POINTS, breaklines)
    expect(asyncSurface.triangles.length).toBe(syncSurface.triangles.length)
  })
})

describe('generateContoursAsync (sync fallback)', () => {
  it('produces the same contours as the sync engine', async () => {
    const syncContours = generateContours(SAMPLE_POINTS, 5)
    const asyncContours = await generateContoursAsync(SAMPLE_POINTS, 5)
    expect(asyncContours.length).toBe(syncContours.length)
    // Same set of elevations
    const syncElevs = syncContours.map(c => c.elevation).sort((a, b) => a - b)
    const asyncElevs = asyncContours.map(c => c.elevation).sort((a, b) => a - b)
    expect(asyncElevs).toEqual(syncElevs)
  })

  it('returns empty for fewer than 3 points', async () => {
    const result = await generateContoursAsync([SAMPLE_POINTS[0]], 5)
    expect(result).toEqual([])
  })

  it('accepts indexInterval and breaklines', async () => {
    const result = await generateContoursAsync(SAMPLE_POINTS, 5, {
      indexInterval: 10,
      breaklines: [{ start: SAMPLE_POINTS[0], end: SAMPLE_POINTS[2] }],
    })
    expect(Array.isArray(result)).toBe(true)
  })
})

describe('tinWorker._handleRequest (wire format)', () => {
  it('triangulate op returns Triangle[]', () => {
    const result = _handleRequest({
      id: 'req-1',
      op: 'triangulate',
      points: SAMPLE_POINTS,
    }) as unknown[]
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('buildTINSurface op returns a TINSurface object with bounds', () => {
    const result = _handleRequest({
      id: 'req-2',
      op: 'buildTINSurface',
      points: SAMPLE_POINTS,
    }) as ReturnType<typeof buildTINSurface>
    expect(result).toHaveProperty('triangles')
    expect(result).toHaveProperty('points')
    expect(result).toHaveProperty('bounds')
    expect(result.bounds).toHaveProperty('minE')
    expect(result.bounds).toHaveProperty('maxE')
    expect(result.bounds).toHaveProperty('minN')
    expect(result.bounds).toHaveProperty('maxN')
  })

  it('generateContours op returns ContourLine[]', () => {
    const result = _handleRequest({
      id: 'req-3',
      op: 'generateContours',
      points: SAMPLE_POINTS,
      interval: 5,
    }) as ReturnType<typeof generateContours>
    expect(Array.isArray(result)).toBe(true)
    for (const c of result) {
      expect(c).toHaveProperty('elevation')
      expect(c).toHaveProperty('points')
      expect(c).toHaveProperty('isIndex')
      expect(c.points.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('throws on unknown op', () => {
    expect(() =>
      _handleRequest({ id: 'req-x', op: 'unknown' as any, points: [] })
    ).toThrow(/Unknown op/)
  })
})

describe('forceSync option', () => {
  it('honours forceSync=true even if Worker might be available', async () => {
    // Worker is already forced unavailable in beforeAll, but forceSync should
    // also short-circuit dispatch without calling getWorker().
    const result = await triangulateAsync(SAMPLE_POINTS, undefined, {
      forceSync: true,
    })
    expect(result.length).toBeGreaterThan(0)
  })
})
