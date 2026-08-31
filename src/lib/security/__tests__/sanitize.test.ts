/**
 * Regression tests for sanitizeHtml — SVG drawing vocabulary.
 *
 * BUG (2026-08-30): the whitelist allowed <svg> but none of its child
 * drawing elements, so DOMPurify stripped the entire plan geometry and
 * the survey plan viewer rendered a blank canvas (also blanked beacon
 * symbols in BeaconPicker). These tests pin the fix: inert SVG drawing
 * elements/attributes survive; XSS vectors stay stripped.
 */
import { sanitizeHtml } from '../sanitize'
import { SurveyPlanRenderer } from '@/lib/reports/surveyPlan/renderer'
import { getBeaconSymbolSVG } from '@/lib/compute/beaconSymbols'

const PLAN_DATA = {
  project: {
    name: 'TEST/PLOT 1',
    location: 'NAIROBI',
    municipality: 'TEST COUNCIL',
    utm_zone: 37,
    hemisphere: 'S',
    datum: 'ARC1960',
    client_name: 'CLIENT',
    surveyor_name: 'SURVEYOR',
    surveyor_licence: 'LS/001',
    firm_name: 'FIRM',
    drawing_no: 'D-001',
    plan_title: 'TEST PLAN',
    area_sqm: 1000,
    area_ha: 0.1,
    parcel_id: 'LOT 1',
    sheetNo: '1',
    totalSheets: '1',
    northRotationDeg: 0,
    revisions: [],
  },
  parcel: {
    boundaryPoints: [
      { name: 'P1', easting: 250000, northing: 9945000 },
      { name: 'P2', easting: 250050, northing: 9945000 },
      { name: 'P3', easting: 250050, northing: 9945030 },
      { name: 'P4', easting: 250000, northing: 9945030 },
    ],
    area_sqm: 1000,
    perimeter_m: 130,
    pin: 'P/1/1',
    parts: [],
  },
  controlPoints: [
    { name: 'P1', easting: 250000, northing: 9945000, elevation: 1800, monumentType: 'found' },
  ],
  fenceOffsets: [],
} as unknown as import("@/lib/reports/surveyPlan/renderer").SurveyPlanData

describe('sanitizeHtml — SVG drawing vocabulary', () => {
  it('keeps the survey plan renderer output intact (not a blank shell)', () => {
    const svg = new SurveyPlanRenderer(PLAN_DATA).render()
    const clean = sanitizeHtml(svg)

    // Every drawing element type the renderer emits must survive.
    for (const tag of ['svg', 'g', 'rect', 'line', 'circle', 'polygon', 'polyline', 'text']) {
      expect(svg).toMatch(new RegExp(`<${tag}[\\s>]`))
      expect(clean).toMatch(new RegExp(`<${tag}[\\s>]`))
    }
    // Geometry attributes must survive.
    expect(clean).toContain('viewBox')
    expect(clean).toContain('points=')
    expect(clean).toContain('x1=')
    // Substantial geometry, not an emptied-out shell.
    expect(clean.length).toBeGreaterThan(svg.length * 0.75)
  })

  it('keeps beacon symbol SVGs intact', () => {
    const svg = getBeaconSymbolSVG('PSC', 'FOUND', 12)
    const clean = sanitizeHtml(svg)
    for (const tag of ['svg', 'circle', 'path', 'line', 'polygon', 'rect', 'title']) {
      if (new RegExp(`<${tag}[\\s>]`).test(svg)) {
        expect(clean).toMatch(new RegExp(`<${tag}[\\s>]`))
      }
    }
  })

  it('still strips XSS vectors from SVG payloads', () => {
    const evil = [
      '<svg><script>alert(1)</script></svg>',
      '<svg onload="alert(1)"><circle r="5"/></svg>',
      '<svg><foreignObject><body><script>alert(1)</script></body></foreignObject></svg>',
      '<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>',
      '<svg><image href="https://evil.example/x" /></svg>',
      '<svg><animate attributeName="href" values="javascript:alert(1)" /></svg>',
    ]
    for (const payload of evil) {
      const clean = sanitizeHtml(payload)
      expect(clean).not.toMatch(/script|onload|foreignObject|javascript:|evil\.example|animate/i)
    }
  })

  it('keeps plain HTML sanitization behaviour', () => {
    const clean = sanitizeHtml('<p onclick="x()">hi<script>a()</script></p><table><tr><td>1</td></tr></table>')
    expect(clean).toContain('<p>hi</p>')
    expect(clean).toContain('<td>1</td>')
    expect(clean).not.toContain('script')
    expect(clean).not.toContain('onclick')
  })
})
