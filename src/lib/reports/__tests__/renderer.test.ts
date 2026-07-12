import { SurveyPlanRenderer } from '../surveyPlan/renderer'
import { SurveyPlanData } from '../surveyPlan/types'

describe('SurveyPlanRenderer', () => {
  // The renderer stamps the current date into the title block / revisions, so
  // pin the clock to a fixed instant — otherwise the snapshot breaks every day
  // at midnight. Midday UTC avoids timezone date-rollover on either side.
  beforeAll(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-06-15T12:00:00Z'))
  })
  afterAll(() => {
    jest.useRealTimers()
  })

  const mockData: SurveyPlanData = {
    project: {
      name: 'TEST PROJECT',
      location: 'NYERI',
      utm_zone: 37,
      hemisphere: 'S',
      datum: 'ARC1960',
      area_sqm: 5000,
      area_ha: 0.5,
      drawing_no: 'MD-659744',
    },
    parcel: {
      boundaryPoints: [
        { name: 'P1', easting: 250000, northing: 9945000 },
        { name: 'P2', easting: 250050, northing: 9945000 },
        { name: 'P3', easting: 250050, northing: 9945050 },
        { name: 'P4', easting: 250000, northing: 9945050 },
      ],
      area_sqm: 2500,
      perimeter_m: 200,
    },
    controlPoints: [],
  }

  it('renders a valid SVG that matches the snapshot', () => {
    const renderer = new SurveyPlanRenderer(mockData, {
      paperSize: 'a3',
      includeGrid: true,
      includePanel: true
    })
    const svg = renderer.render()
    
    expect(svg).toBeDefined()
    expect(svg).toContain('<svg')
    expect(svg).toContain('TEST PROJECT')
    expect(svg).toContain('NYERI')
    
    // Quality Hardening: Snapshots ensure layout consistency
    expect(svg).toMatchSnapshot()
  })

  it('handles empty control points gracefully', () => {
    const renderer = new SurveyPlanRenderer(mockData)
    const svg = renderer.render()
    expect(svg).toContain('COORDINATE SCHEDULE')
  })
})
