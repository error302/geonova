import { NextRequest, NextResponse } from 'next/server'

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    
    try {
      const response = await fetch(`${PYTHON_SERVICE_URL}/export/geojson`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`Python service returned ${response.status}`)
      }
      
      const data = await response.json()
      return NextResponse.json(data)
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId)
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Python service unavailable (timeout)', fallback: true },
          { status: 503 }
        )
      }
      
      return NextResponse.json(
        { error: 'Python service unavailable', fallback: true },
        { status: 503 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'GeoJSON export failed' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ 
    endpoint: '/export/geojson',
    description: 'Export survey data to GeoJSON format',
    python_required: true 
  })
}
