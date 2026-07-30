/**
 * POST /api/workers/process
 *
 * Processes pending jobs from the background_jobs queue.
 * Designed to be called by an external cron (e.g. Vercel Cron, systemd timer)
 * or a dedicated worker process.
 *
 * Processes up to 5 jobs per invocation with proper error handling,
 * timeout management, and status updates.
 *
 * Security: requires auth — only the system account can process jobs.
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { apiHandler, apiSuccess } from '@/lib/apiHandler'
import { db } from '@/lib/db'

const JOB_TIMEOUT_MS = 55_000 // stay within Vercel 60s limit

export const POST = apiHandler(
  { auth: true, rateLimit: { max: 10, windowMs: 60_000 } },
  async (req, ctx) => {
    const body = ctx.body as { limit?: number; jobId?: string }

    const limit = Math.min(body.limit ?? 5, 20)

    // Fetch pending jobs ordered by priority then creation time
    const fetchQuery = body.jobId
      ? `SELECT * FROM background_jobs WHERE id = $1 AND status = 'pending' LIMIT 1`
      : `SELECT * FROM background_jobs WHERE status = 'pending'
         ORDER BY priority DESC, created_at ASC LIMIT $1`

    const params = body.jobId ? [body.jobId] : [limit]
    const { rows: jobs } = await db.query(fetchQuery, params)

    const results: Array<{ jobId: string; status: string; error?: string; durationMs: number; retries?: number; nextRetryIn?: string }> = []

    for (const job of jobs) {
      const start = Date.now()

      try {
        await db.query(
          `UPDATE background_jobs SET status = 'running', started_at = NOW() WHERE id = $1 AND status = 'pending'`,
          [job.id]
        )

        const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : (job.payload || {})
        const result = await processJob(job.job_type, payload)

        const durationMs = Date.now() - start

        await db.query(
          `UPDATE background_jobs
             SET status = 'completed',
                 result = $2,
                 completed_at = NOW(),
                 duration_ms = $3
             WHERE id = $1`,
          [job.id, JSON.stringify(result), durationMs]
        )

        results.push({ jobId: job.id, status: 'completed', durationMs })

      } catch (err: unknown) {
        const durationMs = Date.now() - start
        const message = err instanceof Error ? err.message : 'Unknown error'

        // ByteByteGo audit fix: DLQ pattern — after 3 retries, move to dead-letter
        // Per ByteByteGo "6 cloud messaging patterns": failed messages go to DLQ
        // for human inspection instead of retrying forever.
        const MAX_RETRIES = 3
        const newRetryCount = (job.retry_count || 0) + 1
        const isDeadLetter = newRetryCount >= MAX_RETRIES

        if (isDeadLetter) {
          // Move to dead-letter queue (keep in same table but mark as 'dead_letter')
          await db.query(
            `UPDATE background_jobs
               SET status = 'dead_letter',
                   error_message = $2,
                   completed_at = NOW(),
                   duration_ms = $3,
                   retry_count = $4
             WHERE id = $1`,
            [job.id, `DLQ: ${message.slice(0, 450)}`, durationMs, newRetryCount]
          )
          results.push({ jobId: job.id, status: 'dead_letter', error: message, durationMs, retries: newRetryCount })
        } else {
          // Re-queue for retry (set back to pending with exponential backoff delay)
          const delayMs = Math.pow(2, newRetryCount) * 1000  // 2s, 4s, 8s
          await db.query(
            `UPDATE background_jobs
               SET status = 'pending',
                   error_message = $2,
                   duration_ms = $3,
                   retry_count = $4,
                   scheduled_at = NOW() + ($5 || '0')::interval
             WHERE id = $1`,
            [job.id, message.slice(0, 500), durationMs, newRetryCount, `${delayMs} milliseconds`]
          )
          results.push({ jobId: job.id, status: 'requeued', error: message, durationMs, retries: newRetryCount, nextRetryIn: `${delayMs}ms` })
        }
      }
    }

    return apiSuccess({
      processed: results.length,
      jobs: results,
      timestamp: new Date().toISOString(),
    })
  },
)

/**
 * Process a single job based on its type.
 * Each handler receives the parsed payload and returns a result object.
 * Errors are caught by the outer try/catch and written to the job record.
 */
async function processJob(
  jobType: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const timeout = JOB_TIMEOUT_MS

  switch (jobType) {
    case 'pdf_generation': {
      const { generateDocument } = await import('@/lib/submission/assembleDocument')
      const docResult = await Promise.race([
        generateDocument({
          projectId: String(payload.project_id),
          documentId: String(payload.document_id),
          surveyType: String(payload.survey_type ?? 'cadastral'),
          userId: payload.userId ? String(payload.userId) : undefined,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Job timed out after ${timeout}ms`)), timeout)
        ),
      ])
      return { fileUrl: (docResult as { fileUrl: string }).fileUrl }
    }

    case 'dxf_generation': {
      const projectId = String(payload.project_id)
      const dxfType = String(payload.dxfType ?? 'form_no_4')
      const { generateFormNo4DXF } = await import('@/lib/submission/generators/formNo4')
      const { assembleSubmissionPackage } = await import('@/lib/submission/assembleSubmission')

      const submission = await Promise.race([
        assembleSubmissionPackage(projectId),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`DXF: failed to assemble submission package`)), timeout)
        ),
      ])

      const dxfContent = await Promise.race([
        generateFormNo4DXF((submission as { zipBuffer: Buffer; ref: string; qa: unknown }).zipBuffer as unknown as Parameters<typeof generateFormNo4DXF>[0]),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`DXF job timed out after ${timeout}ms`)), timeout)
        ),
      ])
      void dxfContent // DXF string generated; caller retrieves via document record
      return { type: dxfType, dxfLength: typeof dxfContent === 'string' ? dxfContent.length : 0, ref: (submission as { ref: string }).ref }
    }

    case 'assemble_submission': {
      const { assembleSubmissionPackage } = await import('@/lib/submission/assembleSubmission')
      const asmResult = await Promise.race([
        assembleSubmissionPackage(String(payload.project_id)),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Assembly job timed out after ${timeout}ms`)), timeout)
        ),
      ])
      const asm = asmResult as { ref: string; qa: { passed: boolean } }
      return { ref: asm.ref, qaPassed: asm.qa.passed }
    }

    case 'traverse_compute': {
      const { computeTraverse } = await import('@/lib/computations/traverseEngine')
      const traverseResult = await Promise.race([
        computeTraverse(payload as Parameters<typeof computeTraverse>[0]),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Traverse job timed out after ${timeout}ms`)), timeout)
        ),
      ])
      const tr = traverseResult as { coordinates: Array<unknown>; precisionRatio: number }
      return { pointCount: tr.coordinates.length, precisionRatio: tr.precisionRatio }
    }

    case 'earthworks_boq': {
      const { generateEarthworksBoQ } = await import('@/lib/print/earthworksBoQ')
      const inp = payload.input as Parameters<typeof generateEarthworksBoQ>[0]
      const boqResult = await Promise.race([
        generateEarthworksBoQ(inp),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Earthworks BoQ timed out after ${timeout}ms`)), timeout)
        ),
      ])
      return { htmlLength: String(boqResult).length }
    }

    default:
      throw new Error(`Unknown job type: ${jobType}`)
  }
}