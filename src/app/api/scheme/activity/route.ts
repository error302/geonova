import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiHandler } from '@/lib/apiHandler'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const validActions = [
  'block_created', 'block_updated', 'block_deleted',
  'parcel_created', 'parcel_updated', 'parcel_deleted', 'parcel_computed',
  'traverse_saved', 'deed_plan_generated', 'form_generated',
  'batch_generated', 'rim_generated', 'block_assigned', 'status_changed',
] as const

const validEntities = ['block', 'parcel', 'traverse', 'scheme', 'project'] as const

interface ProjectIdRow { id: string }

interface ActivityLogRow {
  id: string
  project_id: string
  user_id: string | null
  action: string
  details: Record<string, unknown> | null
  created_at: Date | string
}

interface ActivityLogWithUserRow extends ActivityLogRow {
  user_name: string | null
  user_email: string | null
}

const logActivitySchema = z.object({
  project_id: z.string().min(1),
  action: z.enum(validActions),
  entity_type: z.enum(validEntities),
  entity_id: z.string().optional(),
  details: z.any().optional(),
})

export const POST = apiHandler(
  { auth: true, schema: logActivitySchema , rateLimit: { max: 60, windowMs: 60000 } },
  async (req, ctx) => {
    const { project_id, action, entity_type, entity_id, details } = ctx.body as z.infer<typeof logActivitySchema>

    const check = await db.query<ProjectIdRow>(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [project_id, ctx.userId]
    )
    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const result = await db.query<ActivityLogRow>(
      `INSERT INTO scheme_activity_log (project_id, user_id, action, entity_type, entity_id, details)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [project_id, ctx.userId, action, entity_type, entity_id || null, details ? JSON.stringify(details) : null]
    )

    return NextResponse.json({ data: result.rows[0] }, { status: 201 })
  }
)

export const GET = apiHandler(
  { auth: true, rateLimit: { max: 60, windowMs: 60000 } },
  async (req, ctx) => {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('project_id')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
    }

    const check = await db.query<ProjectIdRow>(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, ctx.userId]
    )
    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const result = await db.query<ActivityLogWithUserRow>(
      `SELECT al.*, u.name as user_name, u.email as user_email
      FROM scheme_activity_log al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.project_id = $1
      ORDER BY al.created_at DESC
      LIMIT $2`,
      [projectId, limit]
    )

    return NextResponse.json({ data: result.rows })
  }
)
