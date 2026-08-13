import { generateIDWGrid, parseCSVPoints, wgs84ToArc1960UTM37S, computeBearingDistance } from '@/workers/compute.worker'

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
describe('parseCSVPoints (CSV column detection)', () => {
  // CSV_COLMAP_BUG (2026-08-13): the alias loop matched single-letter
  // aliases (n/e/x/y/h/z) with `headers[i].includes(a)`, so 'point'
  // matched the northing alias 'n' and 'north' matched the elevation
  // alias 'h' — colMap bound northing to the point-name column, every
  // row produced NaN northing, and the function returned []. Fixed by
  // requiring exact matches for single-char aliases and substring
  // matches only for multi-char aliases. These tests lock that in.
  it('maps Point/North/East/Elev/Code headers and converts UTM to WGS84', () => {
    const csv =
      'Point,North,East,Elev,Code\n' +
      'A1,9857700,237100,1720.5,CP\n' +
      'B2,9857600,237200,1721.25,BM\n'
    const pts = parseCSVPoints(csv)
    expect(pts).toHaveLength(2)

    expect(pts[0].pointName).toBe('A1')
    expect(pts[0].northing).toBe(9857700)
    expect(pts[0].easting).toBe(237100)
    expect(pts[0].elevation).toBe(1720.5)
    expect(pts[0].code).toBe('CP')
    // Nairobi sits ~S01°17', E36°38' in this simplified UTM inverse.
    expect(pts[0].latitude).toBeCloseTo(-1.2863292, 6)
    expect(pts[0].longitude).toBeCloseTo(36.6374661, 6)

    expect(pts[1].pointName).toBe('B2')
    expect(pts[1].elevation).toBe(1721.25)
    expect(pts[1].code).toBe('BM')
  })

  it('recognizes y/x/z aliases for northing/easting/elevation', () => {
    const pts = parseCSVPoints('name,y,x,z,code\nP1,100,200,10,CP\n')
    expect(pts).toHaveLength(1)
    expect(pts[0].pointName).toBe('P1')
    expect(pts[0].northing).toBe(100)
    expect(pts[0].easting).toBe(200)
    expect(pts[0].elevation).toBe(10)
    expect(pts[0].code).toBe('CP')
  })

  it('handles single-letter n/e/h headers without cross-matching', () => {
    // Regression: 'pt' contains 'n' and 'type' contains 'e' — the old
    // includes() matching bound northing to the point-name column.
    const pts = parseCSVPoints('pt,n,e,h,type\nP1,100,200,10,CP\n')
    expect(pts).toHaveLength(1)
    expect(pts[0].pointName).toBe('P1')
    expect(pts[0].northing).toBe(100)
    expect(pts[0].easting).toBe(200)
    expect(pts[0].elevation).toBe(10)
    expect(pts[0].code).toBe('CP')
  })

  it('strips quotes and supports custom delimiters', () => {
    const pts = parseCSVPoints('"Point";"North";"East"\n"A1";100;200\n', ';')
    expect(pts).toHaveLength(1)
    expect(pts[0].pointName).toBe('A1')
    expect(pts[0].northing).toBe(100)
    expect(pts[0].easting).toBe(200)
  })

  it('handles CRLF line endings', () => {
    const pts = parseCSVPoints('point,north,east\r\nP1,100,200\r\n')
    expect(pts).toHaveLength(1)
    expect(pts[0].pointName).toBe('P1')
  })

  it('uses lat/lng columns verbatim when both are present', () => {
    const pts = parseCSVPoints(
      'name,latitude,longitude,north,east\nP1,-1.28,36.82,9857700,237100\n'
    )
    expect(pts).toHaveLength(1)
    expect(pts[0].latitude).toBeCloseTo(-1.28, 6)
    expect(pts[0].longitude).toBeCloseTo(36.82, 6)
  })

  it('returns [] for a header-only file and skips rows missing N/E', () => {
    expect(parseCSVPoints('point,north,east\n')).toEqual([])
    expect(parseCSVPoints('point,north,east\nP1,abc,200\n')).toEqual([])
    // No northing/easting columns at all → nothing can be parsed.
    expect(parseCSVPoints('name,latitude,longitude\nP1,-1.28,36.82\n')).toEqual([])
  })

  it('assigns PT{n} default names when no point-name column exists', () => {
    const pts = parseCSVPoints('north,east\n100,200\n')
    expect(pts).toHaveLength(1)
    expect(pts[0].pointName).toBe('PT1')
    expect(pts[0].code).toBe('PT')
    expect(pts[0].elevation).toBeNull()
  })
})

