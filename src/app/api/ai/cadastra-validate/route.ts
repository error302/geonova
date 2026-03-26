// src/app/api/ai/cadastra-validate/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callPythonCompute } from '@/lib/compute/pythonService'
import type { ValidateRequest, ValidateResponse } from '@/types/cadastra'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body: ValidateRequest = await request.json()
    
    if (!body.boundary || !body.boundary.points || body.boundary.points.length < 3) {
      return NextResponse.json({ error: 'Invalid boundary - need at least 3 points' }, { status: 400 })
    }
    
    const result = await callPythonCompute<ValidateResponse>(
      '/cadastra-validate',
      body,
      { timeoutMs: 30000 }
    )
    
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    
    return NextResponse.json(result.value)
  } catch (error) {
    console.error('Cadastra validation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('project_id')
  const validationId = searchParams.get('id')
  
  if (!projectId && !validationId) {
    return NextResponse.json({ error: 'Missing project_id or id' }, { status: 400 })
  }
  
  let query = supabase.from('cadastra_validations').select('*')
  
  if (validationId) {
    query = query.eq('id', validationId).single()
  } else if (projectId) {
    query = query.eq('project_id', projectId).order('created_at', { ascending: false })
  }
  
  const { data, error } = await query
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json(data)
}
