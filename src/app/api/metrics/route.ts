/**
 * API: GET /api/metrics
 *
 * Prometheus-compatible metrics endpoint.
 * Exposes HTTP request counts, latency histograms, DB pool stats,
 * memory usage, and circuit breaker states.
 *
 * Scrape with Prometheus:
 *   scrape_interval: 15s
 *   metrics_path: /api/metrics
 *   static_configs: [{ targets: ['metardu:3000'] }]
 */

import { NextResponse } from 'next/server'
import { getMetricsText } from '@/lib/monitoring/metrics'

export async function GET() {
  try {
    const text = await getMetricsText()
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
