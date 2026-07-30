/**
 * /api/drone/process — Start + monitor photogrammetry processing
 *
 * POST — Start processing a drone task.
 *   - Requires auth
 *   - If WebODM is configured: creates a WebODM task, uploads photos, starts processing
 *   - If WebODM is not configured: returns instructions for manual processing
 *
 * GET — Check processing status.
 *   - If WebODM task exists: polls WebODM for current status + progress
 *   - Returns status, progress, and output paths (when completed)
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { promises as fs } from 'fs'
import path from 'path'
import {
  isWebODMConfigured,
  createWebODMTask,
  getWebODMTaskStatus,
  downloadWebODMResult,
  type WebODMTaskOptions,
} from '@/lib/integrations/webOdm'

const STORAGE_ROOT = process.env.STORAGE_ROOT || path.join(process.cwd(), 'uploads')

// ── POST: Start processing ──

export const POST = apiHandler(
  { auth: true, rateLimit: { max: 5, windowMs: 60_000 } },
  async (req: NextRequest, ctx) => {
    const body = await req.json().catch(() => ({}))
    const taskId = body.taskId as string

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required', code: 'MISSING_TASK' }, { status: 400 })
    }

    // Fetch the task
    const { rows } = await db.query(
      'SELECT * FROM drone_processing_tasks WHERE id = $1 AND user_id = $2',
      [taskId, ctx.userId]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Task not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    const task = rows[0]

    if (task.photo_count === 0) {
      return NextResponse.json({ error: 'No photos uploaded yet', code: 'NO_PHOTOS' }, { status: 400 })
    }

    if (task.status === 'running' || task.status === 'completed') {
      return NextResponse.json({ error: `Task is already ${task.status}`, code: 'ALREADY_PROCESSING' }, { status: 409 })
    }

    // Parse processing options
    const options: WebODMTaskOptions = {
      'dem-resolution': body.demResolution ?? 5,
      'orthophoto-resolution': body.orthophotoResolution ?? 5,
      dsm: body.dsm ?? true,
      dtm: body.dtm ?? true,
      'contour-resolution': body.contourResolution ?? 0.5,
      ...task.options,
    }

    // ── Check if WebODM is configured ──
    if (!isWebODMConfigured()) {
      // WebODM not configured — mark as 'queued' but can't actually process
      await db.query(
        `UPDATE drone_processing_tasks
         SET status = 'queued', options = $2, updated_at = NOW()
         WHERE id = $1`,
        [taskId, JSON.stringify(options)]
      )

      return NextResponse.json({
        taskId,
        status: 'queued',
        message: 'WebODM is not configured on this server. Photos are saved and ready for manual processing.',
        webodmConfigured: false,
        photosDir: task.photos_dir,
        instructions: 'To process these photos, either configure WebODM (set WEBODM_URL + WEBODM_TOKEN env vars) or process them externally and upload the results.',
      })
    }

    // ── WebODM is configured — start processing ──
    try {
      // Get all photo file paths
      const photoFiles = await fs.readdir(task.photos_dir)
      const photoPaths = photoFiles
        .filter(f => /\.(jpg|jpeg|png|tif|tiff)$/i.test(f))
        .map(f => path.join(task.photos_dir, f))

      if (photoPaths.length === 0) {
        return NextResponse.json({ error: 'No valid photo files found', code: 'NO_PHOTOS' }, { status: 400 })
      }

      // Create WebODM task
      const webodmTaskId = await createWebODMTask(photoPaths, task.name, options)

      // Update task with WebODM ID + status
      await db.query(
        `UPDATE drone_processing_tasks
         SET status = 'queued',
             webodm_task_id = $2,
             webodm_url = $3,
             options = $4,
             processing_started_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [taskId, webodmTaskId, process.env.WEBODM_URL, JSON.stringify(options)]
      )

      return NextResponse.json({
        taskId,
        webodmTaskId,
        status: 'queued',
        message: 'Processing started. Photos uploaded to WebODM.',
        webodmConfigured: true,
      })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'

      await db.query(
        `UPDATE drone_processing_tasks
         SET status = 'failed', error_message = $2, updated_at = NOW()
         WHERE id = $1`,
        [taskId, errorMsg]
      )

      return NextResponse.json(
        { error: `Processing failed to start: ${errorMsg}`, code: 'WEBODM_ERROR' },
        { status: 500 }
      )
    }
  }
)

// ── GET: Check status ──

export const GET = apiHandler(
  { auth: true, rateLimit: { max: 30, windowMs: 60_000 } },
  async (req: NextRequest, ctx) => {
    const { searchParams } = new URL(req.url)
    const taskId = searchParams.get('taskId')

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required', code: 'MISSING_TASK' }, { status: 400 })
    }

    const { rows } = await db.query(
      'SELECT * FROM drone_processing_tasks WHERE id = $1 AND user_id = $2',
      [taskId, ctx.userId]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Task not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    const task = rows[0]

    // If task has a WebODM ID and is still processing, poll for status
    if (task.webodm_task_id && (task.status === 'queued' || task.status === 'running')) {
      try {
        const webodmStatus = await getWebODMTaskStatus(task.webodm_task_id)

        // Update task in DB with latest status
        if (webodmStatus.status === 'completed') {
          // Download results
          const resultsDir = path.join(STORAGE_ROOT, 'drone-results', taskId)
          await fs.mkdir(resultsDir, { recursive: true })

          const outputs = webodmStatus.outputs
          const updateFields: string[] = ['status = $2', 'progress = $3', 'processing_completed_at = NOW()', 'updated_at = NOW()']
          const updateParams: unknown[] = [taskId, 'completed', 100]
          let paramIdx = 4

          if (outputs?.orthophotoUrl) {
            const orthoPath = path.join(resultsDir, 'orthophoto.tif')
            await downloadWebODMResult(outputs.orthophotoUrl, orthoPath)
            updateFields.push(`orthophoto_path = $${paramIdx++}`)
            updateParams.push(path.relative(STORAGE_ROOT, orthoPath))
          }
          if (outputs?.pointcloudUrl) {
            const pcPath = path.join(resultsDir, 'pointcloud.las')
            await downloadWebODMResult(outputs.pointcloudUrl, pcPath)
            updateFields.push(`pointcloud_path = $${paramIdx++}`)
            updateParams.push(path.relative(STORAGE_ROOT, pcPath))
          }
          if (outputs?.dsmUrl) {
            const dsmPath = path.join(resultsDir, 'dsm.tif')
            await downloadWebODMResult(outputs.dsmUrl, dsmPath)
            updateFields.push(`dsm_path = $${paramIdx++}`)
            updateParams.push(path.relative(STORAGE_ROOT, dsmPath))
          }
          if (outputs?.dtmUrl) {
            const dtmPath = path.join(resultsDir, 'dtm.tif')
            await downloadWebODMResult(outputs.dtmUrl, dtmPath)
            updateFields.push(`dtm_path = $${paramIdx++}`)
            updateParams.push(path.relative(STORAGE_ROOT, dtmPath))
          }
          if (outputs?.contourUrl) {
            const contourPath = path.join(resultsDir, 'contours.geojson')
            await downloadWebODMResult(outputs.contourUrl, contourPath)
            updateFields.push(`contour_path = $${paramIdx++}`)
            updateParams.push(path.relative(STORAGE_ROOT, contourPath))
          }

          await db.query(
            `UPDATE drone_processing_tasks SET ${updateFields.join(', ')} WHERE id = $1`,
            updateParams
          )

          // Re-fetch the updated task
          const updated = await db.query(
            'SELECT * FROM drone_processing_tasks WHERE id = $1',
            [taskId]
          )
          if (updated.rows.length > 0) {
            return NextResponse.json({ task: updated.rows[0] })
          }
        } else if (webodmStatus.status === 'failed') {
          await db.query(
            `UPDATE drone_processing_tasks
             SET status = 'failed', error_message = $2, progress = $3, updated_at = NOW()
             WHERE id = $1`,
            [taskId, webodmStatus.errorMessage || 'Processing failed', webodmStatus.progress]
          )
        } else {
          // Still running — update progress
          await db.query(
            `UPDATE drone_processing_tasks
             SET status = $2, progress = $3, updated_at = NOW()
             WHERE id = $1`,
            [taskId, webodmStatus.status, webodmStatus.progress]
          )
        }

        // Re-fetch updated task
        const refreshed = await db.query(
          'SELECT * FROM drone_processing_tasks WHERE id = $1',
          [taskId]
        )
        if (refreshed.rows.length > 0) {
          return NextResponse.json({ task: refreshed.rows[0] })
        }
      } catch (err) {
        // If WebODM poll fails, return the DB status (don't fail the request)
        console.error('[drone/process] WebODM poll failed:', err)
      }
    }

    return NextResponse.json({ task })
  }
)
