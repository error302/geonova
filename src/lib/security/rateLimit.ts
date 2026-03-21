/**
 * Rate limiter for METARDU API routes.
 *
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * are set (required in production — serverless functions don't share memory).
 *
 * Falls back to in-memory for local development only.
 * To set up: https://upstash.com → create Redis DB → copy REST URL & token.
 * Add to Vercel: Settings → Environment Variables.
 */

// ─── Upstash implementation (production) ─────────────────────────────────────

async function upstashRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL!
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!
  const windowSec = Math.ceil(windowMs / 1000)
  const key = `geonova_rl:${identifier}`

  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      ['INCR', key],
      ['EXPIRE', key, windowSec],
    ]),
  })

  const data = await res.json()
  const count: number = data[0]?.result ?? 1
  const remaining = Math.max(0, maxRequests - count)
  return { allowed: count <= maxRequests, remaining }
}

// ─── In-memory fallback (development only) ───────────────────────────────────
// WARNING: Resets on every cold start. Do NOT rely on this in production.

const _devStore = new Map<string, { count: number; resetTime: number }>()

function inMemoryRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const record = _devStore.get(identifier)

  if (!record || now > record.resetTime) {
    _devStore.set(identifier, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1 }
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0 }
  }

  record.count++
  return { allowed: true, remaining: maxRequests - record.count }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function rateLimit(
  identifier: string,
  maxRequests = 60,
  windowMs = 60000
): Promise<{ allowed: boolean; remaining: number }> {
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return await upstashRateLimit(identifier, maxRequests, windowMs)
  }

  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[METARDU] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set. ' +
      'Rate limiting is disabled in production. Set these env vars in Vercel immediately.'
    )
  }

  return Promise.resolve(inMemoryRateLimit(identifier, maxRequests, windowMs))
}

export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded ? forwarded.split(',')[0].trim() : 'unknown'
}
