import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { callPythonCompute } from '@/lib/compute/pythonService'
import type { ValidateRequest, ValidateResponse } from '@/types/cadastra'

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
  
  try {
    if (validationId) {
      const result = await db.query(
        'SELECT * FROM cadastra_validations WHERE id = $1',
        [validationId]
      )
      
      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Validation not found' }, { status: 404 })
      }
      
      return NextResponse.json(result.rows[0])
    }
    
    const result = await db.query(
      'SELECT * FROM cadastra_validations WHERE project_id = $1 ORDER BY created_at DESC',
      [projectId]
    )
    
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Cadastra validations GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch validations' }, { status: 500 })
  }
}
