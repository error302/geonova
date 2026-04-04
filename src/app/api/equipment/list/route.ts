import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions) as { user: { id: string; email: string } } | null
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await db.query(
      'SELECT * FROM equipment WHERE user_id = $1 ORDER BY created_at DESC',
      [session.user.id]
    )

    const formatted = (result.rows || []).map((eq: Record<string, unknown>) => ({
      id: eq.id,
      userId: eq.user_id,
      name: eq.name,
      type: eq.type,
      make: eq.manufacturer,
      model: eq.model,
      serialNumber: eq.serial_number,
      purchaseDate: eq.purchase_date,
      status: eq.status,
      notes: eq.notes,
      calibrationHistory: []
    }))

    return NextResponse.json({ equipment: formatted })

  } catch (error) {
    console.error('Equipment list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}