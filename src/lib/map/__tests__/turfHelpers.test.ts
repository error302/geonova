/**
 * Tests for turfHelpers module
 *
 * All public functions are async and depend on @turf/turf and proj4.
 * We mock both dependencies so tests run without actual geospatial libraries.
 */

import {
  SurveyPoint,
  toTurfCoord,
  fromTurfCoord,
  calculateParcelAreaSqM,
  calculateParcelPerimeterM,
  isPointInParcel,
  calculateCompactness,
  calculateIntersection,
  calculateDifference,
} from '../turfHelpers'

// ---------------------------------------------------------------------------
// Mock @turf/turf
// ---------------------------------------------------------------------------

const mockTurfArea = jest.fn()
const mockTurfLength = jest.fn()
const mockTurfPoint = jest.fn()
const mockTurfPolygon = jest.fn()
const mockTurfLineString = jest.fn()
const mockTurfBuffer = jest.fn()
const mockTurfIntersect = jest.fn()
const mockTurfUnion = jest.fn()
const mockTurfDifference = jest.fn()
const mockTurfBooleanPointInPolygon = jest.fn()
const mockTurfFeatureCollection = jest.fn()

const turfMockObj = {
  area: mockTurfArea,
  length: mockTurfLength,
  point: mockTurfPoint,
  polygon: mockTurfPolygon,
  lineString: mockTurfLineString,
  buffer: mockTurfBuffer,
  intersect: mockTurfIntersect,
  union: mockTurfUnion,
  difference: mockTurfDifference,
  booleanPointInPolygon: mockTurfBooleanPointInPolygon,
  featureCollection: mockTurfFeatureCollection,
}

jest.mock('@turf/turf', () => ({
  __esModule: true,
  default: turfMockObj,
  ...turfMockObj,
}))

// ---------------------------------------------------------------------------
// Mock proj4 — use identity transform for reproducible round-trips
// ---------------------------------------------------------------------------

jest.mock('proj4', () => {
  // Identity transform: EPSG:21037 ↔ EPSG:4326 pass-through
  // This makes toTurfCoord/fromTurfCoord round-trip correctly
  const fn = jest.fn((_c1: string, _c2: string, coord?: number[]) => {
    if (coord) return [coord[0], coord[1]]
    return undefined
  }) as jest.Mock<number[] | undefined, [_c1: string, _c2: string, coord?: number[]]> & { defs: jest.Mock }
  fn.defs = jest.fn()
  return { __esModule: true, default: fn }
})

// ---------------------------------------------------------------------------
// Reset mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks()
  mockTurfArea.mockReturnValue(10000)
  mockTurfLength.mockReturnValue(400)
  mockTurfPoint.mockReturnValue({ type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] } })
  mockTurfPolygon.mockReturnValue({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] } })
  mockTurfLineString.mockReturnValue({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } })
  mockTurfBuffer.mockReturnValue({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] } })
  mockTurfBooleanPointInPolygon.mockReturnValue(true)
})

// ---------------------------------------------------------------------------
// toTurfCoord
// ---------------------------------------------------------------------------

describe('toTurfCoord', () => {
  it('converts EPSG:21037 coordinates to WGS84 [lon, lat]', async () => {
    const [lon, lat] = await toTurfCoord(500000, 9840000)
    expect(typeof lon).toBe('number')
    expect(typeof lat).toBe('number')
    // With identity mock, values pass through
    expect(lon).toBe(500000)
    expect(lat).toBe(9840000)
  })

  it('returns a tuple of exactly 2 numbers', async () => {
    const result = await toTurfCoord(300000, 9840000)
    expect(result).toHaveLength(2)
  })

  it('different input produces different output', async () => {
    const [lon1] = await toTurfCoord(300000, 9840000)
    const [lon2] = await toTurfCoord(400000, 9850000)
    expect(lon1).not.toBe(lon2)
  })
})

// ---------------------------------------------------------------------------
// fromTurfCoord
// ---------------------------------------------------------------------------

describe('fromTurfCoord', () => {
  it('converts WGS84 [lon, lat] to EPSG:21037 SurveyPoint', async () => {
    const result = await fromTurfCoord([36.82, -1.28])
    expect(result).toHaveProperty('easting')
    expect(result).toHaveProperty('northing')
    expect(typeof result.easting).toBe('number')
    expect(typeof result.northing).toBe('number')
  })

  it('returns an object with easting and northing properties', async () => {
    const result = await fromTurfCoord([36.82, -1.28])
    expect(result).toHaveProperty('easting')
    expect(result).toHaveProperty('northing')
  })

  it('round-trips correctly with toTurfCoord', async () => {
    const original = { easting: 500123, northing: 9845678 }
    const [lon, lat] = await toTurfCoord(original.easting, original.northing)
    const roundTripped = await fromTurfCoord([lon, lat])
    // With identity mock, values are exactly preserved
    expect(roundTripped.easting).toBe(original.easting)
    expect(roundTripped.northing).toBe(original.northing)
  })
})

