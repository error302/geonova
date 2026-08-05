/**
 * Tests for topologyChecker module
 *
 * The engine functions depend on @turf/turf (lazy-loaded) and proj4.
 * We mock both so tests run without real geospatial libraries.
 *
 * Regression focus: turf 7's intersect()/difference() take a single
 * FeatureCollection. The old code called intersect(a, b) with two features —
 * the second was silently ignored and runtime threw (swallowed by try/catch),
 * so overlap/sliver/road checks never fired. These tests lock in the
 * featureCollection([a, b]) call pattern.
 */

import {
  checkParcelOverlap,
  checkSliverPolygons,
  checkRoadReserveEncroachment,
  checkSelfIntersection,
  type ExistingParcel,
  type RoadReserve,
} from '../topologyChecker'
import type { SurveyPoint } from '@/lib/map/turfHelpers'

// ---------------------------------------------------------------------------
// Mock @turf/turf
// ---------------------------------------------------------------------------

const mockTurfPolygon = jest.fn()
const mockTurfLineString = jest.fn()
const mockTurfIntersect = jest.fn()
const mockTurfArea = jest.fn()
const mockTurfBuffer = jest.fn()
const mockTurfKinks = jest.fn()
const mockTurfFeatureCollection = jest.fn()

const turfMockObj = {
  polygon: mockTurfPolygon,
  lineString: mockTurfLineString,
  intersect: mockTurfIntersect,
  area: mockTurfArea,
  buffer: mockTurfBuffer,
  kinks: mockTurfKinks,
  featureCollection: mockTurfFeatureCollection,
}

jest.mock('@turf/turf', () => ({
  __esModule: true,
  default: turfMockObj,
  ...turfMockObj,
}))

// ---------------------------------------------------------------------------
// Mock proj4 — identity transform for reproducible round-trips
// ---------------------------------------------------------------------------

jest.mock('proj4', () => {
  const fn = jest.fn((_c1: string, _c2: string, coord?: number[]) => {
    if (coord) return [coord[0], coord[1]]
    return undefined
  }) as jest.Mock<number[] | undefined, [_c1: string, _c2: string, coord?: number[]]> & { defs: jest.Mock }
  fn.defs = jest.fn()
  return { __esModule: true, default: fn }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fakePolygon = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] } }
const fakeLine = { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } }

const square: SurveyPoint[] = [
  { easting: 0, northing: 0 },
  { easting: 100, northing: 0 },
  { easting: 100, northing: 100 },
  { easting: 0, northing: 100 },
]

const existing: ExistingParcel = { id: 'parcel-1', name: 'Parcel One', vertices: square }

beforeEach(() => {
  jest.clearAllMocks()
  mockTurfPolygon.mockReturnValue(fakePolygon)
  mockTurfLineString.mockReturnValue(fakeLine)
  mockTurfIntersect.mockReturnValue(null)
  mockTurfArea.mockReturnValue(0)
  mockTurfBuffer.mockReturnValue(fakePolygon)
  mockTurfKinks.mockReturnValue({ type: 'FeatureCollection', features: [] })
  mockTurfFeatureCollection.mockImplementation((features: unknown[]) => ({
    type: 'FeatureCollection',
    features,
  }))
})

// ---------------------------------------------------------------------------
// checkParcelOverlap
// ---------------------------------------------------------------------------

describe('checkParcelOverlap', () => {
  it('passes both parcels to turf.intersect as a single FeatureCollection', async () => {
    mockTurfIntersect.mockReturnValue(fakePolygon)
    mockTurfArea.mockReturnValue(2500)

    const issues = await checkParcelOverlap(square, [existing])

    expect(mockTurfFeatureCollection).toHaveBeenCalledWith([
      expect.objectContaining({ type: 'Feature' }),
      expect.objectContaining({ type: 'Feature' }),
    ])
    expect(mockTurfIntersect).toHaveBeenCalledTimes(1)
    expect(mockTurfIntersect).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'FeatureCollection' }),
    )
    expect(issues).toHaveLength(1)
    expect(issues[0].type).toBe('overlap')
  })

  it('reports no overlap when intersect returns null', async () => {
    mockTurfIntersect.mockReturnValue(null)
    const issues = await checkParcelOverlap(square, [existing])
    expect(issues).toHaveLength(0)
  })

  it('ignores overlaps below the tolerance', async () => {
    mockTurfIntersect.mockReturnValue(fakePolygon)
    mockTurfArea.mockReturnValue(0.5) // below default 1 m² tolerance
    const issues = await checkParcelOverlap(square, [existing])
    expect(issues).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// checkSliverPolygons
// ---------------------------------------------------------------------------

describe('checkSliverPolygons', () => {
  it('detects a sliver gap (buffered overlap, no direct overlap)', async () => {
    // bufferedNew intersect -> polygon, direct intersect -> null
    mockTurfIntersect
      .mockReturnValueOnce(fakePolygon) // bufferedIntersection
      .mockReturnValueOnce(null) // directIntersection
    mockTurfArea.mockReturnValue(20)

    const issues = await checkSliverPolygons(square, [existing])
    expect(issues).toHaveLength(1)
    expect(issues[0].type).toBe('sliver')
    // buffered + direct intersects both get a FeatureCollection
    expect(mockTurfIntersect).toHaveBeenCalledTimes(2)
    expect(mockTurfIntersect).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: 'FeatureCollection' }),
    )
    expect(mockTurfIntersect).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: 'FeatureCollection' }),
    )
  })

  it('reports no sliver when both intersects are null', async () => {
    mockTurfIntersect.mockReturnValue(null)
    const issues = await checkSliverPolygons(square, [existing])
    expect(issues).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// checkRoadReserveEncroachment
// ---------------------------------------------------------------------------

describe('checkRoadReserveEncroachment', () => {
  const road: RoadReserve = {
    id: 'road-1',
    name: 'Mombasa Road',
    centerline: [
      { easting: 0, northing: 0 },
      { easting: 100, northing: 100 },
    ],
    widthM: 30,
  }

  it('detects encroachment via a single FeatureCollection intersect', async () => {
    mockTurfIntersect.mockReturnValue(fakePolygon)
    mockTurfArea.mockReturnValue(500)

    const issues = await checkRoadReserveEncroachment(square, [road])
    expect(issues).toHaveLength(1)
    expect(issues[0].type).toBe('road_encroachment')
    expect(mockTurfIntersect).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'FeatureCollection' }),
    )
  })

  it('reports no encroachment when the road buffer is null', async () => {
    mockTurfBuffer.mockReturnValue(null)
    const issues = await checkRoadReserveEncroachment(square, [road])
    expect(issues).toHaveLength(0)
    expect(mockTurfIntersect).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// checkSelfIntersection
// ---------------------------------------------------------------------------

describe('checkSelfIntersection', () => {
  it('returns [] when kinks finds no self-intersections', async () => {
    mockTurfKinks.mockReturnValue({ type: 'FeatureCollection', features: [] })
    const points = await checkSelfIntersection(square)
    expect(points).toHaveLength(0)
  })

  it('converts kink points back to survey coordinates', async () => {
    mockTurfKinks.mockReturnValue({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [50, 50] } },
      ],
    })
    const points = await checkSelfIntersection(square)
    expect(points).toHaveLength(1)
    expect(points[0].easting).toBe(50)
    expect(points[0].northing).toBe(50)
  })

  it('returns [] for fewer than 4 vertices', async () => {
    expect(await checkSelfIntersection(square.slice(0, 3))).toHaveLength(0)
  })
})
