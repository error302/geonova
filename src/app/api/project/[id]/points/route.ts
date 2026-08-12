export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { requireProjectOwnership } from '@/lib/auth/ownership'

interface SurveyPointFullRow {
  id: string
  point_name: string
  easting: number | null
  northing: number | null
  elevation: number | null
  code: string | null
  description: string | null
  is_control: boolean
  datum: string | null
  projection: string | null
  utm_zone: string | null
  hemisphere: string | null
  epoch_year: number | null
  std_dev_e: number | null
  std_dev_n: number | null
  std_dev_z: number | null
  error_ellipse_major: number | null
  error_ellipse_minor: number | null
  error_ellipse_orient: number | null
  confidence_level: string | null
  source: string | null
  instrument_id: string | null
  observer_id: string | null
  import_session_id: string | null
  observation_date: Date | null
  created_at: Date
  updated_at: Date
}

/**
 * GET /api/project/[id]/points
 *
 * Fetch all survey points for a project, ordered by point name.
 * Used by the deed plan generator, contour generator, mutation plan,
 * cross-sections, and earthworks tools to auto-populate from project data.
 *
 * AUDIT FIX (C5, 2026-07-02): Expanded SELECT to include the CRS,
 * accuracy, and provenance columns added by migration 027. This lets
 * downstream tools (LSA, deformation analysis, deed plan generation)
 * know the datum, zone, accuracy, and source of each coordinate.
 *
 * T1.7 FIX (2026-07-09): Added requireProjectOwnership — previously any
 * authenticated user could read any project's survey points (IDOR). Mirrors
 * the deed-plans endpoint pattern.
 *
 * Returns: { data: SurveyPoint[], meta: { project_crs } }
 *   where SurveyPoint = {
 *     id, point_name, easting, northing, elevation, code, description, is_control,
 *     datum, projection, utm_zone, hemisphere, epoch_year,
 *     std_dev_e, std_dev_n, std_dev_z,
 *     error_ellipse_major, error_ellipse_minor, error_ellipse_orient, confidence_level,
 *     source, instrument_id, observer_id, import_session_id, observation_date
 *   }
 *   meta.project_crs = { datum, utm_zone, hemisphere } from the parent project
 */
export const GET = apiHandler(
  { auth: true, rateLimit: { max: 60, windowMs: 60000 } },
  async (_req, ctx) => {
    const { id } = ctx.params

    // T1.7: Verify project ownership before returning data (IDOR fix).
    const ownership = await requireProjectOwnership(id, ctx.userId)
    if (!ownership.ok) {
  if (!ownership.error) throw new Error('Ownership check failed without an error response')
  return ownership.error
}

    const { rows } = await db.query<SurveyPointFullRow>(
      `SELECT
         -- Identity
         id, point_name, easting, northing, elevation,
         code, description, is_control,
         -- CRS (migration 027)
         datum, projection, utm_zone, hemisphere, epoch_year,
         -- Accuracy (migration 027)
         std_dev_e, std_dev_n, std_dev_z,
         error_ellipse_major, error_ellipse_minor, error_ellipse_orient, confidence_level,
         -- Provenance (migration 027)
         source, instrument_id, observer_id, import_session_id, observation_date,
         -- Timestamps
         created_at, updated_at
       FROM survey_points
       WHERE project_id = $1
         AND easting IS NOT NULL
         AND northing IS NOT NULL
       ORDER BY point_name ASC`,
      [id]
    )

    // Also return the project-level CRS so consumers can fall back to it
    // when a point-level CRS field is null.
    const projectResult = await db.query<{ utm_zone?: number | null; hemisphere?: string | null; datum?: string | null }>(
      `SELECT utm_zone, hemisphere, datum
       FROM projects
       WHERE id = $1`,
      [id]
    )
    const projectCrs = projectResult.rows[0] ?? null

    return NextResponse.json({
      data: rows,
      meta: {
        project_id: id,
        project_crs: projectCrs
          ? {
              utm_zone: projectCrs.utm_zone,
              hemisphere: projectCrs.hemisphere,
              datum: projectCrs.datum,
            }
          : null,
        count: rows.length,
      },
    })
  }
)
