/**
 * /api/feedback — Submit user feedback
 *
 * POST — Save feedback to the database.
 *   - Auth required (prevents anonymous spam)
 *   - Rate limited: 5 per 15 minutes per user (prevents abuse)
 *   - Message must be 10-2000 characters
 *   - Screenshot is saved to /uploads/feedback/ if provided
 *   - Error logs (from sessionStorage) are stored as JSONB
 *
 * GET — List feedback (admin only).
 *   - Returns open feedback ordered by date
 *   - Admins can filter by type, status
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

const ADMIN_ROLES = ['super_admin', 'admin', 'org_admin']

const FeedbackSchema = z.object({
  type: z.enum(['bug', 'feature', 'general', 'performance']).default('general'),
  message: z.string().min(10, 'Message must be at least 10 characters').max(2000),
  email: z.string().email().optional(),
  screenshot: z.string().optional(), // base64 data URL
  includeErrors: z.boolean().default(true),
  errors: z.array(z.object({
    message: z.string(),
    stack: z.string().optional(),
    url: z.string().optional(),
    timestamp: z.string().optional(),
  })).optional(),
})

export const POST = apiHandler(
  { auth: true, schema: FeedbackSchema, rateLimit: { max: 5, windowMs: 15 * 60_000 } },
  async (req, ctx) => {
    const body = ctx.body as z.infer<typeof FeedbackSchema>

    // Collect device metadata
    const userAgent = req.headers.get('user-agent') || ''
    const screenWidth = parseInt(req.headers.get('x-screen-width') || '0', 10) || null
    const screenHeight = parseInt(req.headers.get('x-screen-height') || '0', 10) || null
    const language = req.headers.get('accept-language')?.split(',')[0] || null
    const pageUrl = req.headers.get('referer') || ''

    // Save screenshot if provided
    let screenshotPath: string | null = null
    if (body.screenshot && body.screenshot.startsWith('data:image/')) {
      try {
        const uploadDir = join(process.cwd(), 'public', 'uploads', 'feedback')
        if (!existsSync(uploadDir)) {
          await mkdir(uploadDir, { recursive: true })
        }
        const filename = `${ctx.userId}_${randomUUID()}.jpg`
        const filepath = join(uploadDir, filename)
        // Strip the data URL prefix and save as buffer
        const base64Data = body.screenshot.split(',')[1]
        await writeFile(filepath, Buffer.from(base64Data, 'base64'))
        screenshotPath = `/uploads/feedback/${filename}`
      } catch (err) {
        console.error('[feedback] Screenshot save failed:', err)
        // Continue without screenshot — don't fail the whole submission
      }
    }

    // Insert into the feedback table
    const result = await db.query(
      `INSERT INTO feedback
        (user_id, type, message, email, page_url, user_agent,
         screen_width, screen_height, language, screenshot_path, error_logs)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, created_at`,
      [
        ctx.userId,
        body.type,
        body.message,
        body.email || null,
        pageUrl || null,
        userAgent || null,
        screenWidth,
        screenHeight,
        language,
        screenshotPath,
        body.includeErrors && body.errors ? JSON.stringify(body.errors) : null,
      ]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Failed to save feedback', code: 'INSERT_FAILED' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        id: result.rows[0].id,
        message: 'Feedback submitted. Thank you!',
        createdAt: result.rows[0].created_at,
      },
      { status: 201 }
    )
  }
)

// ── GET: Admin list feedback ──

export const GET = apiHandler(
  { auth: true, rateLimit: { max: 30, windowMs: 60_000 } },
  async (req: NextRequest, ctx) => {
    const userRole = (ctx.session?.user as { role?: string })?.role ?? 'surveyor'
    if (!ADMIN_ROLES.includes(userRole)) {
      return NextResponse.json(
        { error: 'Admin access required', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'open'
    const type = searchParams.get('type') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

    const conditions = ['f.status = $1']
    const params: unknown[] = [status]
    let idx = 2

    if (type) {
      conditions.push(`f.type = $${idx++}`)
      params.push(type)
    }

    params.push(limit)

    const { rows } = await db.query(
      `SELECT f.*, u.email as user_email, u.full_name as user_name
       FROM feedback f
       LEFT JOIN users u ON u.id = f.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY f.created_at DESC
       LIMIT $${idx}`,
      params
    )

    return NextResponse.json({ data: rows })
  }
)
