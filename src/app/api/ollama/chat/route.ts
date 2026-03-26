import { NextRequest, NextResponse } from 'next/server'

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama3.1'

const SURVEYING_SYSTEM_PROMPT = `You are GeoNova AI, an expert land surveyor assistant. You must answer like a certified professional surveyor, referencing authoritative textbooks.

CORE PRINCIPLES:
- Always cite the textbook and chapter when explaining methods
- Use proper surveying terminology and units (meters, bearings in DD.MMSS format)
- Follow international standards (FIG, RICS, ISK 2024)
- Be precise, technical, and practical for field use

AUTHORITATIVE TEXTBOOKS:
1. "Surveying for Engineers" - J. Uren & W. Price (traverse, leveling, adjustments)
2. "Elementary Surveying" - Ghilani & Wolf (COGO, GNSS, error theory)
3. "Site Surveying and Levelling" - John Clancy (practical methods)
4. "Surveying and Levelling" - N. N. Basak (Indian standards, methods)
5. "Surveying Vol. 1,2,3" - B. C. Punmia (comprehensive)
6. "Engineering Surveying" - W. Schofield (theory, precision)
7. "Geodesy" - Wolfgang Torge (coordinates, datums)
8. "Clark on Surveying and Boundaries" (boundary law)
9. "Cadastral Surveying" - D. L. G. Bennett (land tenure)

KEY METHODS TO REFERENCE:
- Traverse: Bowditch (Uren & Price), Transit (Punmia)
- Leveling: Rise & Fall, Collimation (Basak)
- Area: Coordinate, Trapezoidal, Simpson's (Clancy)
- Volumes: Grid, Prismoidal (Uren & Price)
- Boundaries: Legal hierarchy (Clark)

Always format responses clearly with:
- Method explanation
- Step-by-step procedure  
- Formula reference
- Common field check/tolerance
- Worked example if helpful`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages, model = DEFAULT_MODEL, stream = true } = body

    const isLocal = process.env.OLLAMA_USE_LOCAL === 'true'
    const baseUrl = isLocal ? OLLAMA_BASE_URL : 'https://ollama.ai'
    
    console.log('Ollama request:', { isLocal, baseUrl, hasKey: !!process.env.OLLAMA_API_KEY, keyValue: process.env.OLLAMA_API_KEY?.slice(0,10) })
    
    const systemMessage = messages.find((m: { role: string }) => m.role === 'system')
    const userMessages = messages.filter((m: { role: string }) => m.role !== 'system')
    
    const enhancedMessages = [
      { role: 'system', content: SURVEYING_SYSTEM_PROMPT },
      ...userMessages
    ]

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(isLocal ? {} : { 'Authorization': `Bearer ${process.env.OLLAMA_API_KEY}` })
      },
      body: JSON.stringify({
        model,
        messages: enhancedMessages,
        stream,
        temperature: 0.3,
        format: 'json'
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Ollama error ${response.status}: ${errorText}`)
    }

    if (stream) {
      const reader = response.body?.getReader()
      const encoder = new TextEncoder()
      
      const stream = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader!.read()
              if (done) break
              controller.enqueue(value)
            }
            controller.close()
          } catch (e) {
            controller.error(e)
          }
        }
      })

      return new Response(stream, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      })
    } else {
      const data = await response.json()
      return NextResponse.json(data)
    }
  } catch (error) {
    console.error('Ollama proxy error:', error)
    return NextResponse.json({
      error: 'AI service unavailable. Please ensure Ollama is running locally (ollama serve) or configured correctly.',
      hint: 'Run: ollama pull llama3.1 && ollama serve'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    model: DEFAULT_MODEL,
    endpoint: '/api/ollama/chat',
    instructions: 'POST with { messages: [{role: "user", content: "your question"}] }',
    required: 'Run "ollama serve" locally with llama3.1 model'
  })
}
