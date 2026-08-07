import {
  parcelSchema,
  parcelWithBlockSchema,
  schemeDetailsSchema,
  parcelResponseSchema,
  type Parcel,
} from '../src/lib/validation/scheme'

describe('parcelSchema', () => {
  const pgRow: unknown = {
    id: '3f2b5c1e-0000-4000-8000-000000000001',
    project_id: '3f2b5c1e-0000-4000-8000-0000000000aa',
    block_id: '3f2b5c1e-0000-4000-8000-0000000000bb',
    parcel_number: 'PARCEL-001',
    lr_number_proposed: 'LR 12345/67',
    lr_number_confirmed: null,
    area_ha: '0.500000', // pg NUMERIC arrives as a string
    status: 'pending',
    assigned_surveyor: null,
    notes: 'Corner parcel',
    created_at: new Date('2026-08-01T10:00:00Z'), // pg TIMESTAMPTZ → Date pre-serialization
    updated_at: new Date('2026-08-02T10:00:00Z'),
  }

  it('accepts a pg-native row (Date timestamps, numeric-string area)', () => {
    const parsed = parcelSchema.safeParse(pgRow)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      // Coerces the numeric string and normalises timestamps to ISO strings.
      expect(parsed.data.area_ha).toBe(0.5)
      expect(parsed.data.created_at).toBe('2026-08-01T10:00:00.000Z')
    }
  })

  it('accepts the JSON-wire shape (ISO strings, number area)', () => {
    const wire: Parcel = {
      id: '3f2b5c1e-0000-4000-8000-000000000001',
      project_id: '3f2b5c1e-0000-4000-8000-0000000000aa',
      block_id: '3f2b5c1e-0000-4000-8000-0000000000bb',
      parcel_number: 'PARCEL-001',
      lr_number_proposed: null,
      lr_number_confirmed: null,
      area_ha: 0.5,
      status: 'computed',
      assigned_surveyor: null,
      notes: null,
      created_at: '2026-08-01T10:00:00.000Z',
      updated_at: '2026-08-02T10:00:00.000Z',
    }
    expect(parcelSchema.safeParse(wire).success).toBe(true)
  })

  it('rejects an out-of-enum status (the drift the old `status: string` allowed)', () => {
    const bad = { ...(pgRow as object), status: 'not_a_real_status' }
    expect(parcelSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects a numeric id (UUID ids are strings on the wire)', () => {
    const bad = { ...(pgRow as object), id: 123 }
    expect(parcelSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects a missing required column', () => {
    const { parcel_number: _pn, ...missing } = pgRow as Parcel
    expect(parcelSchema.safeParse(missing).success).toBe(false)
  })
})

describe('parcelWithBlockSchema', () => {
  const base = {
    id: '3f2b5c1e-0000-4000-8000-000000000001',
    project_id: '3f2b5c1e-0000-4000-8000-0000000000aa',
    block_id: '3f2b5c1e-0000-4000-8000-0000000000bb',
    parcel_number: 'PARCEL-001',
    lr_number_proposed: null,
    lr_number_confirmed: null,
    area_ha: 0.5,
    status: 'pending',
    assigned_surveyor: null,
    notes: null,
    created_at: new Date(),
    updated_at: new Date(),
  }

  it('requires the joined block columns', () => {
    expect(parcelWithBlockSchema.safeParse(base).success).toBe(false)
    expect(
      parcelWithBlockSchema.safeParse({ ...base, block_number: 'B-01', block_name: 'Block One' }).success,
    ).toBe(true)
  })
})

describe('schemeDetailsSchema', () => {
  it('accepts a realistic scheme row and rejects an invalid status', () => {
    const row = {
      id: '3f2b5c1e-0000-4000-8000-0000000000cc',
      project_id: '3f2b5c1e-0000-4000-8000-0000000000aa',
      scheme_number: 'SCHEME/2026/001',
      county: 'Nairobi',
      sub_county: null,
      ward: 'Westlands',
      planned_parcels: '120', // pg integer arrives as string pre-coercion
      adjudication_section: null,
      status: 'planning',
      created_at: new Date(),
      updated_at: new Date(),
    }
    const parsed = schemeDetailsSchema.safeParse(row)
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.planned_parcels).toBe(120)
    expect(schemeDetailsSchema.safeParse({ ...row, status: 'bogus' }).success).toBe(false)
  })
})

describe('parcelResponseSchema', () => {
  it('validates the `{ data: parcel }` envelope the routes emit', () => {
    const row = {
      id: '3f2b5c1e-0000-4000-8000-000000000001',
      project_id: '3f2b5c1e-0000-4000-8000-0000000000aa',
      block_id: '3f2b5c1e-0000-4000-8000-0000000000bb',
      parcel_number: 'PARCEL-001',
      lr_number_proposed: null,
      lr_number_confirmed: null,
      area_ha: 0.5,
      status: 'pending',
      assigned_surveyor: null,
      notes: null,
      created_at: '2026-08-01T10:00:00.000Z',
      updated_at: '2026-08-02T10:00:00.000Z',
    }
    expect(parcelResponseSchema.safeParse({ data: row }).success).toBe(true)
  })
})
