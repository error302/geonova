export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/api/handler'
import { db } from '@/lib/db'
interface AuditEventRow {
  id: string
  table_name: string
  row_id: string
  user_id: string | null
  user_email: string | null
  action: string
  summary: string | null
  prev_hash: string | null
  hash: string
  created_at: Date
  payload: unknown
}

import { z } from 'zod'

/**
 * GET /api/fieldbook/audit?project_id=<uuid>&limit=100
 *   Returns the cross-table audit event stream for the requesting
 *   surveyor, optionally filtered by project. Newest first.
 *
 * The events come from the fieldbook_audit_events table populated by
 * the fieldbook_signed_audit_func trigger (migration 015). Each event
 * contains a SHA-256 hash chain so tampering is detectable.
 */
export const GET = apiHandler({
  requireAuth: true,
  rateLimit: { max: 60, windowMs: 60_000 },
  handler: async (ctx) => {
    const url = new URL(ctx.req.url)
    const projectId = url.searchParams.get('project_id') || null
    const limit = Math.min(
      Number(url.searchParams.get('limit') || '100'),
      500
    )

    const params: unknown[] = [ctx.userId]
    let whereClause = 'WHERE fae.user_id = $1'
    if (projectId) {
      params.push(projectId)
      whereClause += ` AND (
        -- events on rows belonging to this project (fieldbook entries)
        EXISTS (
          SELECT 1 FROM project_fieldbook_entries pfe
          WHERE pfe.id::TEXT = fae.row_id
            AND pfe.project_id = $2
        )
        OR EXISTS (
          SELECT 1 FROM survey_points sp
          WHERE sp.id::TEXT = fae.row_id
            AND sp.project_id = $2
        )
      )`
    }
    params.push(limit)

    const { rows } = await db.query<AuditEventRow>(
      `SELECT
         fae.id,
         fae.table_name,
         fae.row_id,
         fae.user_id,
         u.email AS user_email,
         fae.action,
         fae.summary,
         fae.prev_hash,
         fae.hash,
         fae.created_at,
         fae.payload
       FROM fieldbook_audit_events fae
       LEFT JOIN users u ON u.id = fae.user_id
       ${whereClause}
       ORDER BY fae.created_at DESC
       LIMIT $${params.length}`,
      params
    )

    return NextResponse.json({ events: rows, count: rows.length })
  },
})

/**
 * POST /api/fieldbook/audit/verify
 *   Verifies the hash chain integrity of a given row's audit history.
 *   Returns { valid: true } if every prev_hash matches the prior hash,
 *   otherwise { valid: false, broken_at: <event_id> }.
 *
 * This is the regulatory evidence-chain check that ISK / Survey of
 * Kenya auditors would request.
 */
const verifySchema = z.object({
  row_id: z.string().min(1),
  table_name: z.enum(['project_fieldbook_entries', 'survey_points']),
})

export const POST = apiHandler({
  requireAuth: true,
  schema: verifySchema,
  rateLimit: { max: 30, windowMs: 60_000 },
  handler: async (ctx) => {
    const { row_id, table_name } = ctx.input

    const { rows } = await db.query<AuditEventRow>(
      `SELECT id, action, prev_hash, hash, created_at
       FROM fieldbook_audit_events
       WHERE row_id = $1 AND table_name = $2
       ORDER BY created_at ASC`,
      [row_id, table_name]
    )

    if (rows.length === 0) {
      return NextResponse.json({ valid: true, events: 0, message: 'No audit history found' })
    }

    // Walk the chain: each event's prev_hash must equal the previous event's hash
    let prevHash = ''
    for (const ev of rows) {
      if (ev.prev_hash !== prevHash) {
        return NextResponse.json({
          valid: false,
          broken_at: ev.id,
          broken_at_action: ev.action,
          expected_prev: prevHash,
          actual_prev: ev.prev_hash,
          events: rows.length,
        })
      }
      prevHash = ev.hash
    }

    return NextResponse.json({
      valid: true,
      events: rows.length,
      last_hash: prevHash,
      last_action: rows[rows.length - 1].action,
    })
  },
})
