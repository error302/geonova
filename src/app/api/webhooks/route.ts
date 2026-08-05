export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { WEBHOOK_SECRET_PREFIX } from '@/lib/webhooks/types'

export const POST = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (req, ctx) => {
  const { url, events, name } = ctx.body as { url?: string; events?: unknown[]; name?: string }

  if (!url || !events || !Array.isArray(events) || events.length === 0) {
    return NextResponse.json(
      { error: 'Missing required fields: url, events (array)' },
      { status: 400 }
    )
  }

  try {
    new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
  }

  const secret = `${WEBHOOK_SECRET_PREFIX}${crypto.randomBytes(24).toString('hex')}`

  const { rows } = await db.query(
    `INSERT INTO webhooks (url, events, secret, name, user_id, active)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING *`,
    [url, JSON.stringify(events), secret, name ?? 'Webhook', ctx.userId]
  )

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 })
  }

  const data = rows[0] as Record<string, unknown>
  return NextResponse.json({
    id: data.id,
    url: data.url,
    events: data.events,
    secret: data.secret,
    active: data.active,
    createdAt: data.created_at,
  })
})

export const GET = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (req, ctx) => {
  const { rows } = await db.query(
    'SELECT * FROM webhooks WHERE user_id = $1 ORDER BY created_at DESC',
    [ctx.userId]
  )

  return NextResponse.json({ webhooks: rows ?? [] })
})
