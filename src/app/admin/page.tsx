'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Users, FolderKanban, LandPlot, RadioTower,
  DollarSign, Activity, Clock, Database,
  HardDrive, Cpu, TrendingUp,
  UserPlus, ShieldCheck, Settings2, FileText,
  CreditCard, Loader2, AlertCircle, ChevronRight,
  Megaphone, Check, X,
} from 'lucide-react'
import { z } from 'zod'
import { apiGet, apiPost, apiPatch, ApiError } from '@/lib/api/client'
import dynamic from 'next/dynamic'
import { RevenueLineChart, SubscriptionDonutChart, Sparkline } from '@/components/admin/charts/AdminCharts'
import SystemHealthPanel from '@/components/admin/SystemHealthPanel'

const DashboardSearch = dynamic(
  () => import('@/components/dashboard/DashboardSearch').then(m => m.default || m),
  { ssr: false },
)
const PerformanceDashboard = dynamic(
  () => import('@/components/PerformanceDashboard').then(m => m.default || m),
  { ssr: false },
)

// ponytail: response schemas — Phase 4 wave 2 will move these to src/lib/api/schemas/

// Dashboard payload is large and may grow; accept any object shape and cast to DashboardData.
const dashboardResponseSchema = z.record(z.any())

const announcementMutationSchema = z.object({
  ok: z.boolean().optional(),
  id: z.union([z.string(), z.number()]).optional(),
}).passthrough()

const overridePlanMutationSchema = z.object({
  ok: z.boolean().optional(),
  plan: z.string().optional(),
}).passthrough()

