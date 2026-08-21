import { buildCorridorBoQ, formatBoQText, formatBoQCSV, type CorridorSection } from '../corridorBoQ'
import { renderCrossSectionPlot, renderCorridorSummary, type CrossSectionPlotData } from '../crossSectionRenderer'
import type { ProfilePoint } from '../crossSectionGeometry'

const DEFAULT_TEMPLATE = {
  carriagewayWidth: 7,
  shoulderWidth: 1.5,
  subgradeDepth: 0.3,
}

function makeSection(chainage: number, groundLevel: number, formationLevel: number): CorridorSection {
  const groundPoints: ProfilePoint[] = [
    { offset: -15, level: groundLevel + 1.2 },
    { offset: -10, level: groundLevel + 0.6 },
    { offset: -5, level: groundLevel + 0.2 },
    { offset: 0, level: groundLevel },
    { offset: 5, level: groundLevel - 0.1 },
    { offset: 10, level: groundLevel + 0.3 },
    { offset: 15, level: groundLevel + 0.8 },
  ]
  const halfCW = DEFAULT_TEMPLATE.carriagewayWidth / 2
  const camberDrop = 0.025 * halfCW
  const formationPoints: ProfilePoint[] = [
    { offset: -10, level: formationLevel - camberDrop - 1 },
    { offset: -halfCW, level: formationLevel - camberDrop },
    { offset: 0, level: formationLevel },
    { offset: halfCW, level: formationLevel - camberDrop },
    { offset: 10, level: formationLevel - camberDrop - 1 },
  ]
  return { chainage, groundPoints, formationPoints, template: DEFAULT_TEMPLATE }
}

describe('corridorBoQ', () => {
  describe('buildCorridorBoQ', () => {
    it('returns empty result for fewer than 2 sections', () => {
      const result = buildCorridorBoQ([makeSection(0, 100, 100)])
      expect(result.rows).toHaveLength(0)
      expect(result.totalCutVolume).toBe(0)
      expect(result.totalFillVolume).toBe(0)
    })

    it('computes volumes for a cut-only corridor', () => {
      const sections = [
        makeSection(0, 102, 100), // ground > formation → cut
        makeSection(20, 103, 100.5),
        makeSection(40, 104, 101),
      ]
      const result = buildCorridorBoQ(sections)
      expect(result.rows).toHaveLength(2)
      expect(result.totalCutVolume).toBeGreaterThan(0)
      expect(result.totalFillVolume).toBe(0)
      expect(result.summary.cutSections).toBe(3)
    })

    it('computes volumes for a fill-only corridor', () => {
      const sections = [
        makeSection(0, 98, 100),  // ground < formation → fill
        makeSection(20, 99, 100.5),
      ]
      const result = buildCorridorBoQ(sections)
      expect(result.totalFillVolume).toBeGreaterThan(0)
      expect(result.totalCutVolume).toBe(0)
    })

    it('produces BoQ items for cut sections', () => {
      const sections = [
        makeSection(0, 102, 100),
        makeSection(20, 103, 100.5),
      ]
      const result = buildCorridorBoQ(sections)
      expect(result.boqItems.length).toBeGreaterThan(0)
      expect(result.boqItems[0].unit).toBe('m\u00B3')
      expect(result.boqItems[0].quantity).toBeGreaterThan(0)
      expect(result.boqItems[0].amount).toBeGreaterThan(0)
    })

    it('handles mixed cut/fill corridors', () => {
      const sections = [
        makeSection(0, 102, 100), // cut
        makeSection(20, 100, 100.5), // fill
        makeSection(40, 103, 101), // cut
      ]
      const result = buildCorridorBoQ(sections)
      expect(result.totalCutVolume).toBeGreaterThan(0)
      expect(result.totalFillVolume).toBeGreaterThan(0)
      expect(result.summary.mixedSections).toBeGreaterThanOrEqual(0)
    })

    it('computes net volume correctly', () => {
      const sections = [
        makeSection(0, 105, 100),
        makeSection(20, 106, 100),
      ]
      const result = buildCorridorBoQ(sections)
      expect(result.netVolume).toBeCloseTo(result.totalCutVolume - result.totalFillVolume, 1)
    })
  })

  describe('formatBoQText', () => {
    it('produces a non-empty formatted text', () => {
      const sections = [
        makeSection(0, 102, 100),
        makeSection(20, 103, 100.5),
      ]
      const result = buildCorridorBoQ(sections)
      const text = formatBoQText(result)
      expect(text.length).toBeGreaterThan(0)
      expect(text).toContain('BILL OF QUANTITIES')
      expect(text).toContain('EARTHWORKS')
    })
  })

  describe('formatBoQCSV', () => {
    it('produces valid CSV with header', () => {
      const sections = [
        makeSection(0, 102, 100),
        makeSection(20, 103, 100.5),
      ]
      const result = buildCorridorBoQ(sections)
      const csv = formatBoQCSV(result)
      expect(csv).toContain('From Chainage')
      expect(csv).toContain('Cut Volume')
      const lines = csv.split('\n')
      expect(lines.length).toBeGreaterThan(2) // header + data rows + totals
    })
  })
})

describe('crossSectionRenderer', () => {
  const makePlotData = (chainage: number, isCut: boolean): CrossSectionPlotData => {
    const gl = isCut ? 102 : 98
    const fl = 100
    return {
      chainage,
      groundPoints: [
        { offset: -10, level: gl + 0.5 },
        { offset: 0, level: gl },
        { offset: 10, level: gl + 0.3 },
      ],
      formationPoints: [
        { offset: -10, level: fl - 1 },
        { offset: 0, level: fl },
        { offset: 10, level: fl - 1 },
      ],
      cutArea: isCut ? 5.2 : 0,
      fillArea: !isCut ? 4.1 : 0,
      sectionType: isCut ? 'cut' : 'fill',
    }
  }

  describe('renderCrossSectionPlot', () => {
    it('produces valid SVG for a cut section', () => {
      const svg = renderCrossSectionPlot(makePlotData(100, true))
      expect(svg).toContain('<svg')
      expect(svg).toContain('Section at 100')
      expect(svg).toContain('Cut:')
    })

    it('produces valid SVG for a fill section', () => {
      const svg = renderCrossSectionPlot(makePlotData(50, false))
      expect(svg).toContain('Fill:')
    })

    it('returns empty SVG for no data', () => {
      const svg = renderCrossSectionPlot({
        chainage: 0, groundPoints: [], formationPoints: [],
        cutArea: 0, fillArea: 0, sectionType: 'fill',
      })
      expect(svg).toContain('No cross-section data')
    })

    it('accepts custom dimensions', () => {
      const svg = renderCrossSectionPlot(makePlotData(100, true), { width: 800, height: 400 })
      expect(svg).toContain('800')
      expect(svg).toContain('400')
    })
  })

  describe('renderCorridorSummary', () => {
    it('produces SVG for corridor volume summary', () => {
      const sections = [makePlotData(0, true), makePlotData(50, false)]
      const volumes = [
        { chainage: 25, cutVolume: 100, fillVolume: 50 },
      ]
      const svg = renderCorridorSummary(sections, volumes)
      expect(svg).toContain('Corridor Volume Summary')
    })

    it('returns empty SVG for no data', () => {
      const svg = renderCorridorSummary([], [])
      expect(svg).toContain('No cross-section data')
    })
  })
})
