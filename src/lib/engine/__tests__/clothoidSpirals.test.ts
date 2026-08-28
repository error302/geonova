import {
  computeClothoidSpiral,
  computeVerticalCurveAnalysis,
} from '../curves'

describe('Clothoid Transition Spirals (Euler Spirals)', () => {
  test('computes Clothoid Spiral elements accurately for R=300m, Ls=60m', () => {
    const spiral = computeClothoidSpiral(300, 60, 45)

    // Spiral parameter A = sqrt(R * Ls) = sqrt(300 * 60) = sqrt(18000) ≈ 134.164m
    expect(spiral.spiralParameter).toBeCloseTo(134.164, 2)

    // Spiral angle θs = Ls / (2R) = 60 / (2 * 300) = 0.1 rad ≈ 5.7296°
    expect(spiral.spiralAngleRadians).toBeCloseTo(0.1, 4)
    expect(spiral.spiralAngleDegrees).toBeCloseTo(5.7296, 2)

    // Shift p ≈ Ls^2 / (24R) = 3600 / 7200 = 0.50m
    expect(spiral.shiftP).toBeCloseTo(0.50, 2)

    // Tangent shift k ≈ Ls / 2 = 30.0m
    expect(spiral.tangentShiftK).toBeCloseTo(29.98, 1)

    // Tangent coordinates X ≈ 59.94m, Y ≈ 1.99m
    expect(spiral.tangentX).toBeCloseTo(59.94, 1)
    expect(spiral.tangentY).toBeCloseTo(1.99, 1)

    // Total tangent length must be calculated
    expect(spiral.totalTangentLength).toBeDefined()
    expect(spiral.totalTangentLength).toBeGreaterThan(100)
  })
})

describe('Advanced Vertical Curve Analysis & Drainage Turning Points', () => {
  test('identifies crest curve and exact crest drainage turning point', () => {
    // VPC at Station 1000m, Elev 100m; g1 = +4%, g2 = -2%, L = 300m
    const analysis = computeVerticalCurveAnalysis({
      g1: 4.0,
      g2: -2.0,
      length: 300,
      stationVPI: 1150,
      elevationVPI: 106.0,
      designSpeedKmh: 80,
    })

    expect(analysis.curveType).toBe('crest')
    expect(analysis.gradeDifferenceA).toBe(6.0)
    expect(analysis.kValue).toBe(50.0) // 300 / 6 = 50

    // Turning station: x = -g1 * L / (g2 - g1) = -4 * 300 / (-6) = 200m from VPC
    // VPC station = 1150 - 150 = 1000m. Turning point = 1200m
    expect(analysis.hasDrainageTurningPoint).toBe(true)
    expect(analysis.turningStation).toBe(1200)

    // K-value of 50 is compliant for 80 km/h crest curve (K_min = 26)
    expect(analysis.isKCompliantRDM).toBe(true)
  })

  test('identifies sag curve and low-point drainage station', () => {
    // VPC at Station 500m, Elev 50m; g1 = -3%, g2 = +3%, L = 200m
    const analysis = computeVerticalCurveAnalysis({
      g1: -3.0,
      g2: 3.0,
      length: 200,
      stationVPI: 600,
      elevationVPI: 47.0,
      designSpeedKmh: 80,
    })

    expect(analysis.curveType).toBe('sag')
    expect(analysis.hasDrainageTurningPoint).toBe(true)
    // Symmetrical sag turning point is at midpoint (Station 600)
    expect(analysis.turningStation).toBe(600)
  })
})
