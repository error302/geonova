import { SurveyPlanRenderer } from '../renderer'
import type { SurveyPlanData } from '../types'

const BASE_DATA: SurveyPlanData = {
  project: {
    name: 'Test Survey',
    location: 'Test Location',
    utm_zone: 55,
    hemisphere: 'S',
    datum: 'WGS84',
    client_name: 'Test Client',
    surveyor_name: 'J. Smith',
    surveyor_licence: 'PLS-12345',
    firm_name: 'Test Surveyors Pty Ltd',
    firm_address: '123 Survey St, Brisbane QLD 4000',
    firm_phone: '07 3000 0000',
    firm_email: 'info@test.com',
    drawing_no: 'TEST-001',
    reference: 'REF-001',
    plan_title: 'Boundary Identification Plan',
    area_sqm: 2500,
    parcel_id: 'Lot 1',
  },
  parcel: {
    boundaryPoints: [
      { name: 'A', easting: 0, northing: 0 },
      { name: 'B', easting: 50, northing: 0 },
      { name: 'C', easting: 50, northing: 50 },
      { name: 'D', easting: 0, northing: 50 },
    ],
    area_sqm: 2500,
    perimeter_m: 200,
  },
  controlPoints: [
    { name: 'A', easting: 0, northing: 0, monumentType: 'found' },
    { name: 'B', easting: 50, northing: 0, monumentType: 'set' },
    { name: 'C', easting: 50, northing: 50, monumentType: 'iron_pin' },
    { name: 'D', easting: 0, northing: 50, monumentType: 'masonry_nail' },
  ],
  adjacentLots: [
    {
      id: 'Lot 2',
      boundaryPoints: [
        { easting: 50, northing: 0 },
        { easting: 100, northing: 0 },
        { easting: 100, northing: 50 },
        { easting: 50, northing: 50 },
      ],
    },
  ],
  buildings: [
    { easting: 25, northing: 25, width_m: 10, height_m: 8, rotation_deg: 0, label: 'House' },
  ],
}