describe('wgs84ToArc1960UTM37S (UTM Zone 37S forward transform)', () => {
  it('maps the zone origin (0° lat, 39°E central meridian) to its exact anchor', () => {
    // A=0 at the central meridian, M=0 at the equator → easting 500000
    // and northing exactly the false northing.
    expect(wgs84ToArc1960UTM37S(0, 39)).toEqual({ northing: 10000000, easting: 500000 })
  })

  it('keeps the central meridian exact while moving north of the equator', () => {
    const res = wgs84ToArc1960UTM37S(0.5, 39)
    expect(res.easting).toBe(500000)
    expect(res.northing).toBeGreaterThan(10000000)
    expect(res.northing).toBeCloseTo(10055265.04, 2)
  })

  it('is stable on a Nairobi reference point', () => {
    // Nairobi city centre (approx). Pure WGS84 UTM — no Arc datum shift —
    // so this is the deterministic value of this implementation.
    const res = wgs84ToArc1960UTM37S(-1.286389, 36.817223)
    expect(res.northing).toBeCloseTo(9857711.22, 2)
    expect(res.easting).toBeCloseTo(257113.28, 2)
    // South of the equator → northing below the 10,000,000 false northing.
    expect(res.northing).toBeLessThan(10000000)
  })

  it('round-trips through the worker CSV parser back to the source lat/lng', () => {
    // The worker parses N/E columns through arc1960UTM37SToWGS84, so the
    // forward/backward pair must recover the original coordinates to the
    // 1e-7 rounding of the inverse.
    const { northing, easting } = wgs84ToArc1960UTM37S(-1.286389, 36.817223)
    const [pt] = parseCSVPoints(`point,north,east\nP1,${northing},${easting}\n`)
    expect(pt.latitude).toBeCloseTo(-1.286389, 6)
    expect(pt.longitude).toBeCloseTo(36.817223, 6)
  })
})

describe('computeBearingDistance (whole-circle bearings from north)', () => {
  it('reports cardinal directions with 0° = north, clockwise', () => {
    const n = computeBearingDistance({ northing: 0, easting: 0 }, { northing: 1000, easting: 0 })
    expect(n.bearing).toBe(0)
    expect(n.distance).toBe(1000)

    const e = computeBearingDistance({ northing: 0, easting: 0 }, { northing: 0, easting: 1000 })
    expect(e.bearing).toBe(90)

    const s = computeBearingDistance({ northing: 0, easting: 0 }, { northing: -1000, easting: 0 })
    expect(s.bearing).toBe(180)

    const w = computeBearingDistance({ northing: 0, easting: 0 }, { northing: 0, easting: -1000 })
    expect(w.bearing).toBe(270)
  })

  it('computes the 45° northeast diagonal with √2 distance', () => {
    const res = computeBearingDistance({ northing: 0, easting: 0 }, { northing: 1, easting: 1 })
    expect(res.bearing).toBe(45)
    expect(res.distance).toBeCloseTo(Math.SQRT2, 4)
    expect(res.dEasting).toBe(1)
    expect(res.dNorthing).toBe(1)
  })

  it('matches the 3-4-5 triangle (bearing atan2(3,4))', () => {
    const res = computeBearingDistance({ northing: 0, easting: 0 }, { northing: 4, easting: 3 })
    expect(res.distance).toBe(5)
    expect(res.bearing).toBeCloseTo(36.8699, 4)
  })

  it('returns zero bearing/distance for coincident points', () => {
    const res = computeBearingDistance({ northing: 5, easting: 7 }, { northing: 5, easting: 7 })
    expect(res.bearing).toBe(0)
    expect(res.distance).toBe(0)
    expect(res.dEasting).toBe(0)
    expect(res.dNorthing).toBe(0)
  })

  it('is invariant to translation (relative offsets only)', () => {
    const a = computeBearingDistance({ northing: 0, easting: 0 }, { northing: 100, easting: 100 })
    const b = computeBearingDistance({ northing: 2000, easting: 3000 }, { northing: 2100, easting: 3100 })
    expect(b.bearing).toBe(a.bearing)
    expect(b.distance).toBe(a.distance)
  })
})
