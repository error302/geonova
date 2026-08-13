import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { isAdmin } from '@/lib/auth/rbac'
import { UpdateSchemeStatusSchema } from '@/lib/validation/apiSchemas'

export const dynamic = 'force-dynamic'

/**
 * Scheme status workflow:
 * planning → in_progress → review → approved
 *
 * Only admin users can advance status.
 * Any status can go back to 'planning' (reset).
 */

interface SchemeStatusRow {
  status: string
  updated_at: Date
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  planning: ['in_progress'],
  in_progress: ['review', 'planning'],
  review: ['approved', 'in_progress'],
  approved: [], // Terminal — only DBA can reopen
}

export const GET = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (req, _ctx) => {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')
  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
  }

  const { rows } = await db.query<SchemeStatusRow>(
    'SELECT status, updated_at FROM scheme_details WHERE project_id = $1',
    [projectId]
  )

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Scheme not found' }, { status: 404 })
  }

  const current = rows[0].status
  const allowed = VALID_TRANSITIONS[current] || []

  return NextResponse.json({
    data: {
      current_status: current,
      allowed_transitions: allowed,
      workflow: Object.entries(VALID_TRANSITIONS).map(([from, tos]) => ({ from, to: tos })),
    }
  })
})

export const POST = apiHandler({
  auth: true,
  schema: UpdateSchemeStatusSchema,
  // T1.9 FIX (2026-07-09): Add audit chain for scheme status changes.
  // Status cascades to all parcels in the scheme — needs tamper-evident logging.
  auditChain: {
    entityType: 'parcel',
    action: 'update',
    projectIdFromBody: 'projectId',
    reason: 'Scheme status changed',
  },
}, async (req, ctx) => {
  const userRole = (ctx.session?.user as { role?: string } | undefined)?.role || 'surveyor'

  // Only admins can change scheme status
  if (!isAdmin(userRole)) {
    return NextResponse.json({ error: 'Only admins can change scheme status' }, { status: 403 })
  }

  const { project_id, new_status, reason } = ctx.body as z.infer<typeof UpdateSchemeStatusSchema>

  // Get current status
  const { rows: current } = await db.query<SchemeStatusRow>(
    'SELECT status FROM scheme_details WHERE project_id = $1',
    [project_id]
  )
  if (current.length === 0) {
    return NextResponse.json({ error: 'Scheme not found' }, { status: 404 })
  }

  // Validate transition
  const allowed = VALID_TRANSITIONS[current[0].status] || []
  if (!allowed.includes(new_status) && current[0].status !== new_status) {
    return NextResponse.json({
      error: `Invalid transition: ${current[0].status} → ${new_status}. Allowed: ${allowed.join(', ') || 'none'}`,
      status: 400,
    })
  }

  // Update status
  const { rows } = await db.query<SchemeStatusRow>(
    'UPDATE scheme_details SET status = $1, updated_at = NOW() WHERE project_id = $2 RETURNING status, updated_at',
    [new_status, project_id]
  )

  // Log activity
  await db.query<never>(
    `INSERT INTO scheme_activity_log (project_id, user_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, 'scheme', $1, $4)`,
    [
      project_id,
      ctx.userId,
      `status_change:${new_status}`,
      JSON.stringify({ from: current[0].status, to: new_status, reason: reason || null }),
    ]
  )

  return NextResponse.json({
    data: {
      previous_status: current[0].status,
      new_status: rows[0].status,
      updated_at: rows[0].updated_at,
    }
  })
})
