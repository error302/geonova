import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserCPDForYear, getTotalCPDForYear, generateCPDCertificate, verifyCPDCertificate } from '@/lib/supabase/cpd'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()
    const action = searchParams.get('action')
    const code = searchParams.get('code')

    if (action === 'verify' && code) {
      const cert = await verifyCPDCertificate(code)
      if (!cert) {
        return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
      }
      return NextResponse.json({ certificate: cert })
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const records = await getUserCPDForYear(userId, year)
    const total = await getTotalCPDForYear(userId, year)

    return NextResponse.json({ records, total, year })

  } catch (error) {
    console.error('CPD GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch CPD records' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { year, surveyorName, iskNumber } = body

    const certificate = await generateCPDCertificate(user.id, year, surveyorName || 'Unknown', iskNumber || 'N/A')

    return NextResponse.json({ certificate })

  } catch (error) {
    console.error('CPD POST error:', error)
    return NextResponse.json({ error: 'Failed to generate certificate' }, { status: 500 })
  }
}
