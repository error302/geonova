import { NextResponse } from 'next/server'
import { getCommunityStats, getOpenPeerReviews, getSurveyors } from '@/lib/supabase/community'

export async function GET() {
  try {
    const [stats, peerReviews, surveyors] = await Promise.all([
      getCommunityStats(),
      getOpenPeerReviews(),
      getSurveyors()
    ])

    return NextResponse.json({
      stats,
      openPeerReviews: peerReviews.length,
      surveyorsCount: surveyors.length
    })

  } catch (error) {
    console.error('Community stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
