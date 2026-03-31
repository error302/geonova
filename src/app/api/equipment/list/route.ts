import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { data: equipment, error } = await supabase
      .from('equipment')
      .select('*, calibration_records(*)')
      .eq('user_id', user.id)
      .order('next_calibration_due', { ascending: true })

    if (error) {
      console.error('Equipment fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch equipment' }, { status: 500 })
    }

    const formatted = (equipment || []).map(eq => ({
      id: eq.id,
      userId: eq.user_id,
      name: eq.name,
      type: eq.type,
      make: eq.make,
      model: eq.model,
      serialNumber: eq.serial_number,
      purchaseDate: eq.purchase_date,
      lastCalibrationDate: eq.last_calibration,
      nextCalibrationDue: eq.next_calibration_due,
      calibrationInterval: eq.calibration_interval,
      calibrationCertNumber: eq.cert_number,
      calibrationLab: eq.calibration_lab,
      status: eq.status,
      notes: eq.notes,
      calibrationHistory: (eq.calibration_records || []).map((cal: any) => ({
        id: cal.id,
        equipmentId: cal.equipment_id,
        date: cal.date,
        certNumber: cal.cert_number,
        lab: cal.lab,
        technician: cal.technician,
        result: cal.result,
        findings: cal.findings,
        corrections: cal.corrections,
        nextDueDate: cal.next_due_date,
        documentPath: cal.document_path
      }))
    }))

    return NextResponse.json({ equipment: formatted })

  } catch (error) {
    console.error('Equipment list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
