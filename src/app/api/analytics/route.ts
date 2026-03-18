import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)

    const schema = z.object({
      event: z.string().min(1).max(80).regex(/^[a-z0-9._:-]+$/i),
      properties: z.record(z.unknown()).optional(),
      url: z.string().max(2048).optional(),
    })

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid analytics payload', issues: parsed.error.issues }, { status: 400 })
    }

    const { event, properties, url } = parsed.data

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Prevent abuse via huge blobs (keep a small, predictable payload).
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

    await supabase.from('analytics_events').insert({
      user_id: user?.id || null,
      event,
      properties: safeProps,
      url: url || ''
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json({ error: 'Failed to track event' }, { status: 500 })
  }
}
