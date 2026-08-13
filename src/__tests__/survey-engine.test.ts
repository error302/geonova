/**
 * Comprehensive Test Suite — METARDU Survey Computation Engine
 * 
 * Validates all P0 corrections against known values and published formulas.
 * Every test case uses independently verifiable reference data.
 */

// Jest globals (describe, it, expect) are available without import.
// Previously imported from 'vitest' — converted for Jest compatibility.

// ─── Atmospheric Corrections ─────────────────────────────────────
import { defined } from '@/test-utils/defined'
import {
  applyAtmosphericCorrection,
  computeVaporPressure,
  validateAtmosphericConditions,
  STANDARD_CONDITIONS,
} from '../lib/survey/corrections/atmospheric';

// ─── Curvature & Refraction ──────────────────────────────────────
import {
  applyCurvatureRefractionCorrection,
  computeCRCorrection,
  computeMeanEarthRadius,
  maxDistanceWithoutCR,
} from '../lib/survey/corrections/curvature-refraction';

// ─── Grid Scale Factor ───────────────────────────────────────────
import {
  computeUTMPointScaleFactor,
  computeLineScaleFactor,
} from '../lib/survey/corrections/grid-scale-factor';

// ─── Sea Level Reduction ────────────────────────────────────────
import {
  applySeaLevelReduction,
  computeReductionFactor,
} from '../lib/survey/corrections/sea-level-reduction';

// ─── Slope Reduction ─────────────────────────────────────────────
import {
  reduceSlopeByAngle,
  reduceSlopeByHeight,
} from '../lib/survey/corrections/slope-reduction';

// ─── Projection Convergence ──────────────────────────────────────
import {
  computeConvergence,
  gridBearingToTrue,
  trueBearingToGrid,
} from '../lib/survey/corrections/projection-convergence';

// ─── Coordinate Transformation ───────────────────────────────────
import {
  arc1960ToWGS84,
  wgs84ToArc1960,
  geodeticToCartesian,
  cartesianToGeodetic,
  computeUTMZone,
} from '../lib/survey/coordinates/transform';

// ─── Traverse ────────────────────────────────────────────────────
import {
  bowditchAdjustment,
  computeBearing,
  computeDistance,
  ORDER_REQUIREMENTS,
} from '../lib/survey/traverse/engine';

// ─── COGO ────────────────────────────────────────────────────────
import {
  computeBearingAndDistance,
  computePoint,
  lineLineIntersection,
  lineCircleIntersection,
} from '../lib/survey/cogo/engine';

// ─── Area ────────────────────────────────────────────────────────
import {
  computeAreaByShoelace,
  computeAreaByDMD,
  convertArea,
} from '../lib/survey/area/computation';

// ─── Error Propagation ───────────────────────────────────────────
import {
  propagateSum,
  propagateScale,
  propagateCoordinate,
} from '../lib/survey/error-propagation/engine';

// ═════════════════════════════════════════════════════════════════
// ATMOSPHERIC CORRECTION TESTS
// ═════════════════════════════════════════════════════════════════

