import { NextRequest, NextResponse } from 'next/server'
import { callPythonCompute } from '@/lib/compute/pythonService'
import type { AnalyzeSafetyRequest, AnalyzeSafetyResponse } from '@/types/safety'

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeSafetyRequest = await request.json()
    
    const result = await callPythonCompute<AnalyzeSafetyResponse>(
      '/safety/analyze',
      body,
      { timeoutMs: 60000 }
    )
    
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    
    return NextResponse.json(result.value)
  } catch (error) {
    console.error('Safety analysis error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
