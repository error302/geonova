import {
  viewportQueryResponseSchema,
  viewportFeatureSchema,
  type ViewportQueryResponse,
} from '../src/lib/validation/viewportQuery'

describe('viewportQueryResponseSchema', () => {
  const valid: ViewportQueryResponse = {
    type: 'FeatureCollection',
    features: [
      {
        id: 'parcel-1',
        type: 'parcel',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [36.8, -1.2],
              [36.9, -1.2],
              [36.9, -1.3],
              [36.8, -1.3],
              [36.8, -1.2],
            ],
          ],
        },
        properties: { parcelNumber: 'LR 12345/67', areaHa: 0.5, status: 'pending' },
      },
      {
        id: 'beacon-2',
        type: 'beacon',
        geometry: { type: 'Point', coordinates: [36.85, -1.25] },
        properties: { beaconNumber: 'B1', beaconType: 'concrete' },
      },
      {
        id: 'fr-3',
        type: 'field_record',
        geometry: { type: 'Point', coordinates: [36.86, -1.26] },
        properties: { frNumber: 'FR/2024/001', county: 'Nairobi', isVerified: true },
      },
    ],
    count: 3,
    bbox: [36.8, -1.3, 36.9, -1.2],
  }

  it('accepts a realistic spatial-index response', () => {
    expect(viewportQueryResponseSchema.safeParse(valid).success).toBe(true)
  })

  it('round-trips the response exactly', () => {
    expect(viewportQueryResponseSchema.parse(valid)).toEqual(valid)
  })

  it('accepts a MultiPolygon parcel geometry (ST_AsGeoJSON output)', () => {
    const multi = {
      ...valid,
      features: [
        {
          id: 'parcel-9',
          type: 'parcel' as const,
          geometry: {
            type: 'MultiPolygon' as const,
            coordinates: [[[[36.8, -1.2], [36.9, -1.2], [36.9, -1.3], [36.8, -1.2]]]],
          },
          properties: {},
        },
      ],
      count: 1,
    }
    expect(viewportQueryResponseSchema.safeParse(multi).success).toBe(true)
  })

  it('rejects a feature type outside the shared enum (server drift)', () => {
    const drifted = {
      ...valid,
      features: [{ ...valid.features[0], type: 'monument' }],
    }
    expect(viewportQueryResponseSchema.safeParse(drifted).success).toBe(false)
  })

  it('rejects a malformed geometry (Polygon with scalar coordinates)', () => {
    const bad = {
      ...valid,
      features: [{ ...valid.features[0], geometry: { type: 'Polygon', coordinates: 42 } }],
    }
    expect(viewportQueryResponseSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects a missing count field', () => {
    const { count: _count, ...noCount } = valid
    expect(viewportQueryResponseSchema.safeParse(noCount).success).toBe(false)
  })

  it('rejects a wrong-arity bbox (client shape drift)', () => {
    const bad = { ...valid, bbox: [36.8, -1.3, 36.9] }
    expect(viewportQueryResponseSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects unknown keys on the response envelope (strict shape)', () => {
    expect(viewportQueryResponseSchema.safeParse({ ...valid, garbage: true }).success).toBe(false)
  })

  it('rejects unknown keys on a feature (strict shape)', () => {
    const bad = {
      ...valid,
      features: [{ ...valid.features[0], extraField: 1 }],
    }
    expect(viewportQueryResponseSchema.safeParse(bad).success).toBe(false)
  })

  it('viewportFeatureSchema rejects a bare point-less feature', () => {
    const { geometry: _geometry, ...noGeometry } = valid.features[0]
    expect(viewportFeatureSchema.safeParse(noGeometry).success).toBe(false)
  })
})
