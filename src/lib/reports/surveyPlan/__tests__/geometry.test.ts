import {
  DPI, MM_PER_INCH, PX_PER_MM, PX_PER_M,
  PAGE_WIDTH_MM, PAGE_HEIGHT_MM, STANDARD_SCALES,
  mmToPx, mToPx, pxToM,
  selectScale, calcScaleLabel, calcScaleBarMetres,
  bearingFromDelta, bearingToDMS,
  distance, midpoint, segmentAngle, textAngleForSegment,
  offsetFromMidpoint, centroid, boundingBox,
  formatBearingDegMinSec, shoelaceArea, shoelacePerimeter,
  rotatePoints, parseCornersCSV,
} from '../geometry'

describe('constants', () => {
  it('DPI is 96', () => {
    expect(DPI).toBe(96)
  })
  it('MM_PER_INCH is 25.4', () => {
    expect(MM_PER_INCH).toBe(25.4)
  })
  it('PX_PER_MM is DPI/25.4', () => {
    expect(PX_PER_MM).toBeCloseTo(96 / 25.4, 6)
  })
  it('PX_PER_M is PX_PER_MM * 1000', () => {
    expect(PX_PER_M).toBeCloseTo((96 / 25.4) * 1000, 4)
  })
  it('PAGE_WIDTH_MM is 420', () => {
    expect(PAGE_WIDTH_MM).toBe(420)
  })
  it('PAGE_HEIGHT_MM is 297', () => {
    expect(PAGE_HEIGHT_MM).toBe(297)
  })
  it('STANDARD_SCALES contains expected values', () => {
    expect(STANDARD_SCALES).toEqual([100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 50000])
  })
})

describe('mmToPx', () => {
  it('converts mm to pixels using PX_PER_MM', () => {
    expect(mmToPx(1)).toBeCloseTo(PX_PER_MM, 4)
    expect(mmToPx(10)).toBeCloseTo(PX_PER_MM * 10, 4)
    expect(mmToPx(0)).toBe(0)
  })
})

describe('mToPx', () => {
  it('converts metres to pixels', () => {
    expect(mToPx(1)).toBeCloseTo(PX_PER_M, 4)
    expect(mToPx(0)).toBe(0)
  })
})

describe('pxToM', () => {
  it('converts pixels back to metres', () => {
    const px = PX_PER_M
    expect(pxToM(px)).toBeCloseTo(1, 4)
  })
  it('round-trips correctly', () => {
    expect(pxToM(mToPx(50))).toBeCloseTo(50, 4)
  })
})

describe('selectScale', () => {
  it('returns first standard scale >= rawScale', () => {
    expect(selectScale(100, 100)).toBe(100)
    expect(selectScale(1.5, 1)).toBe(100)
    expect(selectScale(150, 100)).toBe(100)
    expect(selectScale(200000, 100)).toBe(2000)
  })
  it('falls back to 50000 for very small parcels', () => {
    expect(selectScale(1000000, 1)).toBe(50000)
  })
  it('handles 1:1 scale', () => {
    expect(selectScale(100, 100)).toBe(100)
  })
})

describe('calcScaleLabel', () => {
  it('formats scale as 1:X', () => {
    expect(calcScaleLabel(100)).toBe('1:100')
    expect(calcScaleLabel(1000)).toBe('1:1,000')
    expect(calcScaleLabel(50000)).toBe('1:50,000')
  })
})

describe('calcScaleBarMetres', () => {
  it('returns 200 for scales < 1000', () => {
    expect(calcScaleBarMetres(100)).toBe(200)
    expect(calcScaleBarMetres(500)).toBe(200)
    expect(calcScaleBarMetres(999)).toBe(200)
  })
  it('returns 500 for scales >= 1000', () => {
    expect(calcScaleBarMetres(1000)).toBe(500)
    expect(calcScaleBarMetres(5000)).toBe(500)
    expect(calcScaleBarMetres(50000)).toBe(500)
  })
})

describe('bearingFromDelta', () => {
  it('returns 0° for due north (dE=0, dN>0)', () => {
    expect(bearingFromDelta(0, 10)).toBeCloseTo(0, 6)
  })
  it('returns 90° for due east (dE>0, dN=0)', () => {
    expect(bearingFromDelta(10, 0)).toBeCloseTo(90, 6)
  })
  it('returns 180° for due south (dE=0, dN<0)', () => {
    expect(bearingFromDelta(0, -10)).toBeCloseTo(180, 6)
  })
  it('returns 270° for due west (dE<0, dN=0)', () => {
    expect(bearingFromDelta(-10, 0)).toBeCloseTo(270, 6)
  })
  it('returns 45° for NE quadrant', () => {
    expect(bearingFromDelta(10, 10)).toBeCloseTo(45, 4)
  })
  it('returns 135° for SE quadrant', () => {
    expect(bearingFromDelta(10, -10)).toBeCloseTo(135, 4)
  })
  it('returns 225° for SW quadrant', () => {
    expect(bearingFromDelta(-10, -10)).toBeCloseTo(225, 4)
  })
  it('returns 315° for NW quadrant', () => {
    expect(bearingFromDelta(-10, 10)).toBeCloseTo(315, 4)
  })
})

