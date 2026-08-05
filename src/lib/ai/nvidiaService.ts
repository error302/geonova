/**
 * NVIDIA NIM API Service
 * Provides AI capabilities for survey data analysis, QA, and assistance.
 *
 * Key design decisions:
 * - API key read from process.env at call time (supports rotation without restart)
 * - Streaming supported for report generation (avoids 30s spinner UX)
 * - All survey validation results include safety disclaimers per Survey Act Cap 299
 */

const BASE_URL = 'https://integrate.api.nvidia.com/v1'
const DEFAULT_MODEL = 'meta/llama-3.1-70b-instruct'
const VISION_MODEL = 'meta/llama-3.2-90b-vision-instruct'

function getApiKey(): string {
  const key = process.env.NVIDIA_API_KEY
  if (!key) throw new Error('NVIDIA_API_KEY not configured')
  return key
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | ContentPart[]
}

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface ChatOptions {
  messages: ChatMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
}

export interface StreamOptions extends ChatOptions {
  /** Called for each token chunk as it arrives */
  onToken?: (token: string) => void
}

// ─── Non-streaming chat ──────────────────────────────────────────────────────

export async function chat(options: ChatOptions): Promise<string> {
  const {
    messages,
    model = DEFAULT_MODEL,
    temperature = 0.7,
    maxTokens = 1024,
  } = options

  const apiKey = getApiKey()

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`NVIDIA API error: ${response.status} ${error}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

// ─── Streaming chat ──────────────────────────────────────────────────────────

/**
 * Stream chat tokens from NVIDIA NIM.
 * Returns the full concatenated text when done, calling `onToken` for each chunk.
 * Falls back to non-streaming if the API doesn't support SSE.
 */
export async function chatStream(options: StreamOptions): Promise<string> {
  const {
    messages,
    model = DEFAULT_MODEL,
    temperature = 0.7,
    maxTokens = 1024,
    onToken,
  } = options

  const apiKey = getApiKey()

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
  })

  // If streaming not supported, fall back to non-streaming
  if (!response.headers.get('content-type')?.includes('text/event-stream')) {
    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    onToken?.(content)
    return content
  }

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`NVIDIA API error: ${response.status} ${error}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body for streaming')

  const decoder = new TextDecoder()
  let fullText = ''
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Parse SSE lines
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''  // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed === 'data: [DONE]') continue
      if (!trimmed.startsWith('data: ')) continue

      try {
        const parsed = JSON.parse(trimmed.slice(6))
        const token = parsed.choices?.[0]?.delta?.content || ''
        if (token) {
          fullText += token
          onToken?.(token)
        }
      } catch {
        // Malformed SSE chunk — skip
      }
    }
  }

  return fullText
}

// ─── Survey Data QA ──────────────────────────────────────────────────────────

export async function checkSurveyDataQA(data: {
  coordinates?: Array<{ point: string; easting: number; northing: number; elevation?: number }>
  distances?: Array<{ from: string; to: string; distance: number; bearing?: string }>
  area?: number
  surveyType: string
}): Promise<string> {
  const prompt = `You are a professional land surveyor reviewing survey data for quality assurance.

Survey Type: ${data.surveyType}

${data.coordinates?.length ? `Coordinates:
${data.coordinates.map(c => `  ${c.point}: E:${c.easting}, N:${c.northing}${c.elevation ? `, Z:${c.elevation}` : ''}`).join('\n')}
` : ''}

${data.distances?.length ? `Distances:
${data.distances.map(d => `  ${d.from} to ${d.to}: ${d.distance}m${d.bearing ? ` @ ${d.bearing}` : ''}`).join('\n')}
` : ''}

${data.area ? `Calculated Area: ${data.area} hectares` : ''}

Please review this survey data and identify:
1. Any mathematical inconsistencies (closing errors, misclosures)
2. Outliers or suspicious values
3. Missing data or gaps
4. Compliance with standard survey accuracy requirements
5. Recommendations for improvement

Respond in a structured format with clear findings.`

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are an expert land surveyor with 20+ years experience in survey quality assurance, familiar with RDM, Survey Act, and international standards.',
    },
    {
      role: 'user',
      content: prompt,
    },
  ]

  return await chat({ messages, model: DEFAULT_MODEL })
}

// ─── Extract Coordinates ─────────────────────────────────────────────────────

