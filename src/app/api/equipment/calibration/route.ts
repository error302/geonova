import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import db from '@/lib/db'
import type { CreateCalibrationRecordRequest } from '@/types/equipment'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: { equipmentId: string } & CreateCalibrationRecordRequest = await request.json()
    const { equipmentId, date, certNumber, lab, technician, result, findings, corrections, nextDueDate, documentPath } = body

    if (!equipmentId || !date || !nextDueDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const equipmentResult = await db.query(
      'SELECT user_id FROM equipment WHERE id = $1',
      [equipmentId]
    )

    if (equipmentResult.rows.length === 0 || equipmentResult.rows[0].user_id !== session.user.id) {
      return NextResponse.json(
        { error: 'Equipment not found or access denied' },
        { status: 403 }
      )
    }

    const insertResult = await db.query(
      `INSERT INTO calibration_records 
       (equipment_id, date, cert_number, lab, technician, result, findings, corrections, next_due_date, document_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [equipmentId, date, certNumber, lab, technician, result, findings, corrections, nextDueDate, documentPath]
    )

    if (insertResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Failed to add calibration record' },
        { status: 500 }
      )
    }

    await db.query(
      `UPDATE equipment SET 
       last_calibration = $1, next_calibration_due = $2, cert_number = $3, calibration_lab = $4
       WHERE id = $5`,
      [date, nextDueDate, certNumber, lab, equipmentId]
    )

    return NextResponse.json({ recordId: insertResult.rows[0].id })

  } catch (error) {
    console.error('Add calibration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
