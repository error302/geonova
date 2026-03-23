import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ count: 0 })
    }

    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('equipment')
      .select('last_calibration_date, interval_days')
      .eq('user_id', user.id)

    if (error || !data) {
      return NextResponse.json({ count: 0 })
    }

    const overdue = data.filter((eq: any) => {
      const last = eq.last_calibration_date
      if (!last) return false
      const nextCal = new Date(new Date(last).getTime() + eq.interval_days * 86400000)
      return nextCal < new Date(today)
    }).length

    return NextResponse.json({ count: overdue })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
