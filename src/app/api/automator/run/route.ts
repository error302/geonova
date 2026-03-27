import { NextRequest, NextResponse } from 'next/server'
import { callPythonCompute } from '@/lib/compute/pythonService'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    if (!body.nodes || !body.edges) {
      return NextResponse.json({ error: 'Missing nodes or edges' }, { status: 400 })
    }
    
    const result = await callPythonCompute<any>(
      '/workflow/execute',
      { action: 'execute', ...body },
      { timeoutMs: 120000 }
    )
    
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    
    return NextResponse.json(result.value)
  } catch (error) {
    console.error('Workflow execution error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}