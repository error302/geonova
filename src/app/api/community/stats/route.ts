import { NextResponse } from 'next/server'
import { getCommunityStats, getOpenPeerReviews, getSurveyors } from '@/lib/supabase/community'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [stats, peerReviews, surveyors] = await Promise.all([
      getCommunityStats().catch(() => ({ totalSurveyors: 0, totalJobsPosted: 0, totalReviewsCompleted: 0, totalCPDPointsAwarded: 0 })),
      getOpenPeerReviews().catch(() => []),
      getSurveyors().catch(() => [])
    ])

    return NextResponse.json({
      stats,
      openPeerReviews: peerReviews.length,
      surveyorsCount: surveyors.length
    })

  } catch (error) {
    console.error('Community stats error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch stats',
      stats: { totalSurveyors: 0, totalJobsPosted: 0, totalReviewsCompleted: 0, totalCPDPointsAwarded: 0 },
      openPeerReviews: 0,
      surveyorsCount: 0
    }, { status: 200 })
  }
}
