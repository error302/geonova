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

import { NextRequest, NextResponse } from 'next/server'
import { apiHandler, apiSuccess } from '@/lib/apiHandler'
import { db } from '@/lib/db'

export const GET = apiHandler(
  { auth: true, rateLimit: { max: 120, windowMs: 60_000 } },
  async (req, ctx) => {
    const { jobId } = ctx.params as { jobId: string }

    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 })
    }

    // Use parameterized query — jobId is a UUID, never interpolated
    const { rows } = await db.query(
      `SELECT id, job_type, status, payload, result, error_message,
              priority, retry_count, created_at, started_at, completed_at, duration_ms
         FROM background_jobs
        WHERE id = $1
        LIMIT 1`,
      [jobId]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const job = rows[0]

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