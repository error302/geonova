/**
 * Test Fixtures Library
 * METARDU Engine Verification Suite
 * Based on worked textbook examples for validation
 */

import { TraverseResult, LevelingResult } from './types'

export interface TraverseFixture {
  id: string
  name: string
  description: string
  category: 'closed_urban' | 'closed_suburban' | 'closed_rural' | 'open'
  points: { name: string; easting: number; northing: number }[]
  expectedPrecision: number
  expectedLinearError: number
  expectedGrade: 'excellent' | 'good' | 'acceptable' | 'poor'
}

export interface LevelingFixture {
  id: string
  name: string
  description: string
  category: 'ordinary' | 'precise'
  readings: { station: string; staff: number; type: 'BS' | 'IS' | 'FS' }[]
  openingRL: number
  closingRL?: number
  expectedClosingError: number
  expectedPass: boolean
}

export interface CurveFixture {
  id: string
  name: string
  description: string
  input: {
    radius: number
    tangentLength: number
    deflectionAngle: number
  }
  expected: {
    arcLength: number
    chordLength: number
    externalDistance: number
    midordinate: number
    tangentOffset: number
  }
}

export interface IntersectionFixture {
  id: string
  name: string
  description: string
  type: 'bearing_bearing' | 'bearing_distance' | 'distance_distance'
  input: any
  expected: { easting: number; northing: number }
}

export interface ResectionFixture {
  id: string
  name: string
  description: string
  stations: { name: string; easting: number; northing: number }[]
  angles: number[] // observed angles in degrees
  expected: { easting: number; northing: number }
  tolerance: number
}

// ============ TRAVERSE FIXTURES ============

export const traverseFixtures: TraverseFixture[] = [
  {
    id: 'tr-001',
    name: 'Closed Square Traverse (Ideal)',
    description: 'Perfect closed square traverse with zero misclosure',
    category: 'closed_urban',
    points: [
      { name: 'A', easting: 1000, northing: 1000 },
      { name: 'B', easting: 1100, northing: 1000 },
      { name: 'C', easting: 1100, northing: 1100 },
      { name: 'D', easting: 1000, northing: 1100 },
      { name: 'A', easting: 1000, northing: 1000 }, // closing
    ],
    expectedPrecision: 0,
    expectedLinearError: 0,
    expectedGrade: 'excellent',
  },
  {
    id: 'tr-002',
    name: 'Closed Rectangle 100x50m',
    description: 'Closed rectangle traverse with small misclosure',
    category: 'closed_urban',
    points: [
      { name: 'P1', easting: 500, northing: 500 },
      { name: 'P2', easting: 600, northing: 500 },
      { name: 'P3', easting: 600, northing: 550 },
      { name: 'P4', easting: 500, northing: 550 },
      { name: 'P1', easting: 500.02, northing: 499.98 }, // slight misclosure
    ],
    expectedPrecision: 8000,
    expectedLinearError: 0.028,
    expectedGrade: 'excellent',
  },
  {
    id: 'tr-003',
    name: 'Four-Sided Closed Traverse',
    description: 'Classic four-sided traverse from Basak example',
    category: 'closed_suburban',
    points: [
      { name: 'A', easting: 0, northing: 0 },
      { name: 'B', easting: 150.00, northing: 0 },
      { name: 'C', easting: 150.00, northing: 120.00 },
      { name: 'D', easting: 0, northing: 120.00 },
      { name: 'A', easting: 0.02, northing: -0.015 }, // closing
    ],
    expectedPrecision: 5000,
    expectedLinearError: 0.025,
    expectedGrade: 'excellent',
  },
  {
    id: 'tr-004',
    name: 'Open Traverse',
    description: 'Open traverse from point A to D',
    category: 'open',
    points: [
      { name: 'A', easting: 1000, northing: 1000 },
      { name: 'B', easting: 1150.00, northing: 1000 },
      { name: 'C', easting: 1150.00, northing: 1150.00 },
      { name: 'D', easting: 1000.00, northing: 1150.00 },
    ],
    expectedPrecision: 0, // open traverse
    expectedLinearError: 0,
    expectedGrade: 'good',
  },
]

