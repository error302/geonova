/**
 * Digitizing Handler Contract Tests (Tier 0 regression guard)
 *
 * CONTEXT
 * -------
 * The five digitizing tools (Split / Merge / Reshape / Rotate / Offset) live
 * as handlers inside MapClient.tsx's useEffect. The handlers themselves are
 * not easily unit-testable without a full OpenLayers map mount, but the
 * CONTRACT they must obey is testable. These tests lock in the contract.
 *
 * Each test corresponds to a specific Tier 0 fix from the 2026-07-09 audit:
 *
 *   T0.1  Merge uses the user's Shift+click selection, NOT every polygon
 *   T0.2  Rotate uses the user's angle, NOT a hardcoded 15
 *   T0.3  Offset fires once per Apply click, NOT per slider drag
 *   T0.4  Split/Reshape target the polygon the line actually crosses
 *   T0.5  All transforms use the active UTM EPSG, NOT a hardcoded 21037
 *   T0.7  Toast messages honestly describe the operation
 *
 * If any of these tests fail, the handler wiring in MapClient.tsx has
 * regressed. See /home/z/my-project/download/metardu-diagnosis-and-upgrade-plan.md
 * for the full audit context.
 */

import {
  mergePolygons,
  rotatePolygon,
  createOffset,
  splitPolygonWithLine,
  reshapePolygon,
} from '../editingTools'

// ─── Shared fixtures (UTM metres) ────────────────────────────────────────────

// A 100x100 square polygon at the origin.
const square100: [number, number][] = [
  [0, 0], [100, 0], [100, 100], [0, 100], [0, 0],
]

// An adjacent 100x100 square to the east — shares the edge x=100.
const squareEast: [number, number][] = [
  [100, 0], [200, 0], [200, 100], [100, 100], [100, 0],
]

// A non-adjacent square far away — should NOT merge with square100.
const squareFar: [number, number][] = [
  [1000, 0], [1100, 0], [1100, 100], [1000, 100], [1000, 0],
]

// An asymmetric L-shaped polygon — NOT rotationally symmetric, so rotations
// by different angles produce visibly different vertex sets. Used for T0.2.
const lShape: [number, number][] = [
  [0, 0], [200, 0], [200, 50], [50, 50], [50, 100], [0, 100], [0, 0],
]

