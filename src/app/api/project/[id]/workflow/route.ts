export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import {
  getWorkflowStatus,
  advanceWorkflow,
  type ProjectWorkflowData,
} from '@/lib/workflows/projectWorkflowEngine'

interface ProjectRow {
  id: string
  name: string | null
  survey_type: string | null
  location: string | null
  utm_zone: number | null
  hemisphere: string | null
  workflow_step: number | null
  workflow_max_unlocked: number | null
}

interface CntRow {
  cnt: number
}

interface QcRow {
  passed: boolean
  acknowledged: boolean
}

/**
 * GET /api/project/[id]/workflow
 * Returns the full workflow status for a project.
 */
export const GET = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (_req, ctx) => {
  const { id } = ctx.params

  // Fetch project data
  const { rows } = await db.query<ProjectRow>(
    `SELECT p.id, p.name, p.survey_type, p.location, p.utm_zone, p.hemisphere,
            p.workflow_step, p.workflow_max_unlocked
     FROM projects p
     WHERE p.id = $1 AND p.user_id = $2`,
    [id, ctx.userId]
  )

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const project = rows[0]

  // Fetch related counts
  const [pointsRes, fieldbookRes, computationsRes, deedPlanRes, submissionRes] = await Promise.all([
    db.query<CntRow>('SELECT COUNT(*)::int AS cnt FROM survey_points WHERE project_id = $1', [id]),
    db.query<CntRow>('SELECT COUNT(*)::int AS cnt FROM fieldbook_entries WHERE project_id = $1 AND deleted_at IS NULL', [id]).catch(() => ({ rows: [{ cnt: 0 }] })),
    db.query<CntRow>("SELECT COUNT(*)::int AS cnt FROM computations WHERE project_id = $1 AND status = 'completed'", [id]).catch(() => ({ rows: [{ cnt: 0 }] })),
    db.query<CntRow>('SELECT COUNT(*)::int AS cnt FROM deed_plans WHERE project_id = $1', [id]).catch(() => ({ rows: [{ cnt: 0 }] })),
    db.query<CntRow>('SELECT COUNT(*)::int AS cnt FROM submissions WHERE project_id = $1', [id]).catch(() => ({ rows: [{ cnt: 0 }] })),
  ])

  const pointCount = pointsRes.rows[0]?.cnt ?? 0
  const fieldbookEntryCount = fieldbookRes.rows[0]?.cnt ?? 0
  const hasComputationResults = (computationsRes.rows[0]?.cnt ?? 0) > 0
  const hasDeedPlan = (deedPlanRes.rows[0]?.cnt ?? 0) > 0
  const hasSubmissionPackage = (submissionRes.rows[0]?.cnt ?? 0) > 0

  // Check tolerance from quality_checks table (or derive from computations)
  let toleranceCheckPassed: boolean | null = null
  let toleranceAcknowledged = false
  try {
    const qcRes = await db.query<QcRow>(
      'SELECT passed, acknowledged FROM quality_checks WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1',
      [id]
    )
    if (qcRes.rows.length > 0) {
      toleranceCheckPassed = qcRes.rows[0].passed
      toleranceAcknowledged = !!qcRes.rows[0].acknowledged
    }
  } catch {
    // quality_checks table may not exist yet — that's OK
  }

  const workflowData: ProjectWorkflowData = {
    id: project.id,
    name: project.name,
    surveyType: project.survey_type,
    location: project.location,
    utmZone: project.utm_zone,
    hemisphere: project.hemisphere,
    currentStep: project.workflow_step ?? 1,
    maxUnlocked: project.workflow_max_unlocked ?? 1,
    pointCount,
    fieldbookEntryCount,
    hasComputationResults,
    toleranceCheckPassed,
    toleranceAcknowledged,
    hasDeedPlan,
    hasSubmissionPackage,
  }

  const status = getWorkflowStatus(workflowData)

  return NextResponse.json({ data: status })
})

/**
 * POST /api/project/[id]/workflow/advance
 * Advance the workflow to the next step if conditions are met.
 * Body: { acknowledgeTolerance?: boolean }
 */
