import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getOpenPeerReviews, submitPeerReview } from '@/lib/supabase/community'
import { awardCPDPoints } from '@/lib/supabase/cpd'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET() {
  try {
    const reviews = await getOpenPeerReviews()
    return NextResponse.json({ reviews })
  } catch (error) {
    console.error('Peer review GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 })
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
    const { requestId, verdict, comments } = body

    await submitPeerReview(requestId, user.id, verdict, comments || [])

    const cpdActivity = verdict === 'APPROVED' ? 'PEER_REVIEW_COMPLETED' : 'PEER_REVIEW_RECEIVED'
    const points = verdict === 'APPROVED' ? 2 : 1
    await awardCPDPoints(user.id, cpdActivity, `Peer review ${verdict.toLowerCase()}`, requestId, points)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Peer review POST error:', error)
    return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 })
  }
}
