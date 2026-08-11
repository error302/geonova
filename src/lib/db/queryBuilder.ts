/**
 * PostgreSQL Query Builder — DbClient-Compatible API
 *
 * Drop-in replacement for the legacy DbClient's `.from().select().eq()` chain.
 * Uses the existing `pg` Pool from db.ts for direct PostgreSQL queries.
 * Returns { data, error, count } matching the legacy response shape.
 *
 * ponytail: Phase 6 — replaced 43 `any` types with `unknown`, proper FilterOp
 * union, and typed generics. No behavior change.
 */

import { Pool } from 'pg'

// ponytail: Phase 6 Batch 3 — flipped default to Record<string, unknown> for
// type safety. Consumer files now cast explicitly via `as unknown as Type`.
// This surfaces previously-hidden type assumptions (real bugs fixed in this batch).
export interface QueryResult<T = Record<string, unknown>> {
  data: T | null
  error: { message: string; code: string; details?: string } | null
  count?: number | null
}

// ponytail: explicit FilterOp union — was string + `as any` casts
type FilterOp = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'LIKE' | 'ILIKE' | 'IN' | 'NOT_IN' | 'IS' | 'IS NOT' | '@>'

interface Filter {
  column: string
  op: FilterOp
  value: unknown
}

interface OrderClause {
  column: string
  ascending: boolean
}

// ponytail: Phase 6 Batch 3 — see QueryResult note above
export class QueryBuilder<T = Record<string, unknown>> {
  private pool: Pool
  private table: string
  private operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
  private selectColumns: string = '*'
  private filters: Filter[] = []
  private orFilters: string[] = []
  private orderClauses: OrderClause[] = []
  private limitCount: number | null = null
  private offsetCount: number | null = null
  private singleRow: boolean = false
  private maybeSingleRow: boolean = false
  private countOnly: boolean = false
  private headOnly: boolean = false
  // ponytail: payload shapes are Record<string, unknown> — builder doesn't need to know column types
  private insertPayload: Record<string, unknown> | Record<string, unknown>[] | null = null
  private updatePayload: Record<string, unknown> | null = null
  private upsertConflict: string = 'id'
  // SECURITY (2026-08-03): never set from any caller — always '*'. It is
  // re-validated at execution time by buildReturningColumns() so a future
  // setter can't introduce an interpolation hole.
  private returningColumns: string = '*'

