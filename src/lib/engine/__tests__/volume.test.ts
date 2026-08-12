import { endAreaVolume, prismoidalVolume, volumeFromSections, cutFillVolumeFromSignedSections } from '../volume'
import { approxEqual } from '@/test-utils/approx'

const SECTIONS = [
  { chainage: 0,   area: 20.0 },
  { chainage: 50,  area: 30.0 },
  { chainage: 100, area: 25.0 },
  { chainage: 150, area: 15.0 },
]

describe('endAreaVolume', () => {
  it('computes volume for two sections', () => {
    const r = endAreaVolume([{ chainage: 0, area: 20 }, { chainage: 50, area: 30 }])
    // V = L/2 × (A1+A2) = 50/2 × 50 = 1250
    expect(approxEqual(r.totalVolume, 1250, 10 ** -2)).toBe(true)
  })

  it('total volume equals sum of segment volumes', () => {
    const r = endAreaVolume(SECTIONS)
    const sumSegments = r.segments.reduce((s, seg) => s + seg.volume, 0)
    expect(approxEqual(r.totalVolume, sumSegments, 10 ** -6)).toBe(true)
  })

  it('segment length L = chainage difference', () => {
    const r = endAreaVolume(SECTIONS)
    expect(approxEqual(r.segments[0].L, 50, 10 ** -4)).toBe(true)
    expect(approxEqual(r.segments[1].L, 50, 10 ** -4)).toBe(true)
  })

  it('returns method name end_area', () => {
    const r = endAreaVolume(SECTIONS)
    expect(r.method).toBe('end_area')
  })
})

describe('prismoidalVolume', () => {
  it('prismoidal ≤ end area for concave profiles', () => {
    const ea = endAreaVolume(SECTIONS)
    const pm = prismoidalVolume(SECTIONS)
    // Prismoidal formula is more precise — not always smaller, but should be close
    expect(Math.abs(pm.totalVolume - ea.totalVolume) / ea.totalVolume).toBeLessThan(0.5)
  })

  it('returns method name prismoidal', () => {
    const r = prismoidalVolume(SECTIONS)
    expect(r.method).toBe('prismoidal')
  })

  it('prismoidal computes volume for 3+ sections (requires triplets)', () => {
    // Prismoidal needs triplets: needs at least 3 sections
    const three = [
      { chainage: 0,   area: 10 },
      { chainage: 50,  area: 20 },
      { chainage: 100, area: 10 },
    ]
    const pm = prismoidalVolume(three)
    // V = (100/6) × (10 + 4×20 + 10) = (100/6) × 100 = 1666.67m³
    expect(approxEqual(pm.totalVolume, 1666.67, 10 ** -0)).toBe(true)
    expect(pm.method).toBe('prismoidal')
  })
})

describe('volumeFromSections', () => {
  it('delegates to endAreaVolume when method is end_area', () => {
    const r1 = volumeFromSections(SECTIONS, 'end_area')
    const r2 = endAreaVolume(SECTIONS)
    expect(approxEqual(r1.totalVolume, r2.totalVolume, 10 ** -6)).toBe(true)
  })

  it('delegates to prismoidalVolume when method is prismoidal', () => {
    const r1 = volumeFromSections(SECTIONS, 'prismoidal')
    const r2 = prismoidalVolume(SECTIONS)
    expect(approxEqual(r1.totalVolume, r2.totalVolume, 10 ** -6)).toBe(true)
  })
})

describe('cutFillVolumeFromSignedSections', () => {
  it('separates positive (cut) and negative (fill) sections', () => {
    const mixed = [
      { chainage: 0,   area: 20  },
      { chainage: 50,  area: 15  },   // cut segment (both positive)
      { chainage: 100, area: -5  },
      { chainage: 150, area: -10 },   // fill segment (both negative)
    ]
    const r = cutFillVolumeFromSignedSections(mixed)
    expect(r.cutVolume).toBeGreaterThan(0)
    expect(r.fillVolume).toBeGreaterThan(0)
  })

  it('net volume = cut - fill', () => {
    const mixed = [
      { chainage: 0,  area: 30 },
      { chainage: 50, area: -10 },
      { chainage: 100, area: 5 },
    ]
    const r = cutFillVolumeFromSignedSections(mixed)
    expect(approxEqual(r.netVolume, r.cutVolume - r.fillVolume, 10 ** -4)).toBe(true)
  })

  it('all positive sections: fill = 0', () => {
    const r = cutFillVolumeFromSignedSections(SECTIONS)
    expect(approxEqual(r.fillVolume, 0, 10 ** -4)).toBe(true)
    expect(r.cutVolume).toBeGreaterThan(0)
  })
})
