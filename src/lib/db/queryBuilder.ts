/**
 * PostgreSQL Query Builder — Supabase-Compatible API
 * 
 * Drop-in replacement for Supabase's `.from().select().eq()` chain.
 * Uses the existing `pg` Pool from db.ts for direct PostgreSQL queries.
 * Returns { data, error, count } matching Supabase's response shape.
 */

import { Pool } from 'pg'

export interface QueryResult<T = any> {
  data: T | null
  error: { message: string; code: string; details?: string } | null
  count?: number | null
}

type FilterOp = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'LIKE' | 'ILIKE' | 'IN' | 'IS' | 'IS NOT'

interface Filter {
  column: string
  op: FilterOp
  value: any
}

interface OrderClause {
  column: string
  ascending: boolean
}

export class QueryBuilder<T = any> {
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
  private insertPayload: any = null
  private updatePayload: any = null
  private upsertConflict: string = 'id'
  private returningColumns: string = '*'

  constructor(pool: Pool, table: string) {
    this.pool = pool
    this.table = table
  }

  select(columns: string = '*', options?: { count?: string; head?: boolean }): this {
    this.operation = 'select'
    this.selectColumns = columns
    if (options?.count === 'exact') this.countOnly = true
    if (options?.head) this.headOnly = true
    return this
  }

  insert(data: Record<string, any> | Record<string, any>[]): this {
    this.operation = 'insert'
    this.insertPayload = data
    return this
  }

  update(data: Record<string, any>): this {
    this.operation = 'update'
    this.updatePayload = data
    return this
  }

  upsert(data: Record<string, any> | Record<string, any>[], options?: { onConflict?: string }): this {
    this.operation = 'upsert'
    this.insertPayload = data
    if (options?.onConflict) this.upsertConflict = options.onConflict
    return this
  }

  delete(): this {
    this.operation = 'delete'
    return this
  }

  eq(column: string, value: any): this {
    this.filters.push({ column, op: '=', value })
    return this
  }

  neq(column: string, value: any): this {
    this.filters.push({ column, op: '!=', value })
    return this
  }

  gt(column: string, value: any): this {
    this.filters.push({ column, op: '>', value })
    return this
  }

  gte(column: string, value: any): this {
    this.filters.push({ column, op: '>=', value })
    return this
  }

  lt(column: string, value: any): this {
    this.filters.push({ column, op: '<', value })
    return this
  }

  lte(column: string, value: any): this {
    this.filters.push({ column, op: '<=', value })
    return this
  }

  like(column: string, pattern: string): this {
    this.filters.push({ column, op: 'LIKE', value: pattern })
    return this
  }

  ilike(column: string, pattern: string): this {
    this.filters.push({ column, op: 'ILIKE', value: pattern })
    return this
  }

  in(column: string, values: any[]): this {
    this.filters.push({ column, op: 'IN', value: values })
    return this
  }

  is(column: string, value: any): this {
    if (value === null) {
      this.filters.push({ column, op: 'IS', value: null })
    } else {
      this.filters.push({ column, op: 'IS NOT', value: null })
    }
    return this
  }

  not(column: string, op: string, value: any): this {
    // Map Supabase's .not() to negated filters
    if (op === 'eq') this.filters.push({ column, op: '!=', value })
    else if (op === 'is') this.filters.push({ column, op: 'IS NOT', value })
    else if (op === 'in') {
      // NOT IN
      this.filters.push({ column, op: 'NOT_IN' as any, value })
    }
    return this
  }

  or(filter: string): this {
    this.orFilters.push(filter)
    return this
  }

  contains(column: string, value: any): this {
    // For JSONB contains or array contains
    this.filters.push({ column, op: '@>', value } as any)
    return this
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderClauses.push({ column, ascending: options?.ascending ?? true })
    return this
  }

  limit(count: number): this {
    this.limitCount = count
    return this
  }

  range(from: number, to: number): this {
    this.offsetCount = from
    this.limitCount = to - from + 1
    return this
  }

