export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { requireProjectOwnership } from '@/lib/auth/ownership'
import { db } from '@/lib/db'
import { getActiveSurveyorProfile } from '@/lib/submission/surveyorProfile'
import { generateSubmissionRef } from '@/lib/submission/revisionNumber'

export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  try {
    const projectId = req.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    const surveyor = await getActiveSurveyorProfile()
    if (!surveyor) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // IDOR protection — verify project ownership before returning
    // full project data (survey points, traverse, parcel info)
    const userId = (session?.user as { id?: string })?.id
    const ownership = await requireProjectOwnership(projectId, userId)
    if (!ownership.ok) return ownership.error!

    const { rows: projectRows } = await db.query(
      'SELECT * FROM projects WHERE id = $1 LIMIT 1',
      [projectId]
    )

    if (projectRows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const project = projectRows[0]

    // Simulate joined relations for survey_points (supporting_docs doesn't exist on projects table usually, mock if needed)
    const { rows: pointsRows } = await db.query(
      'SELECT * FROM survey_points WHERE project_id = $1',
      [projectId]
    )

    project.survey_points = pointsRows
    project.supporting_documents = [] // Fallback since it's not a standard table

    const { ref, revision } = await generateSubmissionRef(
      projectId,
      surveyor.registration_number
    )

    const pkg = {
      submissionRef: ref,
      projectId,
      surveyor,
      subtype: project.survey_type || 'cadastral_subdivision',
      parcel: {
        lrNumber: project.lr_number || '',
        county: project.county || '',
        district: project.district || '',
        locality: project.locality || '',
        areaM2: project.area_m2 || 0,
        perimeterM: project.perimeter_m || 0
      },
      traverse: {
        points: (project.survey_points || []).map((pt: any) => ({
          pointName: pt.name || `P${pt.id}`,
          easting: pt.easting || 0,
          northing: pt.northing || 0,
          adjustedEasting: pt.adjusted_easting || pt.easting || 0,
          adjustedNorthing: pt.adjusted_northing || pt.northing || 0,
          observedBearing: pt.observed_bearing || 0,
          observedDistance: pt.observed_distance || 0
        })),
        angularMisclosure: project.angular_misclosure || 0,
        linearMisclosure: project.linear_misclosure || 0,
        precisionRatio: project.precision_ratio || '1:1',
        closingErrorE: project.closing_error_e || 0,
        closingErrorN: project.closing_error_n || 0,
        adjustmentMethod: 'bowditch',
        areaM2: project.area_m2 || 0,
        perimeterM: project.perimeter_m || 0
      },
      supportingDocs: project.supporting_documents || [],
      generatedAt: new Date().toISOString(),
      revision
    }

    return NextResponse.json(pkg)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