// ---------------------------------------------------------------------------
// calculateParcelAreaSqM
// ---------------------------------------------------------------------------

describe('calculateParcelAreaSqM', () => {
  it('returns 0 for fewer than 3 vertices', async () => {
    expect(await calculateParcelAreaSqM([])).toBe(0)
    expect(await calculateParcelAreaSqM([{ easting: 0, northing: 0 }])).toBe(0)
    expect(await calculateParcelAreaSqM([{ easting: 0, northing: 0 }, { easting: 100, northing: 0 }])).toBe(0)
  })

  it('calls turf.area and returns the result', async () => {
    mockTurfArea.mockReturnValue(25000)
    const vertices: SurveyPoint[] = [
      { easting: 0, northing: 0 },
      { easting: 100, northing: 0 },
      { easting: 100, northing: 100 },
      { easting: 0, northing: 100 },
    ]
    expect(await calculateParcelAreaSqM(vertices)).toBe(25000)
    expect(mockTurfArea).toHaveBeenCalled()
  })

  it('returns the value from turf.area for a known rectangle', async () => {
    mockTurfArea.mockReturnValue(10000)
    const vertices: SurveyPoint[] = [
      { easting: 0, northing: 0 },
      { easting: 100, northing: 0 },
      { easting: 100, northing: 100 },
      { easting: 0, northing: 100 },
    ]
    expect(await calculateParcelAreaSqM(vertices)).toBe(10000)
  })
})

// ---------------------------------------------------------------------------
// calculateParcelPerimeterM
// ---------------------------------------------------------------------------

