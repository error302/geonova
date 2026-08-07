import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiHandler } from '@/lib/apiHandler'
import { AssignSurveyorSchema } from '@/lib/validation/apiSchemas'
import { z } from 'zod'

interface AssignmentCheckRow {
  id: string
  project_id: string
}

interface BlockAssignmentRow {
  id: string
  block_id: string
  project_id: string
  assigned_to: string | null
  assigned_by: string
  assigned_at: Date
}

export const dynamic = 'force-dynamic'

export const POST = apiHandler(
  { auth: true, schema: AssignSurveyorSchema, audit: 'block_assigned' , rateLimit: { max: 60, windowMs: 60000 } },
  async (req, ctx) => {
    const { project_id, block_id, assigned_to } = ctx.body as z.infer<typeof AssignSurveyorSchema>

    if (!project_id || !block_id) {
      return NextResponse.json({ error: 'project_id and block_id are required' }, { status: 400 })
    }

    const check = await db.query<AssignmentCheckRow>(
      `SELECT b.id, b.project_id FROM blocks b
      JOIN projects p ON p.id = b.project_id
      WHERE b.id = $1 AND p.user_id = $2`,
      [block_id, ctx.userId]
    )
    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 })
    }

    const result = await db.query<BlockAssignmentRow>(
      `INSERT INTO block_assignments (block_id, project_id, assigned_to, assigned_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (block_id) DO UPDATE SET
        assigned_to = EXCLUDED.assigned_to,
        assigned_by = EXCLUDED.assigned_by,
        assigned_at = NOW()
      RETURNING *`,
      [block_id, project_id, assigned_to || null, ctx.userId]
    )

    if (assigned_to) {
      await db.query<never>(
        `INSERT INTO scheme_activity_log (project_id, user_id, action, entity_type, entity_id, details)
        VALUES ($1, $2, 'block_assigned', 'block', $3, $4)`,
        [project_id, ctx.userId, block_id, JSON.stringify({ assigned_to })]
      )
    }

    return NextResponse.json({ data: result.rows[0] }, { status: 201 })
  }
)

export const DELETE = apiHandler(
  { auth: true, audit: 'block_unassigned' , rateLimit: { max: 60, windowMs: 60000 } },
  async (req, ctx) => {
    const { searchParams } = new URL(req.url)
    const blockId = searchParams.get('block_id')

    if (!blockId) {
      return NextResponse.json({ error: 'block_id is required' }, { status: 400 })
    }

    const check = await db.query<AssignmentCheckRow>(
      `SELECT ba.id, ba.project_id FROM block_assignments ba
      JOIN projects p ON p.id = ba.project_id
      WHERE ba.block_id = $1 AND p.user_id = $2`,
      [blockId, ctx.userId]
    )
    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    await db.query<never>('DELETE FROM block_assignments WHERE id = $1', [check.rows[0].id])

    return NextResponse.json({ message: 'Assignment removed' })
  }
)