export async function extractCoordinates(text: string): Promise<{
  coordinates: Array<{ point: string; easting: number; northing: number; elevation?: number }>
  warnings: string[]
}> {
  const prompt = `Extract all coordinate data from the following survey text. Return ONLY valid JSON in this exact format:

{
  "coordinates": [
    {"point": "POINT_ID", "easting": 12345.678, "northing": 98765.432, "elevation": 123.456}
  ],
  "warnings": ["Any issues or ambiguities found"]
}

IMPORTANT: Respond with ONLY the raw JSON object. Do not include any explanations, markdown formatting, or code. ONLY JSON.

Survey text:
${text}

If no valid coordinates found, return empty arrays.`

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are a precise data extraction assistant. Extract survey coordinates from text and return ONLY valid JSON.',
    },
    {
      role: 'user',
      content: prompt,
    },
  ]

  const response = await chat({ messages, model: DEFAULT_MODEL, temperature: 0.1 })

  try {
    const blockMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    let jsonStr = blockMatch ? blockMatch[1] : response

    if (!blockMatch) {
      const firstBrace = jsonStr.indexOf('{')
      const lastBrace = jsonStr.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace !== -1) {
        jsonStr = jsonStr.slice(firstBrace, lastBrace + 1)
      }
    }

    const parsed = JSON.parse(jsonStr)
    return {
      coordinates: parsed.coordinates || [],
      warnings: parsed.warnings || [],
    }
  } catch (e) {
    console.error('Failed to parse NVIDIA response:', e)
    return { coordinates: [], warnings: ['Failed to parse AI response'] }
  }
}

// ─── Generate Report Section (streaming) ─────────────────────────────────────

/**
 * Generate a survey report section.
 * When `onToken` is provided, streams tokens incrementally.
 * Otherwise returns the full text at once (backward compatible).
 */
export async function generateReportSection(options: {
  sectionType: string
  surveyType: string
  projectData: Record<string, unknown>
  customInstructions?: string
  onToken?: (token: string) => void
}): Promise<string> {
  const { sectionType, surveyType, projectData, customInstructions, onToken } = options

  const prompt = `Generate a professional "${sectionType}" section for a ${surveyType} survey report.

Project Details:
${Object.entries(projectData).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

${customInstructions ? `Custom Instructions: ${customInstructions}` : ''}

Write in professional surveyor language, suitable for submission to regulatory authorities. Include relevant technical details and compliance statements.`

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are a professional land surveyor writing formal survey reports. Use precise technical language and reference relevant standards.',
    },
    {
      role: 'user',
      content: prompt,
    },
  ]

  // Use streaming when callback provided, otherwise non-streaming
  if (onToken) {
    return await chatStream({ messages, model: DEFAULT_MODEL, temperature: 0.7, maxTokens: 2048, onToken })
  }

  return await chat({ messages, model: DEFAULT_MODEL, temperature: 0.7, maxTokens: 2048 })
}

// ─── Validate Survey Results ─────────────────────────────────────────────────

/**
 * AI-assisted survey result review.
 *
 * CRITICAL SAFETY NOTE: This function provides AI-assisted analysis ONLY.
 * It MUST NOT be used as the final authority on whether survey data passes.
 * The deterministic validation engine (toleranceEngine.ts, traverseValidation.ts)
 * is the authoritative source for pass/fail on survey accuracy.
 * A licensed surveyor must always make the final determination per Survey Act Cap 299.
 */
export async function validateSurveyResults(options: {
  surveyType: string
  measured: Record<string, unknown>
  expected?: Record<string, unknown>
  tolerances?: Record<string, number>
}): Promise<{
  aiAssessment: 'likely_pass' | 'likely_fail' | 'needs_review'
  confidence: 'low' | 'medium' | 'high'
  findings: string[]
  recommendations: string[]
  disclaimer: string
}> {
  const { surveyType, measured, expected, tolerances } = options

  const prompt = `You are reviewing survey results as an AI assistant. You MUST NOT make the final pass/fail determination — that is the licensed surveyor's responsibility.

Provide your analysis as an AI assessment with a confidence level.

Survey Type: ${surveyType}

Measured Values:
${Object.entries(measured).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

${expected ? `Expected Values:\n${Object.entries(expected).map(([k, v]) => `- ${k}: ${v}`).join('\n')}` : ''}

${tolerances ? `Tolerances:\n${Object.entries(tolerances).map(([k, v]) => `- ${k}: \u00B1${v}`).join('\n')}` : ''}

Return ONLY raw JSON with no other text, markdown, or code:
{
  "aiAssessment": "likely_pass" | "likely_fail" | "needs_review",
  "confidence": "low" | "medium" | "high",
  "findings": ["Finding 1", "Finding 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}`

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are a survey QA assistant providing analysis for human review. You MUST NOT make the final pass/fail determination. Provide your assessment with confidence levels. A licensed surveyor always makes the final call.',
    },
    {
      role: 'user',
      content: prompt,
    },
  ]

  const response = await chat({
    messages,
    model: DEFAULT_MODEL,
    temperature: 0.1,
  })

  try {
    const blockMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    let jsonStr = blockMatch ? blockMatch[1] : response

    if (!blockMatch) {
      const firstBrace = jsonStr.indexOf('{')
      const lastBrace = jsonStr.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace !== -1) {
        jsonStr = jsonStr.slice(firstBrace, lastBrace + 1)
      }
    }

    const parsed = JSON.parse(jsonStr)
    return {
      aiAssessment: parsed.aiAssessment || 'needs_review',
      confidence: parsed.confidence || 'low',
      findings: parsed.findings || [],
      recommendations: parsed.recommendations || [],
      disclaimer: 'This is an AI-assisted review for reference only. A licensed surveyor must make the final determination per the Survey Act Cap 299.',
    }
  } catch (e) {
    console.error('Failed to parse validation response:', e)
    return {
      aiAssessment: 'needs_review',
      confidence: 'low',
      findings: ['Failed to parse AI validation — manual review required'],
      recommendations: ['A licensed surveyor must review this data manually'],
      disclaimer: 'AI validation failed. A licensed surveyor must make the final determination per the Survey Act Cap 299.',
    }
  }
}

