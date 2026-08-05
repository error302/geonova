/**
 * VULN-001 regression tests (security review 2026-08-03)
 *
 * The /api/db proxy previously interpolated the `columns` string and
 * `limit`/`offset` values raw into SQL:
 *   - columns: `id" FROM users; DROP TABLE projects; --` produced
 *     `SELECT "id" FROM users; DROP TABLE projects; --" FROM "public_beacons"`
 *     (simple query protocol → multi-statement execution, no params bound)
 *   - limit/offset: typed `number` but the JSON body can carry strings
 *     like `"1; DROP TABLE users"` → interpolated straight into `LIMIT ...`
 *
 * Fix: every select column runs through validateIdentifier(), and
 * limit/offset are coerced to non-negative integers.
 */
import { QueryBuilder } from '@/lib/db/queryBuilder'

// Minimal fake pool — captures the exact SQL that would hit Postgres.
function makePool() {
  const calls: { sql: string; params: unknown[] }[] = []
  const pool = {
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params })
      return { rows: [], rowCount: 0 }
    }),
  }
  return { pool, calls }
}

describe('VULN-001: select-column injection is blocked', () => {
  it('blocks the original exploit payload (columns breakout)', async () => {
    const { pool, calls } = makePool()
    const qb = new QueryBuilder(pool as never, 'public_beacons')
      .select('id" FROM users; DROP TABLE projects; --')

    const result = await qb

    // Must NOT execute any SQL — validation error returned instead
    expect(calls.length).toBe(0)
    expect(result.error).not.toBeNull()
    expect(result.data).toBeNull()
    expect(result.error!.message).toMatch(/Invalid column/i)
  })

  it('blocks semicolon/quote payloads on the first column', async () => {
    const { pool, calls } = makePool()
    const result = await new QueryBuilder(pool as never, 'benchmarks')
      .select('id; DROP TABLE users; --')

    expect(calls.length).toBe(0)
    expect(result.error).not.toBeNull()
  })

  it('blocks injected aliases (col AS alias breakout)', async () => {
    const { pool, calls } = makePool()
    const result = await new QueryBuilder(pool as never, 'benchmarks')
      .select('id, name AS "x; DROP TABLE projects; --"')

    expect(calls.length).toBe(0)
    expect(result.error).not.toBeNull()
  })

  it('blocks malicious function-expression columns', async () => {
    const { pool, calls } = makePool()
    const result = await new QueryBuilder(pool as never, 'benchmarks')
      .select('count(*) as c; DROP TABLE users; --')

    expect(calls.length).toBe(0)
    expect(result.error).not.toBeNull()
  })

  it('blocks spaces and schema-dot abuse beyond the allowlist', async () => {
    const { pool, calls } = makePool()
    // `public.users` is technically allowed (schema-qualified), but a second
    // dot or whitespace must be rejected.
    const result = await new QueryBuilder(pool as never, 'benchmarks')
      .select('a.b.c')

    expect(calls.length).toBe(0)
    expect(result.error).not.toBeNull()
  })
})

describe('VULN-001: limit/offset injection is blocked', () => {
  // NOTE: limit()/range() validate synchronously at the setter (same pattern
  // as validateIdentifier in eq()/order()), so these throw rather than
  // returning { data: null, error }. Both paths are safe — no SQL runs.
  it('rejects string limit payloads (e.g. "1; DROP TABLE users")', () => {
    const { pool, calls } = makePool()
    expect(() => {
      new QueryBuilder(pool as never, 'benchmarks')
        .select('id')
        .limit('1; DROP TABLE users' as unknown as number)
    }).toThrow(/Invalid LIMIT/)
    expect(calls.length).toBe(0)
  })

  it('rejects string offset payloads', () => {
    const { pool, calls } = makePool()
    expect(() => {
      new QueryBuilder(pool as never, 'benchmarks')
        .select('id')
        .range('0; DROP TABLE users' as unknown as number, 50)
    }).toThrow()
    expect(calls.length).toBe(0)
  })

  it('rejects negative and fractional values', () => {
    const { pool, calls } = makePool()
    expect(() => new QueryBuilder(pool as never, 'benchmarks').select('id').limit(-1)).toThrow(/Invalid LIMIT/)
    expect(() => new QueryBuilder(pool as never, 'benchmarks').select('id').limit(1.5)).toThrow(/Invalid LIMIT/)
    expect(() => new QueryBuilder(pool as never, 'benchmarks').select('id').range(-1, 5)).toThrow(/Invalid OFFSET/)
    expect(calls.length).toBe(0)
  })
})

