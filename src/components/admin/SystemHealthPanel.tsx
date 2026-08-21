'use client'

import { useEffect, useState } from 'react'
import {
  Cpu, RefreshCw, ChevronDown, ChevronUp,
  AlertTriangle,
} from 'lucide-react'
import {
  UptimeChart,
  ResponseTimeChart,
  ErrorRateChart,
} from '@/components/admin/charts/AdminCharts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HealthData {
  current: {
    database: {
      status: string
      latencyMs: number
      connections: number
      connectionsMax: number
    }
    uptime: number
    uptimePercent: number
    memory: {
      heapUsedMb: number
      heapTotalMb: number
      rssMb: number
      externalMb: number
    }
    responseTimeMs: number
  }
  trends: {
    responseTime: {
      timestamp: string
      p50: number
      p95: number
      p99: number
    }[]
    uptime7d: { date: string; uptime: number }[]
    uptime30d: { date: string; uptime: number }[]
    errorRate: { timestamp: string; rate: number; count: number }[]
  }
  recentErrors: { message: string; timestamp: string; endpoint: string }[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hrs = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hrs}h`
  if (hrs > 0) return `${hrs}h ${mins}m`
  return `${mins}m`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SystemHealthPanel() {
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [uptimeRange, setUptimeRange] = useState<'7d' | '30d'>('7d')

  const fetchHealth = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/admin/health')
      if (!res.ok) throw new Error('Failed to fetch health data')
      const json = (await res.json()) as HealthData & { data?: HealthData }
      setData(json.data ?? json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load health data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, 60000) // refresh every 60s
    return () => clearInterval(interval)
  }, [])

  if (loading && !data) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              System Health
            </h2>
          </div>
        </div>
        <div className="p-5 flex items-center justify-center min-h-[120px]">
          <RefreshCw className="w-5 h-5 text-[var(--accent)] animate-spin" />
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              System Health
            </h2>
          </div>
        </div>
        <div className="p-5 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={fetchHealth}
            className="mt-3 text-xs text-[var(--accent)] hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const d = data.current
  const uptimeTrends = uptimeRange === '7d' ? data.trends.uptime7d : data.trends.uptime30d

  return (
    <div className="card" id="system">
      <div className="card-header">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              System Health
            </h2>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                d.database.status === 'healthy'
                  ? 'bg-green-500/15 text-green-400'
                  : 'bg-red-500/15 text-red-400'
              }`}
            >
              {d.database.status === 'healthy' ? 'Operational' : 'Degraded'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchHealth}
              className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors lg:hidden"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Quick Status Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Database */}
          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-[color-mix(in_srgb,var(--bg-tertiary)_50%,transparent)]">
            <div
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                d.database.status === 'healthy' ? 'bg-green-400' : 'bg-red-400'
              }`}
            />
            <div className="min-w-0">
              <p className="text-xs text-[var(--text-muted)]">Database</p>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {d.database.latencyMs}ms
                {d.database.connections > 0 && (
                  <span className="text-[var(--text-muted)] text-xs ml-1">
                    ({d.database.connections}/{d.database.connectionsMax})
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Uptime */}
          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-[color-mix(in_srgb,var(--bg-tertiary)_50%,transparent)]">
            <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-green-400" />
            <div className="min-w-0">
              <p className="text-xs text-[var(--text-muted)]">Uptime</p>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {d.uptimePercent}%
                <span className="text-[var(--text-muted)] text-xs ml-1">
                  ({formatUptime(d.uptime)})
                </span>
              </p>
            </div>
          </div>

          {/* Memory */}
          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-[color-mix(in_srgb,var(--bg-tertiary)_50%,transparent)]">
            <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-yellow-400" />
            <div className="min-w-0">
              <p className="text-xs text-[var(--text-muted)]">Memory</p>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {d.memory.heapUsedMb}MB / {d.memory.heapTotalMb}MB
              </p>
            </div>
          </div>

          {/* API Response */}
          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-[color-mix(in_srgb,var(--bg-tertiary)_50%,transparent)]">
            <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-blue-400" />
            <div className="min-w-0">
              <p className="text-xs text-[var(--text-muted)]">API Response</p>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {d.responseTimeMs}ms
              </p>
            </div>
          </div>
        </div>

        {/* Expandable Charts — always visible on lg, toggle on mobile */}
        <div className={`${expanded ? 'block' : 'hidden lg:block'} space-y-4`}>
          {/* Uptime Graph with range toggle */}
          <div className="rounded-lg border border-[var(--border-color)] p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Uptime Percentage
              </h3>
              <div className="flex gap-1">
                <button
                  onClick={() => setUptimeRange('7d')}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                    uptimeRange === '7d'
                      ? 'bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  7d
                </button>
                <button
                  onClick={() => setUptimeRange('30d')}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                    uptimeRange === '30d'
                      ? 'bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  30d
                </button>
              </div>
            </div>
            <UptimeChart data={uptimeTrends} />
          </div>

          {/* Response Time P95/P99 */}
          <div className="rounded-lg border border-[var(--border-color)] p-3">
            <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              Response Time (p50 / p95 / p99)
            </h3>
            <ResponseTimeChart data={data.trends.responseTime} />
          </div>

          {/* Error Rate */}
          <div className="rounded-lg border border-[var(--border-color)] p-3">
            <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              Error Rate
            </h3>
            <ErrorRateChart data={data.trends.errorRate} />
          </div>

          {/* Recent Errors */}
          {data.recentErrors.length > 0 && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">
                Recent Errors ({data.recentErrors.length})
              </h3>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {data.recentErrors.map((err, i) => (
                  <div key={`${err}-${i}`} className="flex items-start gap-2 text-xs">
                    <AlertTriangle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-red-300 truncate">{err.message}</p>
                      <p className="text-[var(--text-muted)]">
                        {err.endpoint} &middot; {new Date(err.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
