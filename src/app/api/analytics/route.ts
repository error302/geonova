export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { z } from 'zod'

const analyticsEventSchema = z.object({
  event: z.string().min(1).max(80).regex(/^[a-z0-9._:-]+$/i),
  properties: z.record(z.unknown()).optional(),
  url: z.string().max(2048).optional(),
})

export const POST = apiHandler({ auth: true, schema: analyticsEventSchema, rateLimit: { max: 60, windowMs: 60000 }, audit: 'analytics_event' }, async (req, ctx) => {
  const { event, properties, url } = ctx.body as z.infer<typeof analyticsEventSchema>
  const userId = ctx.userId

  const safeProps: Record<string, unknown> = {}
  if (properties) {
    const keys = Object.keys(properties).slice(0, 50)
    for (const k of keys) {
      const v = properties[k]
      if (typeof v === 'string') safeProps[k] = v.slice(0, 500)
      else if (typeof v === 'number' || typeof v === 'boolean' || v === null) safeProps[k] = v
      else safeProps[k] = JSON.stringify(v).slice(0, 500)
    }
  }

  await db.query<never>(
    `INSERT INTO audit_logs (
      action, details, user_id, table_name
    ) VALUES ($1, $2, $3, $4)`,
    [event, JSON.stringify({ properties: safeProps, url: url ?? '' }), userId, 'analytics_events']
  )

  return NextResponse.json({ success: true })
})
