import { mapExtentSchema, type MapExtent } from '../src/lib/validation/mapExtent'

describe('mapExtentSchema', () => {
  const valid: MapExtent = { minLat: -4.7, minLon: 33.9, maxLat: 4.6, maxLon: 41.9 }

  it('accepts a well-formed bounding box', () => {
    expect(mapExtentSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts a valid box matching the shared MapExtent shape exactly', () => {
    const parsed = mapExtentSchema.parse(valid)
    expect(parsed).toEqual(valid)
  })

  it('rejects missing keys', () => {
    const { success } = mapExtentSchema.safeParse({ minLat: 0, minLon: 0, maxLat: 1 })
    expect(success).toBe(false)
  })

  it('rejects out-of-range latitudes', () => {
    expect(mapExtentSchema.safeParse({ ...valid, minLat: -91 }).success).toBe(false)
    expect(mapExtentSchema.safeParse({ ...valid, maxLat: 91 }).success).toBe(false)
  })

  it('rejects out-of-range longitudes', () => {
    expect(mapExtentSchema.safeParse({ ...valid, minLon: -181 }).success).toBe(false)
    expect(mapExtentSchema.safeParse({ ...valid, maxLon: 181 }).success).toBe(false)
  })

  it('rejects inverted boxes (minLat >= maxLat)', () => {
    expect(mapExtentSchema.safeParse({ ...valid, minLat: 5, maxLat: 4 }).success).toBe(false)
  })

  it('rejects inverted longitudes (minLon >= maxLon)', () => {
    expect(mapExtentSchema.safeParse({ ...valid, minLon: 42, maxLon: 33 }).success).toBe(false)
  })

  it('accepts a global box edge case', () => {
    const global: MapExtent = { minLat: -85.0511, minLon: -180, maxLat: 85.0511, maxLon: 180 }
    expect(mapExtentSchema.safeParse(global).success).toBe(true)
  })

  it('rejects unknown keys (strict shape enforcement)', () => {
    expect(mapExtentSchema.safeParse({ ...valid, garbage: true }).success).toBe(false)
  })
})
