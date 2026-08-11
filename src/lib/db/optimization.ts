/**
 * Database Optimization for METARDU
 * Connection pooling, query optimization, and performance monitoring
 */

import { createClient } from '@/lib/api-client/client'
import { logger } from '@/lib/logger'
import redisCache from '@/lib/cache/redis'

// Query performance thresholds
const SLOW_QUERY_THRESHOLD = 500 // ms

class DatabaseOptimizer {
  private queryLog: Map<string, number[]> = new Map()

  // Optimized query with caching
  async queryWithCache<T>(
    table: string,
    query: string,
    cacheKey: string,
    ttlSeconds = 60
  ): Promise<T[]> {
    return redisCache.getOrSet(
      cacheKey,
      async () => {
        const dbClient = createClient()
        const startTime = Date.now()
        const { data, error } = await dbClient.from(table).select(query)
        
        if (error) throw error
        
        const duration = Date.now() - startTime
        this.logQuery(`SELECT ${table}`, duration)
        
        return ((data || []) as unknown) as T[]
      },
      ttlSeconds
    )
  }

  // Bulk insert with batching
  async bulkInsert<T extends Record<string, unknown>>(
    table: string,
    records: T[],
    batchSize = 100
  ): Promise<{ inserted: number; errors: number }> {
    const dbClient = createClient()
    let inserted = 0
    let errors = 0

    // Process in batches
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize)
      const startTime = Date.now()
      
      const { error } = await dbClient.from(table).insert(batch)
      
      if (error) {
        errors += batch.length
        logger.error(`[DB] Bulk insert error for ${table}:`, { error })
      } else {
        inserted += batch.length
      }

      const duration = Date.now() - startTime
      this.logQuery(`BULK_INSERT ${table}`, duration)
    }

    return { inserted, errors }
  }

  // Paginated query with cursor-based pagination
  async paginatedQuery<T extends Record<string, unknown>>(
    table: string,
    query: string,
    options: {
      cursor?: string
      limit?: number
      orderBy?: string
      orderDirection?: 'asc' | 'desc'
    } = {}
  ): Promise<{
    data: T[]
    nextCursor: string | null
    hasMore: boolean
  }> {
    const dbClient = createClient()
    const { cursor, limit = 50, orderBy = 'created_at', orderDirection = 'desc' } = options

    let queryBuilder = dbClient
      .from(table)
      .select(query)
      .order(orderBy, { ascending: orderDirection === 'asc' })
      .limit(limit + 1) // Fetch one extra to check if there's more

    if (cursor) {
      const [cursorValue, cursorId] = cursor.split('_')
      queryBuilder = queryBuilder.gt(orderBy, cursorValue)
    }

    const startTime = Date.now()
    const { data, error } = await queryBuilder
    const duration = Date.now() - startTime

    this.logQuery(`PAGINATED_SELECT ${table}`, duration)

    if (error) throw error

    const results = (data || []) as unknown as T[]
    const hasMore = results.length > limit
    const trimmedResults = hasMore ? results.slice(0, -1) : results

    const nextCursor = hasMore && trimmedResults.length > 0
      ? `${trimmedResults[trimmedResults.length - 1][orderBy]}_${trimmedResults[trimmedResults.length - 1].id}`
      : null

    return {
      data: trimmedResults as T[],
      nextCursor,
      hasMore,
    }
  }

  // Optimized count query
  async fastCount(table: string, filter?: Record<string, unknown>): Promise<number> {
    const cacheKey = `count:${table}:${JSON.stringify(filter || {})}`
    
    return redisCache.getOrSet(
      cacheKey,
      async () => {
        const dbClient = createClient()
        let queryBuilder = dbClient.from(table).select('*', { count: 'exact', head: true })
        
        if (filter) {
          Object.entries(filter).forEach(([key, value]) => {
            queryBuilder = queryBuilder.eq(key, value)
          })
        }

        const startTime = Date.now()
        const { count, error } = await queryBuilder
        const duration = Date.now() - startTime

        this.logQuery(`COUNT ${table}`, duration)

        if (error) throw error
        return count || 0
      },
      60 // Cache for 60 seconds
    )
  }

  // Query with automatic join optimization
  async optimizedJoin<T>(
    primaryTable: string,
    primaryQuery: string,
    joins: Array<{
      table: string
      foreignKey: string
      select: string
      alias?: string
    }>,
    cacheKey?: string,
    ttlSeconds = 60
  ): Promise<T[]> {
    const executeQuery = async () => {
      const dbClient = createClient()
      
      // Build join query
      let queryBuilder = dbClient.from(primaryTable).select(primaryQuery)
      
      joins.forEach((join) => {
        const select = join.select.split(',').map(s => `${join.table}.${s.trim()}`).join(',')
        const alias = join.alias || join.table
        queryBuilder = queryBuilder.select(`${join.table}(${select})`)
      })

      const startTime = Date.now()
      const { data, error } = await queryBuilder
      const duration = Date.now() - startTime

      this.logQuery(`JOIN ${primaryTable}`, duration)

      if (error) throw error
      return data || []
    }

    if (cacheKey) {
      return redisCache.getOrSet(cacheKey, executeQuery, ttlSeconds)
    }

    return executeQuery()
  }

  // Log query performance
  private logQuery(query: string, duration: number): void {
    const times = this.queryLog.get(query) || []
    times.push(duration)
    
    // Keep last 100 queries
    if (times.length > 100) times.shift()
    this.queryLog.set(query, times)

    if (duration > SLOW_QUERY_THRESHOLD) {
      logger.warn(`[DB] Slow query (${duration}ms): ${query}`)
    }
  }

  // Get query performance stats
  getQueryStats(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const stats: Record<string, { avg: number; min: number; max: number; count: number }> = {}
    
    this.queryLog.forEach((times, query) => {
      if (times.length === 0) return
      
      const sum = times.reduce((a, b) => a + b, 0)
      const avg = sum / times.length
      const min = Math.min(...times)
      const max = Math.max(...times)
      
      stats[query] = { avg, min, max, count: times.length }
    })

    return stats
  }

  // Clear query log
  clearStats(): void {
    this.queryLog.clear()
  }
}