  /**
   * Validate a SQL identifier (column or table name) against a strict
   * allowlist pattern. Prevents SQL injection via column-name
   * interpolation — e.g. an attacker posting
   * `{"column":"x\" = \"y\" OR \"user_id"}` to /api/db would otherwise
   * break out of the quoted identifier and inject arbitrary SQL.
   *
   * Allowed: letters, digits, underscores. Optionally a single dot
   * for schema-qualified names (e.g. "public.users"). Rejects
   * anything containing quotes, semicolons, spaces, or special chars.
   *
   * @throws {Error} if the identifier contains anything outside
   *   [A-Za-z0-9_.]
   */
  private validateIdentifier(name: string, kind: 'column' | 'table'): string {
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error(`Invalid ${kind} identifier: empty or non-string`)
    }
    // Allow schema.table (one dot max), alphanumeric + underscore only
    if (!/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/.test(name)) {
      throw new Error(
        `Invalid ${kind} identifier "${name}": only letters, digits, underscores, and an optional schema-qualifying dot are allowed`
      )
    }
    return name
  }

  constructor(pool: Pool, table: string) {
    this.pool = pool
    this.table = this.validateIdentifier(table, 'table')
  }

  select(columns: string = '*', options?: { count?: string; head?: boolean }): this {
    this.operation = 'select'
    this.selectColumns = columns
    if (options?.count === 'exact') this.countOnly = true
    if (options?.head) this.headOnly = true
    return this
  }

  insert(data: Record<string, unknown> | Record<string, unknown>[]): this {
    this.operation = 'insert'
    this.insertPayload = data
    return this
  }

  update(data: Record<string, unknown>): this {
    this.operation = 'update'
    this.updatePayload = data
    return this
  }

  upsert(data: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }): this {
    this.operation = 'upsert'
    this.insertPayload = data
    if (options?.onConflict) {
      // ON CONFLICT supports comma-separated multi-column targets
      // (e.g. 'user_id,parcel_number', 'project_id,row_index'). Validate
      // EVERY identifier so an injection like `id"; DROP TABLE x; --` is
      // still rejected synchronously, while legitimate multi-column
      // conflict targets keep working. VULN-002 regression fix (2026-08-03):
      // previously the whole string was run through validateIdentifier(),
      // which rejected commas and threw on every multi-column conflict.
      this.upsertConflict = options.onConflict
        .split(',')
        .map((c) => this.validateIdentifier(c.trim(), 'column'))
        .join(',')
    }
    return this
  }

  delete(): this {
    this.operation = 'delete'
    return this
  }

  // ponytail: filter values are `unknown` — the builder just serializes them to SQL params
  eq(column: string, value: unknown): this {
    this.filters.push({ column: this.validateIdentifier(column, 'column'), op: '=', value })
    return this
  }

  neq(column: string, value: unknown): this {
    this.filters.push({ column: this.validateIdentifier(column, 'column'), op: '!=', value })
    return this
  }

  gt(column: string, value: unknown): this {
    this.filters.push({ column: this.validateIdentifier(column, 'column'), op: '>', value })
    return this
  }

  gte(column: string, value: unknown): this {
    this.filters.push({ column: this.validateIdentifier(column, 'column'), op: '>=', value })
    return this
  }

  lt(column: string, value: unknown): this {
    this.filters.push({ column: this.validateIdentifier(column, 'column'), op: '<', value })
    return this
  }

  lte(column: string, value: unknown): this {
    this.filters.push({ column: this.validateIdentifier(column, 'column'), op: '<=', value })
    return this
  }

  like(column: string, pattern: string): this {
    this.filters.push({ column: this.validateIdentifier(column, 'column'), op: 'LIKE', value: pattern })
    return this
  }

  ilike(column: string, pattern: string): this {
    this.filters.push({ column: this.validateIdentifier(column, 'column'), op: 'ILIKE', value: pattern })
    return this
  }

  in(column: string, values: unknown[]): this {
    this.filters.push({ column: this.validateIdentifier(column, 'column'), op: 'IN', value: values })
    return this
  }

  is(column: string, value: unknown): this {
    const col = this.validateIdentifier(column, 'column')
    if (value === null) {
      this.filters.push({ column: col, op: 'IS', value: null })
    } else {
      this.filters.push({ column: col, op: 'IS NOT', value: null })
    }
    return this
  }

  not(column: string, op: string, value: unknown): this {
    const col = this.validateIdentifier(column, 'column')
    if (op === 'eq') this.filters.push({ column: col, op: '!=', value })
    else if (op === 'is') this.filters.push({ column: col, op: 'IS NOT', value })
    else if (op === 'in') {
      this.filters.push({ column: col, op: 'NOT_IN', value })
    }
    return this
  }

  or(filter: string): this {
    // NOTE: `filter` is a raw SQL fragment. Callers must not interpolate
    // user input into it. This is the one escape hatch for complex OR
    // conditions; use sparingly and never with untrusted column names.
    //
    // SECURITY (2026-08-03): parseOrFilter() validates every column name
    // through validateIdentifier() and parameterizes every value before
    // the fragment is emitted, so even attacker-supplied orFilters (e.g.
    // from /api/db) cannot break out of the quoted identifiers.
    this.orFilters.push(filter)
    return this
  }

  contains(column: string, value: unknown): this {
    this.filters.push({ column: this.validateIdentifier(column, 'column'), op: '@>', value })
    return this
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderClauses.push({ column: this.validateIdentifier(column, 'column'), ascending: options?.ascending ?? true })
    return this
  }

  limit(count: number): this {
    this.limitCount = this.coerceNonNegativeInt(count, 'LIMIT')
    return this
  }

  range(from: number, to: number): this {
    this.offsetCount = this.coerceNonNegativeInt(from, 'OFFSET')
    this.limitCount = this.coerceNonNegativeInt(to - from + 1, 'LIMIT')
    return this
  }

  // ponytail: single()/maybeSingle() return `this` so chaining works, but also
  // need to be thenable. The `as unknown as` cast is the minimum needed —
  // the builder is thenable via the `then` method below.
  single(): PromiseLike<QueryResult<T>> & this {
    this.singleRow = true
    return this as unknown as PromiseLike<QueryResult<T>> & this
  }

  maybeSingle(): PromiseLike<QueryResult<T | null>> & this {
    this.maybeSingleRow = true
    return this as unknown as PromiseLike<QueryResult<T | null>> & this
  }

  // Make the builder thenable so `await dbClient.from('x').select('*')` works
  then<TResult1 = QueryResult<T>, TResult2 = never>(
    resolve?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(resolve, reject)
  }

  private buildWhereClause(params: unknown[]): string {
    if (this.filters.length === 0 && this.orFilters.length === 0) return ''

    const conditions: string[] = []

    for (const f of this.filters) {
      if (f.op === 'IS') {
        conditions.push(`"${f.column}" IS NULL`)
      } else if (f.op === 'IS NOT') {
        conditions.push(`"${f.column}" IS NOT NULL`)
      } else if (f.op === 'IN' || f.op === 'NOT_IN') {
        const values = (f.value as unknown[]).map((v) => {
          params.push(v)
          return `$${params.length}`
        })
        const operator = f.op === 'IN' ? 'IN' : 'NOT IN'
        conditions.push(`"${f.column}" ${operator} (${values.join(', ')})`)
      } else if (f.op === '@>') {
        params.push(JSON.stringify(f.value))
        conditions.push(`"${f.column}" @> $${params.length}::jsonb`)
      } else {
        params.push(f.value)
        conditions.push(`"${f.column}" ${f.op} $${params.length}`)
      }
    }

    // Handle raw OR filters (legacy-style: "col.eq.val,col2.eq.val2")
    for (const orFilter of this.orFilters) {
      const parsed = this.parseOrFilter(orFilter, params)
      if (parsed) conditions.push(`(${parsed})`)
    }

    return conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''
  }

  private parseOrFilter(filter: string, params: unknown[]): string | null {
    const parts = filter.split(',')
    const orParts: string[] = []

    for (const part of parts) {
      const match = part.trim().match(/^(\w+)\.(\w+)\.(.+)$/)
      if (match) {
        // SECURITY (2026-08-03): route the column through the same strict
        // allowlist as every other identifier — the regex above already
        // excludes quotes/spaces, but validateIdentifier() is defense-
        // in-depth so future regex loosening can't silently open a hole.
        const col = this.validateIdentifier(match[1], 'column')
        const op = match[2]
        const val = match[3]
        if (op === 'eq') {
          params.push(val === 'null' ? null : val)
          if (val === 'null') {
            orParts.push(`"${col}" IS NULL`)
          } else {
            orParts.push(`"${col}" = $${params.length}`)
          }
        } else if (op === 'neq') {
          params.push(val)
          orParts.push(`"${col}" != $${params.length}`)
        } else if (op === 'gt') {
          params.push(val)
          orParts.push(`"${col}" > $${params.length}`)
        } else if (op === 'lt') {
          params.push(val)
          orParts.push(`"${col}" < $${params.length}`)
        } else if (op === 'ilike') {
          params.push(val)
          orParts.push(`"${col}" ILIKE $${params.length}`)
        }
      }
    }

    return orParts.length > 0 ? orParts.join(' OR ') : null
  }

  /**
   * Build the SELECT column list from a comma-separated string, validating
   * every identifier against the strict allowlist.
   *
   * VULN-001 FIX (security review 2026-08-03): Previously the columns were
   * only wrapped in double quotes with no validation, so a payload like
   * `id" FROM users; DROP TABLE projects; --` broke out of the quoted
   * identifier and executed arbitrary SQL (simple query protocol allows
   * multi-statement when no params are bound).
   *
   * Supported shapes (each identifier validated):
   *   - `*`
   *   - `col` (single-arg function calls like `count(*)`, `max(easting)` are
   *     also accepted; multi-arg calls like `count(a, b)` are rejected since
   *     no current caller needs them and splitting on commas is unsafe)
   *   - `col AS alias` (used by TraverseModal)
   *
   * NOTE: the allowlist permits one dot ("schema.col"), but the emitted SQL
   * quotes the whole token as a single identifier (`"public.id"`), so it is
   * a literal column name — same as the pre-fix behavior.
   *
   * @throws {Error} on any invalid identifier
   */
  private buildSelectColumns(columns: string): string {
    if (columns === '*') return '*'
    return columns.split(',').map((c) => {
      const trimmed = c.trim()
      if (trimmed === '') throw new Error('Invalid column: empty column in select list')
      if (trimmed === '*') return '*'

      // Handle `col AS alias` (e.g. "point_name as name" in TraverseModal)
      const asMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_.]*)\s+AS\s+([A-Za-z_][A-Za-z0-9_]*)$/i)
      if (asMatch) {
        const col = this.validateIdentifier(asMatch[1].trim(), 'column')
        const alias = this.validateIdentifier(asMatch[2].trim(), 'column')
        return `"${col}" AS "${alias}"`
      }

      // Handle function calls: count(*), max(easting), etc.
      if (trimmed.includes('(')) {
        const fnMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)$/)
        if (!fnMatch) {
          throw new Error(`Invalid column "${trimmed}": malformed expression`)
        }
        const fnName = this.validateIdentifier(fnMatch[1].trim(), 'column')
        const inner = fnMatch[2].trim()
        if (inner === '') {
          throw new Error(`Invalid column "${trimmed}": empty function arguments`)
        }
        const args = inner.split(',').map((a) => {
          const arg = a.trim()
          if (arg === '') throw new Error(`Invalid column "${trimmed}": empty argument`)
          if (arg === '*') return '*'
          return `"${this.validateIdentifier(arg, 'column')}"`
        })
        return `${fnName.toUpperCase()}(${args.join(', ')})`
      }

      return `"${this.validateIdentifier(trimmed, 'column')}"`
    }).join(', ')
  }

  /**
   * Validate the RETURNING column list at execution time (defense-in-depth).
   * '*' (the only value ever assigned today) passes through untouched;
   * anything else runs the same strict allowlist used for SELECT columns,
   * so a future caller could not interpolate attacker SQL into RETURNING.
   */
  private buildReturningColumns(): string {
    if (this.returningColumns === '*') return '*'
    return this.buildSelectColumns(this.returningColumns)
  }

  /**
   * VULN-001 FIX: coerce LIMIT/OFFSET values to a non-negative integer.
   * The /api/db proxy typed these as `number` but the raw JSON body can
   * carry anything (e.g. `"1; DROP TABLE users"` or `1.5`) — interpolating
   * those raw would be SQL injection / invalid SQL.
   *
   * @throws {Error} if the value is not a non-negative integer
   */
  private coerceNonNegativeInt(value: unknown, label: 'LIMIT' | 'OFFSET'): number {
    const n = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      throw new Error(`Invalid ${label}: must be a non-negative integer`)
    }
    return n
  }

  private buildOrderClause(): string {
    if (this.orderClauses.length === 0) return ''
    const parts = this.orderClauses.map((o) => `"${o.column}" ${o.ascending ? 'ASC' : 'DESC'}`)
    return ` ORDER BY ${parts.join(', ')}`
  }

  private buildLimitOffset(): string {
    let sql = ''
    // Defense-in-depth: re-validate even though the setters already coerce,
    // so any future code path that writes limitCount/offsetCount is safe too.
    if (this.limitCount !== null) sql += ` LIMIT ${this.coerceNonNegativeInt(this.limitCount, 'LIMIT')}`
    if (this.offsetCount !== null) sql += ` OFFSET ${this.coerceNonNegativeInt(this.offsetCount, 'OFFSET')}`
    return sql
  }

  private async execute(): Promise<QueryResult<T>> {
    try {
      switch (this.operation) {
        case 'select': return await this.executeSelect()
        case 'insert': return await this.executeInsert()
        case 'update': return await this.executeUpdate()
        case 'delete': return await this.executeDelete()
        case 'upsert': return await this.executeUpsert()
        default: return { data: null, error: { message: `Unknown operation: ${this.operation}`, code: 'UNKNOWN_OP' } }
      }
    } catch (err: unknown) {
      // ponytail: was `catch (err: unknown)` — now properly narrowed
      const pgErr = err as { message?: string; code?: string; detail?: string }
      return {
        data: null,
        error: {
          message: pgErr.message || 'Database query failed',
          code: pgErr.code || 'QUERY_ERROR',
          details: pgErr.detail,
        },
      }
    }
  }

  private async executeSelect(): Promise<QueryResult<T>> {
    const params: unknown[] = []

    if (this.headOnly && this.countOnly) {
      // NOTE: head+count (used by e.g. community.ts, optimization.ts) never
      // touches selectColumns, so buildSelectColumns() is intentionally
      // skipped here — nothing user-controlled is interpolated into SQL.
      const sql = `SELECT COUNT(*) as count FROM "${this.table}"${this.buildWhereClause(params)}`
      const result = await this.pool.query(sql, params as unknown[])
      const count = parseInt((result.rows[0] as { count?: string } | undefined)?.count ?? '0', 10)
      return { data: null, error: null, count }
    }

    // VULN-001 FIX: validate every select column (throws → caught by execute()
    // and returned as a structured { data: null, error } instead of executing
    // attacker-controlled SQL).
    const columns = this.buildSelectColumns(this.selectColumns)

    let sql = `SELECT ${columns} FROM "${this.table}"`
    sql += this.buildWhereClause(params)
    sql += this.buildOrderClause()
    sql += this.buildLimitOffset()

    if (this.singleRow || this.maybeSingleRow) {
      sql += this.limitCount === null ? ' LIMIT 1' : ''
    }

    const result = await this.pool.query(sql, params as unknown[])

    if (this.countOnly) {
      const countParams: unknown[] = []
      const countSql = `SELECT COUNT(*) as count FROM "${this.table}"${this.buildWhereClause(countParams)}`
      const countResult = await this.pool.query(countSql, countParams as unknown[])
      const count = parseInt((countResult.rows[0] as { count?: string } | undefined)?.count ?? '0', 10)

      if (this.singleRow) {
        if (result.rows.length === 0) {
          return { data: null, error: { message: 'Row not found', code: 'PGRST116' }, count }
        }
        return { data: result.rows[0] as T, error: null, count }
      }

      return { data: result.rows as T, error: null, count }
    }

    if (this.singleRow) {
      if (result.rows.length === 0) {
        return { data: null, error: { message: 'Row not found', code: 'PGRST116' } }
      }
      return { data: result.rows[0] as T, error: null }
    }

    if (this.maybeSingleRow) {
      return { data: (result.rows[0] ?? null) as T, error: null }
    }

    return { data: result.rows as T, error: null }
  }

  private async executeInsert(): Promise<QueryResult<T>> {
    if (!this.insertPayload) return { data: null, error: null }
    const rows = Array.isArray(this.insertPayload) ? this.insertPayload : [this.insertPayload]
    if (rows.length === 0) return { data: null, error: null }

    const columns = Object.keys(rows[0]).map((c) => this.validateIdentifier(c, 'column'))
    const params: unknown[] = []
    const valuesList: string[] = []

    for (const row of rows) {
      const placeholders: string[] = []
      for (const col of columns) {
        params.push(row[col] !== undefined ? row[col] : null)
        placeholders.push(`$${params.length}`)
      }
      valuesList.push(`(${placeholders.join(', ')})`)
    }

    const quotedColumns = columns.map((c) => `"${c}"`).join(', ')
    const sql = `INSERT INTO "${this.table}" (${quotedColumns}) VALUES ${valuesList.join(', ')} RETURNING ${this.buildReturningColumns()}`

    const result = await this.pool.query(sql, params as unknown[])
    const data = Array.isArray(this.insertPayload) ? (result.rows as unknown as T) : ((result.rows[0] ?? null) as unknown as T)
    return { data, error: null }
  }

  private async executeUpdate(): Promise<QueryResult<T>> {
    if (!this.updatePayload) return { data: null, error: { message: 'No data to update', code: 'NO_DATA' } }

    const params: unknown[] = []
    const setClauses: string[] = []

    for (const [key, value] of Object.entries(this.updatePayload)) {
      const col = this.validateIdentifier(key, 'column')
      params.push(value)
      setClauses.push(`"${col}" = $${params.length}`)
    }

    let sql = `UPDATE "${this.table}" SET ${setClauses.join(', ')}`
    sql += this.buildWhereClause(params)
    sql += ` RETURNING ${this.buildReturningColumns()}`

    const result = await this.pool.query(sql, params as unknown[])

    if (this.singleRow || this.maybeSingleRow) {
      return { data: (result.rows[0] ?? null) as T, error: null }
    }
    return { data: result.rows as T, error: null }
  }

  private async executeDelete(): Promise<QueryResult<T>> {
    const params: unknown[] = []
    let sql = `DELETE FROM "${this.table}"`
    sql += this.buildWhereClause(params)
    sql += ` RETURNING ${this.buildReturningColumns()}`

    const result = await this.pool.query(sql, params as unknown[])
    return { data: result.rows as T, error: null }
  }

  private async executeUpsert(): Promise<QueryResult<T>> {
    if (!this.insertPayload) return { data: null, error: null }
    const rows = Array.isArray(this.insertPayload) ? this.insertPayload : [this.insertPayload]
    if (rows.length === 0) return { data: null, error: null }

    // VULN-002 hardening (upsert path): validate every payload column key —
    // previously only insert()/update() validated, so a malicious key like
    // `id" = "1" OR "owner_id` broke out of the quoted identifier in both the
    // column list and the EXCLUDED.* update set. The onConflict column is
    // already validated at the upsert() setter.
    const columns = Object.keys(rows[0]).map((c) => this.validateIdentifier(c, 'column'))
    const params: unknown[] = []
    const valuesList: string[] = []

    for (const row of rows) {
      const placeholders: string[] = []
      for (const col of columns) {
        params.push(row[col] !== undefined ? row[col] : null)
        placeholders.push(`$${params.length}`)
      }
      valuesList.push(`(${placeholders.join(', ')})`)
    }

    const quotedColumns = columns.map((c) => `"${c}"`).join(', ')
    // The conflict target may be multi-column ('a,b') — split and quote each
    // identifier separately so the emitted SQL is `ON CONFLICT ("a", "b")`
    // rather than one quoted identifier containing commas.
    const conflictCols = this.upsertConflict.split(',').map((c) => c.trim())
    const quotedConflict = conflictCols.map((c) => `"${c}"`).join(', ')
    const conflictSet = new Set(conflictCols)
    const updateCols = columns.filter((c) => !conflictSet.has(c))
    const updateSet = updateCols.map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ')
    // Degenerate case: every payload column is a conflict column — DO NOTHING
    // is valid SQL where `DO UPDATE SET ` (empty) would not be.
    const conflictAction = updateSet ? `DO UPDATE SET ${updateSet}` : 'DO NOTHING'

    const sql = `INSERT INTO "${this.table}" (${quotedColumns}) VALUES ${valuesList.join(', ')} ON CONFLICT (${quotedConflict}) ${conflictAction} RETURNING ${this.buildReturningColumns()}`

    const result = await this.pool.query(sql, params as unknown[])
    const data = Array.isArray(this.insertPayload) ? (result.rows as unknown as T) : ((result.rows[0] ?? null) as unknown as T)
    return { data, error: null }
  }
}

export function createQueryBuilder(pool: Pool) {
  return {
    from(table: string): QueryBuilder {
      return new QueryBuilder(pool, table)
    },
  }
}
