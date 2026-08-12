import { computeTraverseAccuracy, getAccuracyBadgeLabel } from '../traverseAccuracy'
import { defined } from '@/test-utils/defined'

describe('computeTraverseAccuracy', () => {
  it('classifies 1mm error on 4km perimeter as First Order Class I', () => {
    const r = computeTraverseAccuracy(0.001, 4000)
    expect(r).not.toBeNull()
    expect(defined(r).order).toBe('FIRST ORDER CLASS I')
    expect(defined(r).m_mm).toBe(0.5)
    expect(defined(r).C_mm).toBe(1.0)
    expect(defined(r).K_km).toBe(4.0)
    expect(defined(r).allowed).toBeCloseTo(0.5, 1)
  })
  it('returns null for zero perimeter', () => {
    const r = computeTraverseAccuracy(0.001, 0)
    expect(r).toBeNull()
  })
  it('classifies 2mm error on 1km perimeter as Third Order', () => {
    const r = computeTraverseAccuracy(0.002, 1000)
    expect(r).not.toBeNull()
    expect(defined(r).order).toBe('THIRD ORDER')
  })
})
