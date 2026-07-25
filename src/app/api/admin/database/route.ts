/**
 * GET /api/admin/database
 *
 * Database administration dashboard endpoint.
 * Returns comprehensive schema + connection pool + buffer pool stats.
 *
 * Query params:
 *   - table=name: return detailed stats for a single table
 *
 * POST /api/admin/database
 *   Body: { action: 'vacuum' | 'reindex', table: 'name' }
 *   Requires super_admin role.
 */

import { NextResponse } from 'next/server'
import { apiHandler, apiSuccess } from '@/lib/apiHandler'
import {
  getHealthSummary,
  getTableStats,
  vacuumAnalyze,
  reindexTable,
} from '@/lib/db/admin'

export const dynamic = 'force-dynamic'

export const GET = apiHandler(
  { auth: true, roles: ['super_admin', 'admin'], rateLimit: { max: 30, windowMs: 60000 } },
  async (req) => {
    const url = new URL(req.url)
    const table = url.searchParams.get('table')

    if (table) {
      const stats = await getTableStats(table)
      if (!stats) {
        return NextResponse.json({ error: `Table '${table}' not found` }, { status: 404 })
      }
      return apiSuccess({ table: stats })
    }

    const summary = await getHealthSummary()
    return apiSuccess(summary)
  },
)

export const POST = apiHandler(
  { auth: true, roles: ['super_admin'], rateLimit: { max: 10, windowMs: 60000 } },
  async (req, ctx) => {
    const body = ctx.body as { action?: string; table?: string }
    if (!body.action || !body.table) {
      return NextResponse.json(
        { error: 'Missing action or table parameter' },
        { status: 400 },
      )
    }

    let result
    switch (body.action) {
      case 'vacuum':
        result = await vacuumAnalyze(body.table)
        break
      case 'reindex':
        result = await reindexTable(body.table)
        break
      default:
        return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 })
    }

    return apiSuccess(result)
  },
)
