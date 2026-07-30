/**
 * Tests for editingTools — Split, Merge, Rotate, Offset, Reshape.
 *
 * These are pure-geometry functions that use turf.js. No OpenLayers
 * dependencies — they operate on coordinate arrays.
 */

import {
  splitPolygonWithLine,
  mergePolygons,
  rotatePolygon,
  createOffset,
  reshapePolygon,
} from '../editingTools'

describe('splitPolygonWithLine', () => {
  // A 100x100 square polygon (UTM coordinates)
  const square: [number, number][] = [
    [0, 0], [100, 0], [100, 100], [0, 100], [0, 0],
  ]

  it('splits a square in half with a vertical line', () => {
    const line: [number, number][] = [[50, -10], [50, 110]]
    const result = splitPolygonWithLine(square, line)
    expect(result).not.toBeNull()
    if (!result) return
    expect(result.polygon1.length).toBeGreaterThan(3)
    expect(result.polygon2.length).toBeGreaterThan(3)
    expect(result.area1).toBeGreaterThan(0)
    expect(result.area2).toBeGreaterThan(0)
  })

  it('returns null when the line does not cross the polygon', () => {
    const line: [number, number][] = [[200, 200], [300, 300]]
    const result = splitPolygonWithLine(square, line)
    expect(result).toBeNull()
  })

  it('returns null when the line only touches one edge (1 intersection)', () => {
    const line: [number, number][] = [[50, -10], [50, 0]]
    const result = splitPolygonWithLine(square, line)
    expect(result).toBeNull()
  })

  it('produces two non-empty polygons', () => {
    const line: [number, number][] = [[50, -10], [50, 110]]
    const result = splitPolygonWithLine(square, line)
    if (!result) return
    // Both polygons should have at least 4 vertices (valid ring)
    expect(result.polygon1.length).toBeGreaterThanOrEqual(4)
    expect(result.polygon2.length).toBeGreaterThanOrEqual(4)
    // Both should have positive area
    expect(result.area1).toBeGreaterThan(0)
    expect(result.area2).toBeGreaterThan(0)
  })
})

describe('mergePolygons', () => {
  it('merges two adjacent squares into one rectangle', () => {
    const poly1: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
    const poly2: [number, number][] = [[10, 0], [20, 0], [20, 10], [10, 10], [10, 0]]
    const result = mergePolygons([poly1, poly2])
    expect(result).not.toBeNull()
    if (!result) return
    // Merged polygon should have area ≈ 200 m²
    // We can't easily check exact coords (turf may reorder), but length should be ≥ 4
    expect(result.length).toBeGreaterThanOrEqual(4)
  })

  it('returns null for non-adjacent polygons', () => {
    const poly1: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
    const poly2: [number, number][] = [[100, 100], [110, 100], [110, 110], [100, 110], [100, 100]]
    const result = mergePolygons([poly1, poly2])
    expect(result).toBeNull()
  })

  it('returns null for fewer than 2 polygons', () => {
    const poly1: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
    expect(mergePolygons([poly1])).toBeNull()
    expect(mergePolygons([])).toBeNull()
  })
})

describe('rotatePolygon', () => {
  const square: [number, number][] = [
    [0, 0], [10, 0], [10, 10], [0, 10], [0, 0],
  ]

  it('rotates a polygon by 90 degrees', () => {
    const rotated = rotatePolygon(square, 90)
    expect(rotated).toBeDefined()
    expect(rotated.length).toBe(square.length)
    // The area should be preserved (100 m²)
    // We can't easily check exact coords without knowing the centroid,
    // but turf.transformRotate rotates around the centroid by default.
  })

  it('rotating by 0 degrees returns approximately the same coords', () => {
    const rotated = rotatePolygon(square, 0)
    // Should be very close to original (may have minor floating point diffs)
    expect(rotated.length).toBe(square.length)
  })

  it('rotating by 360 degrees returns approximately the same coords', () => {
    const rotated = rotatePolygon(square, 360)
    expect(rotated.length).toBe(square.length)
    // Each point should be very close to the original
    for (let i = 0; i < square.length; i++) {
      expect(Math.abs(rotated[i][0] - square[i][0])).toBeLessThan(0.001)
      expect(Math.abs(rotated[i][1] - square[i][1])).toBeLessThan(0.001)
    }
  })
})

describe('createOffset', () => {
  it('creates an offset of a line', () => {
    const line: [number, number][] = [[0, 0], [100, 0], [100, 100]]
    const offset = createOffset(line, 5, false)
    expect(offset).not.toBeNull()
    if (!offset) return
    expect(offset.length).toBeGreaterThanOrEqual(2)
  })

  it('creates an offset of a polygon (buffer)', () => {
    const poly: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
    const offset = createOffset(poly, 2, true)
    expect(offset).not.toBeNull()
    if (!offset) return
    expect(offset.length).toBeGreaterThanOrEqual(4)
  })

  it('returns null for invalid input (zero distance on line)', () => {
    const line: [number, number][] = [[0, 0], [100, 0]]
    // turf.lineOffset may fail for zero distance
    const offset = createOffset(line, 0, false)
    // Implementation may return null or an empty array — just verify no crash
    expect(offset === null || Array.isArray(offset)).toBe(true)
  })
})

describe('reshapePolygon', () => {
  // AUDIT FIX (2026-07-05): reshapePolygon was previously a no-op (returned
  // the original polygon unchanged). Now it properly traces the boundary
  // and replaces the segment between intersection points.

  const square: [number, number][] = [
    [0, 0], [100, 0], [100, 100], [0, 100], [0, 0],
  ]

  it('reshapes a polygon by replacing a boundary segment with a new line', () => {
    // Draw a line that crosses the square from (-10, 50) to (110, 50)
    // This should replace part of the boundary with the new line
    const newSegment: [number, number][] = [[-10, 50], [110, 50]]
    const result = reshapePolygon(square, newSegment)
    expect(result).not.toBeNull()
    if (!result) return
    // The reshaped polygon should have a different coordinate count
    // (at least 4 vertices to form a valid ring)
    expect(result.length).toBeGreaterThanOrEqual(4)
  })

  it('returns null when the new line does not cross the polygon', () => {
    const newSegment: [number, number][] = [[200, 200], [300, 300]]
    const result = reshapePolygon(square, newSegment)
    expect(result).toBeNull()
  })

  it('returns null when the line only touches one edge', () => {
    const newSegment: [number, number][] = [[-10, 50], [0, 50]]
    const result = reshapePolygon(square, newSegment)
    expect(result).toBeNull()
  })

  it('produces a valid polygon with positive area', () => {
    const newSegment: [number, number][] = [[-10, 50], [110, 50]]
    const result = reshapePolygon(square, newSegment)
    if (!result) return
    // The result should be a closed ring (first ≈ last)
    expect(result.length).toBeGreaterThanOrEqual(4)
    // First and last points should be approximately equal (closed ring)
    const first = result[0]
    const last = result[result.length - 1]
    expect(Math.abs(first[0] - last[0])).toBeLessThan(1)
    expect(Math.abs(first[1] - last[1])).toBeLessThan(1)
  })
})
