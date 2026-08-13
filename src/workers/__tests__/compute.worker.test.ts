import { generateIDWGrid } from '@/workers/compute.worker'

/**
 * Regression tests for generateIDWGrid (IDW interpolation) in
 * src/workers/compute.worker.ts.
 *
 * IDW_BUG (2026-08-13): batch 6 of the unused-vars grind found
 * `row.push(weightSum / weightSum)` — a variable divided by itself — so
 * every non-exact cell of the grid was exactly 1.0, silently destroying
 * the interpolation. Fixed to `weightedSum / weightSum`. These tests
 * lock that fix in: clustered points with differing values must produce
 * values strictly between the samples, never 1.0.
 */
describe('generateIDWGrid (IDW interpolation)', () => {
  const bounds = { minX: 0, minY: 0, maxX: 10, maxY: 10 }
  const resolution = 2

  function gridAt(grid: number[][], x: number, y: number): number {
    const c = Math.round((x - bounds.minX) / resolution)
    const r = Math.round((y - bounds.minY) / resolution)
    return grid[r][c]
  }

  it('returns the sample value exactly at a sample location (dist < 0.0001 branch)', () => {
    const { grid } = generateIDWGrid({
      points: [{ x: 2, y: 2, value: 42 }],
      bounds,
      resolution,
    })
    expect(gridAt(grid, 2, 2)).toBe(42)
  })

  it('interpolates non-1.0 values between clustered points (the weightSum/weightSum regression)', () => {
    // Two points clustered near the origin with different values. With the
    // old bug every non-exact cell was exactly 1.0.
    const { grid, rows, cols } = generateIDWGrid({
      points: [
        { x: 0, y: 0, value: 10 },
        { x: 0.5, y: 0.5, value: 20 },
      ],
      bounds,
      resolution,
    })

    expect(rows).toBe(6)
    expect(cols).toBe(6)

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = bounds.minX + c * resolution
        const y = bounds.minY + r * resolution
        // The (0, 0) sample sits exactly on a grid cell; (0.5, 0.5) does
        // not, so all other cells must come from the weighted average.
        if (x === 0 && y === 0) continue
        const v = grid[r][c]
        expect(v).not.toBe(1) // the bug produced exactly 1.0 everywhere
        expect(v).toBeGreaterThan(10) // strictly between the two samples
        expect(v).toBeLessThan(20)
      }
    }
  })

  it('converges to the sample value far from other points (single-point IDW is exact)', () => {
    const { grid } = generateIDWGrid({
      points: [{ x: 7.5, y: 7.5, value: 33 }],
      bounds,
      resolution,
    })
    for (const row of grid) {
      for (const v of row) {
        // With one point, weightedSum/weightSum telescopes to the value.
        expect(v).toBeCloseTo(33, 6)
      }
    }
  })

  it('honors the power exponent (higher power = stronger nearest-point pull)', () => {
    const pts = [
      { x: 0, y: 0, value: 0 },
      { x: 1, y: 0, value: 100 },
    ]
    const run = (power: number) => {
      const { grid } = generateIDWGrid({ points: pts, bounds: { minX: 0, minY: 0, maxX: 3, maxY: 1 }, resolution: 0.5, power })
      // Cell at x=1.5 (c = 1.5/0.5 = 3), y=0 (r=0). The shared gridAt
      // helper indexes against the default resolution, so read directly.
      return grid[0][3]
    }
    // Query (1.5, 0) sits between the samples: 0.5 units from the 100,
    // 1.5 units from the 0. Both powers interpolate strictly between the
    // samples; the higher power must pull harder toward the nearer point.
    const power1 = run(1)
    const power4 = run(4)
    expect(power1).toBeGreaterThan(0)
    expect(power1).toBeLessThan(100)
    expect(power4).toBeGreaterThan(power1)
    expect(power4).toBeLessThan(100)
  })

  it('keeps the bounds/rows/cols shape stable', () => {
    const res = generateIDWGrid({
      points: [{ x: 1, y: 1, value: 5 }],
      bounds: { minX: 0, minY: 0, maxX: 6, maxY: 4 },
      resolution: 2,
    })
    expect(res.rows).toBe(3) // ceil(4/2)+1
    expect(res.cols).toBe(4) // ceil(6/2)+1
    expect(res.grid).toHaveLength(3)
    expect(res.grid[0]).toHaveLength(4)
    expect(res.bounds).toEqual({ minX: 0, minY: 0, maxX: 6, maxY: 4 })
  })
})
