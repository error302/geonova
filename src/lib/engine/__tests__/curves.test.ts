import { curveElements } from '../curves'
import { approxEqual } from '@/test-utils/approx'

describe('horizontalCurve', () => {
  it('computes basic curve elements', () => {
    const r = curveElements(200, 60)
    expect(Number.isFinite(r.tangentLength)).toBe(true)
    expect(Number.isFinite(r.arcLength)).toBe(true)
    expect(Number.isFinite(r.longChord)).toBe(true)
    expect(Number.isFinite(r.midOrdinate)).toBe(true)
    expect(Number.isFinite(r.externalDistance)).toBe(true)
  })

  it('tangent length for R=200, Δ=60° ≈ 115.47m', () => {
    const r = curveElements(200, 60)
    expect(approxEqual(r.tangentLength, 115.47, 10 ** -1)).toBe(true)
  })

  it('curve length = R × Δ in radians', () => {
    const r = curveElements(100, 90)
    expect(approxEqual(r.arcLength, Math.PI * 100 / 2, 10 ** -2)).toBe(true)
  })

  it('long chord < curve length', () => {
    const r = curveElements(300, 45)
    expect(r.longChord).toBeLessThan(r.arcLength)
  })

  it('mid-ordinate is positive', () => {
    const r = curveElements(150, 30)
    expect(r.midOrdinate).toBeGreaterThan(0)
  })
})
