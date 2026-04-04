import { createClient } from '@/lib/supabase/client'

const AI_BASE_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'https://metardu-ai.up.railway.app'

export interface AICallOptions {
  endpoint: string
  body: Record<string, unknown>
  requirePro?: boolean
}

export interface AIResponse<T> {
  success: boolean
  data: T | null
  error: string | null
  tier: string | null
  callsRemaining: number | null
}

export async function callAI<T>(options: AICallOptions): Promise<AIResponse<T>> {
  const { endpoint, body, requirePro = true } = options

  const supabase = createClient()
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  if (sessionError || !session) {
    return {
      success: false,
      data: null,
      error: 'NOT_AUTHENTICATED',
      tier: null,
      callsRemaining: null,
    }
  }

  if (requirePro) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tier, ai_calls_remaining')
      .eq('id', session.user.id)
      .single()

    if (profileError || !profile) {
      return {
        success: false,
        data: null,
        error: 'PROFILE_NOT_FOUND',
        tier: null,
        callsRemaining: null,
      }
    }

    const validTiers = ['pro', 'team', 'enterprise']
    if (!validTiers.includes(profile.tier)) {
      return {
        success: false,
        data: null,
        error: 'PRO_REQUIRED',
        tier: profile.tier,
        callsRemaining: profile.ai_calls_remaining ?? null,
      }
    }
  }

  try {
    const response = await fetch(`${AI_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (response.status === 403) {
      return {
        success: false,
        data: null,
        error: 'PRO_REQUIRED',
        tier: null,
        callsRemaining: null,
      }
    }

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        data: null,
        error: `AI_SERVICE_ERROR: ${response.status}`,
        tier: null,
        callsRemaining: null,
      }
    }

    const data = await response.json()
    return {
      success: true,
      data: data as T,
      error: null,
      tier: null,
      callsRemaining: null,
    }
  } catch (err) {
    return {
      success: false,
      data: null,
      error: err instanceof Error ? err.message : 'UNKNOWN_ERROR',
      tier: null,
      callsRemaining: null,
    }
  }
}

export function isProError(response: AIResponse<unknown>): boolean {
  return !response.success && response.error === 'PRO_REQUIRED'
}
