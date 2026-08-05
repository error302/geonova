import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg'
import { env } from '@/lib/env'

let pool: Pool | null = null

/**
 * Per-request storage for the current user ID and organization ID.
 * Set by API routes after authentication, read by db.query() to
 * configure the PostgreSQL session variables used by RLS policies.
 *
 * Uses AsyncLocalStorage so it's safe across concurrent requests.
 *
 * AUDIT FIX (C6, 2026-07-02): Added orgIdStore for org-level RLS.
 * Routes that operate on org-scoped resources should call
 * setCurrentOrgId() after authentication. When not set, RLS policies
 * fall back to user_id-only checks (legacy personal projects).
 */
import { AsyncLocalStorage } from 'async_hooks'

const userIdStore = new AsyncLocalStorage<string>()
const orgIdStore = new AsyncLocalStorage<string>()

/** Set the current user ID for RLS (call this in API routes after auth) */
export function setCurrentUserId(userId: string) {
  userIdStore.enterWith(userId)
}

/** Set the current organization ID for org-level RLS (call after auth) */
export function setCurrentOrgId(orgId: string | null) {
  if (orgId) {
    orgIdStore.enterWith(orgId)
  }
}

/** Get the current user ID (used internally by db.query) */
function getCurrentUserId(): string | undefined {
  return userIdStore.getStore()
}

/** Get the current organization ID (used internally by db.query) */
function getCurrentOrgId(): string | undefined {
  return orgIdStore.getStore()
}

function getPoolConfig() {
  // Pool sizing — tune based on expected load.
  // Default 10 connections is conservative; production should set DB_POOL_MAX
  // based on (max_connections - reserved_for_admin - other_apps).
  //
  // Rule of thumb (HikariCP formula): pool_size = (peak_qps × avg_query_ms) / 1000
  // For METARDU: peak ~100 qps × 50ms = 5 connections minimum.
  // Set to 20 for headroom on multi-user deployments.
  const poolMax = parseInt(process.env.DB_POOL_MAX ?? '20', 10)
  const idleTimeoutMs = parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS ?? '30000', 10)
  const connTimeoutMs = parseInt(process.env.DB_POOL_CONNECT_TIMEOUT_MS ?? '2000', 10)
  const statementTimeoutMs = parseInt(process.env.DB_STATEMENT_TIMEOUT_MS ?? '10000', 10)

  const base = {
    max: poolMax,
    idleTimeoutMillis: idleTimeoutMs,
    connectionTimeoutMillis: connTimeoutMs, // Fail fast when DB is unavailable
    statement_timeout: statementTimeoutMs, // 10s — prevents runaway queries
    // Best-practice: keep idle connections warm so first request after idle
    // doesn't pay connection setup latency.
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  }

  if (env.DATABASE_URL) {
    return {
      connectionString: env.DATABASE_URL,
      ...base,
    }
  }

  if (env.DB_HOST && env.DB_NAME && env.DB_USER) {
    return {
      host: env.DB_HOST,
      port: env.DB_PORT ?? 5432,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      ...base,
    }
  }

  throw new Error('Database connection is not configured. Set DATABASE_URL or DB_HOST/DB_NAME/DB_USER.')
}

/** UUID validation regex for RLS context safety */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Slow query threshold in milliseconds */
const SLOW_QUERY_THRESHOLD_MS = 5000

/**
 * T1.8 FIX (2026-07-09): Whitelist of table names allowed in
 * updateWithOptimisticLock / deleteWithOptimisticLock. Prevents SQL injection
 * via the `table` parameter (which is interpolated into the SQL string).
 * Add tables here as needed — the list covers the entities that have
 * `updated_at` columns per the canonical schema.
 */