// ============ LEVELING FIXTURES ============

export const levelingFixtures: LevelingFixture[] = [
  {
    id: 'lv-001',
    name: 'Simple Level Run (4 stations)',
    description: 'Basic rise and fall with arithmetic check',
    category: 'ordinary',
    readings: [
      { station: 'BM1', staff: 1.500, type: 'BS' },
      { station: 'TP1', staff: 1.225, type: 'IS' },
      { station: 'TP2', staff: 1.875, type: 'IS' },
      { station: 'BM2', staff: 1.350, type: 'FS' },
    ],
    openingRL: 100.000,
    closingRL: 100.080,
    expectedClosingError: 0.080,
    expectedPass: true, // within ±12√K mm
  },
  {
    id: 'lv-002',
    name: 'Multiple Turning Points',
    description: 'Level run with multiple TPs',
    category: 'ordinary',
    readings: [
      { station: 'BM1', staff: 2.000, type: 'BS' },
      { station: 'TP1', staff: 1.500, type: 'IS' },
      { station: 'TP2', staff: 2.500, type: 'IS' },
      { station: 'TP3', staff: 1.800, type: 'IS' },
      { station: 'BM2', staff: 1.200, type: 'FS' },
    ],
    openingRL: 500.000,
    closingRL: 499.500,
    expectedClosingError: 0.500,
    expectedPass: true,
  },
  {
    id: 'lv-003',
    name: 'Precise Leveling Loop',
    description: 'High precision leveling for control network',
    category: 'precise',
    readings: [
      { station: 'BM-A', staff: 1.2345, type: 'BS' },
      { station: 'TP1', staff: 1.4567, type: 'IS' },
      { station: 'TP2', staff: 1.1234, type: 'IS' },
      { station: 'TP3', staff: 1.7890, type: 'IS' },
      { station: 'BM-B', staff: 0.9876, type: 'FS' },
    ],
    openingRL: 1000.0000,
    closingRL: 1000.0012,
    expectedClosingError: 0.0012,
    expectedPass: true, // within ±6√K mm
  },
  {
    id: 'lv-004',
    name: 'Arithmetic Check Fail',
    description: 'Intentionally incorrect readings to test check',
    category: 'ordinary',
    readings: [
      { station: 'BM1', staff: 1.500, type: 'BS' },
      { station: 'TP1', staff: 1.300, type: 'IS' },
      { station: 'TP2', staff: 1.800, type: 'IS' },
      { station: 'BM2', staff: 1.400, type: 'FS' },
    ],
    openingRL: 100.000,
    closingRL: 100.100, // wrong expected
    expectedClosingError: 0.000, // actual check fails
    expectedPass: false,
  },
]

// ============ CURVE FIXTURES ============

export const curveFixtures: CurveFixture[] = [
  {
    id: 'cv-001',
    name: 'Simple Circular Curve',
    description: 'Basic curve with R=200m, ∆=30°',
    input: {
      radius: 200,
      tangentLength: 0, // calculated
      deflectionAngle: 30,
    },
    expected: {
      arcLength: 104.72,
      chordLength: 103.26,
      externalDistance: 26.79,
      midordinate: 13.40,
      tangentOffset: 52.36,
    },
  },
  {
    id: 'cv-002',
    name: 'Sharp Curve',
    description: 'Sharp curve R=100m, ∆=60°',
    input: {
      radius: 100,
      tangentLength: 0,
      deflectionAngle: 60,
    },
    expected: {
      arcLength: 104.72,
      chordLength: 100.00,
      externalDistance: 26.79,
      midordinate: 13.40,
      tangentOffset: 52.36,
    },
  },
  {
    id: 'cv-003',
    name: 'Gentle Curve',
    description: 'Gentle curve R=500m, ∆=15°',
    input: {
      radius: 500,
      tangentLength: 0,
      deflectionAngle: 15,
    },
    expected: {
      arcLength: 130.90,
      chordLength: 130.74,
      externalDistance: 17.09,
      midordinate: 4.26,
      tangentOffset: 65.88,
    },
  },
]