// ─── Vision chat (image + text) ──────────────────────────────────────────────

/**
 * Send a chat request with image content to a vision model.
 * Supports base64 data URIs (data:image/...) and public URLs.
 */
export async function visionChat(options: ChatOptions): Promise<string> {
  const {
    messages,
    model = VISION_MODEL,
    temperature = 0.3,
    maxTokens = 2048,
  } = options

  const apiKey = getApiKey()

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    // If vision model fails, try text-only fallback with error context
    if (response.status === 404 || response.status === 400) {
      throw new Error(`Vision model "${model}" not available. The photo could not be interpreted. Try typing your field notes instead.`)
    }
    throw new Error(`NVIDIA Vision API error: ${response.status} ${error}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

// ─── Interpret Field Book Photo ──────────────────────────────────────────────

/**
 * Interpret a field book photo using NVIDIA's vision model.
 * Takes a base64-encoded image and returns structured observations.
 *
 * CRITICAL SAFETY NOTE: AI-interpreted field data must be verified by a
 * licensed surveyor before use in any official document per Survey Act Cap 299.
 */
export async function interpretFieldPhoto(options: {
  imageBase64: string
  mimeType: string
  surveyTypeHint?: string
}): Promise<{
  observations: Array<{
    from: string
    to: string
    bearing: string
    distance: number
    bs?: number
    is?: number
    fs?: number
    notes?: string
  }>
  surveyType: string
  warnings: string[]
  disclaimer: string
}> {
  const { imageBase64, mimeType, surveyTypeHint } = options

  const dataUri = `data:${mimeType};base64,${imageBase64}`

  const systemPrompt = `You are a professional land surveyor AI assistant interpreting field book photos for Kenyan surveyors.
Extract all survey observations from the image. Return ONLY raw JSON with no markdown, code fences, or explanation.

The survey data uses EPSG:21037 (Arc 1960 / UTM Zone 37S) for Kenya.

Return this exact JSON structure:
{
  "observations": [
    {"from": "STATION", "to": "STATION", "bearing": "DDD°MM'SS", "distance": 0.000, "bs": 0.000, "fs": 0.000, "notes": ""}
  ],
  "surveyType": "traverse" | "leveling" | "topographic" | "cadastral" | "unknown",
  "warnings": ["Any issues reading the image or uncertain values"]
}

Rules:
- Extract ALL visible observations, bearings, distances, BS/FS readings
- If a value is unclear, include it with a warning
- Bearings must be in DDD°MM'SS" format
- Distances in meters
- BS = Backsight, FS = Foresight, IS = Intermediate sight
- If the image is not a field book/survey document, return empty observations with a warning
- NEVER fabricate data that is not visible in the image`

  const userPrompt = surveyTypeHint
    ? `Interpret this field book photo. The surveyor indicated this is a ${surveyTypeHint} survey.`
    : `Interpret this field book photo and extract all survey observations.`

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        { type: 'text', text: userPrompt },
        { type: 'image_url', image_url: { url: dataUri } },
      ],
    },
  ]

  const response = await visionChat({ messages, model: VISION_MODEL, temperature: 0.1, maxTokens: 2048 })

  try {
    const blockMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    let jsonStr = blockMatch ? blockMatch[1] : response

    if (!blockMatch) {
      const firstBrace = jsonStr.indexOf('{')
      const lastBrace = jsonStr.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace !== -1) {
        jsonStr = jsonStr.slice(firstBrace, lastBrace + 1)
      }
    }

    const parsed = JSON.parse(jsonStr)
    return {
      observations: parsed.observations || [],
      surveyType: parsed.surveyType || 'unknown',
      warnings: parsed.warnings || [],
      disclaimer: 'AI-interpreted field data must be verified by a licensed surveyor before use in any official document per the Survey Act Cap 299.',
    }
  } catch (e) {
    console.error('[interpretFieldPhoto] Failed to parse vision response:', e)
    return {
      observations: [],
      surveyType: 'unknown',
      warnings: ['Failed to parse AI interpretation — manual entry required', `Raw response preview: ${response.slice(0, 200)}`],
      disclaimer: 'AI interpretation failed. A licensed surveyor must enter field data manually per the Survey Act Cap 299.',
    }
  }
}

// ─── Health check ─────────────────────────────────────────────────────────────

/** Returns true if the NVIDIA API key is configured */
export function isConfigured(): boolean {
  return !!process.env.NVIDIA_API_KEY
}

const nvidiaService = {
  chat,
  chatStream,
  visionChat,
  checkSurveyDataQA,
  extractCoordinates,
  generateReportSection,
  validateSurveyResults,
  interpretFieldPhoto,
  isConfigured,
}

export default nvidiaService
