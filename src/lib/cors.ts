/**
 * CORS helper for API routes.
 *
 * Supported origins:
 * - Hardcoded production origins (metardu.space)
 * - Environment variable CORS_ALLOWED_ORIGINS (comma-separated)
 * - Ionic/Capacitor: ionic://localhost, capacitor://localhost
 * - Playwright E2E testing: http://localhost:3099
 * - Staging/preview deployments: https://*.space-z.ai
 * - Development: http://localhost:3000
 */

import { NextResponse } from 'next/server'

/* ── Origin lists ─────────────────────────────────────────────────── */

/** Hardcoded production origins */
const PRODUCTION_ORIGINS = [
  'https://metardu.space',
  'capacitor://localhost',
  'ionic://localhost',
]

/** Development-only origins */
const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3099',  // Playwright E2E testing
]

/** Origins loaded from CORS_ALLOWED_ORIGINS env var (comma-separated) */
function getEnvOrigins(): string[] {
  const raw = process.env.CORS_ALLOWED_ORIGINS
  if (!raw) return []
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

/** Staging URL pattern: https://*.space-z.ai */
const STAGING_PATTERN = /^https:\/\/[a-z0-9-]+\.space-z\.ai$/

/**
 * Check whether an origin is allowed.
 */
function isOriginAllowed(origin: string): boolean {
  // Check hardcoded production origins
  if (PRODUCTION_ORIGINS.includes(origin)) return true

  // Check environment variable origins
  if (getEnvOrigins().includes(origin)) return true

  // Check staging pattern (preview deployments)
  if (STAGING_PATTERN.test(origin)) return true

  // Check dev-only origins
  if (process.env.NODE_ENV === 'development' && DEV_ORIGINS.includes(origin)) return true

  return false
}

/* ── Rate limiting for preflight requests ─────────────────────────── */

const preflightCounts = new Map<string, { count: number; resetAt: number }>()
const PREFLIGHT_RATE_LIMIT = 10     // max preflight requests per minute per origin
const PREFLIGHT_WINDOW_MS = 60_000  // 1 minute

function isPreflightRateLimited(origin: string): boolean {
  const now = Date.now()
  const entry = preflightCounts.get(origin)

  if (!entry || now > entry.resetAt) {
    // Start a new window
    preflightCounts.set(origin, { count: 1, resetAt: now + PREFLIGHT_WINDOW_MS })
    return false
  }

  entry.count++
  if (entry.count > PREFLIGHT_RATE_LIMIT) {
    return true
  }
  return false
}

/* ── Public API ───────────────────────────────────────────────────── */

export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !isOriginAllowed(origin)) {
    return {}
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true',
  }
}

/**
 * Handle OPTIONS preflight requests — call from any API route that needs CORS.
 * Includes rate limiting (max 10 preflight requests per minute per origin).
 */
export function handlePreflight(request: Request) {
  const origin = request.headers.get('origin')

  if (!origin || !isOriginAllowed(origin)) {
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 })
  }

  // Rate limit preflight requests per origin
  if (isPreflightRateLimited(origin)) {
    return NextResponse.json({ error: 'Too many preflight requests' }, { status: 429 })
  }

  const headers = corsHeaders(origin)
  return new NextResponse(null, {
    status: 204,
    headers,
  })
}
