import {
  buildLabelCandidates,
  solveLabelPlacement,
  renderPlacedLabels,
  solveAndRenderBoundaryLabels,
  type SolverOptions,
} from '../labelPlacement'
import { PX_PER_M } from '../geometry'

const SIMPLE_RECT = [
  { easting: 0, northing: 0 },
  { easting: 50, northing: 0 },
  { easting: 50, northing: 50 },
  { easting: 0, northing: 50 },
]

const DENSE_SUBDIVISION = [
  { easting: 0, northing: 0 },
  { easting: 8, northing: 0 },
  { easting: 8, northing: 12 },
  { easting: 16, northing: 12 },
  { easting: 16, northing: 0 },
  { easting: 24, northing: 0 },
  { easting: 24, northing: 12 },
  { easting: 0, northing: 12 },
]

const SHORT_LEG_POLYGON = [
  { easting: 0, northing: 0 },
  { easting: 1.5, northing: 0 },
  { easting: 1.5, northing: 20 },
  { easting: 0, northing: 20 },
]

const identityTransform = {
  toSvgX: (e: number) => e * PX_PER_M,
  toSvgY: (n: number) => n * PX_PER_M,
}

describe('labelPlacement', () => {
  describe('buildLabelCandidates', () => {
    it('returns one candidate per segment', () => {
      const c = buildLabelCandidates(SIMPLE_RECT)
      expect(c).toHaveLength(4)
    })
    it('populates bearing and distance strings', () => {
      const c = buildLabelCandidates(SIMPLE_RECT)
      for (const lbl of c) {
        expect(lbl.bearingStr).toContain('\u00B0')
        expect(lbl.bearingStr).toContain("'")
        expect(lbl.bearingStr).toContain('"')
        expect(lbl.distStr).toMatch(/^\d+\.\d+ m$/)
      }
    })
    it('computes correct midpoints', () => {
      const c = buildLabelCandidates(SIMPLE_RECT)
      expect(c[0].midE).toBe(25)
      expect(c[0].midN).toBe(0)
    })
    it('computes perpendicular vectors pointing left of travel', () => {
      const c = buildLabelCandidates(SIMPLE_RECT)
      expect(c[0].perpE).toBeCloseTo(0)
      expect(c[0].perpN).toBeCloseTo(1)
    })
    it('skips degenerate zero-length segments', () => {
      expect(buildLabelCandidates([{ easting: 0, northing: 0 }, { easting: 0, northing: 0 }, { easting: 0, northing: 0 }])).toHaveLength(0)
    })
    it('returns empty for single point', () => {
      expect(buildLabelCandidates([{ easting: 0, northing: 0 }])).toHaveLength(0)
    })
  })

  describe('solveLabelPlacement', () => {
    it('returns one placed label per candidate', () => {
      const c = buildLabelCandidates(SIMPLE_RECT)
      expect(solveLabelPlacement(c, identityTransform.toSvgX, identityTransform.toSvgY)).toHaveLength(4)
    })
    it('generates dimension leaders for short legs', () => {
      const c = buildLabelCandidates(SHORT_LEG_POLYGON)
      const placed = solveLabelPlacement(c, identityTransform.toSvgX, identityTransform.toSvgY, { minLegLength: 3 })
      const firstLeg = placed.find(l => l.segIndex === 0)
      expect(firstLeg).toBeDefined()
      expect(firstLeg!.hasLeader).toBe(true)
      expect(firstLeg!.anchorE).toBeDefined()
      expect(firstLeg!.anchorN).toBeDefined()
    })
    it('does not generate leaders for long legs', () => {
      const c = buildLabelCandidates(SIMPLE_RECT)
      for (const lbl of solveLabelPlacement(c, identityTransform.toSvgX, identityTransform.toSvgY)) {
        expect(lbl.hasLeader).toBe(false)
      }
    })
    it('labels have correct text content', () => {
      const c = buildLabelCandidates(SIMPLE_RECT)
      const placed = solveLabelPlacement(c, identityTransform.toSvgX, identityTransform.toSvgY)
      for (let i = 0; i < c.length; i++) {
        const lbl = placed.find(l => l.segIndex === i)
        expect(lbl).toBeDefined()
        expect(lbl!.bearingStr).toBe(c[i].bearingStr)
        expect(lbl!.distStr).toBe(c[i].distStr)
      }
    })
    it('handles dense subdivision without crashing', () => {
      const c = buildLabelCandidates(DENSE_SUBDIVISION)
      const placed = solveLabelPlacement(c, identityTransform.toSvgX, identityTransform.toSvgY)
      expect(placed).toHaveLength(8)
      for (const lbl of placed) {
        expect(Number.isFinite(lbl.svgX)).toBe(true)
        expect(Number.isFinite(lbl.svgY)).toBe(true)
        expect(lbl.boxWidth).toBeGreaterThan(0)
        expect(lbl.boxHeight).toBeGreaterThan(0)
      }
    })
    it('returns empty array for empty candidates', () => {
      expect(solveLabelPlacement([], identityTransform.toSvgX, identityTransform.toSvgY)).toHaveLength(0)
    })
    it('respects custom solver options', () => {
      const c = buildLabelCandidates(SIMPLE_RECT)
      const opts: SolverOptions = { minLegLength: 1, maxOffset: 20, iterations: 5, repulsionK: 50, minGap: 10 }
      expect(solveLabelPlacement(c, identityTransform.toSvgX, identityTransform.toSvgY, opts)).toHaveLength(4)
    })
  })

  describe('renderPlacedLabels', () => {
    it('returns SVG containing label elements', () => {
      const c = buildLabelCandidates(SIMPLE_RECT)
      const placed = solveLabelPlacement(c, identityTransform.toSvgX, identityTransform.toSvgY)
      const svg = renderPlacedLabels(placed, c, identityTransform.toSvgX, identityTransform.toSvgY)
      expect(svg).toContain('<g class="boundary-labels">')
      expect(svg).toContain('text-anchor="middle"')
      expect(svg).toContain('font-weight="bold"')
      expect(svg).toContain('fill="white"')
    })
    it('renders leader lines for short-leg labels', () => {
      const c = buildLabelCandidates(SHORT_LEG_POLYGON)
      const placed = solveLabelPlacement(c, identityTransform.toSvgX, identityTransform.toSvgY, { minLegLength: 3 })
      const svg = renderPlacedLabels(placed, c, identityTransform.toSvgX, identityTransform.toSvgY)
      expect(svg).toContain('stroke-dasharray="3,2"')
      expect(svg).toContain('<polygon')
    })
    it('escapes XML in bearing strings', () => {
      const c = buildLabelCandidates(SIMPLE_RECT)
      const placed = solveLabelPlacement(c, identityTransform.toSvgX, identityTransform.toSvgY)
      const svg = renderPlacedLabels(placed, c, identityTransform.toSvgX, identityTransform.toSvgY)
      expect(svg).toContain('\u00B0')
    })
  })

  describe('solveAndRenderBoundaryLabels', () => {
    it('returns complete SVG group for simple rectangle', () => {
      const svg = solveAndRenderBoundaryLabels(SIMPLE_RECT, identityTransform.toSvgX, identityTransform.toSvgY)
      expect(svg).toContain('<g class="boundary-labels">')
      expect(svg).toContain('</g>')
      const textCount = (svg.match(/text-anchor="middle"/g) || []).length
      expect(textCount).toBe(8) // 4 bearing + 4 distance
    })
    it('returns empty for empty polygon', () => {
      expect(solveAndRenderBoundaryLabels([], identityTransform.toSvgX, identityTransform.toSvgY)).toBe('')
    })
    it('handles dense subdivision', () => {
      const svg = solveAndRenderBoundaryLabels(DENSE_SUBDIVISION, identityTransform.toSvgX, identityTransform.toSvgY)
      expect(svg).toContain('<g class="boundary-labels">')
      const textCount = (svg.match(/text-anchor="middle"/g) || []).length
      expect(textCount).toBe(16) // 8 bearing + 8 distance
    })
    it('includes dimension leaders for short-leg polygon', () => {
      const svg = solveAndRenderBoundaryLabels(SHORT_LEG_POLYGON, identityTransform.toSvgX, identityTransform.toSvgY, { minLegLength: 3 })
      expect(svg).toContain('stroke-dasharray="3,2"')
    })
    it('handles 5-sided polygon', () => {
      const pentagon = [
        { easting: 0, northing: 0 }, { easting: 40, northing: 0 },
        { easting: 50, northing: 30 }, { easting: 25, northing: 50 }, { easting: -5, northing: 30 },
      ]
      const svg = solveAndRenderBoundaryLabels(pentagon, identityTransform.toSvgX, identityTransform.toSvgY)
      expect(svg).toContain('<g class="boundary-labels">')
      expect((svg.match(/text-anchor="middle"/g) || []).length).toBe(10)
    })
    it('produces deterministic output', () => {
      const svg1 = solveAndRenderBoundaryLabels(SIMPLE_RECT, identityTransform.toSvgX, identityTransform.toSvgY)
      const svg2 = solveAndRenderBoundaryLabels(SIMPLE_RECT, identityTransform.toSvgX, identityTransform.toSvgY)
      expect(svg1).toBe(svg2)
    })
  })
})
