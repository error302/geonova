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

/**
 * Check if the current user has a paid subscription.
 * Uses the /api/subscription endpoint which includes admin email detection
 * and correctly reads from user_subscriptions (not profiles.tier).
 */
async function checkSubscriptionAccess(): Promise<{ allowed: boolean; plan: string; isAdmin: boolean }> {
  try {
    const res = await fetch('/api/subscription', {
      cache: 'no-store',
      credentials: 'same-origin',
    })
    if (!res.ok) return { allowed: false, plan: 'free', isAdmin: false }

    const data = (await res.json()) as { plan?: string; isAdmin?: boolean }
    const plan = data.plan || 'free'
    const isAdmin = data.isAdmin === true

    // Admin always has access; paid plans (pro, team, firm, enterprise) have access
    const allowed = isAdmin || ['pro', 'team', 'firm', 'enterprise'].includes(plan)
    return { allowed, plan, isAdmin }
  } catch {
    return { allowed: false, plan: 'free', isAdmin: false }
  }
}

export async function callAI<T>(options: AICallOptions): Promise<AIResponse<T>> {
  const { endpoint, body, requirePro = true } = options

  if (requirePro) {
    const access = await checkSubscriptionAccess()
    if (!access.allowed) {
      return {
        success: false,
        data: null,
        error: 'PRO_REQUIRED',
        tier: access.plan,
        callsRemaining: null,
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
      return {
        success: false,
        data: null,
        error: `AI_SERVICE_ERROR: ${response.status}`,
        tier: null,
        callsRemaining: null,
      }
    }

    const data: unknown = await response.json()
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
