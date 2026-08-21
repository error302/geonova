import type { DeedPlanInput, BoundaryPoint, BoundaryLeg, ClosureCheck } from '@/types/deedPlan'
import {
  buildSurveyPlanDataFromDeedPlan,
  deedPlanMarkToMonument,
  renderDeedPlanDraftSVG,
} from '../fromDeedPlan'
import { DEED_PLAN_OUTPUT_TYPES } from '../outputTypes'

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
    boundaryPoints: [
      { id: 'A', easting: 500000, northing: 9800000, markType: 'IRON_PIN', markStatus: 'FOUND', description: 'Iron pin at NE corner' },
      { id: 'B', easting: 500100, northing: 9800000, markType: 'CONCRETE_BEACON', markStatus: 'SET' },
      { id: 'C', easting: 500100, northing: 9800100, markType: 'INDICATORY', markStatus: 'REFERENCED' },
      { id: 'D', easting: 500000, northing: 9800100, markType: 'MASONRY_NAIL', markStatus: 'FOUND' },
    ],
    abuttalNorth: 'Plot 99',
    abuttalSouth: 'Public Road',
    abuttalEast: 'Plot 101',
    abuttalWest: 'Railway Reserve',
    surveyorName: 'Jane Surveyor',
    iskNumber: 'ISK-12345',
    firmName: 'Survey Co.',
    firmAddress: 'Nairobi',
    surveyDate: '2026-01-01',
    signatureDate: '2026-01-02',
    clientName: 'Acme Holdings',
    firNumber: 'FR-9001',
    ...overrides,
  }
}

const closure: ClosureCheck = {
  closingErrorE: 0.005,
  closingErrorN: 0.005,
  perimeter: 400,
  precisionRatio: '1:56568',
  passes: true,
}

describe('deedPlanMarkToMonument', () => {
  it('maps FOUND status to a found monument regardless of type', () => {
    expect(deedPlanMarkToMonument('IRON_PIN', 'FOUND')).toBe('found')
    expect(deedPlanMarkToMonument('MASONRY_NAIL', 'found')).toBe('found')
  })
  it('maps mark types to monument symbols', () => {
    expect(deedPlanMarkToMonument('MASONRY_NAIL', 'SET')).toBe('masonry_nail')
    expect(deedPlanMarkToMonument('IRON_PIN', 'SET')).toBe('iron_pin')
    expect(deedPlanMarkToMonument('INDICATORY', 'REFERENCED')).toBe('indicatory_beacon')
  })
  it('defaults unknown types to a set monument', () => {
    expect(deedPlanMarkToMonument('WOODEN_PEG', 'SET')).toBe('set')
    expect(deedPlanMarkToMonument(undefined, undefined)).toBe('set')
  })
})

describe('buildSurveyPlanDataFromDeedPlan', () => {
  it('translates statutory identifiers onto the survey plan project', () => {
    const data = buildSurveyPlanDataFromDeedPlan(makeInput())
    expect(data.project.reference).toBe('SRVY2025-001')
    expect(data.project.surveyor_licence).toBe('12345') // ISK- prefix stripped
    expect(data.project.parcel_id).toBe('Nairobi/Block/1/100')
    expect(data.project.lrNumber).toBe('Nairobi/Block/1/100')
    expect(data.project.registrationDistrict).toBe('LR 12345')
    expect(data.project.plan_title).toBe('DEED PLAN DRAFT')
    expect(data.project.area_sqm).toBe(10000)
    expect(data.project.area_ha).toBe(1)
    expect(data.project.firNumber).toBe('FR-9001')
  })

  it('maps every boundary point to parcel + control point entries', () => {
    const data = buildSurveyPlanDataFromDeedPlan(makeInput())
    expect(data.parcel.boundaryPoints).toHaveLength(4)
    expect(data.parcel.boundaryPoints[0]).toEqual({ name: 'A', easting: 500000, northing: 9800000 })
    expect(data.controlPoints).toHaveLength(4)
    expect(data.controlPoints[0].monumentType).toBe('found')
    expect(data.controlPoints[0].beaconDescription).toBe('Iron pin at NE corner')
  })

  it('carries the closure-check perimeter and linear error', () => {
    const data = buildSurveyPlanDataFromDeedPlan(makeInput(), { closureCheck: closure })
    expect(data.parcel.perimeter_m).toBe(400)
    expect(data.traverse?.linearError).toBeCloseTo(Math.sqrt(0.005 ** 2 + 0.005 ** 2), 6)
  })

  it('keeps abuttals in the data model', () => {
    const data = buildSurveyPlanDataFromDeedPlan(makeInput())
    expect(data.project.abuttalNorth).toBe('Plot 99')
    expect(data.project.abuttalWest).toBe('Railway Reserve')
  })

  it('applies an output-type plan title', () => {
    const data = buildSurveyPlanDataFromDeedPlan(makeInput(), { planTitle: 'CADASTRAL PLAN DRAFT' })
    expect(data.project.plan_title).toBe('CADASTRAL PLAN DRAFT')
  })
})

describe('renderDeedPlanDraftSVG', () => {
  it('renders a professional A3 SVG with the deed-plan title', () => {
    const bearingSchedule: BoundaryLeg[] = [
      { fromPoint: 'A', toPoint: 'B', bearing: '000°00\'00.0"', distance: 100 },
      { fromPoint: 'B', toPoint: 'C', bearing: '090°00\'00.0"', distance: 100 },
      { fromPoint: 'C', toPoint: 'D', bearing: '180°00\'00.0"', distance: 100 },
      { fromPoint: 'D', toPoint: 'A', bearing: '270°00\'00.0"', distance: 100 },
    ]
    const svg = renderDeedPlanDraftSVG(makeInput(), bearingSchedule, closure)
    expect(svg).toContain('<svg')
    expect(svg).toContain('DEED PLAN DRAFT')
    // A3 landscape dims
    expect(svg).toContain('width="1587.4015748031497"')
    expect(svg).toContain('height="1122.5196850393702"')
  })

  it('respects the selected output type title', () => {
    const svg = renderDeedPlanDraftSVG(makeInput(), [], closure, { outputType: 'client' })
    expect(svg).toContain(DEED_PLAN_OUTPUT_TYPES.find((t) => t.id === 'client')?.title ?? '')
  })

  it('can omit grid and panel', () => {
    const svg = renderDeedPlanDraftSVG(makeInput(), [], closure, {
      includeGrid: false,
      includePanel: false,
    })
    expect(svg).toContain('<svg')
  })
})