  single(): PromiseLike<QueryResult<T>> & this {
    this.singleRow = true
    return this as any
  }

  maybeSingle(): PromiseLike<QueryResult<T | null>> & this {
    this.maybeSingleRow = true
    return this as any
  }

  // Make the builder thenable so `await supabase.from('x').select('*')` works
  then<TResult1 = QueryResult<T>, TResult2 = never>(
    resolve?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(resolve, reject)
  }

  private buildWhereClause(params: any[]): string {
    if (this.filters.length === 0 && this.orFilters.length === 0) return ''

    const conditions: string[] = []

    for (const f of this.filters) {
      if (f.op === 'IS') {
        conditions.push(`"${f.column}" IS NULL`)
      } else if (f.op === 'IS NOT') {
        conditions.push(`"${f.column}" IS NOT NULL`)
      } else if (f.op === 'IN' || (f.op as any) === 'NOT_IN') {
        const placeholders = (f.value as any[]).map((v) => {
          params.push(v)
          return `$${params.length}`
        })
        const operator = f.op === 'IN' ? 'IN' : 'NOT IN'
        conditions.push(`"${f.column}" ${operator} (${placeholders.join(', ')})`)
      } else if ((f as any).op === '@>') {
        params.push(JSON.stringify(f.value))
        conditions.push(`"${f.column}" @> $${params.length}::jsonb`)
      } else {
        params.push(f.value)
        conditions.push(`"${f.column}" ${f.op} $${params.length}`)
      }
    }

    // Handle raw OR filters (Supabase-style: "col.eq.val,col2.eq.val2")
    for (const orFilter of this.orFilters) {
      const parsed = this.parseOrFilter(orFilter, params)
      if (parsed) conditions.push(`(${parsed})`)
    }

    return conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''
  }

