import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import db from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const existingSub = await db.query(
    'SELECT id FROM user_subscriptions WHERE user_id = $1',
    [session.user.id]
  )

  if (existingSub.rows.length > 0) {
    return NextResponse.json({ ok: true })
  }

  const now = new Date()
  await db.query(
    `INSERT INTO user_subscriptions 
     (user_id, plan_id, status, trial_ends_at, current_period_start, current_period_end)
     VALUES ($1, 'pro', 'trial', $2, $3, $4)`,
    [
      session.user.id,
      new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      now.toISOString(),
      new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    ]
  )

  return NextResponse.json({ ok: true })
}
