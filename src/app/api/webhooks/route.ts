import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import type { WebhookEvent } from '@/lib/webhooks/types'
import { WEBHOOK_SECRET_PREFIX } from '@/lib/webhooks/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, events, name } = body

    if (!url || !events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: url, events (array)' },
        { status: 400 }
      )
    }

    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const secret = `${WEBHOOK_SECRET_PREFIX}${crypto.randomBytes(24).toString('hex')}`

    const { data, error } = await supabase
      .from('webhooks')
      .insert({
        url,
        events,
        secret,
        name: name || 'Webhook',
        user_id: user.id,
        active: true
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      id: data.id,
      url: data.url,
      events: data.events,
      secret: data.secret,
      active: data.active,
      createdAt: data.created_at
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook creation failed' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ webhooks: data || [] })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch webhooks' },
      { status: 500 }
    )
  }
}