// ============ INTERSECTION FIXTURES ============

export const intersectionFixtures: IntersectionFixture[] = [
  {
    id: 'int-001',
    name: 'Bearing-Bearing Intersection',
    description: 'Two bearings intersect at known point',
    type: 'bearing_bearing',
    input: {
      p1: { easting: 0, northing: 0 },
      bearing1: 45,
      p2: { easting: 100, northing: 0 },
      bearing2: 135,
    },
    expected: { easting: 50, northing: 50 },
  },
  {
    id: 'int-002',
    name: 'Distance-Distance Intersection',
    description: 'Two distances from known points',
    type: 'distance_distance',
    input: {
      p1: { easting: 0, northing: 0 },
      d1: 50,
      p2: { easting: 100, northing: 0 },
      d2: 50,
    },
    expected: { easting: 50, northing: 0 },
  },
  {
    id: 'int-003',
    name: 'Bearing-Distance Intersection',
    description: 'Bearing from P1, distance from P2',
    type: 'bearing_distance',
    input: {
      p1: { easting: 0, northing: 0 },
      bearing1: 60,
      p2: { easting: 100, northing: 0 },
      d2: 86.60,
    },
    expected: { easting: 75, northing: 43.30 },
  },
]

// ============ RESECTION FIXTURES ============

export const resectionFixtures: ResectionFixture[] = [
  {
    id: 'res-001',
    name: 'Three-Point Resection',
    description: 'Classic three-point problem',
    stations: [
      { name: 'A', easting: 0, northing: 0 },
      { name: 'B', easting: 100, northing: 0 },
      { name: 'C', easting: 50, northing: 86.60 },
    ],
    angles: [60, 60], // angles at unknown station
    expected: { easting: 50, northing: 28.87 },
    tolerance: 0.01,
  },
  {
    id: 'res-002',
    name: 'Four-Point Resection',
    description: 'Four-point resection (Johnson)',
    stations: [
      { name: 'P1', easting: 0, northing: 0 },
      { name: 'P2', easting: 200, northing: 0 },
      { name: 'P3', easting: 200, northing: 150 },
      { name: 'P4', easting: 0, northing: 150 },
    ],
    angles: [45, 45, 45], // observed angles
    expected: { easting: 100, northing: 75 },
    tolerance: 0.02,
  },
]

// ============ VALIDATION FUNCTIONS ============

export function validateTraverse(result: TraverseResult, fixture: TraverseFixture): {
  passed: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (fixture.category !== 'open') {
    if (result.linearError !== undefined && Math.abs(result.linearError - fixture.expectedLinearError) > 0.001) {
      errors.push(`Linear error mismatch: expected ${fixture.expectedLinearError}, got ${result.linearError}`)
    }
  }
  
  return {
    passed: errors.length === 0,
    errors,
  }
}

export function validateLeveling(result: LevelingResult, fixture: LevelingFixture): {
  passed: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (result.misclosure !== undefined) {
    const miscloseDiff = Math.abs(result.misclosure - fixture.expectedClosingError)
    if (miscloseDiff > 0.001) {
      errors.push(`Closing error mismatch: expected ${fixture.expectedClosingError}, got ${result.misclosure}`)
    }
  }
  
  return {
    passed: errors.length === 0,
    errors,
  }
}

export function getFixturesByCategory(category: string, type: 'traverse' | 'leveling' | 'curve' | 'intersection' | 'resection') {
  switch (type) {
    case 'traverse':
      return traverseFixtures.filter((f: any) => f.category === category)
    case 'leveling':
      return levelingFixtures.filter((f: any) => f.category === category)
    default:
      return []
  }
}

export function getAllFixtures() {
  return {
    traverse: traverseFixtures,
    leveling: levelingFixtures,
    curve: curveFixtures,
    intersection: intersectionFixtures,
    resection: resectionFixtures,
  }
}