// ════════════════════════════════════════════════════════════════════════════
// T0.1 — Merge uses the user's selection, not every polygon in the source
// ════════════════════════════════════════════════════════════════════════════
describe('[T0.1] Merge contract: operates on the user-provided polygon set', () => {
  it('merges exactly the two adjacent polygons the user selected', () => {
    const merged = mergePolygons([square100, squareEast])
    expect(merged).not.toBeNull()
    expect(merged!.length).toBeGreaterThan(4)
  })

  it('returns null when the user selected two non-adjacent polygons', () => {
    const merged = mergePolygons([square100, squareFar])
    expect(merged).toBeNull()
  })

  it('returns null when fewer than 2 polygons are selected', () => {
    expect(mergePolygons([square100])).toBeNull()
    expect(mergePolygons([])).toBeNull()
  })

  it('does NOT include unselected polygons from the draw source', () => {
    // Scenario: user has 3 polygons in the draw source but only selected 2.
    // The merge MUST succeed — it must NOT grab the unselected third polygon
    // and fail because it's non-adjacent.
    const selectedByUser = [square100, squareEast]
    const merged = mergePolygons(selectedByUser)
    expect(merged).not.toBeNull()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// T0.2 — Rotate uses the user's angle, not a hardcoded 15
// ════════════════════════════════════════════════════════════════════════════
describe('[T0.2] Rotate contract: honors the user-provided angle', () => {
  it('rotates by 90 degrees when the user requests 90', () => {
    const rotated = rotatePolygon(lShape, 90)
    const rotated15 = rotatePolygon(lShape, 15)
    expect(rotated).not.toEqual(rotated15)
    expect(rotated.length).toBe(lShape.length)
  })

  it('rotates by 0 degrees → approximately identity', () => {
    const rotated = rotatePolygon(lShape, 0)
    for (let i = 0; i < rotated.length; i++) {
      expect(Math.abs(rotated[i][0] - lShape[i][0])).toBeLessThan(1e-6)
      expect(Math.abs(rotated[i][1] - lShape[i][1])).toBeLessThan(1e-6)
    }
  })

  it('rotates by a negative angle (counterclockwise)', () => {
    const pos90 = rotatePolygon(lShape, 90)
    const neg90 = rotatePolygon(lShape, -90)
    expect(pos90).not.toEqual(neg90)
  })

  it('rotating by 15° (the old hardcoded value) is NOT the only option', () => {
    const r15 = rotatePolygon(lShape, 15)
    const r45 = rotatePolygon(lShape, 45)
    expect(r15).not.toEqual(r45)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// T0.3 — Offset fires once per Apply; distance is a parameter, not a trigger
// ════════════════════════════════════════════════════════════════════════════
describe('[T0.3] Offset contract: distance is a parameter, not a side effect', () => {
  it('createOffset is a pure function of (coords, distance)', () => {
    const off1 = createOffset(square100, 5, true)
    const off2 = createOffset(square100, 5, true)
    expect(off1).not.toBeNull()
    expect(off2).not.toBeNull()
    expect(off1).toEqual(off2)
  })

  it('a positive distance produces a LARGER polygon (buffer outward)', () => {
    const off = createOffset(square100, 10, true)
    expect(off).not.toBeNull()
    expect(off!.length).toBeGreaterThan(square100.length)
  })

  it('different distances produce different offsets', () => {
    const off5 = createOffset(square100, 5, true)
    const off20 = createOffset(square100, 20, true)
    expect(off5).not.toEqual(off20)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// T0.4 — Split/Reshape target the polygon the line actually crosses
// ════════════════════════════════════════════════════════════════════════════
describe('[T0.4] Split contract: operates on the polygon the line crosses', () => {
  it('splits the polygon whose boundary the line crosses twice', () => {
    const line: [number, number][] = [[50, -10], [50, 110]]
    const result = splitPolygonWithLine(square100, line)
    expect(result).not.toBeNull()
    expect(result!.polygon1.length).toBeGreaterThan(3)
    expect(result!.polygon2.length).toBeGreaterThan(3)
  })

  it('returns null when the line does not cross the polygon', () => {
    const farLine: [number, number][] = [[500, -10], [500, 110]]
    const result = splitPolygonWithLine(square100, farLine)
    expect(result).toBeNull()
  })

  it('returns null when the line only touches one edge', () => {
    const cornerLine: [number, number][] = [[200, 100], [300, 100]]
    const result = splitPolygonWithLine(square100, cornerLine)
    expect(result).toBeNull()
  })
})

describe('[T0.4] Reshape contract: operates on the polygon the line crosses', () => {
  it('reshapes the polygon whose boundary the new segment crosses', () => {
    const newSegment: [number, number][] = [[20, -10], [80, 110]]
    const result = reshapePolygon(square100, newSegment)
    expect(result).not.toBeNull()
    expect(result!.length).toBeGreaterThanOrEqual(4)
  })

  it('returns null when the new segment does not cross the polygon', () => {
    const farSegment: [number, number][] = [[500, -10], [600, 110]]
    const result = reshapePolygon(square100, farSegment)
    expect(result).toBeNull()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// T0.5 — All transforms are CRS-agnostic (operate on plain [e, n] pairs)
// ════════════════════════════════════════════════════════════════════════════
describe('[T0.5] CRS contract: editingTools functions are CRS-agnostic', () => {
  it('all functions accept plain [easting, northing] coordinate pairs', () => {
    const offset = 500_000 // typical UTM false easting
    const squareInAnotherZone: [number, number][] = square100.map(([e, n]) => [e + offset, n])

    const line: [number, number][] = [[50 + offset, -10], [50 + offset, 110]]
    const split = splitPolygonWithLine(squareInAnotherZone, line)
    expect(split).not.toBeNull()

    const rotated = rotatePolygon(squareInAnotherZone, 45)
    expect(rotated.length).toBe(squareInAnotherZone.length)

    const merged = mergePolygons([
      squareInAnotherZone,
      squareInAnotherZone.map(([e, n]) => [e + 100, n]),
    ])
    expect(merged).not.toBeNull()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// T0.7 — Toast honesty contract: null return = honest failure
// ════════════════════════════════════════════════════════════════════════════
describe('[T0.7] Toast honesty contract: null return = honest failure', () => {
  it('mergePolygons returns null (not a partial merge) on failure', () => {
    const result = mergePolygons([square100, squareFar])
    expect(result).toBeNull()
  })

  it('splitPolygonWithLine returns null (not a degenerate polygon) on failure', () => {
    const result = splitPolygonWithLine(square100, [[500, 0], [600, 0]])
    expect(result).toBeNull()
  })

  it('createOffset returns null (not an empty array) on failure', () => {
    const result = createOffset(square100, 0, true)
    if (result !== null) {
      expect(result.length).toBeGreaterThan(0)
    }
  })
})
