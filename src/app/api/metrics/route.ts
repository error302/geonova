/**
 * API: GET /api/metrics
 *
 * Prometheus-compatible metrics endpoint.
 * Exposes HTTP request counts, latency histograms, DB pool stats,
 * memory usage, and circuit breaker states.
 *
 * SECURITY (audit H-13, 2026-08-30): requires the API_ADMIN_KEY bearer token.
 * This endpoint was previously public and handed any anonymous caller the
 * full Prometheus dump — per-route hit counters, DB pool gauges, query
 * histograms, active users, project totals and heap internals — a free
 * reconnaissance map of traffic patterns, database pressure and business
 * growth. (Confirmed live during the audit.)
 *
 * Scrape with Prometheus (bearer auth):
 *   scrape_interval: 15s
 *   metrics_path: /api/metrics
 *   authorization: credentials <API_ADMIN_KEY>
 *   static_configs: [{ targets: ['metardu:3000'] }]
 */

import { NextRequest, NextResponse } from 'next/server'
import { getMetrics } from '@/lib/monitoring/metrics'

export const dynamic = 'force-dynamic'

function isAuthorized(request: NextRequest): boolean {
  const adminKey = process.env.API_ADMIN_KEY
  if (!adminKey) {
    // Fail closed: no key configured → nobody may scrape
    return false
  }
  const authHeader = request.headers.get('authorization') || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  return bearer === adminKey
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Metrics require the API admin bearer token' },
      { status: 401 },
    )
  }

  try {
    const text = await getMetrics()
    return new NextResponse(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to collect metrics', message: err instanceof Error ? err.message : 'Unknown' },
      { status: 500 },
    )
  }
}
