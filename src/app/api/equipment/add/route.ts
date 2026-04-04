import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user: { id: string; email: string } } | null
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const {
      name,
      type,
      make,
      model,
      serialNumber,
      purchaseDate,
      lastCalibrationDate,
      calibrationInterval = 12,
      calibrationCertNumber,
      calibrationLab,
      notes
    } = body

    if (!name || !type || !make || !model || !serialNumber || !lastCalibrationDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const lastCal = new Date(lastCalibrationDate)
    const nextDue = new Date(lastCal)
    nextDue.setMonth(nextDue.getMonth() + calibrationInterval)

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await db.query(
      `INSERT INTO equipment 
       (id, user_id, name, type, manufacturer, model, serial_number, purchase_date, 
        status, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        session.user.id,
        name,
        type,
        make,
        model,
        serialNumber,
        purchaseDate || null,
        'available',
        notes || null,
        now
      ]
    )

    return NextResponse.json({ equipmentId: id })

  } catch (error) {
    console.error('Add equipment error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}