describe('legitimate select-column shapes still work', () => {
  it('selects * unmodified', async () => {
    const { pool, calls } = makePool()
    await new QueryBuilder(pool as never, 'benchmarks').select('*')
    expect(calls[0].sql).toBe('SELECT * FROM "benchmarks"')
  })

  it('selects a plain column list', async () => {
    const { pool, calls } = makePool()
    await new QueryBuilder(pool as never, 'benchmarks').select('id, name, location')
    expect(calls[0].sql).toBe('SELECT "id", "name", "location" FROM "benchmarks"')
  })

  it('supports schema-qualified columns', async () => {
    const { pool, calls } = makePool()
    await new QueryBuilder(pool as never, 'benchmarks').select('public.id')
    expect(calls[0].sql).toBe('SELECT "public.id" FROM "benchmarks"')
  })

  it('supports the TraverseModal alias shape (point_name as name)', async () => {
    const { pool, calls } = makePool()
    await new QueryBuilder(pool as never, 'survey_points')
      .select('id, point_name as name, easting, northing')
    expect(calls[0].sql).toBe(
      'SELECT "id", "point_name" AS "name", "easting", "northing" FROM "survey_points"'
    )
  })

  it('supports function columns like count(*)', async () => {
    const { pool, calls } = makePool()
    await new QueryBuilder(pool as never, 'benchmarks').select('count(*)')
    expect(calls[0].sql).toBe('SELECT COUNT(*) FROM "benchmarks"')
  })
})

describe('legitimate limit/offset still work', () => {
  it('emits LIMIT for a valid integer', async () => {
    const { pool, calls } = makePool()
    await new QueryBuilder(pool as never, 'benchmarks').select('id').limit(10)
    expect(calls[0].sql).toBe('SELECT "id" FROM "benchmarks" LIMIT 10')
  })

  it('accepts limit(0) as valid', async () => {
    const { pool, calls } = makePool()
    await new QueryBuilder(pool as never, 'benchmarks').select('id').limit(0)
    expect(calls[0].sql).toBe('SELECT "id" FROM "benchmarks" LIMIT 0')
  })

  it('emits OFFSET/LIMIT for a valid range', async () => {
    const { pool, calls } = makePool()
    await new QueryBuilder(pool as never, 'benchmarks').select('id').range(20, 29)
    expect(calls[0].sql).toBe('SELECT "id" FROM "benchmarks" LIMIT 10 OFFSET 20')
  })
})