describe('bearingToDMS', () => {
  it('formats 0° correctly', () => {
    expect(bearingToDMS(0)).toBe('0°0\'0.0"')
  })
  it('formats 45° correctly', () => {
    expect(bearingToDMS(45)).toBe('45°0\'0.0"')
  })
  it('formats fractional degrees with minutes and seconds', () => {
    expect(bearingToDMS(45.5)).toBe('45°30\'0.0"')
    expect(bearingToDMS(45.25)).toBe('45°15\'0.0"')
    expect(bearingToDMS(45.2525)).toBe('45°15\'9.0"')
  })
  it('handles large bearings', () => {
    expect(bearingToDMS(359.999)).toBe('359°59\'56.4"')
  })
})

describe('distance', () => {
  it('returns 0 for same point', () => {
    expect(distance(0, 0, 0, 0)).toBe(0)
  })
  it('calculates horizontal distance', () => {
    expect(distance(0, 0, 3, 0)).toBeCloseTo(3, 6)
  })
  it('calculates vertical distance', () => {
    expect(distance(0, 0, 0, 4)).toBeCloseTo(4, 6)
  })
  it('calculates diagonal distance (3-4-5 triangle)', () => {
    expect(distance(0, 0, 3, 4)).toBeCloseTo(5, 6)
  })
})

describe('midpoint', () => {
  it('returns midpoint of horizontal segment', () => {
    expect(midpoint(0, 0, 10, 0)).toEqual([5, 0])
  })
  it('returns midpoint of vertical segment', () => {
    expect(midpoint(0, 0, 0, 10)).toEqual([0, 5])
  })
  it('returns midpoint of diagonal segment', () => {
    expect(midpoint(0, 0, 10, 10)).toEqual([5, 5])
  })
})

describe('segmentAngle', () => {
  it('returns 90 for eastward segment (atan2(dE, dN) basis)', () => {
    expect(segmentAngle(0, 0, 10, 0)).toBeCloseTo(90, 6)
  })
  it('returns 0 for northward segment', () => {
    expect(segmentAngle(0, 0, 0, 10)).toBeCloseTo(0, 6)
  })
  it('returns 180 for southward segment', () => {
    expect(segmentAngle(0, 0, 0, -10)).toBeCloseTo(180, 6)
  })
})

describe('textAngleForSegment', () => {
  it('returns 90 for eastward segment (angle=90, not >90 or <-90)', () => {
    expect(textAngleForSegment(0, 0, 10, 0)).toBeCloseTo(90, 6)
  })
  it('returns 0 for northward segment', () => {
    expect(textAngleForSegment(0, 0, 0, 10)).toBeCloseTo(0, 6)
  })
  it('returns 360 for southward segment (angle=180, >90 so adds 180)', () => {
    expect(textAngleForSegment(0, 0, 0, -10)).toBeCloseTo(360, 6)
  })
})

describe('offsetFromMidpoint', () => {
  it('offsets perpendicular to horizontal east segment', () => {
    const [x, y] = offsetFromMidpoint(0, 0, 10, 0, 5)
    expect(x).toBeCloseTo(5, 4)
    expect(y).toBeCloseTo(5, 4)
  })
  it('offsets perpendicular to vertical north segment', () => {
    const [x, y] = offsetFromMidpoint(0, 0, 0, 10, 5)
    expect(x).toBeCloseTo(-5, 4)
    expect(y).toBeCloseTo(5, 4)
  })
  it('returns NaN for zero-length segment (division by zero)', () => {
    const [x, y] = offsetFromMidpoint(5, 5, 5, 5, 5)
    expect(isFinite(x)).toBe(false)
    expect(isFinite(y)).toBe(false)
  })
})

describe('centroid', () => {
  it('returns [0,0] for empty array', () => {
    expect(centroid([])).toEqual([0, 0])
  })
  it('returns average of points', () => {
    const pts = [
      { easting: 0, northing: 0 },
      { easting: 10, northing: 0 },
      { easting: 10, northing: 10 },
      { easting: 0, northing: 10 },
    ]
    expect(centroid(pts)).toEqual([5, 5])
  })
  it('handles single point', () => {
    expect(centroid([{ easting: 3, northing: 7 }])).toEqual([3, 7])
  })
})

