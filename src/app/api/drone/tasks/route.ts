/**
 * /api/drone/tasks — List user's drone processing tasks
 *
 * GET — Returns the authenticated user's drone processing tasks,
 * ordered by creation date (newest first).
 *
 * Query params:
 *   status  — filter by status (optional: 'completed', 'running', 'failed')
 *   limit   — max results (default 20, max 100)
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'

export const GET = apiHandler(
  { auth: true, rateLimit: { max: 30, windowMs: 60_000 } },
  async (req: NextRequest, ctx) => {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)

    const conditions = ['user_id = $1']
    const params: unknown[] = [ctx.userId]
    let idx = 2

    if (status) {
      conditions.push(`status = $${idx++}`)
      params.push(status)
    }

    params.push(limit)

    const { rows } = await db.query(
      `SELECT id, name, project_id, photo_count, total_size_mb,
              status, progress, error_message,
              orthophoto_path, pointcloud_path, dsm_path, dtm_path, contour_path,
              webodm_task_id,
              created_at, processing_started_at, processing_completed_at, imported_at
       FROM drone_processing_tasks
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${idx}`,
      params
    )

    return NextResponse.json({ tasks: rows })
  }
)