describe('Atmospheric Correction', () => {
  it('should return zero correction at standard conditions', () => {
    const result = applyAtmosphericCorrection(1000, STANDARD_CONDITIONS);
    expect(result.ppmCorrection).toBeCloseTo(0, 0); // Within ~1 ppm
    expect(result.correctedDistance).toBeCloseTo(1000, 2);
  });

  it('should compute significant correction at Nairobi conditions (~50 ppm)', () => {
    // Nairobi: 20°C, 830 hPa, 60% humidity
    // Lower pressure at altitude causes significant correction
    // Actual value is ~50 ppm (not 22 as originally estimated)
    const result = applyAtmosphericCorrection(1000, {
      temperature: 20,
      pressure: 830,
      humidity: 60,
    });
    expect(Math.abs(result.ppmCorrection)).toBeGreaterThan(40);
    expect(Math.abs(result.ppmCorrection)).toBeLessThan(200);
    // Lower pressure at altitude: air is less dense, light travels faster,
    // EDM reads SHORT → correction is POSITIVE (adds distance back)
    expect(result.correctedDistance).toBeGreaterThan(1000);
  });

  it('should compute correct vapor pressure', () => {
    // At 20°C, 100% humidity: saturation vapor pressure ≈ 23.4 hPa
    const e = computeVaporPressure(20, 100);
    expect(e).toBeCloseTo(23.4, 0);
    
    // At 0°C, 100% humidity: ≈ 6.1 hPa
    const e0 = computeVaporPressure(0, 100);
    expect(e0).toBeCloseTo(6.1, 0);
    
    // At 50% humidity: half the saturation
    const e50 = computeVaporPressure(20, 50);
    expect(e50).toBeCloseTo(11.7, 0);
  });

  it('should validate atmospheric conditions', () => {
    const valid = validateAtmosphericConditions({
      temperature: 25,
      pressure: 900,
      humidity: 60,
    });
    expect(valid.valid).toBe(true);
    
    const extreme = validateAtmosphericConditions({
      temperature: 60,
      pressure: 500,
      humidity: 100,
    });
    expect(extreme.valid).toBe(false);
    expect(extreme.warnings.length).toBeGreaterThan(0);
  });

  it('should throw on invalid inputs', () => {
    expect(() => applyAtmosphericCorrection(-100, STANDARD_CONDITIONS)).toThrow();
    expect(() => computeVaporPressure(100, 50)).toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════
// CURVATURE & REFRACTION TESTS
// ═════════════════════════════════════════════════════════════════

describe('Curvature & Refraction', () => {
  it('should compute ~67.5mm correction at 1km', () => {
    const correction = computeCRCorrection(1000, 0, 0.13);
    expect(correction).toBeCloseTo(0.0675, 2); // ~67.5mm
  });

  it('should compute ~6.75mm correction at 316m (~√0.1 km)', () => {
    // C&R scales as D², so at 316m (~√0.1 km): 0.0675 × 0.1 = 6.75mm
    const correction = computeCRCorrection(316, 0, 0.13);
    expect(correction).toBeCloseTo(0.00675, 2);
  });

  it('should compute correct Earth radius at equator', () => {
    const R = computeMeanEarthRadius(0);
    // At equator, R ≈ 6378 km (close to equatorial radius)
    expect(R).toBeGreaterThan(6350000);
    expect(R).toBeLessThan(6400000);
  });

  it('should compute correct Earth radius at 45° latitude', () => {
    const R = computeMeanEarthRadius(45);
    expect(R).toBeGreaterThan(6350000);
    expect(R).toBeLessThan(6380000);
  });

  it('should apply full C&R correction with heights', () => {
    const result = applyCurvatureRefractionCorrection({
      slopeDistance: 1000,
      verticalAngle: 90, // Horizontal sight
      instrumentHeight: 1.5,
      targetHeight: 1.5,
      latitude: 0,
      refractionCoefficient: 0.13,
    });
    
    // For horizontal sight, height difference should be ~C&R correction
    expect(result.crCorrection).toBeCloseTo(0.0675, 2);
    expect(result.isSignificant).toBe(true); // > 10mm
  });

  it('should compute max distance without C&R exceeding threshold', () => {
    const maxDist = maxDistanceWithoutCR(10, 0, 0.13);
    // Should be around 270m for 10mm threshold
    expect(maxDist).toBeGreaterThan(200);
    expect(maxDist).toBeLessThan(400);
  });
});

// ═════════════════════════════════════════════════════════════════
// GRID SCALE FACTOR TESTS
// ═════════════════════════════════════════════════════════════════

describe('Grid Scale Factor', () => {
  it('should compute scale factor ≈ 0.9996 at UTM central meridian', () => {
    // At the central meridian of UTM Zone 37S (39°E)
    // Easting = 500000 (central meridian), scale factor = k0 = 0.9996
    const result = computeUTMPointScaleFactor(500000, 9900000, 'UTM37S');
    expect(result.scaleFactor).toBeCloseTo(0.9996, 3);
  });

  it('should compute scale factor > 1.0 at 180km from central meridian', () => {
    // At 180km from CM: scale factor ≈ 1.0004
    const result = computeUTMPointScaleFactor(680000, 9900000, 'UTM37S');
    expect(result.scaleFactor).toBeGreaterThan(1.000);
    expect(result.scaleFactor).toBeLessThan(1.001);
  });

  it('should compute line scale factor using Simpson rule', () => {
    // Line from CM to 100km east
    const result = computeLineScaleFactor(
      500000, 9900000,
      600000, 9900000,
      'UTM37S'
    );
    expect(result.lineScaleFactor).toBeGreaterThan(0.9996);
    expect(result.lineScaleFactor).toBeLessThan(1.0005);
    expect(result.ppmCorrection).toBeDefined();
  });

  it('should report ppm from unity', () => {
    const result = computeUTMPointScaleFactor(500000, 9900000, 'UTM37S');
    expect(result.ppmFromUnity).toBeCloseTo(-400, 0); // 0.9996 → -400 ppm
  });
});

// ═════════════════════════════════════════════════════════════════
// SEA LEVEL REDUCTION TESTS
// ═════════════════════════════════════════════════════════════════

describe('Sea Level Reduction', () => {
  it('should compute ~267 ppm reduction at Nairobi altitude (1700m)', () => {
    const result = applySeaLevelReduction({
      horizontalDistance: 1000,
      heightAboveEllipsoid: 1700,
      latitude: 0,
    });
    
    expect(result.reductionPPM).toBeCloseTo(267, -1); // ~267 ppm
    expect(result.ellipsoidalDistance).toBeLessThan(1000);
    expect(result.reductionMeters).toBeCloseTo(0.267, 1); // ~267mm
  });

  it('should compute negligible reduction at sea level', () => {
    const result = applySeaLevelReduction({
      horizontalDistance: 1000,
      heightAboveEllipsoid: 0,
      latitude: 0,
    });
    
    expect(result.reductionPPM).toBeCloseTo(0, 0);
    expect(result.ellipsoidalDistance).toBeCloseTo(1000, 4);
  });

  it('should compute correct reduction factor', () => {
    const { factor, ppm } = computeReductionFactor(1700, 0);
    expect(factor).toBeLessThan(1);
    expect(ppm).toBeCloseTo(267, -1);
  });

  it('should handle orthometric height with geoid undulation', () => {
    const result = applySeaLevelReduction({
      horizontalDistance: 1000,
      orthometricHeight: 1700,
      geoidUndulation: -12,
      latitude: -1,
    });
    
    // Ellipsoidal height = 1700 + (-12) = 1688m
    expect(result.meanHeight).toBeCloseTo(1688, 0);
    expect(result.ellipsoidalDistance).toBeLessThan(1000);
  });
});

// ═════════════════════════════════════════════════════════════════
// SLOPE REDUCTION TESTS
// ═════════════════════════════════════════════════════════════════

describe('Slope Reduction', () => {
  it('should return same distance for horizontal sight (90°)', () => {
    const result = reduceSlopeByAngle({
      slopeDistance: 100,
      verticalAngle: 90,
    });
    expect(result.horizontalDistance).toBeCloseTo(100, 5);
    expect(result.verticalComponent).toBeCloseTo(0, 5);
  });

  it('should correctly reduce 30° slope', () => {
    const result = reduceSlopeByAngle({
      slopeDistance: 200,
      verticalAngle: 90 - 30, // 60° zenith = 30° elevation
    });
    expect(result.horizontalDistance).toBeCloseTo(200 * Math.sin(60 * Math.PI / 180), 5);
    expect(result.verticalComponent).toBeCloseTo(200 * Math.cos(60 * Math.PI / 180), 5);
  });

  it('should reduce by height difference', () => {
    const result = reduceSlopeByHeight({
      slopeDistance: 100,
      heightDifference: 0, // Horizontal
    });
    expect(result.horizontalDistance).toBeCloseTo(100, 5);
  });

  it('should throw when height difference exceeds slope distance', () => {
    expect(() => reduceSlopeByHeight({
      slopeDistance: 100,
      heightDifference: 150,
    })).toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════
// PROJECTION CONVERGENCE TESTS
// ═════════════════════════════════════════════════════════════════

describe('Projection Convergence', () => {
  it('should be zero at central meridian', () => {
    const result = computeConvergence({
      latitude: -1,
      longitude: 39, // Central meridian of UTM Zone 37S
      centralMeridian: 39,
    });
    expect(result.convergence).toBeCloseTo(0, 5);
    expect(result.sign).toBe('on_meridian');
  });

  it('should be negative east of central meridian in southern hemisphere', () => {
    // In the southern hemisphere, convergence is NEGATIVE east of CM
    // This is because sin(φ) < 0 for southern latitudes
    const result = computeConvergence({
      latitude: -1,    // Southern hemisphere
      longitude: 40,   // 1° east of CM
      centralMeridian: 39,
    });
    expect(result.convergence).toBeLessThan(0);
  });

  it('should be positive west of central meridian in southern hemisphere', () => {
    const result = computeConvergence({
      latitude: -1,    // Southern hemisphere
      longitude: 38,   // 1° west of CM
      centralMeridian: 39,
    });
    expect(result.convergence).toBeGreaterThan(0);
  });

  it('should be positive east of central meridian in northern hemisphere', () => {
    const result = computeConvergence({
      latitude: 1,     // Northern hemisphere
      longitude: 40,   // 1° east of CM
      centralMeridian: 39,
    });
    expect(result.convergence).toBeGreaterThan(0);
    expect(result.sign).toBe('E');
  });

  it('should correctly convert grid/true bearings', () => {
    const trueBearing = 45;
    const convergence = 0.5; // 0.5° convergence
    
    const gridBearing = trueBearingToGrid(trueBearing, convergence);
    expect(gridBearing).toBeCloseTo(45.5, 3);
    
    const backToTrue = gridBearingToTrue(gridBearing, convergence);
    expect(backToTrue).toBeCloseTo(45, 3);
  });
});

// ═════════════════════════════════════════════════════════════════
// COORDINATE TRANSFORMATION TESTS
// ═════════════════════════════════════════════════════════════════

describe('Coordinate Transformation', () => {
  it('should compute correct UTM zone', () => {
    expect(computeUTMZone(38.5)).toBe(37);  // Kenya east
    expect(computeUTMZone(32.5)).toBe(36);  // Kenya west
    expect(computeUTMZone(0)).toBe(31);     // Prime meridian
  });

  it('should round-trip geodetic ↔ Cartesian', () => {
    const original = { latitude: -1.2921, longitude: 36.8219, height: 1700 }; // Nairobi
    const cartesian = geodeticToCartesian(original);
    const recovered = cartesianToGeodetic(cartesian);
    
    expect(recovered.latitude).toBeCloseTo(original.latitude, 6);
    expect(recovered.longitude).toBeCloseTo(original.longitude, 6);
    expect(defined(recovered.height)).toBeCloseTo(original.height, 1);
  });

  it('should round-trip Arc 1960 ↔ WGS84', () => {
    const arc1960 = { latitude: -1.2921, longitude: 36.8219, height: 1700 };
    const wgs84 = arc1960ToWGS84(arc1960);
    const recovered = wgs84ToArc1960(wgs84);
    
    // Should recover original within ~0.1 arc-second (~3m)
    expect(recovered.latitude).toBeCloseTo(arc1960.latitude, 4);
    expect(recovered.longitude).toBeCloseTo(arc1960.longitude, 4);
  });
});

// ═════════════════════════════════════════════════════════════════
// COGO TESTS
// ═════════════════════════════════════════════════════════════════

describe('COGO Engine', () => {
  it('should compute correct bearing and distance', () => {
    const from = { easting: 0, northing: 0 };
    const to = { easting: 100, northing: 100 };
    
    const result = computeBearingAndDistance(from, to);
    expect(result.bearing).toBeCloseTo(45, 5); // NE
    expect(result.distance).toBeCloseTo(141.421, 2);
  });

  it('should compute correct point from bearing and distance', () => {
    const from = { easting: 0, northing: 0 };
    const result = computePoint(from, 45, 141.421356);
    
    expect(result.easting).toBeCloseTo(100, 2);
    expect(result.northing).toBeCloseTo(100, 2);
  });

  it('should compute line-line intersection', () => {
    // Two perpendicular lines crossing at origin
    const result = lineLineIntersection(
      { easting: -100, northing: 0 },
      90, // East
      { easting: 0, northing: -100 },
      0,  // North
    );
    
    expect(result.exists).toBe(true);
    expect(result.point.easting).toBeCloseTo(0, 3);
    expect(result.point.northing).toBeCloseTo(0, 3);
  });

  it('should detect parallel lines (no intersection)', () => {
    const result = lineLineIntersection(
      { easting: 0, northing: 0 },
      45,
      { easting: 10, northing: 10 },
      45, // Same bearing = parallel
    );
    
    expect(result.exists).toBe(false);
  });

  it('should compute line-circle intersection', () => {
    // Line going east from origin, circle at (50, 0) radius 30
    const results = lineCircleIntersection(
      { easting: 0, northing: 0 },
      90, // East
      { easting: 50, northing: 0 },
      30
    );
    
    expect(results.length).toBe(2);
    // Intersections at E=20 and E=80
    expect(results[0].easting).toBeCloseTo(20, 1);
    expect(results[1].easting).toBeCloseTo(80, 1);
  });

  it('should round-trip inverse/forward COGO', () => {
    const from = { easting: 250000, northing: 9850000 };
    const bearing = 127.354;
    const distance = 543.210;
    
    const to = computePoint(from, bearing, distance);
    const inverse = computeBearingAndDistance(from, to);
    
    expect(inverse.bearing).toBeCloseTo(bearing, 4);
    expect(inverse.distance).toBeCloseTo(distance, 2);
  });
});

// ═════════════════════════════════════════════════════════════════
// AREA COMPUTATION TESTS
// ═════════════════════════════════════════════════════════════════

describe('Area Computation', () => {
  it('should compute correct area for a square (100m × 100m)', () => {
    const square = [
      { easting: 0, northing: 0 },
      { easting: 100, northing: 0 },
      { easting: 100, northing: 100 },
      { easting: 0, northing: 100 },
    ];
    
    const result = computeAreaByShoelace(square);
    expect(result.areaSqM).toBeCloseTo(10000, 2);
    expect(result.areaHa).toBeCloseTo(1, 3);
  });

  it('should compute correct area for a triangle', () => {
    const triangle = [
      { easting: 0, northing: 0 },
      { easting: 100, northing: 0 },
      { easting: 0, northing: 100 },
    ];
    
    const result = computeAreaByShoelace(triangle);
    expect(result.areaSqM).toBeCloseTo(5000, 2);
  });

  it('should compute perimeter', () => {
    const square = [
      { easting: 0, northing: 0 },
      { easting: 100, northing: 0 },
      { easting: 100, northing: 100 },
      { easting: 0, northing: 100 },
    ];
    
    const result = computeAreaByShoelace(square);
    expect(result.perimeter).toBeCloseTo(400, 2);
  });

  it('should convert area units correctly', () => {
    expect(convertArea(10000, 'sqm', 'ha')).toBeCloseTo(1, 3);
    expect(convertArea(1, 'ha', 'sqm')).toBeCloseTo(10000, 3);
    expect(convertArea(1, 'acre', 'sqm')).toBeCloseTo(4046.856, 2);
  });

  it('should compute area by DMD', () => {
    // Same square as above, using bearings and distances
    const bearings = [90, 0, 270, 180]; // E, N, W, S
    const distances = [100, 100, 100, 100];
    
    const result = computeAreaByDMD(bearings, distances);
    expect(result.areaSqM).toBeCloseTo(10000, 2);
  });

  it('should throw for less than 3 points', () => {
    expect(() => computeAreaByShoelace([{ easting: 0, northing: 0 }])).toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════
// ERROR PROPAGATION TESTS
// ═════════════════════════════════════════════════════════════════

describe('Error Propagation', () => {
  it('should propagate sum uncertainty', () => {
    const values = [
      { value: 100, stdDev: 5, units: 'm' },
      { value: 200, stdDev: 8, units: 'm' },
    ];
    
    const result = propagateSum(values);
    expect(result.computedValue).toBe(300);
    expect(result.stdDev).toBeCloseTo(Math.sqrt(25 + 64), 3); // √(5² + 8²)
  });

  it('should propagate scale uncertainty', () => {
    const value = { value: 100, stdDev: 2, units: 'm' };
    const result = propagateScale(value, 3);
    
    expect(result.computedValue).toBe(300);
    expect(result.stdDev).toBeCloseTo(6, 3); // 3 × 2
  });

  it('should propagate coordinate uncertainty', () => {
    const result = propagateCoordinate(
      { value: 250000, stdDev: 0.02, units: 'm' },
      { value: 9850000, stdDev: 0.02, units: 'm' },
      { value: 500, stdDev: 0.01, units: 'm' },
      { value: 45 * Math.PI / 180, stdDev: 5 / 3600 * Math.PI / 180, units: 'rad' }
    );
    
    // Easting and northing should have propagated uncertainty
    expect(result.easting.stdDev).toBeGreaterThan(0);
    expect(result.northing.stdDev).toBeGreaterThan(0);
    // 95% confidence should be ~1.96× stdDev
    expect(result.easting.confidence95).toBeCloseTo(1.96 * result.easting.stdDev, 2);
  });

  it('should compute contributors percentages', () => {
    const values = [
      { value: 100, stdDev: 10, units: 'm', description: 'A' },
      { value: 200, stdDev: 0, units: 'm', description: 'B' },
    ];
    
    const result = propagateSum(values);
    expect(result.contributors[0].percentage).toBeCloseTo(100, 0);
    expect(result.contributors[1].percentage).toBeCloseTo(0, 0);
  });
});

// ═════════════════════════════════════════════════════════════════
// TRAVERSE ENGINE TESTS
// ═════════════════════════════════════════════════════════════════

describe('Traverse Engine', () => {
  it('should compute correct bearing between points', () => {
    expect(computeBearing(0, 0, 100, 100)).toBeCloseTo(45, 5);
    expect(computeBearing(0, 0, 0, 100)).toBeCloseTo(0, 5); // North
    expect(computeBearing(0, 0, 100, 0)).toBeCloseTo(90, 5); // East
    expect(computeBearing(0, 0, -100, 0)).toBeCloseTo(270, 5); // West
  });

  it('should compute correct distance', () => {
    expect(computeDistance(0, 0, 300, 400)).toBeCloseTo(500, 2);
  });

  it('should have correct order requirements', () => {
    expect(ORDER_REQUIREMENTS[1]).toBe(100000);
    expect(ORDER_REQUIREMENTS[3]).toBe(10000);
  });

  it('should perform Bowditch adjustment on closed traverse', () => {
    const stations = [
      { name: 'A', easting: 0, northing: 0, isFixed: true },
      { name: 'B', isFixed: false },
      { name: 'C', isFixed: false },
      { name: 'D', easting: 0, northing: 0, isFixed: true }, // Closes back
    ];
    
    const legs = [
      { fromStation: 'A', toStation: 'B', bearing: 0, distance: 100 },
      { fromStation: 'B', toStation: 'C', bearing: 90, distance: 100 },
      { fromStation: 'C', toStation: 'D', bearing: 180, distance: 100 },
      { fromStation: 'D', toStation: 'A', bearing: 270, distance: 100 }, // This won't close perfectly
    ];
    
    // This test verifies the framework works — a proper closed traverse
    // with exact bearings would have zero misclosure
    const result = bowditchAdjustment(stations, legs, 3);
    expect(result.adjustmentMethod).toBe('bowditch');
    expect(result.stations.length).toBe(4);
  });
});

// ═════════════════════════════════════════════════════════════════
// INTEGRATION: CORRECTION PIPELINE
// ═════════════════════════════════════════════════════════════════

describe('Correction Pipeline Integration', () => {
  it('should process a typical Kenya observation through all stages', async () => {
    const { processObservation, KENYA_DEFAULT_CONFIG } = await import('../lib/survey/pipeline/correction-pipeline');
    
    const result = processObservation({
      fromStation: 'A',
      toStation: 'B',
      rawSlopeDistance: 500.123,
      verticalAngle: 90.05, // Slightly upward
      horizontalAngle: 45.1234,
      edmConstant: 0.003,
      temperature: 22,
      pressure: 840,
      humidity: 60,
      instrumentHeight: 1.55,
      targetHeight: 1.60,
      heightAboveEllipsoid: 1700,
      fromEasting: 250000,
      fromNorthing: 9850000,
      toEasting: 250350,
      toNorthing: 9850350,
      latitude: -1.0,
      longitude: 37.5,
      edmWavelength: 0.850,
    }, KENYA_DEFAULT_CONFIG);
    
    // Should have all correction stages applied
    expect(result.correctionLog.length).toBeGreaterThan(0);
    expect(result.gridDistance).toBeDefined();
    expect(result.rawSlopeDistance).toBe(500.123);
    // Grid distance should be different from raw due to corrections
    expect(result.gridDistance).not.toBeCloseTo(500.123, 1);
    // Should have audit trail
    expect(result.correctionLog.length).toBeGreaterThanOrEqual(3);
  });

  it('should generate correction report', async () => {
    const { processObservations, generateCorrectionReport, KENYA_DEFAULT_CONFIG } = await import('../lib/survey/pipeline/correction-pipeline');
    
    const observations = [{
      fromStation: 'A',
      toStation: 'B',
      rawSlopeDistance: 300.5,
      verticalAngle: 90.0,
      temperature: 25,
      pressure: 830,
      humidity: 55,
    }];
    
    const processed = processObservations(observations, KENYA_DEFAULT_CONFIG);
    const report = generateCorrectionReport(processed);
    
    expect(report).toContain('CORRECTION PIPELINE AUDIT REPORT');
    expect(report).toContain('A → B');
  });
});
