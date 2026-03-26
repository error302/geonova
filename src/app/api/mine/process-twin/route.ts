import { NextRequest, NextResponse } from 'next/server'
import { callPythonCompute } from '@/lib/compute/pythonService'
import type { ProcessTwinRequest, ProcessTwinResponse } from '@/types/minetwin'

export async function POST(request: NextRequest) {
  try {
    const body: ProcessTwinRequest = await request.json()
    
    if (!body.points || body.points.length === 0) {
      return NextResponse.json({ error: 'No points provided' }, { status: 400 })
    }
    
    const result = await callPythonCompute<ProcessTwinResponse>(
      '/mine-twin',
      body,
      { timeoutMs: 60000 }
    )
    
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    
    return NextResponse.json(result.value)
  } catch (error) {
    console.error('MineTwin processing error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