  private parseOrFilter(filter: string, params: any[]): string | null {
    // Parse Supabase-style OR filter: "status.eq.active,status.eq.pending"
    const parts = filter.split(',')
    const orParts: string[] = []

    for (const part of parts) {
      const match = part.trim().match(/^(\w+)\.(\w+)\.(.+)$/)
      if (match) {
        const [, col, op, val] = match
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

  private buildOrderClause(): string {
    if (this.orderClauses.length === 0) return ''
    const parts = this.orderClauses.map((o: any) => `"${o.column}" ${o.ascending ? 'ASC' : 'DESC'}`)
    return ` ORDER BY ${parts.join(', ')}`
  }

  private buildLimitOffset(): string {
    let sql = ''
    if (this.limitCount !== null) sql += ` LIMIT ${this.limitCount}`
    if (this.offsetCount !== null) sql += ` OFFSET ${this.offsetCount}`
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
    } catch (err: any) {
      return {
        data: null,
        error: {
          message: err.message || 'Database query failed',
          code: err.code || 'QUERY_ERROR',
          details: err.detail,
        },
      }
    }
  }

  private async executeSelect(): Promise<QueryResult<T>> {
    const params: any[] = []

    if (this.headOnly && this.countOnly) {
      const sql = `SELECT COUNT(*) as count FROM "${this.table}"${this.buildWhereClause(params)}`
      const result = await this.pool.query(sql, params)
      const count = parseInt(result.rows[0]?.count ?? '0', 10)
      return { data: null, error: null, count }
    }

    const columns = this.selectColumns === '*' ? '*' : this.selectColumns.split(',').map((c: any) => {
      const trimmed = c.trim()
      // Handle nested selects like "projects(*)" — flatten to just the column
      if (trimmed.includes('(')) return `"${trimmed.split('(')[0].trim()}"`
      if (trimmed === 'id' || trimmed === '*') return trimmed
      return `"${trimmed}"`
    }).join(', ')

    let sql = `SELECT ${columns} FROM "${this.table}"`
    sql += this.buildWhereClause(params)
    sql += this.buildOrderClause()
    sql += this.buildLimitOffset()

    if (this.singleRow || this.maybeSingleRow) {
      sql += this.limitCount === null ? ' LIMIT 1' : ''
    }

    const result = await this.pool.query(sql, params)

    if (this.countOnly) {
      // Also get the count
      const countParams: any[] = []
      const countSql = `SELECT COUNT(*) as count FROM "${this.table}"${this.buildWhereClause(countParams)}`
      const countResult = await this.pool.query(countSql, countParams)
      const count = parseInt(countResult.rows[0]?.count ?? '0', 10)

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
    const rows = Array.isArray(this.insertPayload) ? this.insertPayload : [this.insertPayload]
    if (rows.length === 0) return { data: null, error: null }

    const columns = Object.keys(rows[0])
    const params: any[] = []
    const valuesList: string[] = []

    for (const row of rows) {
      const placeholders: string[] = []
      for (const col of columns) {
        params.push(row[col] !== undefined ? row[col] : null)
        placeholders.push(`$${params.length}`)
      }
      valuesList.push(`(${placeholders.join(', ')})`)
    }

    const quotedColumns = columns.map((c: any) => `"${c}"`).join(', ')
    const sql = `INSERT INTO "${this.table}" (${quotedColumns}) VALUES ${valuesList.join(', ')} RETURNING ${this.returningColumns}`

    const result = await this.pool.query(sql, params)
    const data = Array.isArray(this.insertPayload) ? result.rows : (result.rows[0] ?? null)
    return { data: data as T, error: null }
  }

  private async executeUpdate(): Promise<QueryResult<T>> {
    if (!this.updatePayload) return { data: null, error: { message: 'No data to update', code: 'NO_DATA' } }

    const params: any[] = []
    const setClauses: string[] = []

    for (const [key, value] of Object.entries(this.updatePayload)) {
      params.push(value)
      setClauses.push(`"${key}" = $${params.length}`)
    }

    let sql = `UPDATE "${this.table}" SET ${setClauses.join(', ')}`
    sql += this.buildWhereClause(params)
    sql += ` RETURNING ${this.returningColumns}`

    const result = await this.pool.query(sql, params)
    
    if (this.singleRow || this.maybeSingleRow) {
      return { data: (result.rows[0] ?? null) as T, error: null }
    }
    return { data: result.rows as T, error: null }
  }

  private async executeDelete(): Promise<QueryResult<T>> {
    const params: any[] = []
    let sql = `DELETE FROM "${this.table}"`
    sql += this.buildWhereClause(params)
    sql += ` RETURNING ${this.returningColumns}`

    const result = await this.pool.query(sql, params)
    return { data: result.rows as T, error: null }
  }

  private async executeUpsert(): Promise<QueryResult<T>> {
    const rows = Array.isArray(this.insertPayload) ? this.insertPayload : [this.insertPayload]
    if (rows.length === 0) return { data: null, error: null }

    const columns = Object.keys(rows[0])
    const params: any[] = []
    const valuesList: string[] = []

    for (const row of rows) {
      const placeholders: string[] = []
      for (const col of columns) {
        params.push(row[col] !== undefined ? row[col] : null)
        placeholders.push(`$${params.length}`)
      }
      valuesList.push(`(${placeholders.join(', ')})`)
    }

    const quotedColumns = columns.map((c: any) => `"${c}"`).join(', ')
    const updateCols = columns.filter((c: any) => c !== this.upsertConflict)
    const updateSet = updateCols.map((c: any) => `"${c}" = EXCLUDED."${c}"`).join(', ')

    const sql = `INSERT INTO "${this.table}" (${quotedColumns}) VALUES ${valuesList.join(', ')} ON CONFLICT ("${this.upsertConflict}") DO UPDATE SET ${updateSet} RETURNING ${this.returningColumns}`

    const result = await this.pool.query(sql, params)
    const data = Array.isArray(this.insertPayload) ? result.rows : (result.rows[0] ?? null)
    return { data: data as T, error: null }
  }
}

export function createQueryBuilder(pool: Pool) {
  return {
    from(table: string): QueryBuilder {
      return new QueryBuilder(pool, table)
    },
  }
}
