import type { DeedPlanInput, BoundaryPoint, ClosureCheck } from '@/types/deedPlan'
import { validateDeedPlanData } from '../validation'

function makePoints(): BoundaryPoint[] {
  return [
    { id: 'A', easting: 500000, northing: 9800000, markType: 'IRON_PIN', markStatus: 'FOUND' },
    { id: 'B', easting: 500100, northing: 9800000, markType: 'IRON_PIN', markStatus: 'FOUND' },
    { id: 'C', easting: 500100, northing: 9800100, markType: 'IRON_PIN', markStatus: 'SET' },
    { id: 'D', easting: 500000, northing: 9800100, markType: 'IRON_PIN', markStatus: 'FOUND' },
  ]
}

function makeInput(overrides: Partial<DeedPlanInput> = {}): DeedPlanInput {
  return {
    surveyNumber: 'SRVY2025-001',
    drawingNumber: 'DWG-001',
    parcelNumber: 'Nairobi/Block/1/100',
    locality: 'Nairobi',
    area: 10000,
    registrationSection: 'LR 12345',
    county: 'Nairobi',
    utmZone: 37,
    hemisphere: 'S',
    scale: 1000,
    datum: 'ARC1960',
    projectionType: 'UTM',
    boundaryPoints: makePoints(),
    abuttalNorth: 'N',
    abuttalSouth: 'S',
    abuttalEast: 'E',
    abuttalWest: 'W',
    surveyorName: 'Jane Surveyor',
    iskNumber: 'ISK-12345',
    firmName: 'Survey Co.',
    firmAddress: 'Nairobi',
    surveyDate: '2026-01-01',
    signatureDate: '2026-01-02',
    ...overrides,
  }
}

describe('validateDeedPlanData', () => {
  it('returns valid for a complete submission', () => {
    const result = validateDeedPlanData(makeInput())
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.missingFields).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it('flags fewer than 3 boundary points as an error', () => {
    const result = validateDeedPlanData(makeInput({ boundaryPoints: makePoints().slice(0, 2) }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('At least 3 boundary points'))).toBe(true)
  })

  it('flags invalid coordinates as an error', () => {
    const points = makePoints()
    points[1] = { ...points[1], easting: Number.NaN }
    const result = validateDeedPlanData(makeInput({ boundaryPoints: points }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('invalid coordinates'))).toBe(true)
  })

  it('flags a degenerate zero-area polygon as an error', () => {
    const points = [
      { id: 'A', easting: 0, northing: 0, markType: 'IRON_PIN' as const, markStatus: 'FOUND' as const },
      { id: 'B', easting: 10, northing: 0, markType: 'IRON_PIN' as const, markStatus: 'FOUND' as const },
      { id: 'C', easting: 20, northing: 0, markType: 'IRON_PIN' as const, markStatus: 'SET' as const },
    ]
    const result = validateDeedPlanData(makeInput({ boundaryPoints: points }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('degenerate polygon'))).toBe(true)
  })

  it('lists every missing statutory field as error + missingFields', () => {
    const input = makeInput({
      surveyNumber: '',
      parcelNumber: '  ',
      surveyorName: undefined as unknown as string,
      iskNumber: undefined as unknown as string,
    })
    const result = validateDeedPlanData(input)
    expect(result.valid).toBe(false)
    expect(result.missingFields).toContain('Survey Number')
    expect(result.missingFields).toContain('Parcel Number')
    expect(result.missingFields).toContain('Surveyor Name')
    expect(result.missingFields).toContain('ISK Number')
    expect(result.errors).toContain('Missing required field: Survey Number.')
  })

  it('warns (non-blocking) when area is missing or non-positive', () => {
    const noArea = validateDeedPlanData(makeInput({ area: 0 }))
    expect(noArea.valid).toBe(true)
    expect(noArea.warnings.some((w) => w.includes('Area is zero or missing'))).toBe(true)
  })

  it('warns when the closure check fails', () => {
    const badClosure: ClosureCheck = {
      closingErrorE: 0.5,
      closingErrorN: 0.4,
      perimeter: 400,
      precisionRatio: '1:400',
      passes: false,
    }
    const result = validateDeedPlanData(makeInput(), badClosure)
    expect(result.valid).toBe(true)
    expect(result.warnings.some((w) => w.includes('Closure check failed'))).toBe(true)
  })

  it('does not warn when the closure check passes', () => {
    const goodClosure: ClosureCheck = {
      closingErrorE: 0.01,
      closingErrorN: 0.01,
      perimeter: 400,
      precisionRatio: '1:28000',
      passes: true,
    }
    const result = validateDeedPlanData(makeInput(), goodClosure)
    expect(result.warnings.some((w) => w.includes('Closure check failed'))).toBe(false)
  })
})