describe('boundingBox', () => {
  it('computes bounding box of points', () => {
    const pts = [
      { easting: 0, northing: 0 },
      { easting: 10, northing: 0 },
      { easting: 10, northing: 10 },
      { easting: 0, northing: 10 },
    ]
    const bb = boundingBox(pts)
    expect(bb.minE).toBe(0)
    expect(bb.maxE).toBe(10)
    expect(bb.minN).toBe(0)
    expect(bb.maxN).toBe(10)
    expect(bb.rangeE).toBe(10)
    expect(bb.rangeN).toBe(10)
  })
  it('handles single point', () => {
    const bb = boundingBox([{ easting: 5, northing: 5 }])
    expect(bb.minE).toBe(5)
    expect(bb.maxE).toBe(5)
    expect(bb.rangeE).toBe(1)
    expect(bb.rangeN).toBe(1)
  })
  it('handles empty array (Math.min/max of empty return Infinity/-Infinity)', () => {
    const bb = boundingBox([])
    expect(isFinite(bb.rangeE)).toBe(false)
    expect(isFinite(bb.rangeN)).toBe(false)
  })
})

describe('formatBearingDegMinSec', () => {
  it('pads degrees to 3 digits and minutes/seconds to 2', () => {
    expect(formatBearingDegMinSec(0)).toBe('000°00\'00.0"')
    expect(formatBearingDegMinSec(85.15)).toBe('085°09\'00.0"')
    expect(formatBearingDegMinSec(175.5075)).toBe('175°30\'27.0"')
    expect(formatBearingDegMinSec(359.999)).toBe('359°59\'56.4"')
  })
})

describe('shoelaceArea', () => {
  it('computes area of unit square as 1', () => {
    const pts = [
      { easting: 0, northing: 0 },
      { easting: 1, northing: 0 },
      { easting: 1, northing: 1 },
      { easting: 0, northing: 1 },
    ]
    expect(shoelaceArea(pts)).toBeCloseTo(1, 4)
  })
  it('computes area of triangle', () => {
    const pts = [
      { easting: 0, northing: 0 },
      { easting: 6, northing: 0 },
      { easting: 0, northing: 8 },
    ]
    expect(shoelaceArea(pts)).toBeCloseTo(24, 4)
  })
})

describe('shoelacePerimeter', () => {
  it('computes perimeter of unit square', () => {
    const pts = [
      { easting: 0, northing: 0 },
      { easting: 1, northing: 0 },
      { easting: 1, northing: 1 },
      { easting: 0, northing: 1 },
    ]
    expect(shoelacePerimeter(pts)).toBeCloseTo(4, 4)
  })
})

describe('rotatePoints', () => {
  it('rotates a point around its own centroid (itself)', () => {
    const pts = [{ easting: 1, northing: 0 }]
    const rotated = rotatePoints(pts, 90)
    expect(rotated[0].easting).toBeCloseTo(1, 4)
    expect(rotated[0].northing).toBeCloseTo(0, 4)
  })
  it('rotates rectangle 90° CCW around its centroid', () => {
    const pts = [
      { easting: 0, northing: 0 },
      { easting: 4, northing: 0 },
      { easting: 4, northing: 2 },
      { easting: 0, northing: 2 },
    ]
    const rotated = rotatePoints(pts, 90)
    expect(rotated[0].easting).toBeCloseTo(3, 4)
    expect(rotated[0].northing).toBeCloseTo(-1, 4)
    expect(rotated[1].easting).toBeCloseTo(3, 4)
    expect(rotated[1].northing).toBeCloseTo(3, 4)
    expect(rotated[2].easting).toBeCloseTo(1, 4)
    expect(rotated[2].northing).toBeCloseTo(3, 4)
    expect(rotated[3].easting).toBeCloseTo(1, 4)
    expect(rotated[3].northing).toBeCloseTo(-1, 4)
  })
  it('rotates around given center', () => {
    const pts = [{ easting: 2, northing: 0 }]
    const rotated = rotatePoints(pts, 90, 1, 0)
    expect(rotated[0].easting).toBeCloseTo(1, 4)
    expect(rotated[0].northing).toBeCloseTo(1, 4)
  })
})

describe('parseCornersCSV', () => {
  it('parses comma-delimited CSV', () => {
    const csv = 'C1,0,0\nC2,10,0\nC3,10,10'
    const pts = parseCornersCSV(csv)
    expect(pts).toHaveLength(3)
    expect(pts[0]).toEqual({ name: 'C1', easting: 0, northing: 0 })
  })
  it('skips header row', () => {
    const csv = 'Label,Easting,Northing\nC1,0,0\nC2,10,0\nC3,10,10'
    const pts = parseCornersCSV(csv)
    expect(pts).toHaveLength(3)
  })
  it('throws for fewer than 3 rows', () => {
    expect(() => parseCornersCSV('C1,0,0\nC2,10,0')).toThrow()
  })
})
