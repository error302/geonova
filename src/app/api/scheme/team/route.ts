import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const AssignTeamSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['surveyor', 'reviewer', 'approver']),
  action: z.enum(['assign', 'remove']),
})

const TeamQuerySchema = z.object({
  project_id: z.string().uuid({ message: 'project_id must be a valid UUID' }),
})

// ─── DB Row Interfaces ───────────────────────────────────────────────────────

interface AssignmentRow {
  block_id: string
  block_number: string
  block_name: string
  assigned_to: string
  email: string
  full_name: string
  role: string
  assigned_at: string
  assigned_by: string
}

interface BlockStatsRow {
  block_id: string
  block_number: string
  total_parcels: string
  approved: string
  in_progress: string
  pending: string
}

interface BlockRow {
  id: string
  block_number: string
  block_name: string
}

interface ProjectOwnerRow {
  id: string
  email: string
  full_name: string
  role: string
  owner_since: string
}

interface ProjectUserIdRow {
  user_id: string
}

interface UserIdRow {
  id: string
}

interface ExistingAssignmentRow {
  id: string
}

interface TeamMember {
  user: { id: string; email: string; full_name: string; role: string }
  blocks: Array<{
    block_id: string
    block_number: string
    block_name: string
    assigned_at: string
    stats: { total_parcels: number; approved: number; in_progress: number; pending: number }
  }>
}

/**
 * GET /api/scheme/team?project_id=X
 * Returns all surveyors assigned to blocks in a project, plus the project owner.
 */
export const GET = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (req, _ctx) => {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')

  const queryParsed = TeamQuerySchema.safeParse({ project_id: projectId })
  if (!queryParsed.success) {
    return NextResponse.json({ error: 'Invalid project_id', details: queryParsed.error.issues }, { status: 400 })
  }

  // Get project owner
  const { rows: projects } = await db.query<ProjectOwnerRow>(
    'SELECT u.id, u.email, u.name as full_name, u.role, p.created_at as owner_since FROM projects p JOIN users u ON u.id = p.user_id WHERE p.id = $1',
    [projectId]
  )

  if (projects.length === 0) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Get assigned surveyors
  const { rows: assignments } = await db.query<AssignmentRow>(
    `SELECT
      ba.block_id, b.block_number, b.block_name,
      ba.assigned_to, u.email, u.name as full_name, u.role,
      ba.assigned_at, ba.assigned_by
     FROM block_assignments ba
     JOIN blocks b ON b.id = ba.block_id
     JOIN users u ON u.id = ba.assigned_to
     WHERE b.project_id = $1
     ORDER BY b.block_number`,
    [projectId]
  )

  // Get block stats per assignee
  const { rows: blockStats } = await db.query<BlockStatsRow>(
    `SELECT
      b.id as block_id, b.block_number,
      COUNT(p.id) as total_parcels,
      COUNT(CASE WHEN p.status = 'approved' THEN 1 END) as approved,
      COUNT(CASE WHEN p.status IN ('computed', 'plan_generated', 'submitted') THEN 1 END) as in_progress,
      COUNT(CASE WHEN p.status IN ('pending', 'field_complete') THEN 1 END) as pending
     FROM blocks b
     LEFT JOIN parcels p ON p.block_id = b.id
     WHERE b.project_id = $1
     GROUP BY b.id, b.block_number
     ORDER BY b.block_number`,
    [projectId]
  )

  // Build team view
  const owner = projects[0]
  const assigneeMap = new Map<string, TeamMember>()

  assignments.forEach((a) => {
    if (!assigneeMap.has(a.assigned_to)) {
      assigneeMap.set(a.assigned_to, {
        user: { id: a.assigned_to, email: a.email, full_name: a.full_name, role: a.role },
        blocks: [],
      })
    }
    const stats = blockStats.find((s) => s.block_id === a.block_id)
    const assignee = assigneeMap.get(a.assigned_to)
    if (assignee) {
      assignee.blocks.push({
        block_id: a.block_id,
        block_number: a.block_number,
        block_name: a.block_name,
        assigned_at: a.assigned_at,
        stats: stats
          ? { total_parcels: Number(stats.total_parcels), approved: Number(stats.approved), in_progress: Number(stats.in_progress), pending: Number(stats.pending) }
          : { total_parcels: 0, approved: 0, in_progress: 0, pending: 0 },
      })
    }
  })

  // Get unassigned blocks
  const assignedBlockIds = new Set(assignments.map((a) => a.block_id))
  const { rows: allBlocks } = await db.query<BlockRow>(
    'SELECT id, block_number, block_name FROM blocks WHERE project_id = $1 ORDER BY block_number',
    [projectId]
  )
  const unassignedBlocks = allBlocks
    .filter((b) => !assignedBlockIds.has(b.id))
    .map((b) => {
      const stats = blockStats.find((s) => s.block_id === b.id)
      return {
        ...b,
        stats: stats
          ? { total_parcels: Number(stats.total_parcels), approved: Number(stats.approved), in_progress: Number(stats.in_progress), pending: Number(stats.pending) }
          : { total_parcels: 0, approved: 0, in_progress: 0, pending: 0 },
      }
    })

  return NextResponse.json({
    data: {
      owner: { id: owner.id, email: owner.email, full_name: owner.full_name, role: owner.role },
      team: Array.from(assigneeMap.values()),
      unassigned_blocks: unassignedBlocks,
    }
  })
})

/**
 * POST /api/scheme/team
 * Assign or remove a team member from a project block.
 */
export const POST = apiHandler(
  { auth: true, schema: AssignTeamSchema, rateLimit: { max: 60, windowMs: 60000 } },
  async (req, ctx) => {
    const { userId: targetUserId, role, action } = ctx.body as z.infer<typeof AssignTeamSchema>
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('project_id')

    if (!projectId) {
      return NextResponse.json({ error: 'project_id query parameter is required' }, { status: 400 })
    }

    // Verify project exists
    const { rows: projects } = await db.query<ProjectUserIdRow>(
      'SELECT user_id FROM projects WHERE id = $1',
      [projectId]
    )
    if (projects.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Only the project owner can manage team
    if (projects[0].user_id !== ctx.userId) {
      return NextResponse.json({ error: 'Only the project owner can manage team assignments' }, { status: 403 })
    }

    // Verify target user exists
    const { rows: users } = await db.query<UserIdRow>(
      'SELECT id FROM users WHERE id = $1',
      [targetUserId]
    )
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (action === 'assign') {
      // Check if already assigned
      const { rows: existing } = await db.query<ExistingAssignmentRow>(
        'SELECT id FROM block_assignments WHERE assigned_to = $1 AND block_id IN (SELECT id FROM blocks WHERE project_id = $2) LIMIT 1',
        [targetUserId, projectId]
      )
      if (existing.length > 0) {
        return NextResponse.json({ error: 'User is already assigned to this project' }, { status: 409 })
      }

      // Update user role if needed
      await db.query<never>(
        'UPDATE users SET role = $1 WHERE id = $2 AND role != $1',
        [role, targetUserId]
      )

      return NextResponse.json({ message: 'Team member assigned successfully', userId: targetUserId, role }, { status: 201 })
    }

    if (action === 'remove') {
      await db.query<never>(
        'DELETE FROM block_assignments WHERE assigned_to = $1 AND block_id IN (SELECT id FROM blocks WHERE project_id = $2)',
        [targetUserId, projectId]
      )

      return NextResponse.json({ message: 'Team member removed successfully', userId: targetUserId })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
)
