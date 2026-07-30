/**
 * Database Administration Library
 *
 * Provides runtime DB inspection and administration functions for the
 * admin dashboard. All functions require super_admin role.
 *
 * Capabilities:
 *  - getSchemaOverview: list tables, row counts, sizes, index counts
 *  - getMissingIndexes: detect FK columns without indexes
 *  - getInvalidIndexes: detect indexes needing REINDEX
 *  - getTableStats: per-table detail (rows, size, index size, last vacuum)
 *  - getSlowQueries: from pg_stat_statements
 *  - getConnectionPoolStats: active/idle connections
 *  - getBufferPoolStats: cache hit ratio (database buffer pool)
 *  - vacuumAnalyze: run VACUUM ANALYZE on a table
 *  - reindexTable: rebuild indexes on a table
 */

import { db } from '@/lib/db'

export interface SchemaOverview {
  totalTables: number
  totalIndexes: number
  totalSizeMb: number
  tables: TableSummary[]
}

export interface TableSummary {
  name: string
  rowEstimate: number
  sizeMb: number
  indexSizeMb: number
  indexCount: number
  lastVacuum: string | null
  lastAnalyze: string | null
  hasRls: boolean
}

export interface MissingIndex {
  table: string
  column: string
  references: string
  severity: 'high' | 'medium'
  reason: string
}

export interface TableStats {
  name: string
  rowEstimate: number
  totalSizeMb: number
  indexSizeMb: number
  toastSizeMb: number
  seqScanCount: number
  seqTupRead: number
  idxScanCount: number
  idxTupFetch: number
  lastVacuum: string | null
  lastAnalyze: string | null
  lastAutoVacuum: string | null
  lastAutoAnalyze: string | null
  nDeadTup: number
  nLiveTup: number
  deadTupleRatio: number
}

export interface ConnectionPoolStats {
  maxConnections: number
  activeConnections: number
  idleConnections: number
  idleInTransaction: number
  waitingConnections: number
  byDatabase: Array<{ database: string; connections: number }>
  byUser: Array<{ user: string; connections: number }>
  oldestTransactionSeconds: number | null
}

export interface BufferPoolStats {
  cacheHitRatio: number       // 0-1, blks_hit / (blks_hit + blks_read)
  cacheMissRatio: number
  blocksRead: number          // disk reads
  blocksHit: number           // cache hits
  databaseBlocksRead: number
  databaseBlocksHit: number
  bufferPoolSizeMb: number    // shared_buffers setting
}

export interface SlowQuery {
  query: string
  calls: number
  totalExecMs: number
  meanExecMs: number
  rows: number
  database: string
}

/**
 * Get a high-level overview of the database schema.
 */
export async function getSchemaOverview(): Promise<SchemaOverview> {
  const result = await db.query(`
    SELECT
      c.relname AS name,
      c.reltuples::bigint AS row_estimate,
      pg_size_pretty(pg_total_relation_size(c.oid)) AS size_pretty,
      pg_total_relation_size(c.oid) AS size_bytes,
      pg_size_pretty(pg_indexes_size(c.oid)) AS index_size_pretty,
      pg_indexes_size(c.oid) AS index_size_bytes,
      (SELECT count(*) FROM pg_index i WHERE i.indrelid = c.oid) AS index_count,
      (SELECT relrowsecurity FROM pg_class WHERE oid = c.oid) AS has_rls
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
    ORDER BY pg_total_relation_size(c.oid) DESC
  `)

  const tables: TableSummary[] = result.rows.map((r: any) => ({
    name: r.name,
    rowEstimate: parseInt(r.row_estimate, 10) || 0,
    sizeMb: parseFloat(r.size_bytes) / (1024 * 1024),
    indexSizeMb: parseFloat(r.index_size_bytes) / (1024 * 1024),
    indexCount: parseInt(r.index_count, 10),
    lastVacuum: null,  // populated by getTableStats
    lastAnalyze: null,
    hasRls: r.has_rls || false,
  }))

  const totalSizeMb = tables.reduce((s, t) => s + t.sizeMb, 0)
  const totalIndexes = tables.reduce((s, t) => s + t.indexCount, 0)

  return {
    totalTables: tables.length,
    totalIndexes,
    totalSizeMb,
    tables,
  }
}

