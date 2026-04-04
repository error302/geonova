import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import db from '@/lib/db'
import { getJobById, applyToJob, awardJob, completeJob } from '@/lib/community'
import { awardCPDPoints } from '@/lib/cpd'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const job = await getJobById(id)
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const applicationsResult = await db.query(
      'SELECT * FROM job_applications WHERE job_id = $1',
      [id]
    )

    return NextResponse.json({ job, applications: applicationsResult.rows })

  } catch (error) {
    console.error('Job GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch job' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const action = body.action

    if (action === 'apply') {
      await applyToJob(jobId, body.application, session.user.id)
      return NextResponse.json({ success: true })
    }

    if (action === 'award') {
      await awardJob(jobId, body.surveyorId)
      return NextResponse.json({ success: true })
    }

    if (action === 'complete') {
      await completeJob(jobId)
      
      const jobResult = await db.query(
        'SELECT awarded_to FROM survey_jobs WHERE id = $1',
        [jobId]
      )

      if (jobResult.rows.length > 0 && jobResult.rows[0].awarded_to) {
        await awardCPDPoints(jobResult.rows[0].awarded_to, 'JOB_COMPLETED', `Completed job ${jobId}`, jobId)
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Job POST error:', error)
    return NextResponse.json({ error: 'Failed to process action' }, { status: 500 })
  }
}