describe('upsert column keys are validated (upsert hardening)', () => {
  it('blocks a malicious column key in the upsert payload', async () => {
    const { pool, calls } = makePool()
    // `id" = "1" OR "owner_id` would previously break out of the quoted
    // identifier in both the column list and the EXCLUDED.* update set.
    const qb = new QueryBuilder(pool as never, 'projects').upsert(
      { 'id" = "1" OR "owner_id': 1, name: 'x' } as Record<string, unknown>,
      { onConflict: 'id' }
    )

    const result = await qb
    expect(calls.length).toBe(0)
    expect(result.error).not.toBeNull()
    expect(result.data).toBeNull()
    expect(result.error!.message).toMatch(/Invalid column/i)
  })

  it('blocks a malicious onConflict column synchronously at the setter', () => {
    const { pool, calls } = makePool()
    expect(() => {
      new QueryBuilder(pool as never, 'projects').upsert(
        { id: 1 },
        { onConflict: 'id; DROP TABLE projects; --' }
      )
    }).toThrow(/Invalid column/i)
    expect(calls.length).toBe(0)
  })

  it('emits a correct ON CONFLICT upsert for legitimate payloads', async () => {
    const { pool, calls } = makePool()
    const result = await new QueryBuilder(pool as never, 'projects').upsert(
      { id: 7, name: 'Test' },
      { onConflict: 'id' }
    )

    expect(result.error).toBeNull()
    expect(calls.length).toBe(1)
    expect(calls[0].sql).toContain('ON CONFLICT ("id") DO UPDATE SET')
    expect(calls[0].sql).toContain('"name" = EXCLUDED."name"')
    // the conflict column must be excluded from the DO UPDATE SET list
    expect(calls[0].sql).not.toContain('"id" = EXCLUDED."id"')
    expect(calls[0].sql).toContain('VALUES ($1, $2)')
  })

  it('multi-row upsert validates every row against the first row\'s keys', async () => {
    const { pool, calls } = makePool()
    const qb = new QueryBuilder(pool as never, 'projects').upsert(
      [{ id: 1, name: 'a' }, { id: 2, name: 'b' }],
      { onConflict: 'id' }
    )

    const result = await qb
    expect(result.error).toBeNull()
    expect(calls.length).toBe(1)
    expect(calls[0].sql).toContain('VALUES ($1, $2), ($3, $4)')
  })

  it('emits a correct multi-column ON CONFLICT for comma-separated targets', async () => {
    // Regression: VULN-002 hardening ran the WHOLE onConflict string through
    // validateIdentifier(), which rejected commas — so real multi-column
    // conflicts like 'project_id,row_index' (DynamicFieldBook, useFieldBook,
    // SubmissionClient, parcelVault) threw before any SQL was built.
    const { pool, calls } = makePool()
    const result = await new QueryBuilder(pool as never, 'project_fieldbook_entries').upsert(
      { project_id: 1, row_index: 2, raw_data: { x: 1 } },
      { onConflict: 'project_id,row_index' }
    )

    expect(result.error).toBeNull()
    expect(calls.length).toBe(1)
    expect(calls[0].sql).toContain('ON CONFLICT ("project_id", "row_index")')
    // both conflict columns must be excluded from the DO UPDATE SET list
    expect(calls[0].sql).not.toContain('"project_id" = EXCLUDED."project_id"')
    expect(calls[0].sql).not.toContain('"row_index" = EXCLUDED."row_index"')
    expect(calls[0].sql).toContain('"raw_data" = EXCLUDED."raw_data"')
  })

  it('allows whitespace around comma-separated conflict columns', async () => {
    const { pool, calls } = makePool()
    const result = await new QueryBuilder(pool as never, 'parcel_vault').upsert(
      { user_id: 'u1', parcel_number: 'LR 1/2', area_sqm: 100 },
      { onConflict: 'user_id, parcel_number' }
    )

    expect(result.error).toBeNull()
    expect(calls.length).toBe(1)
    expect(calls[0].sql).toContain('ON CONFLICT ("user_id", "parcel_number")')
  })

  it('blocks injection smuggled through a multi-column onConflict', () => {
    const { pool, calls } = makePool()
    // First part legit, second part a breakout attempt:
    //   `id"; DROP TABLE projects; --` must not reach SQL as a bare identifier.
    expect(() => {
      new QueryBuilder(pool as never, 'projects').upsert(
        { id: 1, name: 'x' },
        { onConflict: 'id"; DROP TABLE projects; --, name' }
      )
    }).toThrow(/Invalid column/i)
    expect(calls.length).toBe(0)
  })

  it('rejects empty/blank conflict segments', () => {
    const { pool, calls } = makePool()
    expect(() => {
      new QueryBuilder(pool as never, 'projects').upsert(
        { id: 1, name: 'x' },
        { onConflict: 'id,' }
      )
    }).toThrow(/Invalid column/i)
    expect(calls.length).toBe(0)
  })

  it('falls back to DO NOTHING when every payload column is a conflict column', async () => {
    const { pool, calls } = makePool()
    const result = await new QueryBuilder(pool as never, 'projects').upsert(
      { id: 1 },
      { onConflict: 'id' }
    )

    expect(result.error).toBeNull()
    expect(calls.length).toBe(1)
    expect(calls[0].sql).toContain('ON CONFLICT ("id") DO NOTHING')
  })
})