describe('calculateParcelPerimeterM', () => {
  it('returns 0 for fewer than 2 vertices', async () => {
    expect(await calculateParcelPerimeterM([])).toBe(0)
    expect(await calculateParcelPerimeterM([{ easting: 0, northing: 0 }])).toBe(0)
  })

  it('calls turf.length and returns the result', async () => {
    mockTurfLength.mockReturnValue(500)
    const vertices: SurveyPoint[] = [
      { easting: 0, northing: 0 },
      { easting: 100, northing: 0 },
    ]
    expect(await calculateParcelPerimeterM(vertices)).toBe(500)
  })

  it('returns correct perimeter for a square (400m)', async () => {
    mockTurfLength.mockReturnValue(400)
    const vertices: SurveyPoint[] = [
      { easting: 0, northing: 0 },
      { easting: 100, northing: 0 },
      { easting: 100, northing: 100 },
      { easting: 0, northing: 100 },
      { easting: 0, northing: 0 },
    ]
    expect(await calculateParcelPerimeterM(vertices)).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// isPointInParcel
// ---------------------------------------------------------------------------

describe('isPointInParcel', () => {
  it('returns false for fewer than 3 parcel vertices', async () => {
    expect(await isPointInParcel(50, 50, [])).toBe(false)
  })

  it('returns true when point is inside (mocked)', async () => {
    mockTurfBooleanPointInPolygon.mockReturnValue(true)
    const parcel: SurveyPoint[] = [
      { easting: 0, northing: 0 },
      { easting: 100, northing: 0 },
      { easting: 100, northing: 100 },
      { easting: 0, northing: 100 },
    ]
    expect(await isPointInParcel(50, 50, parcel)).toBe(true)
    expect(mockTurfBooleanPointInPolygon).toHaveBeenCalled()
  })

  it('returns false when point is outside (mocked)', async () => {
    mockTurfBooleanPointInPolygon.mockReturnValue(false)
    const parcel: SurveyPoint[] = [
      { easting: 0, northing: 0 },
      { easting: 100, northing: 0 },
      { easting: 100, northing: 100 },
      { easting: 0, northing: 100 },
    ]
    expect(await isPointInParcel(200, 200, parcel)).toBe(false)
  })

  it('returns true when point is on the edge (mocked)', async () => {
    mockTurfBooleanPointInPolygon.mockReturnValue(true)
    const parcel: SurveyPoint[] = [
      { easting: 0, northing: 0 },
      { easting: 100, northing: 0 },
      { easting: 100, northing: 100 },
      { easting: 0, northing: 100 },
    ]
    expect(await isPointInParcel(50, 0, parcel)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// calculateIntersection
// ---------------------------------------------------------------------------

describe('calculateIntersection', () => {
  const rectA: SurveyPoint[] = [
    { easting: 0, northing: 0 },
    { easting: 100, northing: 0 },
    { easting: 100, northing: 100 },
    { easting: 0, northing: 100 },
  ]
  const rectB: SurveyPoint[] = [
    { easting: 50, northing: 50 },
    { easting: 150, northing: 50 },
    { easting: 150, northing: 150 },
    { easting: 50, northing: 150 },
  ]

  it('passes both parcels to turf.intersect as a single FeatureCollection', async () => {
    mockTurfFeatureCollection.mockReturnValue({ type: 'FeatureCollection', features: [] })
    mockTurfIntersect.mockReturnValue({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[50, 50], [100, 50], [100, 100], [50, 100], [50, 50]]] },
    })
    await calculateIntersection(rectA, rectB)
    // FeatureCollection must receive BOTH polygons
    expect(mockTurfFeatureCollection).toHaveBeenCalledWith([
      expect.objectContaining({ type: 'Feature' }),
      expect.objectContaining({ type: 'Feature' }),
    ])
    // intersect must receive the FeatureCollection (single arg), not two features
    expect(mockTurfIntersect).toHaveBeenCalledTimes(1)
    expect(mockTurfIntersect).toHaveBeenCalledWith(expect.objectContaining({ type: 'FeatureCollection' }))
  })

  it('returns null when the intersection has fewer than 3 vertices', async () => {
    mockTurfFeatureCollection.mockReturnValue({ type: 'FeatureCollection', features: [] })
    mockTurfIntersect.mockReturnValue(null)
    expect(await calculateIntersection(rectA, rectB)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// calculateDifference
// ---------------------------------------------------------------------------

describe('calculateDifference', () => {
  const rectA: SurveyPoint[] = [
    { easting: 0, northing: 0 },
    { easting: 100, northing: 0 },
    { easting: 100, northing: 100 },
    { easting: 0, northing: 100 },
  ]
  const rectB: SurveyPoint[] = [
    { easting: 50, northing: 50 },
    { easting: 150, northing: 50 },
    { easting: 150, northing: 150 },
    { easting: 50, northing: 150 },
  ]

  it('passes both parcels to turf.difference as a single FeatureCollection', async () => {
    mockTurfFeatureCollection.mockReturnValue({ type: 'FeatureCollection', features: [] })
    mockTurfDifference.mockReturnValue({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [50, 0], [50, 50], [0, 50], [0, 0]]] },
    })
    await calculateDifference(rectA, rectB)
    expect(mockTurfFeatureCollection).toHaveBeenCalledWith([
      expect.objectContaining({ type: 'Feature' }),
      expect.objectContaining({ type: 'Feature' }),
    ])
    expect(mockTurfDifference).toHaveBeenCalledWith(expect.objectContaining({ type: 'FeatureCollection' }))
  })

  it('returns null when the difference is empty', async () => {
    mockTurfFeatureCollection.mockReturnValue({ type: 'FeatureCollection', features: [] })
    mockTurfDifference.mockReturnValue(null)
    expect(await calculateDifference(rectA, rectB)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// calculateCompactness
// ---------------------------------------------------------------------------

describe('calculateCompactness', () => {
  it('returns 0 for fewer than 3 vertices', async () => {
    expect(await calculateCompactness([])).toBe(0)
    expect(await calculateCompactness([{ easting: 0, northing: 0 }])).toBe(0)
  })

  it('computes Polsby-Popper compactness (4πA / P²)', async () => {
    mockTurfArea.mockReturnValue(10000)
    mockTurfLength.mockReturnValue(400)
    const vertices: SurveyPoint[] = [
      { easting: 0, northing: 0 },
      { easting: 100, northing: 0 },
      { easting: 100, northing: 100 },
      { easting: 0, northing: 100 },
    ]
    // 4π × 10000 / 400² = 4π × 10000 / 160000 = π/4 ≈ 0.785
    expect(await calculateCompactness(vertices)).toBeCloseTo(Math.PI / 4, 3)
  })

  it('returns 0 when perimeter is 0', async () => {
    mockTurfArea.mockReturnValue(0)
    mockTurfLength.mockReturnValue(0)
    const vertices: SurveyPoint[] = [
      { easting: 0, northing: 0 },
      { easting: 0, northing: 0 },
      { easting: 0, northing: 0 },
    ]
    expect(await calculateCompactness(vertices)).toBe(0)
  })

  it('circle approaches 1.0 compactness', async () => {
    // A circle with r=50: A = π×50² = 7853.98, P = 2π×50 = 314.16
    // C = 4π × 7853.98 / 314.16² ≈ 1.0
    mockTurfArea.mockReturnValue(7854)
    mockTurfLength.mockReturnValue(314.16)
    const vertices: SurveyPoint[] = [
      { easting: 0, northing: 0 },
      { easting: 1, northing: 0 },
      { easting: 1, northing: 1 },
      { easting: 0, northing: 1 },
    ]
    expect(await calculateCompactness(vertices)).toBeCloseTo(1.0, 1)
  })

  it('very elongated shape has low compactness', async () => {
    mockTurfArea.mockReturnValue(1000)
    mockTurfLength.mockReturnValue(2002)
    const vertices: SurveyPoint[] = [
      { easting: 0, northing: 0 },
      { easting: 1000, northing: 0 },
      { easting: 1000, northing: 1 },
      { easting: 0, northing: 1 },
    ]
    // C = 4π × 1000 / 2002² ≈ 0.00313
    expect(await calculateCompactness(vertices)).toBeLessThan(0.01)
  })
})
