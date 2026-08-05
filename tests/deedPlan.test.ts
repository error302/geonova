import { computeBoundaryLegs, degreesToDMS, computeArea, computeClosureCheck } from '@/lib/compute/deedPlan'
import { renderDeedPlanSVG } from '@/lib/compute/deedPlanRenderer'
import type { BoundaryPoint, BeaconType, DeedPlanInput } from '@/types/deedPlan'

function createPoint(id: string, easting: number, northing: number): BoundaryPoint {
  return {
    id,
    easting,
    northing,
    markType: 'PSC' as BeaconType,
    markStatus: 'FOUND'
  }
}

describe('DeedPlan Computation Engine', () => {
  describe('degreesToDMS', () => {
    it('converts 0 degrees correctly', () => {
      const result = degreesToDMS(0)
      expect(result).toMatch(/^000\u00b000'/)
      expect(result).toContain('"')
    })

    it('converts 90 degrees correctly', () => {
      const result = degreesToDMS(90)
      expect(result).toMatch(/^090\u00b000'/)
      expect(result).toContain('"')
    })

    it('converts 82.2 degrees correctly', () => {
      const result = degreesToDMS(82.2)
      expect(result).toMatch(/^082\u00b012'/)
      expect(result).toContain('"')
    })

    it('converts 359.999999 degrees correctly', () => {
      const result = degreesToDMS(359.999999)
      expect(result).toMatch(/359\u00b059'/)
    })
  })

  describe('computeBoundaryLegs', () => {
    it('computes bearings for a square', () => {
      const square = [
        createPoint('BP1', 0, 0),
        createPoint('BP2', 100, 0),
        createPoint('BP3', 100, 100),
        createPoint('BP4', 0, 100)
      ]

      const legs = computeBoundaryLegs(square)

      expect(legs).toHaveLength(4)
      expect(legs[0].fromPoint).toBe('BP1')
      expect(legs[0].toPoint).toBe('BP2')
      expect(legs[1].fromPoint).toBe('BP2')
      expect(legs[1].toPoint).toBe('BP3')
    })

    it('computes correct distances', () => {
      const square = [
        createPoint('BP1', 0, 0),
        createPoint('BP2', 100, 0),
        createPoint('BP3', 100, 100),
        createPoint('BP4', 0, 100)
      ]

      const legs = computeBoundaryLegs(square)

      legs.forEach(leg => {
        expect(leg.distance).toBe(100)
      })
    })

    it('throws error for less than 3 points', () => {
      const points = [
        createPoint('BP1', 0, 0),
        createPoint('BP2', 100, 0)
      ]

      expect(() => computeBoundaryLegs(points)).toThrow('at least 3 boundary points')
    })
  })

  describe('computeArea', () => {
    it('computes area of 100m x 50m rectangle = 5000 m\u00b2', () => {
      const rectangle = [
        createPoint('BP1', 0, 0),
        createPoint('BP2', 100, 0),
        createPoint('BP3', 100, 50),
        createPoint('BP4', 0, 50)
      ]

      const area = computeArea(rectangle)
      expect(area).toBe(5000)
    })

    it('returns 0 for less than 3 points', () => {
      const points = [createPoint('BP1', 0, 0)]

      expect(computeArea(points)).toBe(0)
    })
  })

  describe('computeClosureCheck', () => {
    it('closed traverse should have high precision ratio', () => {
      const square = [
        createPoint('BP1', 0, 0),
        createPoint('BP2', 100, 0),
        createPoint('BP3', 100, 100),
        createPoint('BP4', 0, 100)
      ]

      const closure = computeClosureCheck(square)

      expect(closure.closingErrorE).toBe(0)
      expect(closure.closingErrorN).toBe(0)
      expect(closure.perimeter).toBe(400)
      expect(closure.passes).toBe(true)
      expect(closure.precisionRatio).toBe('1 : \u221e')
    })

    it('computes closure for closed square', () => {
      const square = [
        createPoint('BP1', 0, 0),
        createPoint('BP2', 100, 0),
        createPoint('BP3', 100, 100),
        createPoint('BP4', 0, 100)
      ]

      const closure = computeClosureCheck(square)

      expect(closure.closingErrorE).toBe(0)
      expect(closure.closingErrorN).toBe(0)
      expect(closure.perimeter).toBe(400)
      expect(closure.passes).toBe(true)
    })
  })
})

describe('DeedPlan SVG renderer — XSS escaping (sheetNumber gap + same-class)', () => {
  function makeInput(overrides: Partial<DeedPlanInput> = {}): DeedPlanInput {
    const pts = [
      createPoint('BP1', 0, 0),
      createPoint('BP2', 100, 0),
      createPoint('BP3', 100, 100),
      createPoint('BP4', 0, 100)
    ]
    return {
      surveyNumber: 'SRV-2026-001',
      drawingNumber: 'DRG-001',
      parcelNumber: 'PARCEL-1',
      locality: 'Nairobi',
      area: 10000,
      registrationSection: 'LR 1234/5',
      county: 'Nairobi',
      utmZone: 37,
      hemisphere: 'S',
      scale: 1000,
      datum: 'ARC1960',
      projectionType: 'UTM',
      boundaryPoints: pts,
      abuttalNorth: 'Road',
      abuttalSouth: 'Plot 2',
      abuttalEast: 'Plot 3',
      abuttalWest: 'Plot 4',
      surveyorName: 'John Doe',
      iskNumber: 'ISK-123',
      firmName: 'Doe Surveys',
      firmAddress: 'Nairobi',
      surveyDate: '2026-01-01',
      signatureDate: '2026-01-01',
      ...overrides,
    }
  }

  function render(input: DeedPlanInput): string {
    const legs = computeBoundaryLegs(input.boundaryPoints)
    const closure = computeClosureCheck(input.boundaryPoints)
    return renderDeedPlanSVG(input, legs, closure)
  }

  it('escapes script payloads in the previously-raw string fields', () => {
    const svg = render(makeInput({
      drawingNumber: 'DRG</text><script>alert(1)</script>',
      surveyDate: '2026</text><script>alert(2)</script>',
      registrationSection: 'LR<script>alert(3)</script>',
      titleDeedNumber: 'TITLE<script>alert(4)</script>',
      firNumber: 'FIR<script>alert(5)</script>',
      registryMapSheet: 'SHEET<script>alert(6)</script>',
      firmAddress: 'ADDR<script>alert(7)</script>',
      drawnBy: 'DB<script>alert(8)</script>',
      checkedBy: 'CB<script>alert(9)</script>',
      signatureDate: '2026<script>alert(10)</script>',
    }))

    // No raw script tags may survive into the SVG
    expect(svg).not.toContain('<script>')
    // The payload must be visible as inert text
    expect(svg).toContain('&lt;script&gt;')
  })

  it('renders numeric sheet numbers in the sheet line without breakage', () => {
    const svg = render(makeInput({ sheetNumber: 2, totalSheets: 3 }))
    expect(svg).toContain('Sheet <tspan font-weight="bold">2</tspan> of <tspan font-weight="bold">3</tspan>')
  })

  it('escapes a string smuggled into sheetNumber past the numeric type', () => {
    const svg = render(makeInput({
      sheetNumber: '2</tspan><script>x</script>' as unknown as number,
      totalSheets: 3,
    }))
    expect(svg).not.toContain('<script>')
  })

  it('escapes point ids and mark types in the coordinate schedule', () => {
    const svg = render(makeInput({
      boundaryPoints: [
        { id: 'P1</text><script>x</script>', easting: 0, northing: 0, markType: 'PSC', markStatus: 'FOUND' },
        createPoint('BP2', 100, 0),
        createPoint('BP3', 100, 100),
        createPoint('BP4', 0, 100),
      ],
    }))
    expect(svg).not.toContain('<script>')
  })

  it('still renders the pre-escaped infinity entity correctly (no double-escape)', () => {
    const svg = render(makeInput({}))
    expect(svg).toContain('&#8734;')
    expect(svg).not.toContain('&amp;#8734;')
  })

  it('does not double-escape legit strings containing special chars', () => {
    const svg = render(makeInput({
      firmName: 'Doe & Sons Surveyors',
      surveyorName: "O'Brien",
      drawingNumber: 'DRG-100 "(A)"',
    }))
    expect(svg).toContain('Doe &amp; Sons Surveyors')
    expect(svg).not.toContain('&amp;amp;')
    expect(svg).toContain('O&apos;Brien')
  })
})
