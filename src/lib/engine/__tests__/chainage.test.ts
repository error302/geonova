import { computeChainageTable, reverseChainageLinear } from '../chainage'
import { approxEqual } from '@/test-utils/approx'
import { defined } from '@/test-utils/defined'

const ALIGNMENT = [
  { name: 'A', easting: 0,   northing: 0   },
  { name: 'B', easting: 100, northing: 0   },
  { name: 'C', easting: 100, northing: 100 },
]

describe('computeChainageTable', () => {
  it('first row has starting chainage', () => {
    const rows = computeChainageTable({
      start: { easting: 0, northing: 0 },
      startChainage: 0,
      alignment: ALIGNMENT,
    })
    expect(approxEqual(rows[0].chainage, 0, 10 ** -4)).toBe(true)
    expect(approxEqual(rows[0].distance, 0, 10 ** -4)).toBe(true)
  })

  it('cumulative chainage increases along alignment', () => {
    // Each alignment point should have greater chainage than the previous
    const rows = computeChainageTable({
      start: { easting: 0, northing: 0 },
      startName: 'START',
      startChainage: 0,
      alignment: [
        { name: 'B', easting: 100, northing: 0   },
        { name: 'C', easting: 100, northing: 100 },
        { name: 'D', easting: 200, northing: 100 },
      ],
    })
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].chainage).toBeGreaterThan(rows[i - 1].chainage)
    }
  })

  it('horizontal leg of 100m gives chainage increase of 100', () => {
    const rows = computeChainageTable({
      start: { easting: 0, northing: 0 },
      startChainage: 500,
      alignment: [{ name: 'B', easting: 100, northing: 0 }],
    })
    expect(approxEqual(rows[1].chainage, 600, 10 ** -3)).toBe(true)
    expect(approxEqual(rows[1].distance, 100, 10 ** -3)).toBe(true)
  })

  it('returns correct number of rows (start + alignment points)', () => {
    const rows = computeChainageTable({
      start: { easting: 0, northing: 0 },
      startChainage: 0,
      alignment: ALIGNMENT,
    })
    expect(rows.length).toBe(ALIGNMENT.length + 1)
  })
})

describe('reverseChainageLinear', () => {
  it('finds coordinates at midpoint of a segment', () => {
    const table = computeChainageTable({
      start: { easting: 0, northing: 0 },
      startChainage: 0,
      alignment: [{ name: 'B', easting: 100, northing: 0 }],
    })
    const pt = reverseChainageLinear({ targetChainage: 50, table })
    expect(pt).not.toBeNull()
    expect(approxEqual(defined(pt).easting, 50, 10 ** -3)).toBe(true)
    expect(approxEqual(defined(pt).northing, 0, 10 ** -3)).toBe(true)
  })

  it('returns null when chainage is out of range', () => {
    const table = computeChainageTable({
      start: { easting: 0, northing: 0 },
      startChainage: 0,
      alignment: [{ name: 'B', easting: 100, northing: 0 }],
    })
    expect(reverseChainageLinear({ targetChainage: 999, table })).toBeNull()
  })

  it('returns start point for chainage = startChainage', () => {
    const table = computeChainageTable({
      start: { easting: 0, northing: 0 },
      startChainage: 0,
      alignment: [{ name: 'B', easting: 100, northing: 0 }],
    })
    const pt = reverseChainageLinear({ targetChainage: 0, table })
    expect(pt).not.toBeNull()
    expect(approxEqual(defined(pt).easting, 0, 10 ** -3)).toBe(true)
  })
})
