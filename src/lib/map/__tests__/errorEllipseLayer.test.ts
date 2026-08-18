import { SRID_21037 } from '@/lib/map/projection'
import {
  buildErrorEllipseFeatures,
  buildErrorEllipseRing,
  ellipseConfidenceMultiplier,
  normalizeAdjustedStationsToEllipses,
  type MapErrorEllipseStation,
} from '../errorEllipseLayer'

describe('normalizeAdjustedStationsToEllipses', () => {
  it('maps stored LSA stations onto drawable ellipses', () => {
    const result = normalizeAdjustedStationsToEllipses([
      {
        name: 'TRV-2',
        easting: 255000.123,
        northing: 9865000.456,
        semiMajor: 0.008,
        semiMinor: 0.005,
        orientation: 42.5,
        isFixed: false,
      },
    ])

    expect(result).toEqual([
      {
        pointName: 'TRV-2',
        easting: 255000.123,
        northing: 9865000.456,
        semiMajor: 0.008,
        semiMinor: 0.005,
        orientation: 42.5,
      },
    ])
  })

  it('prefers pointName over name', () => {
    const result = normalizeAdjustedStationsToEllipses([
      { pointName: 'BEACON-A', name: 'legacy', easting: 1, northing: 2, semiMajor: 0.01, semiMinor: 0.006, orientation: 10, isFixed: false },
    ])
    expect(result[0].pointName).toBe('BEACON-A')
  })

  it('excludes fixed stations (they carry no covariance)', () => {
    const result = normalizeAdjustedStationsToEllipses([
      { name: 'BASE', easting: 1, northing: 2, semiMajor: 0.01, semiMinor: 0.006, orientation: 0, isFixed: true },
      { name: 'ROVER', easting: 3, northing: 4, semiMajor: 0.01, semiMinor: 0.006, orientation: 0, isFixed: false },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].pointName).toBe('ROVER')
  })

  it('excludes stations with zero or absent ellipse axes', () => {
    const result = normalizeAdjustedStationsToEllipses([
      { name: 'A', easting: 1, northing: 2, semiMajor: 0, semiMinor: 0.006, orientation: 0, isFixed: false },
      { name: 'B', easting: 1, northing: 2, semiMajor: undefined, semiMinor: undefined, orientation: 0, isFixed: false },
      { name: 'C', easting: 1, northing: 2, semiMajor: 0.01, semiMinor: 0.006, orientation: 0, isFixed: false },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].pointName).toBe('C')
  })

  it('skips null rows and tolerates missing coordinates', () => {
    const result = normalizeAdjustedStationsToEllipses([
      null,
      undefined,
      { name: 'D', easting: null, northing: null, semiMajor: 0.01, semiMinor: 0.006, orientation: 0, isFixed: false },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].easting).toBe(0)
  })
})

describe('ellipseConfidenceMultiplier', () => {
  it('returns the 2-DOF chi-square multipliers', () => {
    expect(ellipseConfidenceMultiplier(0.95)).toBeCloseTo(2.447, 3)
    expect(ellipseConfidenceMultiplier(0.99)).toBeCloseTo(3.035, 3)
    expect(ellipseConfidenceMultiplier(0.394)).toBeCloseTo(1.0, 3)
  })

  it('falls back to the nearest tabulated confidence', () => {
    expect(ellipseConfidenceMultiplier(0.92)).toBeCloseTo(2.447, 3) // closer to 0.95 than 0.865
    expect(ellipseConfidenceMultiplier(0.88)).toBeCloseTo(2.0, 3)   // closer to 0.865
  })

  it('defaults to 95%', () => {
    expect(ellipseConfidenceMultiplier()).toBeCloseTo(2.447, 3)
  })
})

describe('buildErrorEllipseRing', () => {
  it('places the major axis along East when orientation is 0', () => {
    const ring = buildErrorEllipseRing(1000, 2000, 0.02, 0.01, 0, 1, 0.394) // 1σ, no exaggeration
    expect(ring[0][0]).toBeCloseTo(1000 + 0.02, 9) // angle 0 → [E + a, N]
    expect(ring[0][1]).toBeCloseTo(2000, 9)
    // angle π/2 → [E, N + b]
    const quarter = ring[16]
    expect(quarter[0]).toBeCloseTo(1000, 9)
    expect(quarter[1]).toBeCloseTo(2000 + 0.01, 9)
  })

  it('rotates the major axis to North at orientation 90 (from East, CCW)', () => {
    const ring = buildErrorEllipseRing(1000, 2000, 0.02, 0.01, 90, 1, 0.394)
    expect(ring[0][0]).toBeCloseTo(1000, 9)
    expect(ring[0][1]).toBeCloseTo(2000 + 0.02, 9)
  })

  it('applies the 95% confidence multiplier and the exaggeration factor', () => {
    const ring = buildErrorEllipseRing(1000, 2000, 0.02, 0.01, 0, 100) // 95% × 100
    const expectedMajor = 0.02 * ellipseConfidenceMultiplier(0.95) * 100
    expect(ring[0][0] - 1000).toBeCloseTo(expectedMajor, 6)
  })

  it('produces a closed ring with 64 segments', () => {
    const ring = buildErrorEllipseRing(0, 0, 0.01, 0.005, 30, 10)
    expect(ring).toHaveLength(65) // 64 segments + closing point
    expect(ring[64]).toEqual(ring[0])
  })
})

describe('buildErrorEllipseFeatures', () => {
  const stations: MapErrorEllipseStation[] = [
    { pointName: 'ROVER', easting: 255000, northing: 9865000, semiMajor: 0.012, semiMinor: 0.007, orientation: 35 },
    { pointName: 'CHECK', easting: 255100, northing: 9865100, semiMajor: 0.02, semiMinor: 0.015, orientation: 120 },
  ]

  it('builds one Polygon feature per ellipse with metadata properties', async () => {
    const features = await buildErrorEllipseFeatures({ stations, epsg: SRID_21037, exaggeration: 100 })

    expect(features).toHaveLength(2)
    for (const feature of features) {
      expect(feature.getGeometry()?.getType()).toBe('Polygon')
      expect(feature.get('layerType')).toBe('errorEllipse')
      expect(feature.get('pointName')).toBeTruthy()
      expect(feature.get('formatted')).toContain('±')
    }
    expect(features[0].get('pointName')).toBe('ROVER')
    expect(features[1].get('pointName')).toBe('CHECK')
  })

  it('returns an empty array for no stations', async () => {
    const features = await buildErrorEllipseFeatures({ stations: [], epsg: SRID_21037 })
    expect(features).toHaveLength(0)
  })
})
