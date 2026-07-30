/**
 * ─────────────────────────────────────────────────────────────────────────────
 * General-purpose rate limiter for METARDU API routes.
 *
 * Distinction from loginLimiter.ts:
 *   • This module enforces per-IP request quotas (e.g., "max 60 req/min").
 *   • loginLimiter.ts handles login brute-force protection — it tracks
 *     failed attempts per email+IP and issues account lockouts.
 * ─────────────────────────────────────────────────────────────────────────────
 *
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
  const key = `metardu_rl:${identifier}`

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

// Rate limit categories — referenced by middleware.ts to pick the right
// quota per route family. Values are { max, windowMs }.
//
// AUDIT FIX (2026-07-05): These exports were referenced by middleware.ts
// since 2026-05-29 (commit 39158da) but never actually defined here. The
// middleware silently threw TypeError: Cannot read properties of
// undefined (reading api) on every API request, which was masked
// because:
//   1. tsconfig.json include only covered src/**/*.ts — middleware.ts
//      at the project root was never type-checked by tsc --noEmit.
//   2. next build uses webpack, which does not do strict typechecking.
//
// The fix: define the exports AND add middleware.ts to tsconfig include.
export type RateLimitCategory =
  | 'api'
  | 'auth'
  | 'submission'
  | 'upload'
  | 'mpesa'
  | 'export'

export const RATE_LIMITS: Record<RateLimitCategory, { max: number; windowMs: number }> = {
  // Default for all /api/* routes — 120 req/min per IP
  api: { max: 120, windowMs: 60_000 },
  // Auth routes (login, register, password reset) — tighter to slow brute force
  auth: { max: 20, windowMs: 60_000 },
  // Submission/NLIMS export — heavy work, 10/min
  submission: { max: 10, windowMs: 60_000 },
  // File uploads — 20/min (each upload is a separate request)
  upload: { max: 20, windowMs: 60_000 },
  // M-Pesa STK push initiation — 10/min (Safaricom also rate-limits server-side)
  mpesa: { max: 10, windowMs: 60_000 },
  // Export endpoints (DXF/Shapefile/PDF generation) — 30/min
  export: { max: 30, windowMs: 60_000 },
}

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
    // ByteByteGo audit fix: in-memory rate limiting is NOT acceptable in production.
    // It silently fails in multi-instance deployments (each instance gets its own
    // counter, so attackers get N×the limit). Fail loudly instead.
    console.error(
      '[rate-limit] PRODUCTION ERROR: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN ' +
      'must be set in production. In-memory rate limiting is disabled. ' +
      'Set these env vars or set NODE_ENV=development for local dev.'
    )
    // Fail OPEN (allow the request) but log the error — failing closed would lock everyone out
    return Promise.resolve({ allowed: true, remaining: 0 })
  }

  return Promise.resolve(inMemoryRateLimit(identifier, maxRequests, windowMs))
}

export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded ? forwarded.split(',')[0].trim() : 'unknown'
}