/**
 * Detect foreign key columns that lack an index.
 * This is a critical performance issue in PostgreSQL.
 */
export async function getMissingIndexes(): Promise<MissingIndex[]> {
  const result = await db.query(`
    SELECT
      c.conrelid::regclass AS table_name,
      a.attname AS column_name,
      c.confrelid::regclass AS references_table
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
      AND a.attnum = ANY (c.conkey)
    LEFT JOIN pg_index i
      ON i.indrelid = c.conrelid
      AND a.attnum = ANY (i.indkey)
      AND i.indisunique = false
    WHERE c.contype = 'f'
      AND i.indrelid IS NULL
      AND c.conrelid::regclass::text NOT LIKE 'pg_%'
      AND c.conrelid::regclass::text NOT LIKE 'auth%'
  `)

  return result.rows.map((r: any) => ({
    table: r.table_name,
    column: r.column_name,
    references: r.references_table,
    severity: 'high' as const,
    reason: 'FK column not indexed — causes slow JOINs and lock escalation',
  }))
}

/**
 * Get detailed statistics for a single table.
 */
export async function getTableStats(tableName: string): Promise<TableStats | null> {
  // Validate table name to prevent SQL injection
  if (!/^[a-z_][a-z0-9_]*$/.test(tableName)) {
    throw new Error('Invalid table name')
  }

  const result = await db.query(`
    SELECT
      relname AS name,
      n_live_tup,
      n_dead_tup,
      seq_scan,
      seq_tup_read,
      idx_scan,
      idx_tup_fetch,
      last_vacuum,
      last_autovacuum,
      last_analyze,
      last_autoanalyze,
      pg_total_relation_size(relid) AS total_size,
      pg_relation_size(relid) AS table_size,
      pg_indexes_size(relid) AS index_size,
      pg_total_relation_size((quote_ident(relname) || '_toast')::regclass) AS toast_size
    FROM pg_stat_user_tables
    WHERE relname = $1
  `, [tableName])

  if (result.rows.length === 0) return null

  const r = result.rows[0] as any
  const totalSize = parseFloat(r.total_size) || 0
  const indexSize = parseFloat(r.index_size) || 0
  const toastSize = parseFloat(r.toast_size) || 0
  const nLive = parseInt(r.n_live_tup, 10) || 0
  const nDead = parseInt(r.n_dead_tup, 10) || 0

  return {
    name: r.name,
    rowEstimate: nLive,
    totalSizeMb: totalSize / (1024 * 1024),
    indexSizeMb: indexSize / (1024 * 1024),
    toastSizeMb: toastSize / (1024 * 1024),
    seqScanCount: parseInt(r.seq_scan, 10) || 0,
    seqTupRead: parseInt(r.seq_tup_read, 10) || 0,
    idxScanCount: parseInt(r.idx_scan, 10) || 0,
    idxTupFetch: parseInt(r.idx_tup_fetch, 10) || 0,
    lastVacuum: r.last_vacuum,
    lastAnalyze: r.last_analyze,
    lastAutoVacuum: r.last_autovacuum,
    lastAutoAnalyze: r.last_autoanalyze,
    nDeadTup: nDead,
    nLiveTup: nLive,
    deadTupleRatio: nLive > 0 ? nDead / nLive : 0,
  }
}

/**
 * Get connection pool statistics.
 */
