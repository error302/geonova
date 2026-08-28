import {
  reduceGroundToGrid,
  calculateMeanRadiusOfCurvature,
  formatDegreesToDMS,
  ELLIPSOIDS,
} from '../geodeticReduction'

describe('Geodetic Reduction Engine', () => {
  test('calculates mean radius of curvature for Clarke 1880 at Equator', () => {
    const Rm = calculateMeanRadiusOfCurvature(0, 'clarke1880_modified')
    expect(Rm).toBeCloseTo(6356514.87, 1)
  })

  test('calculates mean radius of curvature for WGS84 at 45° Latitude', () => {
    const Rm = calculateMeanRadiusOfCurvature(Math.PI / 4, 'wgs84')
    expect(Rm).toBeGreaterThan(6378000)
    expect(Rm).toBeLessThan(6400000)
  })

  test('formats degrees to DMS correctly', () => {
    expect(formatDegreesToDMS(1.5)).toBe("1° 30' 00.00\"")
    expect(formatDegreesToDMS(-0.75)).toBe("-0° 45' 00.00\"")
  })

  test('performs 3-step physical geodetic reduction in Kenyan Arc 1960 UTM 37S', () => {
    const result = reduceGroundToGrid({
      groundDistance: 1000.0,
      fromPoint: {
        easting: 254000.0,
        northing: 9860000.0, // Equator region Southern Hemisphere
        elevation: 1650.0, // Nairobi altitude
        geoidUndulation: -16.2,
      },
      toPoint: {
        easting: 254800.0,
        northing: 9860600.0,
        elevation: 1660.0,
        geoidUndulation: -16.2,
      },
      ellipsoid: 'clarke1880_modified',
    })

    // Elevation factor should be < 1.0 (since altitude > sea level)
    expect(result.elevationFactor).toBeLessThan(1.0)
    expect(result.elevationFactor).toBeCloseTo(1 - (1655 - 16.2) / 6378249, 5)

    // Combined scale factor should be accurate
    expect(result.combinedScaleFactor).toBeGreaterThan(0.999)
    expect(result.combinedScaleFactor).toBeLessThan(1.001)

    // Grid distance must be close to 1000m with subtle correction
    expect(result.gridDistance).toBeCloseTo(1000 * result.combinedScaleFactor, 3)

    // Audit steps must be populated
    expect(result.calculationSteps.length).toBeGreaterThanOrEqual(8)
  })
})
