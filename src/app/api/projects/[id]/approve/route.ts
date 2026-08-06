export const dynamic = 'force-dynamic'

/**
 * POST /api/projects/[id]/approve
 *
 * Approve & Lock a project.
 *
 * Only a LICENSED surveyor with verified ISK credentials can invoke this.
 * The handler:
 *   1. Resolves the caller's role from surveyor_profiles
 *   2. Checks RBAC via canApproveAndLock()
 *   3. Builds a canonical JSON of all control_points + parcels
 *   4. Computes a SHA-256 cryptographic seal
 *   5. Sets project status to 'LOCKED' and stores the seal
 */

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { createHash } from 'crypto'
import { getRoleFromProfile, canApproveAndLock } from '@/lib/rbac'
import { notifyProjectLocked } from '@/lib/notifications/africasTalking'

interface SurveyorProfileRow {
  role: string | null
  verified_isk: boolean | null
  phone: string | null
}

interface ApprovalProjectRow {
  id: string
  status: string
  name: string | null
  lr_number: string | null
}

interface LockedProjectRow {
  id: string
  status: string
  cryptographic_seal: string | null
  updated_at: Date | string
}

interface SurveyPointRow {
  point_name: string
  easting: number
  northing: number
  elevation: number | null
  description: string | null
}

interface ApprovalParcelRow {
  parcel_number: string
  area_ha: number | null
  status: string
}

export const POST = apiHandler({ auth: true, audit: 'project:approve_lock', rateLimit: { max: 60, windowMs: 60000 },
  auditChain: { entityType: 'parcel', action: 'lock', entityIdParam: 'id' } }, async (_req, ctx) => {
  const projectId = ctx.params.id

  if (!projectId) {
    return NextResponse.json(
      { error: 'Project ID is required', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  // ── 1. Resolve role from surveyor_profiles ──────────────────────────
  const email = ctx.session?.user?.email
  if (!email) {
    return NextResponse.json(
      { error: 'Cannot determine user email from session', code: 'UNAUTHORIZED' },
      { status: 401 }
    )
  }

  const { rows: profileRows } = await db.query<SurveyorProfileRow>(
    `SELECT role, verified_isk, phone
     FROM surveyor_profiles
     WHERE email = $1
     LIMIT 1`,
    [email]
  )

  if (profileRows.length === 0) {
    return NextResponse.json(
      { error: 'Surveyor profile not found. Please complete your profile.', code: 'PROFILE_MISSING' },
      { status: 403 }
    )
  }

  const profile = profileRows[0]
  const role = getRoleFromProfile({ role: profile.role, verified_isk: profile.verified_isk })
  const verifiedIsk = !!profile.verified_isk

  // ── 2. RBAC check ───────────────────────────────────────────────────
  if (!canApproveAndLock(role, verifiedIsk)) {
    return NextResponse.json(
      { error: 'Only licensed surveyors with verified ISK can approve and lock projects.', code: 'FORBIDDEN' },
      { status: 403 }
    )
  }

  // ── 3. Verify project exists and is not already locked ──────────────
  const { rows: projectRows } = await db.query<ApprovalProjectRow>(
    `SELECT id, status, name, lr_number FROM projects WHERE id = $1`,
    [projectId]
  )

  if (projectRows.length === 0) {
    return NextResponse.json(
      { error: 'Project not found', code: 'NOT_FOUND' },
      { status: 404 }
    )
  }

  if (projectRows[0].status === 'LOCKED') {
    return NextResponse.json(
      { error: 'Project is already locked and approved.', code: 'ALREADY_LOCKED' },
      { status: 409 }
    )
  }

  // ── 4. Fetch all control points and parcels for canonical hashing ────
  // AUDIT FIX (2026-07-03): control_points table doesn't exist → use
  // survey_points WHERE is_control=true. survey_points.name → point_name.
  // parcels.area_sqm → area_ha. Removed non-existent geometry_type/
  // description columns.
  const [pointsResult, parcelsResult] = await Promise.all([
    db.query<SurveyPointRow>(
      `SELECT point_name, easting, northing, elevation, description
       FROM survey_points
       WHERE project_id = $1 AND is_control = true
       ORDER BY point_name ASC`,
      [projectId]
    ),
    db.query<ApprovalParcelRow>(
      `SELECT parcel_number, area_ha, status
       FROM parcels
       WHERE project_id = $1
       ORDER BY parcel_number ASC`,
      [projectId]
    ),
  ])

  // ── 5. Build canonical JSON and compute SHA-256 seal ─────────────────
  const canonicalPayload = {
    projectId,
    control_points: pointsResult.rows,
    parcels: parcelsResult.rows,
  }

  const canonicalJson = JSON.stringify(canonicalPayload, Object.keys(canonicalPayload).sort())
  const seal = createHash('sha256').update(canonicalJson).digest('hex')

  // ── 6. Lock the project with the cryptographic seal ──────────────────
  const { rows: updatedRows } = await db.query<LockedProjectRow>(
    `UPDATE projects
     SET status = 'LOCKED',
         cryptographic_seal = $1,
         updated_at = NOW()
     WHERE id = $2 AND status != 'LOCKED'
     RETURNING id, status, cryptographic_seal, updated_at`,
    [seal, projectId]
  )

  if (updatedRows.length === 0) {
    // Race condition: another request locked it first
    return NextResponse.json(
      { error: 'Project was locked by another request.', code: 'ALREADY_LOCKED' },
      { status: 409 }
    )
  }

  // ── 7. Notify surveyor via SMS (non-blocking) ───────────────────
  try {
    const projectName = projectRows[0].name || projectId
    const lrNumber = projectRows[0].lr_number || undefined
    const surveyorName = ctx.session?.user?.name || email
    const surveyorPhone = profile.phone || undefined

    await notifyProjectLocked({
      projectName,
      lrNumber,
      surveyorName,
      surveyorPhone,
      seal,
      projectId,
    })
  } catch (notifyErr) {
    console.error('[project:approve] Notification failed (non-blocking):', notifyErr)
  }

  return NextResponse.json({
    success: true,
    seal,
    lockedAt: updatedRows[0].updated_at
      ? new Date(updatedRows[0].updated_at).toISOString()
      : new Date().toISOString(),
  })
})
