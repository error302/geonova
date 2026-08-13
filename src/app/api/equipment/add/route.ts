export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
export const POST = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (req, ctx) => {
  const body = ctx.body as {
    name: string
    type: string
    make: string
    model: string
    serialNumber: string
    purchaseDate?: string
    lastCalibrationDate: string
    calibrationInterval?: number
    calibrationCertNumber?: string
    calibrationLab?: string
    notes?: string
  }

  const {
    name,
    type,
    make,
    model,
    serialNumber,
    purchaseDate,
    lastCalibrationDate,
    calibrationInterval = 12,
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

  await db.query<never>(
    `INSERT INTO equipment 
     (id, user_id, name, type, manufacturer, model, serial_number, purchase_date, 
      status, notes, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id,
      ctx.userId,
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
})
