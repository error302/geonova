/**
 * Health Check Endpoints — v0.3 redesign
 *
 * Per system-design skill: separate liveness and readiness probes.
 *
 *   GET /api/health/live   — is the process alive? (no deps checked)
 *   GET /api/health/ready  — is the app ready to serve? (checks DB, etc.)
 *
 * Used by Docker, PM2, and orchestrators for rolling deployments.
 */

import { NextResponse } from 'next/server'
import { apiSuccessV3, apiErrorV3 } from '@/lib/api/response'

// ─── Liveness: process is alive ─────────────────────────────────────────────

export function GET_live() {
  return NextResponse.json(
    apiSuccessV3({ status: 'alive', timestamp: Date.now() })
  )
}

// ─── Readiness: deps are connected ──────────────────────────────────────────

export async function GET_ready() {
  const checks: Record<string, 'ok' | 'fail'> = {
    process: 'ok',
  }

  // Check database connectivity (lazy — only fails if we can't get a client)
  try {
    const { createClient } = await import('@/lib/api-client/server')
    const client = await createClient()
    // Simple no-op query — if this throws, DB is down
    // Use limit(1) instead of .head() — .head() isn't in the QueryBuilder type
    await client.from('users').select('id').limit(1)
    checks.database = 'ok'
  } catch {
    checks.database = 'fail'
  }

  const allOk = Object.values(checks).every(v => v === 'ok')

  return NextResponse.json(
    allOk
      ? apiSuccessV3({ status: 'ready', checks })
      : apiErrorV3('DEPS_UNAVAILABLE', 'One or more dependencies are unavailable', { checks }),
    { status: allOk ? 200 : 503 }
  )
}

// ─── Route exports ──────────────────────────────────────────────────────────

// Next.js App Router: each file in app/api/health/[route]/route.ts
// This file is a helper — actual route handlers live in:
//   app/api/health/live/route.ts   -> export { GET_live as GET }
//   app/api/health/ready/route.ts  -> export { GET_ready as GET }
