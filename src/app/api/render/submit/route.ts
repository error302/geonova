import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

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
    const { type, projectId, outputFormat, inputData } = body

    const pointCount = inputData?.points?.length || 0

    if (pointCount < 500) {
      return NextResponse.json({
        message: 'Small job - process synchronously',
        pointCount,
        // In production, generate SVG here
        svg: '<svg></svg>'
      })
    }

    const { data: job, error: jobError } = await supabase
      .from('render_jobs')
      .insert({
        user_id: user.id,
        project_id: projectId,
        type,
        status: 'QUEUED',
        input_data: inputData,
        output_format: outputFormat || 'PDF',
        point_count: pointCount,
        estimated_secs: Math.ceil(pointCount * 0.1)
      })
      .select()
      .single()

    if (jobError) {
      console.error('Render job error:', jobError)
      return NextResponse.json({ error: 'Failed to create render job' }, { status: 500 })
    }

    return NextResponse.json({
      jobId: job.id,
      status: 'QUEUED',
      estimatedSeconds: job.estimated_secs
    })

  } catch (error) {
    console.error('Render submit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
