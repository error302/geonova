import { NextRequest, NextResponse } from 'next/server'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const DEFAULT_MODEL = 'gpt-4o-mini'

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
    if (!OPENAI_API_KEY) {
      return NextResponse.json({
        error: 'OpenAI not configured',
        hint: 'Add OPENAI_API_KEY to environment variables'
      }, { status: 500 })
    }

    const body = await request.json()
    const { messages, model = DEFAULT_MODEL, stream = true } = body

    const userMessages = messages.filter((m: { role: string }) => m.role !== 'system')

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SURVEYING_SYSTEM_PROMPT },
          ...userMessages
        ],
        stream,
        temperature: 0.3
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI error: ${error}`)
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
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      })
    } else {
      const data = await response.json()
      return NextResponse.json(data)
    }
  } catch (error) {
    console.error('OpenAI proxy error:', error)
    return NextResponse.json({
      error: 'AI service unavailable',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    provider: 'openai',
    model: DEFAULT_MODEL,
    endpoint: '/api/openai/chat',
    instructions: 'POST with { messages: [{role: "user", content: "your question"}] }',
    required: 'Set OPENAI_API_KEY in environment'
  })
}
