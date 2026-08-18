/**
 * GET /api/submission/status?projectId=<uuid>
 *
 * Returns the persisted submission QA status for a project — the reviewer
 * facing mirror of the package's manifest qaResult, so the GNSS QC override
 * reason and the underlying QC failures are visible on the submission page
 * WITHOUT opening the assembled ZIP.
 *
 * Reads the latest project_submissions row (validation_results + the stored
 * GNSS observation report in generated_artifacts) and builds the status view
 * via buildSubmissionQAStatus() (pure, unit-tested).
 *
 * Response:
 *   200: SubmissionQAStatusView
 *   400: missing projectId
 *   403: project belongs to another user (IDOR protection)
 *   404: surveyor profile missing (requireProjectOwnership dependency)
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler, apiSuccess } from '@/lib/apiHandler'
import { requireProjectOwnership } from '@/lib/auth/ownership'
import { db } from '@/lib/db'
import {
  buildSubmissionQAStatus,
} from '@/lib/submission/submissionStatus'
import type { GNSSObservationReport } from '@/lib/submission/gnssObservationReport'

/** Latest project_submissions row (typed callback params for the raw query). */
interface SubmissionStatusRow {
  submission_number: string | null
  package_status: string | null
  revision_code: string | null
  generated_artifacts: Record<string, unknown> | null
  validation_results: Record<string, unknown> | null
  created_at: string
}

/** Parse the structured GNSS report stored under generated_artifacts. */
function parseStoredGNSSReport(
  artifacts?: Record<string, unknown> | null
): GNSSObservationReport | null {
  const stored = artifacts?.['gnss_observation_report']
  if (stored && typeof stored === 'object') {
    return stored as GNSSObservationReport
  }
  if (typeof stored === 'string') {
    try {
      return JSON.parse(stored) as GNSSObservationReport
    } catch {
      return null
    }
  }
  return null
}

export const GET = apiHandler(
  { auth: true, rateLimit: { max: 120, windowMs: 60000 } },
  async (req, ctx) => {
    const projectId = new URL(req.url).searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    // IDOR protection — only the project owner (surveyor / team) may read
    // the QA status, which includes QC failure details.
    const ownership = await requireProjectOwnership(projectId, ctx.userId)
    if (!ownership.ok) {
      if (!ownership.error) throw new Error('Ownership check failed without an error response')
      return ownership.error
    }

    const { rows } = await db.query<SubmissionStatusRow>(
      `SELECT submission_number, package_status, revision_code,
              generated_artifacts, validation_results, created_at
       FROM project_submissions
       WHERE project_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [projectId]
    )
    const row = rows[0]

    return apiSuccess(
      buildSubmissionQAStatus({
        submission: row
          ? {
              submissionNumber: row.submission_number,
              packageStatus: row.package_status,
              generatedAt: row.created_at,
            }
          : null,
        validationResults: row?.validation_results,
        gnssReport: parseStoredGNSSReport(row?.generated_artifacts),
      })
    )
  }
)