const ALLOWED_TABLES = new Set([
  'projects',
  'deed_plans',
  'survey_points',
  'surveyor_profiles',
  'marketplace_listings',
  'marketplace_jobs',
  'scheme_parcels',
  'scheme_blocks',
  'scheme_beacons',
  'traverse_results',
  'traverse_observations',
  'payments',
  'subscriptions',
  'equipment',
  'beacons',
  'field_projects',
  'cpd_certificates',
  'cpd_activities',
  'white_label_settings',
  'announcements',
])

/** Assert that a table name is in the whitelist (SQL injection guard) */
function assertTable(table: string): void {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`[db] table "${table}" is not in the optimistic-lock whitelist. Add it to ALLOWED_TABLES in src/lib/db.ts.`)
  }
}

/** Get the singleton Pool instance (lazy-initialized) */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(getPoolConfig())
    // NOTE: DDL migrations removed from hot path.
    // Column additions (payment_history.plan_id, transaction_id) are handled
    // by scripts/migrate.js which runs in docker-entrypoint.sh before the
    // server starts. Running ALTER TABLE on every pool creation takes an
    // ACCESS EXCLUSIVE lock on the table, blocking all reads/writes.

    // Pool-level error listener — prevents unhandled errors from crashing the process
    pool.on('error', (err) => {
      console.error('[db] Unexpected pool error:', err)
    })
  }
  return pool
}

/**
 * Set the RLS session variable on a client so that current_user_id() works.
 * This must be called after acquiring a client and before any data queries.
 */
async function _setRlsContext(client: PoolClient | Pool) {
  const userId = getCurrentUserId()
  if (userId) {
    // Defense-in-depth: validate UUID format before interpolating into SQL.
    // SET LOCAL does not support $1 parameterized placeholders.
    if (!UUID_RE.test(userId)) {
      throw new Error(`Invalid userId format for RLS context: ${userId}`)
    }
    await client.query(`SET LOCAL request.user_id = '${userId}'`)
  }
  // AUDIT FIX (C6, 2026-07-02): Set org context for org-level RLS policies.
  const orgId = getCurrentOrgId()
  if (orgId) {
    if (!UUID_RE.test(orgId)) {
      throw new Error(`Invalid orgId format for RLS context: ${orgId}`)
    }
    await client.query(`SET LOCAL request.organization_id = '${orgId}'`)
  } else {
    // Explicitly clear (in case the connection was reused from the pool)
    await client.query(`SET LOCAL request.organization_id = ''`)
  }
}

/** Set the RLS session variable on a client (exported for manual transaction use) */
export async function setRlsContext(client: PoolClient | Pool) {
  return _setRlsContext(client)
}

