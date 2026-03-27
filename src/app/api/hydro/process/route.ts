import { NextRequest, NextResponse } from 'next/server'

import { callPythonCompute } from '@/lib/compute/pythonService'
import type { ProcessBathymetryRequest, ProcessBathymetryResponse } from '@/types/bathymetry'

export async function POST(request: NextRequest) {
  try {
    const body: ProcessBathymetryRequest = await request.json()
    
    if (!body.soundings || body.soundings.length === 0) {
      return NextResponse.json({ error: 'No soundings provided' }, { status: 400 })
    }
    
    const result = await callPythonCompute<ProcessBathymetryResponse>(
      '/bathymetry/process',
      body,
      { timeoutMs: 60000 }
    )
    
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    
    return NextResponse.json(result.value)
  } catch (error) {
    console.error('Bathymetry processing error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
