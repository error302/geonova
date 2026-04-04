import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import db from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ count: 0 })
    }

    const result = await db.query(
      `SELECT last_calibration_date, interval_days FROM equipment WHERE user_id = $1`,
      [session.user.id]
    )

    if (!result.rows.length) {
      return NextResponse.json({ count: 0 })
    }

    const today = new Date()
    const overdue = result.rows.filter((eq: { last_calibration_date: string | null; interval_days: number }) => {
      const last = eq.last_calibration_date
      if (!last) return false
      const nextCal = new Date(new Date(last).getTime() + eq.interval_days * 86400000)
      return nextCal < today
    }).length

    return NextResponse.json({ count: overdue })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