// Database index recommendations
export const recommendedIndexes = {
  projects: [
    'CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_projects_survey_type ON projects(survey_type)',
    'CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)',
  ],
  survey_points: [
    'CREATE INDEX IF NOT EXISTS idx_survey_points_project ON survey_points(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_survey_points_is_control ON survey_points(is_control)',
    'CREATE INDEX IF NOT EXISTS idx_survey_points_name ON survey_points(name)',
  ],
  survey_observations: [
    'CREATE INDEX IF NOT EXISTS idx_survey_observations_project ON survey_observations(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_survey_observations_point ON survey_observations(point_id)',
    'CREATE INDEX IF NOT EXISTS idx_survey_observations_type ON survey_observations(observation_type)',
    'CREATE INDEX IF NOT EXISTS idx_survey_observations_synced ON survey_observations(synced_at)',
    'CREATE INDEX IF NOT EXISTS idx_survey_observations_observed ON survey_observations(observed_at DESC)',
  ],
  field_photos: [
    'CREATE INDEX IF NOT EXISTS idx_field_photos_project ON field_photos(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_field_photos_synced ON field_photos(synced_at)',
  ],
  project_submissions: [
    'CREATE INDEX IF NOT EXISTS idx_project_submissions_project ON project_submissions(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_project_submissions_number ON project_submissions(submission_number)',
    'CREATE INDEX IF NOT EXISTS idx_project_submissions_status ON project_submissions(package_status)',
    'CREATE INDEX IF NOT EXISTS idx_project_submissions_year ON project_submissions(submission_year)',
  ],
}

// Migration script for indexes
export async function applyRecommendedIndexes(): Promise<{ applied: string[]; skipped: string[] }> {
  const dbClient = createClient()
  const applied: string[] = []
  const skipped: string[] = []
  
  for (const [table, indexes] of Object.entries(recommendedIndexes)) {
    for (const sql of indexes) {
      try {
        await dbClient.rpc('execute_sql', { sql })
        applied.push(sql)
      } catch (error) {
        skipped.push(sql)
        logger.error(`[DB] Failed to apply index: ${sql}`, { error })
      }
    }
  }

  return { applied, skipped }
}

/** Named export for the recommended indexes (returns the static object) */
export function getRecommendedIndexes() {
  return recommendedIndexes
}

/** Get slow queries from the optimizer stats */
export async function getSlowQueries(): Promise<{ query: string; avgDuration: number; count: number }[]> {
  const stats = dbOptimizer.getQueryStats()
  return Object.entries(stats)
    .filter(([, s]) => s.avg > SLOW_QUERY_THRESHOLD)
    .map(([query, s]) => ({ query, avgDuration: s.avg, count: s.count }))
}

// Export singleton
export const dbOptimizer = new DatabaseOptimizer()
export default dbOptimizer