export async function getConnectionPoolStats(): Promise<ConnectionPoolStats> {
  const [maxConnResult, activityResult, byDbResult, byUserResult, oldestResult] = await Promise.all([
    db.query(`SHOW max_connections`),
    db.query(`
      SELECT state, count(*) AS count
      FROM pg_stat_activity
      WHERE datname IS NOT NULL
      GROUP BY state
    `),
    db.query(`
      SELECT datname AS database, count(*) AS connections
      FROM pg_stat_activity
      WHERE datname IS NOT NULL
      GROUP BY datname
      ORDER BY connections DESC
    `),
    db.query(`
      SELECT usename AS user, count(*) AS connections
      FROM pg_stat_activity
      WHERE datname IS NOT NULL
      GROUP BY usename
      ORDER BY connections DESC
    `),
    db.query(`
      SELECT COALESCE(MAX(EXTRACT(EPOCH FROM (NOW() - xact_start))), 0)::int AS oldest_seconds
      FROM pg_stat_activity
      WHERE xact_start IS NOT NULL
    `),
  ])

  const maxConn = parseInt(maxConnResult.rows[0].max_connections, 10)
  const byState = new Map<string, number>()
  for (const r of activityResult.rows) {
    byState.set(r.state, parseInt(r.count, 10))
  }

  return {
    maxConnections: maxConn,
    activeConnections: byState.get('active') || 0,
    idleConnections: byState.get('idle') || 0,
    idleInTransaction: byState.get('idle in transaction') || 0,
    waitingConnections: byState.get('waiting') || 0,
    byDatabase: byDbResult.rows.map((r: any) => ({
      database: r.database,
      connections: parseInt(r.connections, 10),
    })),
    byUser: byUserResult.rows.map((r: any) => ({
      user: r.user,
      connections: parseInt(r.connections, 10),
    })),
    oldestTransactionSeconds: oldestResult.rows[0]?.oldest_seconds || null,
  }
}

/**
 * Get buffer pool (PostgreSQL shared_buffers) statistics.
 *
 * The cache hit ratio is the most important metric — should be > 99% for
 * a well-tuned database. Below 95% means shared_buffers is too small.
 */
export async function getBufferPoolStats(): Promise<BufferPoolStats> {
  const [stattableResult, settingsResult] = await Promise.all([
    db.query(`
      SELECT
        sum(blks_read) AS blocks_read,
        sum(blks_hit) AS blocks_hit
      FROM pg_stat_database
      WHERE datname = current_database()
    `),
    db.query(`
      SELECT setting, unit
      FROM pg_settings
      WHERE name = 'shared_buffers'
    `),
  ])

  const blocksRead = parseInt(stattableResult.rows[0].blocks_read, 10) || 0
  const blocksHit = parseInt(stattableResult.rows[0].blocks_hit, 10) || 0
  const total = blocksRead + blocksHit
  const cacheHitRatio = total > 0 ? blocksHit / total : 0

  // Parse shared_buffers setting (e.g., "256MB" or "16384" with unit "8kB")
  const setting = settingsResult.rows[0]?.setting || '0'
  const unit = settingsResult.rows[0]?.unit || ''
  let bufferPoolSizeMb = 0
  if (unit === '8kB') {
    bufferPoolSizeMb = (parseInt(setting, 10) * 8) / 1024
  } else {
    // Try to parse as size string (e.g., "256MB")
    const match = setting.match(/^(\d+(?:\.\d+)?)(kB|MB|GB)?$/i)
    if (match) {
      const val = parseFloat(match[1])
      const u = (match[2] || 'MB').toUpperCase()
      bufferPoolSizeMb = u === 'GB' ? val * 1024 : u === 'KB' ? val / 1024 : val
    }
  }

  return {
    cacheHitRatio,
    cacheMissRatio: 1 - cacheHitRatio,
    blocksRead,
    blocksHit,
    databaseBlocksRead: blocksRead,
    databaseBlocksHit: blocksHit,
    bufferPoolSizeMb,
  }
}

/**
 * Get slow queries from pg_stat_statements (if extension is installed).
 */
