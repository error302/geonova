import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import db from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, projectId, outputFormat, inputData } = body

    const pointCount = inputData?.points?.length || 0

    if (pointCount < 500) {
      return NextResponse.json({
        message: 'Small job - process synchronously',
        pointCount,
        svg: '<svg></svg>'
      })
    }

    const result = await db.query(
      `INSERT INTO render_jobs (user_id, project_id, type, status, input_data, output_format, point_count, estimated_secs)
       VALUES ($1, $2, $3, 'QUEUED', $4, $5, $6, $7)
       RETURNING id, estimated_secs`,
      [session.user.id, projectId, type, inputData, outputFormat || 'PDF', pointCount, Math.ceil(pointCount * 0.1)]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Failed to create render job' }, { status: 500 })
    }

    const job = result.rows[0]

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
