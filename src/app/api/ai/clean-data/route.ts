import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callPythonCompute } from '@/lib/compute/pythonService'
import type { CleanDataRequest, CleanDataResponse } from '@/types/fieldguard'

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    return null
  }

  return createClient(url, serviceRoleKey)
}

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
  
  if (datasetId) {
    const supabase = createServiceClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase service role is not configured' }, { status: 503 })
    }

    const { data, error } = await supabase
      .from('cleaned_datasets')
      .select('*')
      .eq('id', datasetId)
      .single()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json(data)
  } else if (projectId) {
    const supabase = createServiceClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase service role is not configured' }, { status: 503 })
    }

    const { data, error } = await supabase
      .from('cleaned_datasets')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json(data)
  }
}
