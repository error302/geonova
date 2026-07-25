/**
 * Metrics Collection — Prometheus-compatible metrics for observability
 *
 * ByteByteGo audit fix: Adds the 3rd pillar of observability (metrics).
 * Previously only had logs (structured JSON) and traces (Sentry).
 * Now provides a /metrics endpoint for Prometheus scraping.
 *
 * Tracks the 4 golden signals (Google SRE):
 *   - Latency (response time histograms)
 *   - Traffic (request count)
 *   - Errors (error count by status code)
 *   - Saturation (DB pool, memory, circuit breaker state)
 *
 * Exposed at GET /api/metrics in Prometheus text format.
 */

import { getAllCircuitStates } from '@/lib/resilience/circuitBreaker'
import { db } from '@/lib/db'

// ─── In-memory metrics store ────────────────────────────────────────────────

interface MetricEntry {
  name: string
  labels: Record<string, string>
  value: number
  timestamp: number
}

const counters = new Map<string, number>()
const histograms = new Map<string, number[]>()

function counterKey(name: string, labels: Record<string, string> = {}): string {
  const labelStr = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v}"`)
    .join(',')
  return `${name}{${labelStr}}`
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function incrementCounter(name: string, labels?: Record<string, string>, value: number = 1) {
  const key = counterKey(name, labels)
  counters.set(key, (counters.get(key) || 0) + value)
}

export function observeHistogram(name: string, value: number) {
  if (!histograms.has(name)) histograms.set(name, [])
  const arr = histograms.get(name)!
  arr.push(value)
  if (arr.length > 10000) arr.shift() // prevent unbounded growth
}

export function recordRequest(method: string, path: string, status: number, durationMs: number) {
  // Traffic counter
  incrementCounter('http_requests_total', { method, path, status: String(status) })

  // Latency histogram
  observeHistogram('http_request_duration_ms', durationMs)

  // Error counter (4xx + 5xx)
  if (status >= 400) {
    incrementCounter('http_errors_total', {
      method,
      path,
      status_class: status < 500 ? '4xx' : '5xx',
    })
  }
}

// ─── Metrics Export (Prometheus format) ─────────────────────────────────────

export async function getMetricsText(): Promise<string> {
  const lines: string[] = []

  // ─── HTTP counters ──────────────────────────────────────────────────────
  lines.push('# HELP http_requests_total Total HTTP requests')
  lines.push('# TYPE http_requests_total counter')
  for (const [key, value] of counters.entries()) {
    if (key.startsWith('http_requests_total')) {
      lines.push(`${key} ${value}`)
    }
  }

  lines.push('# HELP http_errors_total Total HTTP errors (4xx + 5xx)')
  lines.push('# TYPE http_errors_total counter')
  for (const [key, value] of counters.entries()) {
    if (key.startsWith('http_errors_total')) {
      lines.push(`${key} ${value}`)
    }
  }

  // ─── Latency histogram ─────────────────────────────────────────────────
  lines.push('# HELP http_request_duration_ms HTTP request duration in milliseconds')
  lines.push('# TYPE http_request_duration_ms summary')
  const durations = histograms.get('http_request_duration_ms') || []
  if (durations.length > 0) {
    const sorted = [...durations].sort((a, b) => a - b)
    const p50 = sorted[Math.floor(sorted.length * 0.5)]
    const p90 = sorted[Math.floor(sorted.length * 0.9)]
    const p99 = sorted[Math.floor(sorted.length * 0.99)]
    const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length
    lines.push(`http_request_duration_ms{quantile="0.5"} ${p50}`)
    lines.push(`http_request_duration_ms{quantile="0.9"} ${p90}`)
    lines.push(`http_request_duration_ms{quantile="0.99"} ${p99}`)
    lines.push(`http_request_duration_ms_avg ${avg}`)
    lines.push(`http_request_duration_ms_count ${sorted.length}`)
  }

  // ─── DB pool metrics ───────────────────────────────────────────────────
  lines.push('# HELP db_pool_connections Database connection pool metrics')
  lines.push('# TYPE db_pool_connections gauge')
  try {
    const poolMetrics = db.getPoolMetrics()
    lines.push(`db_pool_total_connections ${poolMetrics.totalCount}`)
    lines.push(`db_pool_idle_connections ${poolMetrics.idleCount}`)
    lines.push(`db_pool_waiting_connections ${poolMetrics.waitingCount}`)
  } catch {}

  // ─── Memory metrics ────────────────────────────────────────────────────
  lines.push('# HELP nodejs_memory_usage_mb Node.js memory usage in MB')
  lines.push('# TYPE nodejs_memory_usage_mb gauge')
  const mem = process.memoryUsage()
  lines.push(`nodejs_memory_rss_mb ${(mem.rss / 1024 / 1024).toFixed(2)}`)
  lines.push(`nodejs_memory_heap_used_mb ${(mem.heapUsed / 1024 / 1024).toFixed(2)}`)
  lines.push(`nodejs_memory_heap_total_mb ${(mem.heapTotal / 1024 / 1024).toFixed(2)}`)
  lines.push(`nodejs_memory_external_mb ${(mem.external / 1024 / 1024).toFixed(2)}`)

  // ─── Circuit breaker metrics ───────────────────────────────────────────
  lines.push('# HELP circuit_breaker_state Circuit breaker state (0=CLOSED, 1=HALF_OPEN, 2=OPEN)')
  lines.push('# TYPE circuit_breaker_state gauge')
  lines.push('# HELP circuit_breaker_failures Consecutive failures for circuit breaker')
  lines.push('# TYPE circuit_breaker_failures gauge')
  try {
    for (const circuit of getAllCircuitStates()) {
      const stateValue = circuit.state === 'CLOSED' ? 0 : circuit.state === 'HALF_OPEN' ? 1 : 2
      lines.push(`circuit_breaker_state{name="${circuit.name}"} ${stateValue}`)
      lines.push(`circuit_breaker_failures{name="${circuit.name}"} ${circuit.failureCount}`)
    }
  } catch {}

  // ─── Uptime ────────────────────────────────────────────────────────────
  lines.push('# HELP process_uptime_seconds Process uptime in seconds')
  lines.push('# TYPE process_uptime_seconds gauge')
  lines.push(`process_uptime_seconds ${process.uptime().toFixed(2)}`)

  return lines.join('\n') + '\n'
}