const verifyIskMutationSchema = z.object({
  ok: z.boolean().optional(),
  verified: z.boolean().optional(),
}).passthrough()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardData {
  users: {
    total: number
    newThisMonth: number
    active: number
  }
  projects: {
    total: number
    byStatus: Record<string, number>
  }
  parcels: number
  beacons: number
  revenue: {
    total: number
    byMonth: { month: string; total: number }[]
  }
  recentSignups: {
    id: string
    email: string
    name: string
    role: string
    plan: string
    createdAt: string
  }[]
  iskPendingCount: number
  iskQueue: {
    id: string
    email: string
    name: string
    iskNumber: string
    submittedAt: string
  }[]
  activeSubscriptions: { free: number; pro: number; enterprise: number }
  submissionsThisMonth: number
  system: {
    database: {
      status: string
      latencyMs: number
    }
    uptime: number
    memory: {
      heapUsedMb: number
      heapTotalMb: number
      rssMb: number
    }
    responseTimeMs: number
  }
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function roleBadgeClass(role: string): string {
  switch (role) {
    case 'super_admin':
      return 'bg-red-500/15 text-red-400 border-red-500/30'
    case 'org_admin':
      return 'bg-orange-500/15 text-orange-400 border-orange-500/30'
    case 'admin':
      return 'bg-orange-500/15 text-orange-400 border-orange-500/30'
    case 'project_manager':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30'
    case 'surveyor':
      return 'bg-green-500/15 text-green-400 border-green-500/30'
    case 'viewer':
      return 'bg-gray-500/15 text-gray-400 border-gray-500/30'
    default:
      return 'bg-gray-500/15 text-gray-400 border-gray-500/30'
  }
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  trend,
  color = 'var(--accent)',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  subValue?: string
  trend?: 'up' | 'down' | 'neutral'
  color?: string
}) {
  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <span style={{ color }}><Icon className="w-5 h-5" /></span>
        </div>
        {trend === 'up' && (
          <div className="flex items-center gap-1 text-xs text-green-400">
            <TrendingUp className="w-3 h-3" />
            <span>Up</span>
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
        {subValue && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{subValue}</p>
        )}
      </div>
      <p className="text-xs text-[var(--text-secondary)]">{label}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AdminDashboardPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Broadcast state
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementBody, setAnnouncementBody] = useState('')
  const [announcementTarget, setAnnouncementTarget] = useState('all')
  const [broadcastSending, setBroadcastSending] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState<{ ok: boolean; msg: string } | null>(null)

  // Subscription override state
  const [overrideEmail, setOverrideEmail] = useState('')
  const [overridePlan, setOverridePlan] = useState('pro')
  const [overrideDays, setOverrideDays] = useState('30')
  const [overrideSending, setOverrideSending] = useState(false)
  const [overrideResult, setOverrideResult] = useState<{ ok: boolean; msg: string } | null>(null)

  // ISK queue processing
  const [iskProcessing, setIskProcessing] = useState<Set<string>>(new Set())

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const json = await apiGet('/api/admin/dashboard', dashboardResponseSchema, { ttlMs: 0 })
      setData(json as unknown as DashboardData)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isUnauthorized) {
          router.push('/login')
          return
        }
        if (err.isForbidden) {
          router.push('/dashboard')
          return
        }
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      }
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (sessionStatus === 'authenticated') {
      fetchDashboard()
    }
  }, [sessionStatus, fetchDashboard, router])

  const handleBroadcast = async () => {
    if (!announcementTitle || !announcementBody) return
    setBroadcastSending(true)
    setBroadcastResult(null)
    try {
      await apiPost(
        '/api/admin/announcements',
        announcementMutationSchema,
        {
          title: announcementTitle,
          body: announcementBody,
          target: announcementTarget,
        },
      )
      setBroadcastResult({ ok: true, msg: 'Announcement sent successfully!' })
      setAnnouncementTitle('')
      setAnnouncementBody('')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Network error'
      setBroadcastResult({ ok: false, msg })
    } finally {
      setBroadcastSending(false)
    }
  }

  const handleOverride = async () => {
    if (!overrideEmail || !overridePlan) return
    setOverrideSending(true)
    setOverrideResult(null)
    try {
      await apiPatch(
        '/api/admin/users/override-plan',
        overridePlanMutationSchema,
        {
          email: overrideEmail,
          plan: overridePlan,
          days: parseInt(overrideDays, 10) || 30,
        },
      )
      setOverrideResult({ ok: true, msg: `Plan updated to ${overridePlan} for ${overrideDays} days` })
      setOverrideEmail('')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Network error'
      setOverrideResult({ ok: false, msg })
    } finally {
      setOverrideSending(false)
    }
  }

  const handleIskAction = async (userId: string, approve: boolean) => {
    setIskProcessing(prev => new Set(prev).add(userId))
    try {
      await apiPatch(
        `/api/admin/users/${userId}/verify-isk`,
        verifyIskMutationSchema,
        { verified: approve },
      )
      // Remove from queue locally
      setData(prev => prev ? {
        ...prev,
        iskQueue: prev.iskQueue.filter(u => u.id !== userId),
        iskPendingCount: Math.max(0, prev.iskPendingCount - 1),
      } : prev)
    } catch (err) {
      // ponytail: surface the failure so the admin knows to retry — previously this was a silent swallow
      const msg = err instanceof ApiError ? err.message : 'Failed to update ISK status'
      setError(msg)
    } finally {
      setIskProcessing(prev => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    }
  }

  // Loading state
  if (sessionStatus === 'loading' || (loading && !data)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
          <p className="text-sm text-[var(--text-secondary)]">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="card p-8 max-w-md w-full mx-4 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            Failed to Load Dashboard
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4">{error}</p>
          <button onClick={fetchDashboard} className="btn btn-primary">
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const userRole = (session?.user as { role?: string })?.role ?? ''
  const isSuperAdmin = userRole === 'super_admin'
  const isAdminRole = userRole === 'admin' || userRole === 'super_admin'
  const canOverridePlans = isAdminRole

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Admin Dashboard</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Platform overview for Metardu administrators
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DashboardSearch />
          <button
            onClick={fetchDashboard}
            className="btn btn-secondary text-sm"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Activity className="w-4 h-4" />
            )}
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          icon={Users}
          label="Total Users"
          value={data.users.total.toLocaleString()}
          subValue={`${data.users.newThisMonth} new this month`}
          trend="up"
          color="#4ade80"
        />
        <StatCard
          icon={Activity}
          label="Active Users"
          value={data.users.active.toLocaleString()}
          subValue="Last 30 days"
          color="#60a5fa"
        />
        <StatCard
          icon={FolderKanban}
          label="Total Projects"
          value={data.projects.total.toLocaleString()}
          subValue={Object.entries(data.projects.byStatus)
            .map(([s, c]) => `${s}: ${c}`)
            .join(', ')}
          color="#f59e0b"
        />
        <StatCard
          icon={LandPlot}
          label="Total Parcels"
          value={data.parcels.toLocaleString()}
          color="#a78bfa"
        />
        <StatCard
          icon={RadioTower}
          label="Total Beacons"
          value={data.beacons.toLocaleString()}
          color="#f472b6"
        />
      </div>

      {/* Extended Stats Row + Subscription Donut */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={CreditCard}
          label="Pro Subscribers"
          value={data.activeSubscriptions?.pro ?? 0}
          subValue={`Enterprise: ${data.activeSubscriptions?.enterprise ?? 0}`}
          color="#a78bfa"
        />
        <StatCard
          icon={FileText}
          label="Submissions (month)"
          value={data.submissionsThisMonth ?? 0}
          subValue="This calendar month"
          color="#34d399"
        />
        <StatCard
          icon={ShieldCheck}
          label="ISK Pending Verification"
          value={data.iskPendingCount ?? 0}
          trend={data.iskPendingCount > 0 ? 'up' : 'neutral'}
          color="#fbbf24"
        />
        {/* Subscription Donut Chart */}
        <div className="card p-4">
          <p className="text-xs text-[var(--text-secondary)] mb-2">Subscriptions</p>
          <SubscriptionDonutChart
            data={[
              { name: 'free', value: data.activeSubscriptions?.free ?? 0 },
              { name: 'pro', value: data.activeSubscriptions?.pro ?? 0 },
              { name: 'enterprise', value: data.activeSubscriptions?.enterprise ?? 0 },
            ]}
          />
        </div>
      </div>

      {/* Revenue + ISK Verification Queue */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Revenue Overview */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Revenue Overview
              </h2>
            </div>
            <span className="text-xs text-[var(--text-muted)]">Completed payments</span>
          </div>
          <div className="p-5">
            <p className="text-3xl font-bold text-[var(--text-primary)] mb-4">
              {formatCurrency(data.revenue.total)}
            </p>
            {data.revenue.byMonth.length > 0 ? (
              <RevenueLineChart data={data.revenue.byMonth} />
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No revenue data yet</p>
            )}
          </div>
        </div>

        {/* ISK Verification Queue */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                ISK Verification Queue
              </h2>
            </div>
            <Link href="/admin/users?role=surveyor" className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-0">
            {(data.iskQueue ?? []).length > 0 ? (
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full min-w-[480px]">
                  <thead>
                    <tr className="table-header">
                      <th className="px-4 py-2 text-left">Surveyor</th>
                      <th className="px-4 py-2 text-left">ISK No.</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.iskQueue.map((user) => (
                      <tr key={user.id} className="table-row">
                        <td className="table-cell">
                          <div>
                            <p className="text-[var(--text-primary)] font-medium text-sm truncate max-w-[160px]">
                              {user.name}
                            </p>
                            <p className="text-xs text-[var(--text-muted)] truncate max-w-[160px]">
                              {user.email}
                            </p>
                          </div>
                        </td>
                        <td className="table-cell text-sm font-mono">
                          {user.iskNumber}
                        </td>
                        <td className="table-cell text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleIskAction(user.id, true)}
                              disabled={iskProcessing.has(user.id)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                              title="Approve ISK"
                            >
                              {iskProcessing.has(user.id) ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => handleIskAction(user.id, false)}
                              disabled={iskProcessing.has(user.id)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                              title="Reject ISK"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5 text-center text-sm text-[var(--text-muted)]">
                No pending ISK verifications
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Signups + Broadcast */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Signups */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-400" />
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Recent Signups
              </h2>
            </div>
            <Link
              href="/admin/users"
              className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-0">
            {data.recentSignups.length > 0 ? (
              <div className="max-h-72 overflow-x-auto overflow-y-auto">
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr className="table-header">
                      <th className="px-4 py-2 text-left">User</th>
                      <th className="px-4 py-2 text-left">Role</th>
                      <th className="px-4 py-2 text-left">Plan</th>
                      <th className="px-4 py-2 text-right">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentSignups.map((user) => (
                      <tr key={user.id} className="table-row">
                        <td className="table-cell">
                          <div>
                            <p className="text-[var(--text-primary)] font-medium text-sm truncate max-w-[160px]">
                              {user.name}
                            </p>
                            <p className="text-xs text-[var(--text-muted)] truncate max-w-[160px]">
                              {user.email}
                            </p>
                          </div>
                        </td>
                        <td className="table-cell">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${roleBadgeClass(user.role)}`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="table-cell text-sm capitalize">
                          {user.plan}
                        </td>
                        <td className="table-cell text-sm text-right text-[var(--text-muted)]">
                          {formatDate(user.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5 text-center text-sm text-[var(--text-muted)]">
                No users yet
              </div>
            )}
          </div>
        </div>

        {/* Broadcast Announcement */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-blue-400" />
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Broadcast Announcement
              </h2>
            </div>
          </div>
          <div className="p-5 space-y-3">
            <input
              type="text"
              aria-label="Announcement title" placeholder="Announcement title..."
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 outline-none transition-all"
              value={announcementTitle}
              onChange={e => setAnnouncementTitle(e.target.value)}
            />
            <textarea
              placeholder="Message body..."
              rows={3}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm resize-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 outline-none transition-all"
              value={announcementBody}
              onChange={e => setAnnouncementBody(e.target.value)}
            />
            <div className="flex gap-2">
              <select
                className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm focus:border-[var(--accent)] outline-none transition-all"
                value={announcementTarget}
                onChange={e => setAnnouncementTarget(e.target.value)}
              >
                <option value="all">All Users</option>
                <option value="pro">Pro Users Only</option>
                <option value="free">Free Users Only</option>
                <option value="enterprise">Enterprise Only</option>
              </select>
              <button
                onClick={handleBroadcast}
                className="btn btn-primary flex items-center gap-2"
                disabled={!announcementTitle || !announcementBody || broadcastSending}
              >
                {broadcastSending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Send
              </button>
            </div>
            {broadcastResult && (
              <p className={`text-xs ${broadcastResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                {broadcastResult.msg}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* System Health + Quick Actions + Subscription Override */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* System Health — Enhanced with charts */}
        <SystemHealthPanel />

        {/* Quick Actions */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Quick Actions
            </h2>
          </div>
          <div className="p-5 grid grid-cols-2 gap-3">
            <Link
              href="/admin/users"
              className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-color)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5 transition-all group"
            >
              <Users className="w-5 h-5 text-[var(--accent)]" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)]">
                  User Management
                </p>
                <p className="text-xs text-[var(--text-muted)]">Manage users & roles</p>
              </div>
            </Link>

            <Link
              href="/audit-logs"
              className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-color)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5 transition-all group"
            >
              <ShieldCheck className="w-5 h-5 text-[var(--accent)]" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)]">
                  Audit Logs
                </p>
                <p className="text-xs text-[var(--text-muted)]">View security logs</p>
              </div>
            </Link>

            <Link
              href="/admin/payments"
              className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-color)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5 transition-all group"
            >
              <CreditCard className="w-5 h-5 text-[var(--accent)]" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)]">
                  Payments
                </p>
                <p className="text-xs text-[var(--text-muted)]">Revenue & billing</p>
              </div>
            </Link>

            <Link
              href="/admin"
              className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-color)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5 transition-all group"
            >
              <Settings2 className="w-5 h-5 text-[var(--accent)]" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)]">
                  System Health
                </p>
                <p className="text-xs text-[var(--text-muted)]">View diagnostics</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Subscription Override (admin/super_admin) */}
        {canOverridePlans && (
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-purple-400" />
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  Subscription Override
                </h2>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <input
                type="email"
                aria-label="User email" placeholder="User email..."
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 outline-none transition-all"
                value={overrideEmail}
                onChange={e => setOverrideEmail(e.target.value)}
              />
              <div className="flex gap-2">
                <select
                  className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm focus:border-[var(--accent)] outline-none transition-all"
                  value={overridePlan}
                  onChange={e => setOverridePlan(e.target.value)}
                >
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
                <input
                  type="number"
                  aria-label="Override duration (days)" placeholder="Days"
                  className="w-24 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm focus:border-[var(--accent)] outline-none transition-all"
                  value={overrideDays}
                  onChange={e => setOverrideDays(e.target.value)}
                />
                <button
                  onClick={handleOverride}
                  className="btn btn-primary flex items-center gap-2"
                  disabled={!overrideEmail || overrideSending}
                >
                  {overrideSending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Apply
                </button>
              </div>
              {overrideResult && (
                <p className={`text-xs ${overrideResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                  {overrideResult.msg}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Performance Dashboard — Web Vitals & Optimization */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Performance Monitoring
            </h2>
          </div>
        </div>
        <div className="[&_*]:text-[var(--text-primary)] [&_.bg-gray-900]:bg-[var(--bg-primary)] [&_.bg-gray-800]:bg-[var(--bg-secondary)] [&_.bg-gray-700]:bg-[var(--bg-tertiary)] [&_.text-white]:text-[var(--text-primary)] [&_.text-gray-400]:text-[var(--text-muted)] [&_.text-gray-300]:text-[var(--text-secondary)] [&_.text-gray-500]:text-[var(--text-muted)] [&_.border-gray-700]:border-[var(--border-color)] [&_.border-b_border-gray-700]:border-[var(--border-color)]">
          <PerformanceDashboard />
        </div>
      </div>
    </div>
  )
}