export async function getSlowQueries(limit = 20): Promise<SlowQuery[]> {
  try {
    const result = await db.query(`
      SELECT
        query,
        calls,
        total_exec_time AS total_ms,
        mean_exec_time AS mean_ms,
        rows
      FROM pg_stat_statements
      WHERE query NOT ILIKE '%pg_stat%'
        AND query NOT ILIKE '%pg_catalog%'
      ORDER BY total_exec_time DESC
      LIMIT $1
    `, [limit])

    return result.rows.map((r: any) => ({
      query: r.query.substring(0, 500),
      calls: parseInt(r.calls, 10),
      totalExecMs: parseFloat(r.total_ms),
      meanExecMs: parseFloat(r.mean_ms),
      rows: parseInt(r.rows, 10),
      database: '',
    }))
  } catch {
    // pg_stat_statements not installed
    return []
  }
}

/**
 * Run VACUUM ANALYZE on a table. Useful after large imports.
 */
export async function vacuumAnalyze(tableName: string): Promise<{ ok: boolean; message: string }> {
  if (!/^[a-z_][a-z0-9_]*$/.test(tableName)) {
    throw new Error('Invalid table name')
  }
  await db.query(`VACUUM ANALYZE "${tableName}"`)
  return { ok: true, message: `VACUUM ANALYZE completed on ${tableName}` }
}

/**
 * Rebuild all indexes on a table. Useful when indexes become bloated.
 */
export async function reindexTable(tableName: string): Promise<{ ok: boolean; message: string }> {
  if (!/^[a-z_][a-z0-9_]*$/.test(tableName)) {
    throw new Error('Invalid table name')
  }
  await db.query(`REINDEX TABLE CONCURRENTLY "${tableName}"`)
  return { ok: true, message: `REINDEX completed on ${tableName}` }
}

/**
 * Get the full health summary: schema + connections + buffer pool + slow queries.
 */
export async function getHealthSummary() {
  const [schema, missingIdx, pool, buffer, slowQueries] = await Promise.all([
    getSchemaOverview(),
    getMissingIndexes(),
    getConnectionPoolStats(),
    getBufferPoolStats(),
    getSlowQueries(10),
  ])

  const issues: Array<{ severity: 'critical' | 'high' | 'medium' | 'low'; message: string }> = []

  if (missingIdx.length > 0) {
    issues.push({
      severity: 'high',
      message: `${missingIdx.length} foreign key columns are missing indexes (causes slow JOINs and lock escalation)`,
    })
  }

  if (buffer.cacheHitRatio < 0.95) {
    issues.push({
      severity: 'critical',
      message: `Buffer pool cache hit ratio is ${(buffer.cacheHitRatio * 100).toFixed(1)}% (should be >99%). Increase shared_buffers.`,
    })
  } else if (buffer.cacheHitRatio < 0.99) {
    issues.push({
      severity: 'medium',
      message: `Buffer pool cache hit ratio is ${(buffer.cacheHitRatio * 100).toFixed(1)}% (should be >99%)`,
    })
  }

  if (pool.idleInTransaction > 5) {
    issues.push({
      severity: 'high',
      message: `${pool.idleInTransaction} connections are idle in transaction (potential connection leak)`,
    })
  }

  if (pool.oldestTransactionSeconds && pool.oldestTransactionSeconds > 60) {
    issues.push({
      severity: 'high',
      message: `Oldest transaction has been running for ${pool.oldestTransactionSeconds}s (should be <60s)`,
    })
  }

  const connectionUtilization = pool.activeConnections / pool.maxConnections
  if (connectionUtilization > 0.7) {
    issues.push({
      severity: 'medium',
      message: `Connection utilization is ${(connectionUtilization * 100).toFixed(0)}% (${pool.activeConnections}/${pool.maxConnections})`,
    })
  }

  return {
    schema,
    missingIndexes: missingIdx,
    connectionPool: pool,
    bufferPool: buffer,
    slowQueries,
    issues,
    timestamp: new Date().toISOString(),
  }
}
