import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import db from '@/lib/db'
import { getUserCPDForYear, getTotalCPDForYear, generateCPDCertificate, verifyCPDCertificate } from '@/lib/cpd'

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
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { year, surveyorName, iskNumber } = body

    const certificate = await generateCPDCertificate(
      session.user.id, 
      year, 
      surveyorName || 'Unknown', 
      iskNumber || 'N/A'
    )

    return NextResponse.json({ certificate })

  } catch (error) {
    console.error('CPD POST error:', error)
    return NextResponse.json({ error: 'Failed to generate certificate' }, { status: 500 })
  }
}
