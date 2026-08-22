/**
 * Kenya precision audit — Survey Act Cap 299 / RDM 1.1 / Survey Regulations 1994
 *
 * Part A: traverse closure classification must match RDM 1.1 Table 2.4
 *         (C = m√K, orders FIRST I … THIRD).
 * Part B: Reg 89 standard plotting scales must cover every area band with no
 *         gaps/overlaps and include the 1:1250 cadastral default.
 */
import { computeTraverseAccuracy, ACCURACY_CLASSES } from '@/lib/reports/traverseAccuracy'
import { STANDARD_SCALES } from '@/lib/survey/surveyRegulationsExtended'

describe('Kenya precision audit — RDM 1.1 Table 2.4 closure classes', () => {
  it('classifies a first-order-class-I traverse (tight closure)', () => {
    // C=0.5mm allowed at K=1km: m√K = 0.5·1 = 0.5mm
    const r = computeTraverseAccuracy(0.0004, 1000)
    expect(r?.order).toBe('FIRST ORDER CLASS I')
    expect(r?.allowed).toBeLessThanOrEqual(0.5)
  })

  it('classifies third order at loose closure', () => {
    // C=4mm, K=4km → allowed = 4/√4 = 2.0mm = exactly THIRD ORDER limit
    const r = computeTraverseAccuracy(0.004, 4000)
    expect(r?.order).toBe('THIRD ORDER')
    expect(r?.allowed).toBeCloseTo(2.0, 5)
  })

  it('scales the allowance by √K, not linearly', () => {
    // Same relative precision: C growing 10× while K grows 100× keeps
    // C/√K constant → identical class and allowance, proving √K scaling.
    const short = computeTraverseAccuracy(0.0005, 1000)    // 0.5mm @ 1km
    const long = computeTraverseAccuracy(0.005, 100000)    // 5mm @ 100km
    expect(short!.allowed).toBeCloseTo(long!.allowed, 5)
    expect(short!.order).toBe(long!.order)
    expect(long!.C_mm).toBeCloseTo(short!.C_mm * 10, 3)
  })

  it('rejects degenerate input', () => {
    expect(computeTraverseAccuracy(NaN, 100)).toBeNull()
    expect(computeTraverseAccuracy(1, 0)).toBeNull()
  })

  it('exposes all five RDM classes in strict m-order', () => {
    const ms = ACCURACY_CLASSES.map((c) => c.m_mm)
    expect(ms).toEqual([...ms].sort((a, b) => a - b))
    expect(ACCURACY_CLASSES.length).toBe(5)
  })
})

describe('Kenya precision audit — Reg 89 standard plotting scales', () => {
  it('includes the 1:1250 cadastral deed-plan default (≤4ha)', () => {
    const s = STANDARD_SCALES.find((x) => x.scale === 1250)
    expect(s).toBeDefined()
    expect(s!.maxAreaHa).toBe(4)
  })

  it('covers all area bands from small plots to perimeter farms without gaps', () => {
    const sorted = [...STANDARD_SCALES].sort((a, b) => a.maxAreaHa - b.maxAreaHa)
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].maxAreaHa).toBeGreaterThan(sorted[i - 1].maxAreaHa)
    }
    expect(sorted[0].scale).toBeLessThanOrEqual(500)   // foundation-scale plots
    expect(sorted[sorted.length - 1].maxAreaHa).toBeGreaterThanOrEqual(100) // farms
  })

  it('always recommends the smallest scale that fits the area', () => {
    const pick = (ha: number) => STANDARD_SCALES.find((s) => ha <= s.maxAreaHa)
    expect(pick(0.05)?.scale).toBe(250)
    expect(pick(3)?.scale).toBe(1250)
    expect(pick(150)).toBeUndefined() // beyond largest standard scale
  })
})
