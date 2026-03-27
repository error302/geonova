import { NextRequest, NextResponse } from 'next/server'
import { callPythonCompute } from '@/lib/compute/pythonService'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    if (!body.project_data) {
      return NextResponse.json({ error: 'Missing project_data' }, { status: 400 })
    }
    
    const result = await callPythonCompute<any>(
      '/workflow/execute',
      { 
        action: 'report',
        project_data: body.project_data,
        sections: body.sections || ['summary', 'results'],
        style: body.style || 'technical'
      },
      { timeoutMs: 60000 }
    )
    
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    
    return NextResponse.json(result.value)
  } catch (error) {
    console.error('Report generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}