describe('SurveyPlanRenderer', () => {
  describe('constructor', () => {
    it('creates instance with default options', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA)
      expect(renderer).toBeInstanceOf(SurveyPlanRenderer)
    })
    it('accepts custom options', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA, {
        paperSize: 'a4',
        scale: 200,
        includeGrid: false,
        includePanel: false,
      })
      expect(renderer).toBeInstanceOf(SurveyPlanRenderer)
    })
    it('accepts partial options', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA, { scale: 100 })
      expect(renderer).toBeInstanceOf(SurveyPlanRenderer)
    })
  })

  describe('getScale', () => {
    it('returns configured scale when set', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA, { scale: 1000 })
      expect(renderer.getScale()).toBe(1000)
    })
    it('computes auto-scale when not set', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA)
      expect(renderer.getScale()).toBeGreaterThan(0)
      expect(renderer.getScale()).toBeLessThanOrEqual(50000)
    })
  })

  describe('render', () => {
    it('returns a non-empty string', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA)
      const svg = renderer.render()
      expect(typeof svg).toBe('string')
      expect(svg.length).toBeGreaterThan(0)
    })

    it('produces valid SVG root element', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA)
      const svg = renderer.render()
      expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
      expect(svg).toContain('viewBox=')
    })

    it('contains background rect', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA)
      const svg = renderer.render()
      expect(svg).toContain('<rect x="0" y="0" width="')
      expect(svg).toContain('fill="white"')
    })

    it('contains sheet border', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA)
      const svg = renderer.render()
      expect(svg).toContain('stroke-width="2"')
      expect(svg).toContain('stroke-width="1"')
    })

    it('contains panel divider when panel enabled', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA, { includePanel: true })
      const svg = renderer.render()
      expect(svg).toContain('x1="')
      expect(svg).toContain('stroke-width="2"')
    })

    it('contains grid lines when grid enabled', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA, { includeGrid: true })
      const svg = renderer.render()
      expect(svg).toContain('stroke-dasharray="2,4"')
    })

    it('does not contain grid lines when grid disabled', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA, { includeGrid: false })
      const svg = renderer.render()
      expect(svg).not.toContain('stroke-dasharray="2,4"')
    })

    it('contains lot fill polygon', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA)
      const svg = renderer.render()
      expect(svg).toContain('<polygon points=')
      expect(svg).toContain('fill="#F5EDD6"')
    })

    it('contains boundary polyline', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA)
      const svg = renderer.render()
      expect(svg).toContain('<polyline points=')
    })

    it('contains boundary labels with bearings and distances', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA)
      const svg = renderer.render()
      expect(svg).toContain('\u00B0')
      expect(svg).toContain("'")
      expect(svg).toContain('"')
      expect(svg).toContain(' m')
    })

    it('contains corner dot symbols', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA)
      const svg = renderer.render()
      expect(svg).toContain('r="1.5"')
    })

    it('contains found monument symbols', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA)
      const svg = renderer.render()
      expect(svg).toContain('fill="#1A6B32"')
    })

    it('contains set monument symbols', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA)
      const svg = renderer.render()
      expect(svg).toContain('fill="none"')
      expect(svg).toContain('stroke="#1A6B32"')
    })

    it('contains masonry nail symbols', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA)
      const svg = renderer.render()
      expect(svg).toContain('fill="#C0392B"')
    })

    it('contains iron pin symbols', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA)
      const svg = renderer.render()
      expect(svg).toContain('r="2.5"')
    })

    it('contains lot number watermark', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA)
      const svg = renderer.render()
      expect(svg).toContain('opacity="0.12"')
      expect(svg).toContain('font-size="28"')
    })

    it('contains area label', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA)
      const svg = renderer.render()
      expect(svg).toContain('m\u00B2')
    })

    it('contains north arrow', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA)
      const svg = renderer.render()
      expect(svg).toContain('>N<')
    })

    it('contains scale bar', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA)
      const svg = renderer.render()
      expect(svg).toContain('SCALE')
      expect(svg).toContain('METRES')
    })

    it('contains plan info panel when panel enabled', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA, { includePanel: true })
      const svg = renderer.render()
      expect(svg).toContain('PLAN INFORMATION')
    })

    it('contains legend when panel enabled', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA, { includePanel: true })
      const svg = renderer.render()
      expect(svg).toContain('LEGEND')
    })

    it('contains warning box when panel enabled', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA, { includePanel: true })
      const svg = renderer.render()
      expect(svg).toContain('WARNING')
    })

    it('contains certificate when panel enabled', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA, { includePanel: true })
      const svg = renderer.render()
      expect(svg).toContain('CERTIFICATE')
    })

    it('contains surveyor name in certificate', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA, { includePanel: true })
      const svg = renderer.render()
      expect(svg).toContain('J. Smith')
    })

    it('contains surveyor licence in certificate', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA, { includePanel: true })
      const svg = renderer.render()
      expect(svg).toContain('PLS-12345')
    })

    it('contains company footer with phone', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA, { includePanel: true })
      const svg = renderer.render()
      expect(svg).toContain('07 3000 0000')
    })

    it('contains company footer with email', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA, { includePanel: true })
      const svg = renderer.render()
      expect(svg).toContain('info@test.com')
    })

    it('contains sheet footer with drawing no', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA)
      const svg = renderer.render()
      expect(svg).toContain('TEST-001')
    })

    it('contains adjacent lot labels when adjacent lots present', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA)
      const svg = renderer.render()
      expect(svg).toContain('Lot 2')
    })

    it('contains building hatching pattern', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA)
      const svg = renderer.render()
      expect(svg).toContain('pattern id="hatch"')
      expect(svg).toContain('House')
    })

    it('escapes XML in surveyor name in certificate', () => {
      const dataWithXmlChars: SurveyPlanData = {
        ...BASE_DATA,
        project: {
          ...BASE_DATA.project,
          surveyor_name: 'A. Test <Surveyor>',
        },
      }
      const renderer = new SurveyPlanRenderer(dataWithXmlChars)
      const svg = renderer.render()
      expect(svg).not.toContain('<Surveyor>')
      expect(svg).toContain('&lt;Surveyor&gt;')
    })

    it('escapes surveyor name in certificate', () => {
      const dataWithXmlChars: SurveyPlanData = {
        ...BASE_DATA,
        project: {
          ...BASE_DATA.project,
          surveyor_name: 'D. O\'Brien',
        },
      }
      const renderer = new SurveyPlanRenderer(dataWithXmlChars)
      const svg = renderer.render()
      expect(svg).not.toContain("D. O'")
      expect(svg).toContain('D. O&apos;')
    })

    it('handles data with no adjacent lots', () => {
      const data = { ...BASE_DATA, adjacentLots: undefined }
      const renderer = new SurveyPlanRenderer(data)
      const svg = renderer.render()
      expect(typeof svg).toBe('string')
      expect(svg.length).toBeGreaterThan(0)
    })

    it('handles data with no buildings', () => {
      const data = { ...BASE_DATA, buildings: undefined }
      const renderer = new SurveyPlanRenderer(data)
      const svg = renderer.render()
      expect(typeof svg).toBe('string')
    })

    it('handles municipality in project data', () => {
      const dataWithMun: SurveyPlanData = {
        ...BASE_DATA,
        project: {
          ...BASE_DATA.project,
          municipality: 'Brisbane City Council',
        },
      }
      const renderer = new SurveyPlanRenderer(dataWithMun)
      const svg = renderer.render()
      expect(svg).toContain('Brisbane City Council')
    })

    it('uses parcel_id for lot watermark', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA)
      const svg = renderer.render()
      expect(svg).toContain('Lot 1')
    })

    it('uses project name when no parcel_id', () => {
      const dataNoPid = {
        ...BASE_DATA,
        project: { ...BASE_DATA.project, parcel_id: undefined, name: 'MyProject' },
      }
      const renderer = new SurveyPlanRenderer(dataNoPid)
      const svg = renderer.render()
      expect(svg).toContain('MyProject')
    })

    it('uses default scale label when drawing no not provided', () => {
      const dataNoDrawingNo = {
        ...BASE_DATA,
        project: { ...BASE_DATA.project, drawing_no: undefined },
      }
      const renderer = new SurveyPlanRenderer(dataNoDrawingNo)
      const svg = renderer.render()
      expect(typeof svg).toBe('string')
    })

    it('throws for empty boundary points (requires at least 2 points)', () => {
      const emptyData: SurveyPlanData = {
        ...BASE_DATA,
        parcel: { ...BASE_DATA.parcel, boundaryPoints: [] },
        controlPoints: [],
      }
      const renderer = new SurveyPlanRenderer(emptyData)
      expect(() => renderer.render()).toThrow()
    })

    it('contains bearing schedule in right panel', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA)
      const svg = renderer.render()
      expect(svg).toContain('BEARING SCHEDULE')
    })

    it('contains revision block in right panel', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA)
      const svg = renderer.render()
      expect(svg).toContain('REVISIONS')
    })

    it('contains surveyor certificate with numbered paragraphs', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA)
      const svg = renderer.render()
      expect(svg).toContain("SURVEYOR'S CERTIFICATE")
      expect(svg).toContain('1.')
    })

    it('contains metric note', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA)
      const svg = renderer.render()
      expect(svg).toContain('0.3048')
    })

    it('renders street name when provided', () => {
      const dataWithStreet = {
        ...BASE_DATA,
        project: { ...BASE_DATA.project, street: 'Main Road' },
      }
      const renderer = new SurveyPlanRenderer(dataWithStreet)
      const svg = renderer.render()
      expect(svg).toContain('MAIN ROAD')
    })

    it('renders ISK reg number when provided', () => {
      const dataWithIsk = {
        ...BASE_DATA,
        project: { ...BASE_DATA.project, iskRegNo: 'ISK/2024/001' },
      }
      const renderer = new SurveyPlanRenderer(dataWithIsk)
      const svg = renderer.render()
      expect(svg).toContain('ISK/2024/001')
    })

    it('renders adjacent lot plan references', () => {
      const dataWithPlanRef = {
        ...BASE_DATA,
        adjacentLots: [{
          id: 'Lot 2',
          boundaryPoints: BASE_DATA.adjacentLots![0].boundaryPoints,
          planReference: 'PLAN M-459',
          side: 'right' as const,
        }],
      }
      const renderer = new SurveyPlanRenderer(dataWithPlanRef)
      const svg = renderer.render()
      expect(svg).toContain('PLAN M-459')
    })

    it('renders PIN label when parcel has pin', () => {
      const dataWithPin = {
        ...BASE_DATA,
        parcel: { ...BASE_DATA.parcel, pin: 'KRN-12345' },
      }
      const renderer = new SurveyPlanRenderer(dataWithPin)
      const svg = renderer.render()
      expect(svg).toContain('PIN: KRN-12345')
    })

    it('does not render PIN label when not provided', () => {
      const renderer = new SurveyPlanRenderer(BASE_DATA)
      const svg = renderer.render()
      expect(svg).not.toContain('PIN:')
    })

    it('renders part labels when parcel has parts', () => {
      const dataWithParts = {
        ...BASE_DATA,
        parcel: { ...BASE_DATA.parcel, parts: ['PART 1', 'PART 2'] },
      }
      const renderer = new SurveyPlanRenderer(dataWithParts)
      const svg = renderer.render()
      expect(svg).toContain('PART 1')
      expect(svg).toContain('PART 2')
    })

    it('renders association stamp when firm_name is provided', () => {
      const dataWithFirm = {
        ...BASE_DATA,
        project: { ...BASE_DATA.project, firm_name: 'GeoTech Surveys Ltd' },
      }
      const renderer = new SurveyPlanRenderer(dataWithFirm)
      const svg = renderer.render()
      expect(svg).toContain('SURVEYORS ASSOCIATION STAMP')
      expect(svg).toContain('GeoTech Surveys Ltd')
    })

    it('does not render association stamp when firm_name is absent', () => {
      const dataWithoutFirm = {
        ...BASE_DATA,
        project: { ...BASE_DATA.project, firm_name: undefined },
      }
      const renderer = new SurveyPlanRenderer(dataWithoutFirm)
      const svg = renderer.render()
      expect(svg).not.toContain('SURVEYORS ASSOCIATION STAMP')
    })

    it('applies north rotation when northRotationDeg is set', () => {
      const dataWithRotation = {
        ...BASE_DATA,
        project: { ...BASE_DATA.project, northRotationDeg: 15 },
      }
      const renderer = new SurveyPlanRenderer(dataWithRotation)
      const svg = renderer.render()
      expect(svg).toContain('15')
      expect(svg).toContain('N')
    })

    it('renders fence offsets when provided', () => {
      const dataWithFence = {
        ...BASE_DATA,
        fenceOffsets: [
          { segmentIndex: 0, type: 'chain_link' as const, offsetMetres: 1.5 },
          { segmentIndex: 1, type: 'board_fence' as const, offsetMetres: 2.0 },
        ],
      }
      const renderer = new SurveyPlanRenderer(dataWithFence)
      const svg = renderer.render()
      expect(svg).toContain('FENCE TYPES')
    })

    it('renders multiple sheets when totalSheets > 1', () => {
      const dataMultiSheet = {
        ...BASE_DATA,
        project: { ...BASE_DATA.project, sheetNo: '1', totalSheets: '4' },
      }
      const renderer = new SurveyPlanRenderer(dataMultiSheet)
      const svg = renderer.render()
      expect(svg).toContain('Sheet 1 of 4')
      expect(svg).toContain('Sheet 4 of 4')
      expect(svg).toContain('width="3174.')
    })
  })
})