/** Convenient query helper — acquires and releases a client per call */
export const db = {
  query: async <T extends QueryResultRow = any>(text: string, params?: unknown[]): Promise<QueryResult<T>> => {
    const client = await getPool().connect()
    const start = Date.now()
    try {
      const userId = getCurrentUserId()
      if (userId) {
        // Defense-in-depth: validate UUID format before interpolating into SQL.
        if (!UUID_RE.test(userId)) {
          throw new Error(`Invalid userId format for RLS context: ${userId}`)
        }
        await client.query(`SET LOCAL request.user_id = '${userId}'`)
      }
      const result = await client.query(text, params)
      const elapsed = Date.now() - start
      if (elapsed > SLOW_QUERY_THRESHOLD_MS) {
        console.warn(`[db] Slow query (${elapsed}ms):`, text.slice(0, 200))
      }
      return result
    } finally {
      client.release()
    }
  },

  /**
   * Run multiple queries in a single atomic transaction.
   * The callback receives a connected client. If the callback throws,
   * the transaction is rolled back automatically.
   * RLS context is set automatically if a user ID is available.
   *
   * @example
   * await db.transaction(async (client) => {
   *   await client.query('INSERT INTO projects ...', [...])
   *   await client.query('INSERT INTO scheme_details ...', [...])
   * })
   */
  transaction: async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
    const client = await getPool().connect()
    try {
      await client.query('BEGIN')
      const userId = getCurrentUserId()
      if (userId) {
        if (!UUID_RE.test(userId)) {
          throw new Error(`Invalid userId format for RLS context: ${userId}`)
        }
        await client.query(`SET LOCAL request.user_id = '${userId}'`)
      }
      const result = await fn(client)
      await client.query('COMMIT')
      return result
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  },

  getClient: async (): Promise<PoolClient> => getPool().connect(),

  /**
   * T1.8 FIX (2026-07-09): Optimistic locking UPDATE — puts the guard in the
   * SQL WHERE clause itself, eliminating the TOCTOU race in the old
   * `checkOptimisticLock()` helper (which did SELECT → JS check → UPDATE
   * without `AND updated_at = $2` in the UPDATE).
   *
   * Returns the updated row, or `null` if 0 rows were affected (meaning the
   * row was either modified by another user or doesn't exist — caller should
   * return 409 Conflict).
   *
   * @param table     - table name (validated against a whitelist; see assertTable)
   * @param id        - row UUID
   * @param updates   - { column: value, ... } — only these columns are SET
   * @param clientUpdatedAt - the updated_at the client saw when it read the row
   *
   * @example
   * const row = await db.updateWithOptimisticLock('projects', id, { name: 'New' }, body.updated_at)
   * if (!row) return NextResponse.json({ error: 'CONFLICT' }, { status: 409 })
   */
  updateWithOptimisticLock: async <T = Record<string, unknown>>(
    table: string,
    id: string,
    updates: Record<string, unknown>,
    clientUpdatedAt: string,
  ): Promise<T | null> => {
    assertTable(table)
    const cols = Object.keys(updates)
    if (cols.length === 0) {
      throw new Error('[db.updateWithOptimisticLock] no columns to update')
    }
    // Build SET clause: col1 = $1, col2 = $2, ...
    // Always bump updated_at in the same statement (atomic with the guard).
    const setClauses = cols.map((c, i) => `${c} = $${i + 1}`)
    const params: unknown[] = [...cols.map(c => updates[c]), id, clientUpdatedAt]
    const n = params.length
    const sql = `UPDATE ${table}
                 SET ${setClauses.join(', ')}, updated_at = NOW()
                 WHERE id = $${n - 1} AND updated_at = $${n}
                 RETURNING *`
    const { rows } = await db.query(sql, params)
    return (rows[0] as T) ?? null
  },

  /**
   * T1.8 FIX (2026-07-09): Optimistic locking DELETE — same pattern as
   * updateWithOptimisticLock but for deletes. Prevents deleting a row that
   * was modified after the client last read it.
   *
   * Returns `true` if the row was deleted, `false` if 0 rows affected (conflict).
   */
  deleteWithOptimisticLock: async (
    table: string,
    id: string,
    clientUpdatedAt: string,
  ): Promise<boolean> => {
    assertTable(table)
    const sql = `DELETE FROM ${table}
                 WHERE id = $1 AND updated_at = $2`
    const result = await db.query(sql, [id, clientUpdatedAt])
    return (result.rowCount ?? 0) > 0
  },

  /**
   * Health check — runs SELECT 1 with a 2-second timeout.
   * Returns true if the database is reachable, false otherwise.
   */
  isHealthy: async (): Promise<boolean> => {
    try {
      const p = getPool()
      const client = await p.connect()
      try {
        await client.query('SELECT 1')
        return true
      } finally {
        client.release()
      }
    } catch (err) {
      console.error('[db] Health check failed:', err)
      return false
    }
  },

  /**
   * Pool metrics — returns connection pool statistics.
   * Useful for monitoring and diagnostics.
   */
  getPoolMetrics: (): { totalCount: number; idleCount: number; waitingCount: number } => {
    const p = pool
    if (!p) {
      return { totalCount: 0, idleCount: 0, waitingCount: 0 }
    }
    return {
      totalCount: p.totalCount,
      idleCount: p.idleCount,
      waitingCount: p.waitingCount,
    }
  },
}

export default db
