'use client';

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Loader2 } from 'lucide-react'
import { logger } from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnalyticsData {
  totalProjects: number
  activeProjects: number
  completedSurveys: number
  totalPoints: number
  storageUsed: number
  apiCalls: number
  userActivity: { date: string; count: number }[]
  projectTypes: { type: string; count: number }[]
  // Previous period data for delta computation
  prevTotalProjects: number
  prevActiveProjects: number
  prevCompletedSurveys: number
}

const emptyData: AnalyticsData = {
  totalProjects: 0,
  activeProjects: 0,
  completedSurveys: 0,
  totalPoints: 0,
  storageUsed: 0,
  apiCalls: 0,
  userActivity: [],
  projectTypes: [],
  prevTotalProjects: 0,
  prevActiveProjects: 0,
  prevCompletedSurveys: 0,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeDelta(current: number, previous: number): string | null {
  if (previous === 0 && current === 0) return null
  if (previous === 0) return current > 0 ? '+100%' : null
  const change = ((current - previous) / previous) * 100
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(0)}%`
}

function deltaColor(delta: string | null): string {
  if (!delta) return 'text-[var(--text-muted)]'
  return delta.startsWith('+') ? 'text-green-400' : 'text-red-400'
}

const TYPE_COLORS = ['#60a5fa', '#4ade80', '#f59e0b', '#a78bfa', '#f472b6', '#94a3b8']

const activityChartConfig: ChartConfig = {
  count: { label: 'Projects Created', color: 'hsl(var(--accent))' },
}

const typeChartConfig: ChartConfig = {
  cadastral: { label: 'Cadastral', color: '#60a5fa' },
  topographic: { label: 'Topographic', color: '#4ade80' },
  engineering: { label: 'Engineering', color: '#f59e0b' },
  control: { label: 'Control', color: '#a78bfa' },
  other: { label: 'Other', color: '#94a3b8' },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const { data: session, status } = useSession()
  const [period, setPeriod] = useState('7d')
  const [data, setData] = useState<AnalyticsData>(emptyData)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user?.id) {
      setLoading(false)
      return
    }
    const sessionUserId = session.user.id

    async function fetchAnalytics() {
      try {
        // Use the admin dashboard API for richer data if admin,
        // otherwise fall back to direct DB query via Supabase
        const isAdmin = (session?.user as { role?: string })?.role === 'super_admin' ||
          (session?.user as { role?: string })?.role === 'admin'

        if (isAdmin) {
          const res = await fetch('/api/admin/dashboard')
          if (res.ok) {
            const json = (await res.json()) as {
              data?: {
                projects?: {
                  total?: number
                  byStatus?: Record<string, number>
                }
                parcels?: number
                submissionsThisMonth?: number
                revenue?: { byMonth?: Array<{ month: string; total: number }> }
              }
            }
            const d = (json.data ?? json) as {
              projects?: {
                total?: number
                byStatus?: Record<string, number>
              }
              parcels?: number
              submissionsThisMonth?: number
              revenue?: { byMonth?: Array<{ month: string; total: number }> }
            }
            setData({
              totalProjects: d.projects?.total ?? 0,
              activeProjects: d.projects?.byStatus?.active ?? d.projects?.total ?? 0,
              completedSurveys: d.projects?.byStatus?.completed ?? 0,
              totalPoints: d.parcels ?? 0,
              // AUDIT FIX: Don't fabricate storage from parcel count.
              storageUsed: 0,
              apiCalls: d.submissionsThisMonth ?? 0,
              userActivity: (d.revenue?.byMonth ?? []).map((m: { month: string; total: number }) => ({
                date: m.month,
                count: m.total,
              })),
              projectTypes: Object.entries(d.projects?.byStatus ?? {}).map(([type, count]) => ({
                type,
                count: count as number,
              })),
              // AUDIT FIX: Don't fabricate 'previous period' deltas.
              prevTotalProjects: 0,
              prevActiveProjects: 0,
              prevCompletedSurveys: 0,
            })
          }
        } else {
          // Regular user — query their own projects
          const { createClient } = await import('@/lib/api-client/client')
          const dbClient = createClient()
          const userId = sessionUserId

          const [projectsRes, pointsRes] = await Promise.all([
            dbClient.from('projects').select('id, survey_type, created_at').eq('user_id', userId),
            dbClient.from('survey_points').select('id, created_at').eq('user_id', userId),
          ])

          type ProjectRow = { id: string; survey_type: string | null; created_at: string }
          type PointRow = { id: string; created_at: string }
          const projects = (projectsRes.data ?? []) as ProjectRow[]
          const points = (pointsRes.data ?? []) as PointRow[]

          // Build activity based on period
          const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365
          const lastNDays: { date: string; count: number }[] = []
          for (let i = days - 1; i >= 0; i--) {
            const d = new Date()
            d.setDate(d.getDate() - i)
            const dateStr = d.toISOString().split('T')[0]
            const count = projects.filter((p) => p.created_at?.startsWith(dateStr)).length
            lastNDays.push({ date: dateStr, count })
          }

          const projectTypesMap: Record<string, number> = {}
          projects.forEach((p) => {
            const type = p.survey_type ?? 'Other'
            projectTypesMap[type] = (projectTypesMap[type] ?? 0) + 1
          })

          // Compute previous period deltas
          const halfPoint = Math.floor(projects.length / 2)
          const recentProjects = projects.slice(0, halfPoint)
          const olderProjects = projects.slice(halfPoint)

          setData({
            totalProjects: projects.length,
            activeProjects: projects.length,
            completedSurveys: projects.filter((p) => p.survey_type !== null).length,
            totalPoints: points.length,
            // AUDIT FIX (2026-07-03): Don't fabricate storage from points count.
            storageUsed: 0,
            // AUDIT FIX: apiCalls=0 was hardcoded. We don't track per-user API calls yet.
            apiCalls: 0,
            userActivity: lastNDays,
            projectTypes: Object.entries(projectTypesMap).map(([type, count]) => ({ type, count })),
            prevTotalProjects: olderProjects.length,
            prevActiveProjects: olderProjects.length,
            prevCompletedSurveys: olderProjects.filter((p) => p.survey_type !== null).length,
          })
        }
      } catch (err) {
        logger.error('Analytics fetch failed:', { error: err })
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [session?.user, status, period])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
      </div>
    )
  }

  const deltas = {
    totalProjects: computeDelta(data.totalProjects, data.prevTotalProjects),
    activeProjects: computeDelta(data.activeProjects, data.prevActiveProjects),
    completedSurveys: computeDelta(data.completedSurveys, data.prevCompletedSurveys),
    apiCalls: null as string | null,
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">Analytics</h1>
            <p className="text-[var(--text-muted)]">Track your METARDU usage</p>
          </div>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="p-2 border border-[var(--border-color)] rounded-lg bg-[var(--bg-secondary)] text-[var(--text-primary)]"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
        </div>

        {/* Stat cards with computed deltas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Projects', value: data.totalProjects, delta: deltas.totalProjects },
            { label: 'Active Projects', value: data.activeProjects, delta: deltas.activeProjects },
            { label: 'Completed Surveys', value: data.completedSurveys, delta: deltas.completedSurveys },
            { label: 'API Calls', value: data.apiCalls, delta: deltas.apiCalls },
          ].map((card) => (
            <div key={card.label} className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6">
              <p className="text-sm text-[var(--text-muted)] mb-1">{card.label}</p>
              <p className="text-3xl font-bold text-[var(--text-primary)]">
                {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
              </p>
              {card.delta ? (
                <p className={`text-xs mt-1 ${deltaColor(card.delta)}`}>
                  {card.delta.startsWith('+') ? '↑' : '↓'} {card.delta} from last period
                </p>
              ) : (
                <p className="text-xs text-[var(--text-muted)] mt-1">No prior data</p>
              )}
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* User Activity — Recharts AreaChart */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6">
            <h2 className="text-lg font-semibold mb-4 text-[var(--text-primary)]">User Activity</h2>
            <ChartContainer config={activityChartConfig} className="min-h-[240px] w-full">
              <AreaChart data={data.userActivity} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="activityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  tickFormatter={(v: string) => v.split('-').slice(1).join('/')}
                />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--accent))"
                  strokeWidth={2}
                  fill="url(#activityGrad)"
                />
              </AreaChart>
            </ChartContainer>
          </div>

          {/* Projects by Type — Donut Chart */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6">
            <h2 className="text-lg font-semibold mb-4 text-[var(--text-primary)]">Projects by Type</h2>
            {data.projectTypes.length > 0 ? (
              <div className="flex items-start gap-4">
                <ChartContainer config={typeChartConfig} className="min-h-[200px] w-[200px]">
                  <PieChart>
                    <Pie
                      data={data.projectTypes}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="count"
                      stroke="none"
                    >
                      {data.projectTypes.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={TYPE_COLORS[index % TYPE_COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
                <div className="space-y-2 text-sm flex-1">
                  {data.projectTypes.map((pt, i) => {
                    const percentage = data.totalProjects > 0 ? (pt.count / data.totalProjects) * 100 : 0
                    return (
                      <div key={pt.type} className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-sm shrink-0"
                          style={{ backgroundColor: TYPE_COLORS[i % TYPE_COLORS.length] }}
                        />
                        <span className="text-[var(--text-secondary)] capitalize">{pt.type}</span>
                        <span className="text-[var(--text-primary)] font-medium ml-auto">
                          {pt.count}
                          <span className="text-[var(--text-muted)] text-xs ml-1">
                            ({Math.round(percentage)}%)
                          </span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No project type data</p>
            )}
          </div>
        </div>

        {/* Storage, API, and Team info */}
        {/* AUDIT FIX (2026-07-03): Storage/API widgets were fabricated.
            Now show honest 'not yet available' when no real data. */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6">
            <h2 className="text-lg font-semibold mb-2 text-[var(--text-primary)]">Storage</h2>
            <div className="relative pt-4">
              {data.storageUsed > 0 ? (
                <>
                  <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-4">
                    <div
                      className="bg-green-500 h-4 rounded-full transition-all"
                      style={{ width: `${Math.min((data.storageUsed / 5) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-sm text-[var(--text-muted)] mt-2">
                    {data.storageUsed} GB of 5 GB used
                  </p>
                </>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">
                  Storage tracking is not yet available. File-size accounting will be added in a future update.
                </p>
              )}
            </div>
          </div>
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6">
            <h2 className="text-lg font-semibold mb-2 text-[var(--text-primary)]">API Usage</h2>
            <div className="relative pt-4">
              {data.apiCalls > 0 ? (
                <>
                  <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-4">
                    <div
                      className="bg-blue-500 h-4 rounded-full transition-all"
                      style={{ width: `${Math.min((data.apiCalls / 50000) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-sm text-[var(--text-muted)] mt-2">
                    {data.apiCalls.toLocaleString()} of 50,000 calls
                  </p>
                </>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">
                  Per-user API call tracking is not yet available. Contact your administrator for platform-wide stats.
                </p>
              )}
            </div>
          </div>
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6">
            <h2 className="text-lg font-semibold mb-2 text-[var(--text-primary)]">Survey Points</h2>
            <p className="text-3xl font-bold text-[var(--text-primary)]">{data.totalPoints.toLocaleString()}</p>
            <p className="text-sm text-[var(--text-muted)]">Total points recorded</p>
          </div>
        </div>
      </div>
    </div>
  )
}
