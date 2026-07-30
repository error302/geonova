/**
 * Tests for surveyData — Kenya-specific coordinate and project validation.
 *
 * Critical invariants tested:
 *   - Kenya bounding box (Arc 1960 / UTM 37S)
 *   - Levelling closure tolerance uses 10√K (RDM 1.1), not 12√K
 *   - Coordinate SRID is always 21037 (Kenya default)
 */

import {
  CoordinateSchema,
  CreateProjectSchema,
  LevellingObservationSchema,
  validateCoordinates,
} from '../surveyData'

describe('CoordinateSchema', () => {
  const validCoord = {
    point_id: 'PT001',
    easting: 500000,
    northing: 9800000,
  }

  it('accepts a coordinate inside Kenya bounds', () => {
    const result = CoordinateSchema.safeParse(validCoord)
    expect(result.success).toBe(true)
  })

  it('defaults the SRID to 21037 (Kenya Arc 1960 UTM 37S)', () => {
    const result = CoordinateSchema.safeParse(validCoord)
    if (!result.success) throw new Error('should have parsed')
    expect(result.data.srid).toBe(21037)
  })

  it('accepts an optional elevation between -100 and 6000', () => {
    const result = CoordinateSchema.safeParse({ ...validCoord, elevation: 2000 })
    expect(result.success).toBe(true)
  })

  it('rejects an elevation above 6000m (Mount Kenya is 5199m)', () => {
    const result = CoordinateSchema.safeParse({ ...validCoord, elevation: 7000 })
    expect(result.success).toBe(false)
  })

  it('rejects an easting below the Kenya minimum (166000)', () => {
    const result = CoordinateSchema.safeParse({ ...validCoord, easting: 100000 })
    expect(result.success).toBe(false)
  })

  it('rejects an easting above the Kenya maximum (1066000)', () => {
    const result = CoordinateSchema.safeParse({ ...validCoord, easting: 1100000 })
    expect(result.success).toBe(false)
  })

  it('rejects a northing below the Kenya minimum (9140000)', () => {
    const result = CoordinateSchema.safeParse({ ...validCoord, northing: 9000000 })
    expect(result.success).toBe(false)
  })

  it('rejects a northing above the Kenya maximum (10200000)', () => {
    const result = CoordinateSchema.safeParse({ ...validCoord, northing: 11000000 })
    expect(result.success).toBe(false)
  })

  it('rejects a missing point_id', () => {
    const result = CoordinateSchema.safeParse({ easting: 500000, northing: 9800000 })
    expect(result.success).toBe(false)
  })

  it('rejects a non-numeric easting', () => {
    const result = CoordinateSchema.safeParse({ ...validCoord, easting: '500000' })
    expect(result.success).toBe(false)
  })
})

describe('validateCoordinates (convenience wrapper)', () => {
  it('returns success=true for valid input', () => {
    const result = validateCoordinates({
      point_id: 'BM1',
      easting: 600000,
      northing: 9900000,
    })
    expect(result.success).toBe(true)
  })

  it('returns success=false for invalid input', () => {
    const result = validateCoordinates({
      point_id: 'BM1',
      easting: 100, // below Kenya bounds
      northing: 9900000,
    })
    expect(result.success).toBe(false)
  })
})

describe('CreateProjectSchema', () => {
  it('accepts a valid cadastral project', () => {
    const result = CreateProjectSchema.safeParse({
      name: 'Kiambu Subdivision',
      survey_type: 'cadastral_subdivision',
    })
    expect(result.success).toBe(true)
  })

  it('accepts an engineering road project', () => {
    const result = CreateProjectSchema.safeParse({
      name: 'Nairobi-Thika Road',
      survey_type: 'engineering_road',
      county: 'Kiambu',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a name shorter than 3 characters', () => {
    const result = CreateProjectSchema.safeParse({
      name: 'AB',
      survey_type: 'cadastral_subdivision',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a name longer than 200 characters', () => {
    const result = CreateProjectSchema.safeParse({
      name: 'A'.repeat(201),
      survey_type: 'cadastral_subdivision',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown survey type', () => {
    const result = CreateProjectSchema.safeParse({
      name: 'Test Project',
      survey_type: 'unknown_type',
    })
    expect(result.success).toBe(false)
  })

  it('accepts a description up to 2000 characters', () => {
    const result = CreateProjectSchema.safeParse({
      name: 'Test Project',
      survey_type: 'topographic',
      description: 'A'.repeat(2000),
    })
    expect(result.success).toBe(true)
  })

  it('rejects a description longer than 2000 characters', () => {
    const result = CreateProjectSchema.safeParse({
      name: 'Test Project',
      survey_type: 'topographic',
      description: 'A'.repeat(2001),
    })
    expect(result.success).toBe(false)
  })
})

describe('LevellingObservationSchema', () => {
  it('accepts a valid levelling observation', () => {
    const result = LevellingObservationSchema.safeParse({
      benchmark_id: 'BM_001',
      rl: 1893.456,
      distance_km: 1.2,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a missing benchmark_id', () => {
    const result = LevellingObservationSchema.safeParse({
      rl: 1893.456,
      distance_km: 1.2,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a non-positive distance', () => {
    const result = LevellingObservationSchema.safeParse({
      benchmark_id: 'BM_001',
      rl: 1893.456,
      distance_km: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a negative distance', () => {
    const result = LevellingObservationSchema.safeParse({
      benchmark_id: 'BM_001',
      rl: 1893.456,
      distance_km: -1,
    })
    expect(result.success).toBe(false)
  })

  it('accepts a benchmark_id up to 50 chars', () => {
    const result = LevellingObservationSchema.safeParse({
      benchmark_id: 'A'.repeat(50),
      rl: 1000,
      distance_km: 1,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a benchmark_id longer than 50 chars', () => {
    const result = LevellingObservationSchema.safeParse({
      benchmark_id: 'A'.repeat(51),
      rl: 1000,
      distance_km: 1,
    })
    expect(result.success).toBe(false)
  })
})

/**
 * Critical invariant: the levelling closure tolerance MUST be 10√K mm
 * per RDM 1.1 (2025) Table 5.1. The 12√K value was used in older
 * standards and is no longer correct.
 *
 * These tests verify that the constant 12 does NOT appear anywhere
 * in the validation module's source code in the context of closure
 * tolerances. (A simple grep of the source would also work, but
 * importing here makes it part of the test suite.)
 */
describe('RDM 1.1 levelling closure tolerance invariant', () => {
  it('the surveyData module must not export a 12√K tolerance constant', () => {
    // Read the module's source as text and assert no "12√K" or
    // "12 * Math.sqrt" or "12*Math.sqrt" pattern appears.
    // This catches accidental regression to the old standard.
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'surveyData.ts'),
      'utf8',
    )
    // Look for "12√K" or numeric 12 followed by sqrt usage
    expect(src).not.toMatch(/12\s*[√*]\s*Math\.sqrt/i)
    expect(src).not.toMatch(/12\s*\\u221A\s*K/)
    // The CRITICAL INVARIANT comment should explicitly say "10√K"
    expect(src).toMatch(/10\s*[√]K/)
  })
})
