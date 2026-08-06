import { NextResponse } from 'next/server'
import { apiHandler, apiSuccess } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth/session'
import { validateBody, notificationSchema } from '@/lib/validation/apiValidation'

interface NotificationRow {
  id: string
  type: string
  category: string | null
  title: string
  message: string | null
  action_url: string | null
  action_label: string | null
  metadata: Record<string, unknown> | null
  read_at: Date | string | null
  created_at: Date | string
}

export const dynamic = 'force-dynamic'

/**
 * GET /api/notifications
 *
 * Returns the current user's notifications.
 * Query params:
 *   - unread_only: 'true' to return only unread notifications
 *   - limit: max results (default 50, max 100)
 *   - offset: pagination offset
 */
export const GET = apiHandler(
  { auth: true, rateLimit: { max: 120, windowMs: 60000 } },
  async (req, ctx) => {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(req.url)
    const unreadOnly = url.searchParams.get('unread_only') === 'true'
    const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '50', 10))
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10))

    const params: unknown[] = [user.id, limit, offset]
    let whereClause = 'WHERE user_id = $1'
    if (unreadOnly) {
      whereClause += ' AND read_at IS NULL'
    }

    const result = await db.query<NotificationRow>(
      `SELECT id, type, category, title, message, action_url, action_label, metadata, read_at, created_at
       FROM notifications
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      params,
    )

    const unreadResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
      [user.id],
    )
    const unreadCount = parseInt(unreadResult.rows[0]?.count || '0', 10)

    return apiSuccess({
      notifications: result.rows,
      unreadCount,
      pagination: { limit, offset, total: result.rows.length },
    })
  },
)

/**
 * POST /api/notifications
 * Create a notification (internal use).
 */
export const POST = apiHandler(
  { auth: true, rateLimit: { max: 30, windowMs: 60000 } },
  async (req, ctx) => {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = validateBody(ctx.body, notificationSchema)
    const targetUserId = body.userId
    const type = String(body.type || 'info')
    const category = String(body.category || 'general')
    const title = String(body.title || '')
    const message = String(body.message || '')
    const actionUrl = body.actionUrl ? String(body.actionUrl) : null
    const actionLabel = body.actionLabel ? String(body.actionLabel) : null

    if (!title || !message) {
      return NextResponse.json({ error: 'title and message are required' }, { status: 400 })
    }

    const result = await db.query<Pick<NotificationRow, 'id' | 'created_at'>>(
      `INSERT INTO notifications (user_id, type, category, title, message, action_url, action_label)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, created_at`,
      [targetUserId || user.id, type, category, title, message, actionUrl, actionLabel],
    )

    return apiSuccess({ id: result.rows[0].id, createdAt: result.rows[0].created_at })
  },
)

/**
 * PATCH /api/notifications
 * Mark notifications as read.
 * Body: { id?: string, all?: boolean }
 */
export const PATCH = apiHandler(
  { auth: true, rateLimit: { max: 60, windowMs: 60000 } },
  async (req, ctx) => {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = ctx.body as Record<string, unknown>
    const notifId = body.id ? String(body.id) : null
    const markAll = body.all === true

    if (markAll) {
      const result = await db.query<Pick<NotificationRow, 'id'>>(
        `UPDATE notifications SET read_at = NOW()
         WHERE user_id = $1 AND read_at IS NULL RETURNING id`,
        [user.id],
      )
      return apiSuccess({ markedRead: result.rowCount, action: 'all' })
    }

    if (notifId) {
      await db.query<never>(
        `UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2`,
        [notifId, user.id],
      )
      return apiSuccess({ id: notifId, action: 'single' })
    }

    return NextResponse.json({ error: 'Provide either { id } or { all: true }' }, { status: 400 })
  },
)

/**
 * DELETE /api/notifications?id=<notif_id>
 */
export const DELETE = apiHandler(
  { auth: true, rateLimit: { max: 30, windowMs: 60000 } },
  async (req, ctx) => {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(req.url)
    const notifId = url.searchParams.get('id')
    if (!notifId) {
      return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 })
    }

    await db.query<never>(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
      [notifId, user.id],
    )

    return apiSuccess({ id: notifId, deleted: true })
  },
)