describe('or() / parseOrFilter column names are validated (VULN-002 extension)', () => {
  it('emits parameterized SQL for a legitimate or() fragment', async () => {
    const { pool, calls } = makePool()
    const result = await new QueryBuilder(pool as never, 'projects')
      .select('id, name')
      .or('status.eq.completed,name.eq.Test')

    expect(result.error).toBeNull()
    expect(calls.length).toBe(1)
    expect(calls[0].sql).toContain('("status" = $1 OR "name" = $2)')
    expect(calls[0].params).toEqual(['completed', 'Test'])
  })

  it('blocks a column breakout that matches the parser but fails the allowlist', async () => {
    const { pool, calls } = makePool()
    // `1col` matches the legacy `(\w+)` fragment regex but fails the strict
    // allowlist (identifiers must start with a letter or underscore) — the
    // validateIdentifier() routing rejects it before any SQL is built.
    const result = await new QueryBuilder(pool as never, 'projects')
      .select('id')
      .or('status.eq.completed,1col.eq.5')

    expect(calls.length).toBe(0)
    expect(result.error).not.toBeNull()
    expect(result.data).toBeNull()
    expect(result.error!.message).toMatch(/Invalid column/i)
  })

  it('drops quote/space breakout fragments so they never reach SQL', async () => {
    const { pool, calls } = makePool()
    // A `"` or `;` in the column position fails the fragment regex entirely,
    // so the malicious fragment is skipped — only the safe `status.eq.completed`
    // part is emitted, and no injected text appears in the query.
    const result = await new QueryBuilder(pool as never, 'projects')
      .select('id')
      .or('status.eq.completed,id"; DROP TABLE projects; --.eq.1')

    expect(result.error).toBeNull()
    expect(calls.length).toBe(1)
    expect(calls[0].sql).toContain('("status" = $1)')
    expect(calls[0].sql).not.toContain('DROP TABLE')
    expect(calls[0].params).toEqual(['completed'])
  })
})

describe('returningColumns is validated at execution (defense-in-depth)', () => {
  it('emits RETURNING * by default (the only value ever assigned)', async () => {
    const { pool, calls } = makePool()
    await new QueryBuilder(pool as never, 'benchmarks')
      .insert({ id: 1, name: 'x' })
    expect(calls[0].sql).toContain('RETURNING *')
  })

  it('rejects an injected returning column if one is ever set', async () => {
    // returningColumns is private and never settable today, but buildReturningColumns()
    // runs the strict allowlist so a future setter cannot open an interpolation hole.
    const { pool, calls } = makePool()
    const qb = new QueryBuilder(pool as never, 'benchmarks')
      .insert({ id: 1, name: 'x' })
    ;(qb as unknown as { returningColumns: string }).returningColumns =
      'id; DROP TABLE users; --'

    const result = await qb
    expect(calls.length).toBe(0)
    expect(result.error).not.toBeNull()
    expect(result.error!.message).toMatch(/Invalid column/i)
  })
})

describe('head+count skip path is safe (columns never reach SQL)', () => {
  it('head+count with malicious columns still emits only SELECT COUNT(*)', async () => {
    const { pool, calls } = makePool()
    // Same as community.ts / optimization.ts: select('id', { count:'exact', head:true })
    const result = await new QueryBuilder(pool as never, 'benchmarks')
      .select('id; DROP TABLE users; --', { count: 'exact', head: true })

    expect(result.error).toBeNull()
    expect(calls.length).toBe(1)
    expect(calls[0].sql).toBe('SELECT COUNT(*) as count FROM "benchmarks"')
  })
})
