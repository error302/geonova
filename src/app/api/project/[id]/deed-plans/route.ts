export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { requireProjectOwnership } from '@/lib/auth/ownership'

/**
 * GET /api/project/[id]/deed-plans
 *
 * Fetch all saved deed plans for a project, most recent first.
 * Used by the mutation plan generator to auto-populate boundary points
 * from the project's existing deed plan data.
 *
 * SECURITY: Verifies project ownership before returning data.
 *
 * Returns: { data: DeedPlanRecord[] }
 *   where DeedPlanRecord = {
 *     id, survey_number, parcel_number, locality, area_sqm, scale,
 *     input_data (JSON with boundaryPoints), created_at
 *   }
 */
export const GET = apiHandler(
  { auth: true, rateLimit: { max: 60, windowMs: 60000 } },
  async (_req, ctx) => {
    const { id } = ctx.params

    const ownership = await requireProjectOwnership(id, ctx.userId)
    if (!ownership.ok) return ownership.error!

    const { rows } = await db.query(
      `SELECT id, survey_number, parcel_number, locality, area_sqm, scale,
              input_data, created_at
       FROM deed_plans
       WHERE project_id = $1
       ORDER BY created_at DESC`,
      [id]
    )

    return NextResponse.json({ data: rows })
  }
)
