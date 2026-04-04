import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { callPythonCompute } from '@/lib/compute/pythonService'
import type { CleanDataRequest, CleanDataResponse } from '@/types/fieldguard'

export async function POST(request: NextRequest) {
  try {
    const body: CleanDataRequest = await request.json()
    
    if (!body.points || body.points.length === 0) {
      return NextResponse.json({ error: 'No points provided' }, { status: 400 })
    }
    
    if (!body.data_type || !['gnss', 'totalstation', 'lidar'].includes(body.data_type)) {
      return NextResponse.json({ error: 'Invalid data_type' }, { status: 400 })
    }
    
    const result = await callPythonCompute<CleanDataResponse>(
      '/clean-data',
      body,
      { timeoutMs: 30000 }
    )
    
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    
    return NextResponse.json(result.value)
  } catch (error) {
    console.error('Clean data error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('project_id')
  const datasetId = searchParams.get('id')
  
  if (!projectId && !datasetId) {
    return NextResponse.json({ error: 'Missing project_id or id' }, { status: 400 })
  }
  
  try {
    if (datasetId) {
      const result = await db.query(
        'SELECT * FROM cleaned_datasets WHERE id = $1',
        [datasetId]
      )
      
      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Dataset not found' }, { status: 404 })
      }
      
      return NextResponse.json(result.rows[0])
    } else if (projectId) {
      const result = await db.query(
        'SELECT * FROM cleaned_datasets WHERE project_id = $1 ORDER BY created_at DESC',
        [projectId]
      )
      
      return NextResponse.json(result.rows)
    }
  } catch (error) {
    console.error('Cleaned datasets GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch datasets' }, { status: 500 })
  }
}
