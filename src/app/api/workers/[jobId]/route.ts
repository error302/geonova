/**
 * GET /api/workers/[jobId]
 * GET /api/workers/[jobId]/status  (alternative path)
 *
 * Returns the current status of a background job including
 * result, error, duration, and retry count.
 *
 * The jobId comes from the URL param, not query string, so it can't
 * be enumerated by casual scanning (though jobs are still scoped to
 * the user's org via RLS).
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler, apiSuccess } from '@/lib/apiHandler'
import { db } from '@/lib/db'

interface JobDetailRow {
  id: string
  job_type: string
  status: string
  payload: unknown
  result: unknown
  error_message: string | null
  priority: number
  retry_count: number
  created_by: string | null
  created_at: Date
  started_at: Date | null
  completed_at: Date | null
  duration_ms: number | null
}

export const GET = apiHandler(
  { auth: true, rateLimit: { max: 120, windowMs: 60_000 } },
  async (req, ctx) => {
    const { jobId } = ctx.params as { jobId: string }

    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 })
    }

    // Use parameterized query — jobId is a UUID, never interpolated.
    // SECURITY (audit H-05, 2026-08-30): jobs are attributed to their creator
    // (migration 057). A caller may read a job only if they created it or are
    // an admin; legacy rows with NULL created_by are admin-only. Previously
    // any authenticated user could read any job's payload and result by bare
    // UUID — payloads can contain full job inputs.
    const { rows } = await db.query<JobDetailRow>(
      `SELECT id, job_type, status, payload, result, error_message,
              priority, retry_count, created_by, created_at, started_at, completed_at, duration_ms
         FROM background_jobs
        WHERE id = $1
        LIMIT 1`,
      [jobId]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const job = rows[0]
    const callerRole = (ctx.session?.user as { role?: string } | undefined)?.role
    const isAdmin = callerRole === 'admin' || callerRole === 'super_admin'
    if (!isAdmin && job.created_by !== ctx.userId) {
      return NextResponse.json(
        { error: 'You do not have access to this job', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    return apiSuccess({
      id: job.id,
      jobType: job.job_type,
      status: job.status,
      priority: job.priority,
      retryCount: job.retry_count,
      errorMessage: job.error_message,
      result: job.result,
      createdAt: job.created_at,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      durationMs: job.duration_ms,
    })
  }
)