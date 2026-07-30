export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
export const POST = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (request, ctx) => {
  const { type, projectId, outputFormat, inputData } = ctx.body as {
    type?: string
    projectId?: string
    outputFormat?: string
    inputData?: Record<string, unknown>
  }

  const pointCount = (inputData as { points?: unknown[] })?.points?.length || 0

  if (pointCount < 500) {
    return NextResponse.json({
      message: 'Small job - process synchronously',
      pointCount,
      svg: '<svg></svg>'
    })
  }

  const result = await db.query(
    `INSERT INTO render_jobs (user_id, project_id, type, status, input_data, output_format, point_count, estimated_secs)
     VALUES ($1, $2, $3, 'QUEUED', $4, $5, $6, $7)
     RETURNING id, estimated_secs`,
    [ctx.userId, projectId, type, inputData, outputFormat || 'PDF', pointCount, Math.ceil(pointCount * 0.1)]
  )

  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'Failed to create render job' }, { status: 500 })
  }

  const job = result.rows[0]

  // ByteByteGo audit fix: return 202 Accepted with Location header for async job
  // Per ByteByteGo "Async Request-Reply" pattern: return 202 + polling URL
  return NextResponse.json({
    jobId: job.id,
    status: 'QUEUED',
    estimatedSeconds: job.estimated_secs,
    pollUrl: `/api/workers/${job.id}`,
  }, {
    status: 202,
    headers: {
      'Location': `/api/workers/${job.id}`,
    },
  })
})
