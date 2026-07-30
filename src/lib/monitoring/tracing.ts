/**
 * Distributed Tracing — OpenTelemetry-style trace context propagation
 *
 * ByteByteGo audit fix: Add distributed tracing between Next.js and Python worker.
 *
 * WHAT THIS DOES
 * --------------
 * 1. Generates a trace ID for every incoming request (if not from upstream)
 * 2. Propagates the trace ID to the Python worker via X-Trace-Id header
 * 3. Propagates the trace ID to outbound fetch calls (Stripe, M-Pesa, etc.)
 * 4. The Python worker logs the trace ID, enabling end-to-end request tracing
 * 5. Sentry is configured with the same trace ID for cross-referencing
 *
 * This implements the W3C Trace Context standard (traceparent header):
 *   traceparent: 00-{trace-id}-{span-id}-{flags}
 *
 * USAGE
 * -----
 * // In API routes:
 * import { getTraceContext, traceFetch } from '@/lib/monitoring/tracing'
 * const trace = getTraceContext(request)
 * const response = await traceFetch('https://api.stripe.com/...', { ... }, trace)
 *
 * // In Python worker calls:
 * const response = await traceFetch(`${PYTHON_WORKER_URL}/osm/features`, { ... }, trace)
 */

import { randomUUID } from 'crypto'
import type { NextRequest } from 'next/server'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TraceContext {
  traceId: string
  spanId: string
  parentSpanId?: string
  sampled: boolean
}

// ─── Trace Context Extraction & Generation ──────────────────────────────────

/**
 * Extract trace context from an incoming request.
 *
 * Checks for W3C traceparent header first, then falls back to X-Trace-Id.
 * If no trace context is found, generates a new one.
 */
export function getTraceContext(request?: NextRequest | Request): TraceContext {
  // Try W3C traceparent header first
  const traceparent = request?.headers.get('traceparent')
  if (traceparent) {
    const parts = traceparent.split('-')
    if (parts.length === 4 && parts[0] === '00') {
      return {
        traceId: parts[1],
        spanId: randomUUID().replace(/-/g, '').slice(0, 16),
        parentSpanId: parts[2],
        sampled: parts[3] === '01',
      }
    }
  }

  // Fall back to X-Trace-Id (simpler, used by our Python worker)
  const existingTraceId = request?.headers.get('x-trace-id')
  if (existingTraceId) {
    return {
      traceId: existingTraceId,
      spanId: randomUUID().replace(/-/g, '').slice(0, 16),
      sampled: true,
    }
  }

  // Generate new trace context
  return {
    traceId: randomUUID().replace(/-/g, ''),
    spanId: randomUUID().replace(/-/g, '').slice(0, 16),
    sampled: true,
  }
}

/**
 * Format a traceparent header for outbound requests.
 */
export function formatTraceparent(trace: TraceContext): string {
  return `00-${trace.traceId}-${trace.spanId}-${trace.sampled ? '01' : '00'}`
}

/**
 * Get trace headers to add to outbound requests.
 */
export function getTraceHeaders(trace: TraceContext): Record<string, string> {
  return {
    'traceparent': formatTraceparent(trace),
    'x-trace-id': trace.traceId,
    'x-span-id': trace.spanId,
  }
}

// ─── Traced Fetch Wrapper ───────────────────────────────────────────────────

/**
 * Fetch with trace context propagation.
 *
 * Automatically adds traceparent and X-Trace-Id headers to outbound requests.
 * If no trace context is provided, generates a new one (root span).
 *
 * Usage:
 *   const trace = getTraceContext(request)
 *   const res = await traceFetch('https://api.stripe.com/...', { method: 'POST', ... }, trace)
 */
export async function traceFetch(
  url: string,
  options: RequestInit = {},
  trace?: TraceContext,
): Promise<Response> {
  const ctx = trace || getTraceContext()

  const headers = new Headers(options.headers)
  const traceHeaders = getTraceHeaders(ctx)
  for (const [key, value] of Object.entries(traceHeaders)) {
    headers.set(key, value)
  }

  const startTime = performance.now()

  try {
    const response = await fetch(url, { ...options, headers })

    // Record metrics for this outbound call
    const duration = performance.now() - startTime
    recordOutboundSpan(url, ctx, response.status, duration)

    return response
  } catch (err) {
    const duration = performance.now() - startTime
    recordOutboundSpan(url, ctx, 0, duration, err instanceof Error ? err.message : 'Unknown')
    throw err
  }
}

// ─── Span Recording (for /metrics endpoint) ─────────────────────────────────

interface SpanRecord {
  url: string
  traceId: string
  spanId: string
  status: number
  durationMs: number
  error?: string
  timestamp: number
}

const recentSpans: SpanRecord[] = []
const MAX_SPANS = 1000

function recordOutboundSpan(
  url: string,
  trace: TraceContext,
  status: number,
  durationMs: number,
  error?: string,
) {
  recentSpans.push({
    url: url.substring(0, 200),  // truncate long URLs
    traceId: trace.traceId,
    spanId: trace.spanId,
    status,
    durationMs,
    error,
    timestamp: Date.now(),
  })

  if (recentSpans.length > MAX_SPANS) {
    recentSpans.shift()
  }
}

/**
 * Get recent outbound spans (for debugging / /metrics endpoint).
 */
export function getRecentSpans(): SpanRecord[] {
  return [...recentSpans].reverse()  // most recent first
}

/**
 * Get span statistics for /metrics endpoint.
 */
export function getSpanStats(): {
  totalSpans: number
  errorSpans: number
  avgDurationMs: number
  p90DurationMs: number
  p99DurationMs: number
} {
  if (recentSpans.length === 0) {
    return { totalSpans: 0, errorSpans: 0, avgDurationMs: 0, p90DurationMs: 0, p99DurationMs: 0 }
  }

  const durations = recentSpans.map(s => s.durationMs).sort((a, b) => a - b)
  const errors = recentSpans.filter(s => s.status >= 400 || s.error).length
  const avg = durations.reduce((s, v) => s + v, 0) / durations.length
  const p90 = durations[Math.floor(durations.length * 0.9)]
  const p99 = durations[Math.floor(durations.length * 0.99)]

  return {
    totalSpans: recentSpans.length,
    errorSpans: errors,
    avgDurationMs: Math.round(avg),
    p90DurationMs: Math.round(p90),
    p99DurationMs: Math.round(p99),
  }
}

// ─── Sentry Integration ─────────────────────────────────────────────────────

/**
 * Set the trace context on Sentry for cross-referencing.
 */
export function setSentryTraceContext(trace: TraceContext) {
  try {
    import('@/lib/monitoring/sentry').then(({ setUser, addBreadcrumb }) => {
      addBreadcrumb({
        category: 'trace',
        message: `Trace ${trace.traceId}`,
        level: 'info',
        data: { traceId: trace.traceId, spanId: trace.spanId },
      })
    }).catch(() => {})
  } catch {}
}
