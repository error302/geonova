import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getJobById, applyToJob, awardJob as awardJobFn, completeJob as completeJobFn } from '@/lib/supabase/community'
import { awardCPDPoints } from '@/lib/supabase/cpd'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

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

    const { data: applications } = await supabase
      .from('job_applications')
      .select('*')
      .eq('job_id', id)

    return NextResponse.json({ job, applications: applications || [] })

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
    const action = body.action

    if (action === 'apply') {
      await applyToJob(jobId, body.application, user.id)
      return NextResponse.json({ success: true })
    }

    if (action === 'award') {
      await awardJobFn(jobId, body.surveyorId)
      return NextResponse.json({ success: true })
    }

    if (action === 'complete') {
      await completeJobFn(jobId)
      
      const { data: job } = await supabase
        .from('survey_jobs')
        .select('awarded_to')
        .eq('id', jobId)
        .single()

      if (job?.awarded_to) {
        await awardCPDPoints(job.awarded_to, 'JOB_COMPLETED', `Completed job ${jobId}`, jobId)
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Job POST error:', error)
    return NextResponse.json({ error: 'Failed to process action' }, { status: 500 })
  }
}
