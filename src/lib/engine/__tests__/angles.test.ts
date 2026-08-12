import { approxEqual } from '@/test-utils/approx'
import {
  toRadians, toDegrees, normalizeBearing,
  dmsToDecimal, decimalToDMS, backBearing, angularMisclosure
} from '../angles'

describe('toRadians / toDegrees', () => {
  it('converts 180° to π', () => expect(approxEqual(toRadians(180), Math.PI, 10 ** -10)).toBe(true))
  it('converts 90° to π/2', () => expect(approxEqual(toRadians(90), Math.PI / 2, 10 ** -10)).toBe(true))
  it('converts π back to 180°', () => expect(approxEqual(toDegrees(Math.PI), 180, 10 ** -10)).toBe(true))
  it('round-trips correctly', () => expect(approxEqual(toDegrees(toRadians(123.456)), 123.456, 10 ** -8)).toBe(true))
})

describe('normalizeBearing', () => {
  it('keeps 0–360 values unchanged', () => expect(approxEqual(normalizeBearing(45), 45, 10 ** -6)).toBe(true))
  it('wraps negative bearings', () => expect(approxEqual(normalizeBearing(-90), 270, 10 ** -6)).toBe(true))
  it('wraps bearings > 360', () => expect(approxEqual(normalizeBearing(450), 90, 10 ** -6)).toBe(true))
  it('360 normalizes to 0', () => expect(approxEqual(normalizeBearing(360), 0, 10 ** -6)).toBe(true))
})

describe('backBearing', () => {
  it('0° → 180°', () => expect(approxEqual(backBearing(0), 180, 10 ** -6)).toBe(true))
  it('90° → 270°', () => expect(approxEqual(backBearing(90), 270, 10 ** -6)).toBe(true))
  it('180° → 0°', () => expect(approxEqual(backBearing(180), 0, 10 ** -6)).toBe(true))
  it('270° → 90°', () => expect(approxEqual(backBearing(270), 90, 10 ** -6)).toBe(true))
  it('45° → 225°', () => expect(approxEqual(backBearing(45), 225, 10 ** -6)).toBe(true))
})

describe('dmsToDecimal', () => {
  it('converts 90°0\'0" to 90', () =>
    expect(approxEqual(dmsToDecimal({ degrees: 90, minutes: 0, seconds: 0, direction: 'E' }), 90, 10 ** -6)).toBe(true))
  it('converts 1°30\'0" to 1.5', () =>
    expect(approxEqual(dmsToDecimal({ degrees: 1, minutes: 30, seconds: 0, direction: 'N' }), 1.5, 10 ** -6)).toBe(true))
  it('converts 45°30\'36" ≈ 45.51°', () =>
    expect(approxEqual(dmsToDecimal({ degrees: 45, minutes: 30, seconds: 36, direction: 'N' }), 45.51, 10 ** -4)).toBe(true))
})

describe('decimalToDMS', () => {
  it('converts 1.5° → 1°30\'0"', () => {
    const r = decimalToDMS(1.5, false)
    expect(r.degrees).toBe(1)
    expect(r.minutes).toBe(30)
    expect(approxEqual(r.seconds, 0, 10 ** -4)).toBe(true)
  })

  it('round-trips decimal → DMS → decimal', () => {
    const original = 123.4567
    const dms = decimalToDMS(original, false)
    const back = dmsToDecimal({ ...dms, direction: 'N' })
    expect(approxEqual(back, original, 10 ** -4)).toBe(true)
  })
})

describe('angularMisclosure', () => {
  it('zero misclosure for exact closed traverse', () => {
    // 4-station traverse: expected sum = (4-2)×180 = 360°
    const r = angularMisclosure(360.0, 4)
    expect(approxEqual(r.misclosure, 0, 10 ** -6)).toBe(true)
  })

  it('positive misclosure when sum exceeds theoretical', () => {
    // Observed 361° vs expected 360°
    const r = angularMisclosure(361.0, 4)
    expect(approxEqual(r.misclosure, 1.0, 10 ** -4)).toBe(true)
  })

  it('correction per station = -misclosure / n', () => {
    const r = angularMisclosure(362.0, 4)
    expect(approxEqual(r.correctionPerStation, -0.5, 10 ** -4)).toBe(true)
  })
})
