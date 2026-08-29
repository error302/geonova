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
import { logger } from '@/lib/logger'

// ─── Upstash implementation (production) ─────────────────────────────────────

async function upstashRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set')
  }
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

  const data = await res.json() as Array<{ result?: number }>
  const count: number = data[0]?.result ?? 1
  const remaining = Math.max(0, maxRequests - count)
  return { allowed: count <= maxRequests, remaining }
}

// ─── In-memory fallback ──────────────────────────────────────────────────────
// NOTE (2026-08-30): METARDU's production topology is a SINGLE app container
// (docker-compose, no replicas), so the in-process counter IS authoritative.
// The previous behavior failed OPEN in production whenever Upstash env vars
// were absent — which left every rate limit in the security remediation
// (H-12 OSM auth throttling, M-01 middleware quotas, M-08 payments limiting,
// H-08-adjacent login throttling) completely inert while logging an error
// per request. In-memory is now used with a one-time warning. Multi-instance
// deployments MUST set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
// (each instance keeps its own counter, multiplying the effective limit).

let _warnedInMemoryFallback = false

function warnOnceInMemoryFallback(): void {
  if (_warnedInMemoryFallback) return
  _warnedInMemoryFallback = true
  logger.warn(
    '[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN not set — using the in-process ' +
    'limiter. This is correct for the current single-container production ' +
    'deployment; set the Upstash env vars before scaling to multiple app ' +
    'replicas or serverless functions.'
  )
}

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
    // SECURITY (2026-08-30): previously this branch FAILED OPEN (allowed the
    // request) — see the fallback note above for why in-memory is correct
    // for the current single-container deployment.
    warnOnceInMemoryFallback()
    return Promise.resolve(inMemoryRateLimit(identifier, maxRequests, windowMs))
  }

  return Promise.resolve(inMemoryRateLimit(identifier, maxRequests, windowMs))
}

export function getClientIdentifier(request: Request): string {
  // SECURITY (audit H-08, 2026-08-30): derive identity from the RIGHTMOST
  // X-Forwarded-For hop (the one our own reverse proxy appended) or
  // CF-Connecting-IP. The FIRST XFF entry is client-controlled behind an
  // appending proxy — trusting it let attackers rotate a fake IP per request
  // to defeat every rate limit keyed on this value.
  const cfIp = request.headers.get('cf-connecting-ip')
  if (cfIp) return cfIp.trim()

  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const hops = forwarded.split(',').map((h) => h.trim()).filter(Boolean)
    if (hops.length > 0) return hops[hops.length - 1]
  }

  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}