export const POST = apiHandler({ auth: true, rateLimit: { max: 30, windowMs: 60000 } }, async (_req, ctx) => {
  const { id } = ctx.params
  const body = ctx.body as { acknowledgeTolerance?: boolean } | undefined

  // Fetch project data
  const { rows } = await db.query<ProjectRow>(
    `SELECT p.id, p.name, p.survey_type, p.location, p.utm_zone, p.hemisphere,
            p.workflow_step, p.workflow_max_unlocked
     FROM projects p
     WHERE p.id = $1 AND p.user_id = $2`,
    [id, ctx.userId]
  )

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const project = rows[0]

  // If acknowledging tolerance, save that first
  if (body?.acknowledgeTolerance) {
    try {
      await db.query(
        `INSERT INTO quality_checks (project_id, passed, acknowledged, created_at)
         VALUES ($1, false, true, NOW())
         ON CONFLICT (project_id) DO UPDATE SET acknowledged = true`,
        [id]
      )
    } catch {
      // If table doesn't exist, we can still proceed with in-memory state
    }
  }

  // Fetch related counts
  const [pointsRes, fieldbookRes, computationsRes, deedPlanRes, submissionRes] = await Promise.all([
    db.query<CntRow>('SELECT COUNT(*)::int AS cnt FROM survey_points WHERE project_id = $1', [id]),
    db.query<CntRow>('SELECT COUNT(*)::int AS cnt FROM fieldbook_entries WHERE project_id = $1 AND deleted_at IS NULL', [id]).catch(() => ({ rows: [{ cnt: 0 }] })),
    db.query<CntRow>("SELECT COUNT(*)::int AS cnt FROM computations WHERE project_id = $1 AND status = 'completed'", [id]).catch(() => ({ rows: [{ cnt: 0 }] })),
    db.query<CntRow>('SELECT COUNT(*)::int AS cnt FROM deed_plans WHERE project_id = $1', [id]).catch(() => ({ rows: [{ cnt: 0 }] })),
    db.query<CntRow>('SELECT COUNT(*)::int AS cnt FROM submissions WHERE project_id = $1', [id]).catch(() => ({ rows: [{ cnt: 0 }] })),
  ])

  let toleranceCheckPassed: boolean | null = null
  let toleranceAcknowledged = !!body?.acknowledgeTolerance
  try {
    const qcRes = await db.query<QcRow>(
      'SELECT passed, acknowledged FROM quality_checks WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1',
      [id]
    )
    if (qcRes.rows.length > 0) {
      toleranceCheckPassed = qcRes.rows[0].passed
      toleranceAcknowledged = qcRes.rows[0].acknowledged || !!body?.acknowledgeTolerance
    }
  } catch {
    // OK
  }

  const workflowData: ProjectWorkflowData = {
    id: project.id,
    name: project.name,
    surveyType: project.survey_type,
    location: project.location,
    utmZone: project.utm_zone,
    hemisphere: project.hemisphere,
    currentStep: project.workflow_step ?? 1,
    maxUnlocked: project.workflow_max_unlocked ?? 1,
    pointCount: pointsRes.rows[0]?.cnt ?? 0,
    fieldbookEntryCount: fieldbookRes.rows[0]?.cnt ?? 0,
    hasComputationResults: (computationsRes.rows[0]?.cnt ?? 0) > 0,
    toleranceCheckPassed,
    toleranceAcknowledged,
    hasDeedPlan: (deedPlanRes.rows[0]?.cnt ?? 0) > 0,
    hasSubmissionPackage: (submissionRes.rows[0]?.cnt ?? 0) > 0,
  }

  const newStep = advanceWorkflow(workflowData)

  if (newStep === null) {
    const status = getWorkflowStatus(workflowData)
    return NextResponse.json(
      { error: 'Cannot advance workflow', blockers: status.blockers },
      { status: 400 }
    )
  }

  // Update project in DB
  const newMax = Math.max(workflowData.maxUnlocked, newStep)
  await db.query(
    'UPDATE projects SET workflow_step = $1, workflow_max_unlocked = $2, updated_at = NOW() WHERE id = $3',
    [newStep, newMax, id]
  )

  // Return updated status
  const updatedData = { ...workflowData, currentStep: newStep, maxUnlocked: newMax }
  const status = getWorkflowStatus(updatedData)

  return NextResponse.json({ data: { newStep, status } })
})
