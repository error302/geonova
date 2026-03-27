import { NextRequest, NextResponse } from 'next/server'
import { callPythonCompute } from '@/lib/compute/pythonService'
import type { CreateMissionRequest } from '@/types/usv'

export async function POST(request: NextRequest) {
  try {
    const body: CreateMissionRequest = await request.json()
    
    if (!body.mission_name || !body.waypoints || body.waypoints.length === 0) {
      return NextResponse.json({ error: 'Mission name and waypoints required' }, { status: 400 })
    }
    
    const result = await callPythonCompute<any>(
      '/usv/mission',
      body,
      { timeoutMs: 30000 }
    )
    
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    
    return NextResponse.json(result.value)
  } catch (error) {
    console.error('USV mission error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
