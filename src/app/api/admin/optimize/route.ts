export const dynamic = 'force-dynamic'

/**
 * Admin API for Performance Optimization
 * Apply database indexes and clear caches
 */

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import {
  getRecommendedIndexes,
  applyRecommendedIndexes,
  getSlowQueries,
} from '@/lib/db/optimization'
import redisCache from '@/lib/cache/redis'

export const POST = apiHandler({ auth: true, roles: ['super_admin', 'org_admin'], rateLimit: { max: 60, windowMs: 60000 } }, async (request, ctx) => {
  const { action } = ctx.body as { action?: string }

  switch (action) {
    case 'apply_indexes':
      return applyIndexes()

    case 'clear_cache':
      return clearCaches()

    case 'analyze_queries':
      return analyzeQueries()

    case 'full_optimization':
      return runFullOptimization()

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
})

async function applyIndexes(): Promise<NextResponse> {
  const { applied, skipped } = await applyRecommendedIndexes()

  return NextResponse.json({
    action: 'apply_indexes',
    summary: { total: applied.length + skipped.length, applied: applied.length, skipped: skipped.length },
    applied,
    skipped,
  })
}

async function clearCaches(): Promise<NextResponse> {
  await redisCache.connect()

  await redisCache.delPattern('project:*')
  await redisCache.delPattern('projects:list:*')
  await redisCache.delPattern('survey_points:*')
  await redisCache.delPattern('submissions:*')
  await redisCache.delPattern('api:*')
  await redisCache.delPattern('count:*')

  return NextResponse.json({
    action: 'clear_cache',
    status: 'success',
    message: 'All application caches cleared',
  })
}

async function analyzeQueries(): Promise<NextResponse> {
  const slowQueries = await getSlowQueries()
  const recommendedIndexes = await getRecommendedIndexes()

  return NextResponse.json({
    action: 'analyze_queries',
    status: 'success',
    slowQueries,
    recommendedIndexes,
  })
}

async function runFullOptimization(): Promise<NextResponse> {
  const results: Record<string, unknown> = {}

  const indexResult = await applyIndexes()
  results.indexes = await indexResult.json()

  const cacheResult = await clearCaches()
  results.cache = await cacheResult.json()

  const queryResult = await analyzeQueries()
  results.queries = await queryResult.json()

  return NextResponse.json({
    action: 'full_optimization',
    status: 'success',
    timestamp: new Date().toISOString(),
    results,
  })
}

// GET endpoint for status — admin-only to avoid information disclosure
export const GET = apiHandler({ auth: true, roles: ['super_admin', 'org_admin'], rateLimit: { max: 60, windowMs: 60000 } }, async () => {
  return NextResponse.json({
    status: 'available',
    endpoints: [
      { method: 'POST', action: 'apply_indexes', description: 'Apply database indexes' },
      { method: 'POST', action: 'clear_cache', description: 'Clear application caches' },
      { method: 'POST', action: 'analyze_queries', description: 'Analyze query performance' },
      { method: 'POST', action: 'full_optimization', description: 'Run all optimizations' },
    ],
  })
})
