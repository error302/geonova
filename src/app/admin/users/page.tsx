'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Users, Search, Filter, Loader2, AlertCircle,
  ChevronLeft, ChevronRight, ShieldCheck, Ban,
  CheckCircle2, X, Crown, Rocket, Building2, User as UserIcon,
  CalendarDays, Clock,
} from 'lucide-react'
import { z } from 'zod'
import { apiGet, apiPost, apiPut, apiDelete, apiPatch, ApiError } from '@/lib/api/client'
import { MobileUserCard } from '@/components/admin/MobileCards'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const usersResponseSchema = z.object({
  users: z.array(z.object({
    id: z.string(),
    email: z.string(),
    fullName: z.string(),
    role: z.string(),
    verifiedIsk: z.boolean(),
    isSuspended: z.boolean(),
    suspensionReason: z.string().nullable(),
    plan: z.string(),
    subscriptionStatus: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }).passthrough()),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
    hasMore: z.boolean(),
  }).passthrough(),
}).passthrough()

const roleMutationSchema = z.object({}).passthrough()
const suspendMutationSchema = z.object({}).passthrough()
const overridePlanResponseSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
}).passthrough()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserRecord {
  id: string
  email: string
  fullName: string
  role: string
  verifiedIsk: boolean
  isSuspended: boolean
  suspensionReason: string | null
  plan: string
  subscriptionStatus: string | null
  createdAt: string
  updatedAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore: boolean
}


type PlanTier = 'free' | 'pro' | 'enterprise'
type DurationOption = '7' | '30' | '90' | '365' | 'custom' | 'forever'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function planBadgeClass(plan: string): string {
  switch (plan.toLowerCase()) {
    case 'pro':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30'
    case 'enterprise':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    case 'free':
    default:
      return 'bg-gray-500/15 text-gray-400 border-gray-500/30'
  }
}

function planIcon(plan: string) {
  switch (plan.toLowerCase()) {
    case 'pro':
      return <Rocket className="w-3 h-3" />
    case 'enterprise':
      return <Building2 className="w-3 h-3" />
    default:
      return <UserIcon className="w-3 h-3" />
  }
}

const AVAILABLE_ROLES = ['super_admin', 'org_admin', 'project_manager', 'surveyor', 'viewer']

const DURATION_OPTIONS: { value: DurationOption; label: string }[] = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
  { value: 'custom', label: 'Custom' },
  { value: 'forever', label: 'Forever' },
]

function durationToDays(option: DurationOption, customDays: number): number | null {
  if (option === 'forever') return 3650 // ~10 years for "forever"
  if (option === 'custom') return customDays
  return Number(option)
}

// ---------------------------------------------------------------------------
// Role Assignment Modal
// ---------------------------------------------------------------------------

function RoleAssignModal({
  user,
  currentCallerRole,
  onClose,
  onAssigned,
}: {
  user: UserRecord
  currentCallerRole: string
  onClose: () => void
  onAssigned: () => void
}) {
  const [selectedRole, setSelectedRole] = useState(user.role)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isSuperAdmin = currentCallerRole === 'super_admin'

  const canAssign = (_role: string): boolean => {
    if (!isSuperAdmin) return false
    return true
  }

  const handleSubmit = async () => {
    if (selectedRole === user.role) {
      onClose()
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await apiPut(
        `/api/admin/users/${user.id}/role`,
        roleMutationSchema,
        { role: selectedRole },
      )
      onAssigned()
      onClose()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : 'Failed to assign role')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md">
        <div className="card-header">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            Assign Role
          </h3>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-sm text-[var(--text-secondary)]">
              User: <span className="text-[var(--text-primary)] font-medium">{user.fullName}</span>
            </p>
            <p className="text-xs text-[var(--text-muted)]">{user.email}</p>
          </div>

          {!isSuperAdmin && (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400">
              Only super_admin can assign roles.
            </div>
          )}

          <div>
            <label htmlFor="user-role" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Role
            </label>
            <select
              id="user-role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              disabled={!isSuperAdmin || submitting}
              className="input w-full"
            >
              {AVAILABLE_ROLES.map((role) => (
                <option key={role} value={role} disabled={!canAssign(role)}>
                  {role}
                  {!canAssign(role) ? ' (insufficient privilege)' : ''}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button onClick={onClose} className="btn btn-secondary text-sm">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !isSuperAdmin || selectedRole === user.role}
              className="btn btn-primary text-sm"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Assign'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Suspend/Unsuspend Modal
// ---------------------------------------------------------------------------

function SuspendModal({
  user,
  onClose,
  onAction,
}: {
  user: UserRecord
  onClose: () => void
  onAction: () => void
}) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isSuspend = !user.isSuspended

  const handleSubmit = async () => {
    if (isSuspend && !reason.trim()) {
      setError('Suspension reason is required')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      if (isSuspend) {
        await apiPost(
          `/api/admin/users/${user.id}/suspend`,
          suspendMutationSchema,
          { reason },
        )
      } else {
        await apiDelete(`/api/admin/users/${user.id}/suspend`)
      }
      onAction()
      onClose()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : 'Action failed')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md">
        <div className="card-header">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            {isSuspend ? 'Suspend User' : 'Unsuspend User'}
          </h3>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-sm text-[var(--text-secondary)]">
              User: <span className="text-[var(--text-primary)] font-medium">{user.fullName}</span>
            </p>
            <p className="text-xs text-[var(--text-muted)]">{user.email}</p>
          </div>

          {isSuspend && (
            <div>
              <label htmlFor="suspend-reason" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Reason for suspension
              </label>
              <textarea
                id="suspend-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason..."
                className="input w-full min-h-[80px] resize-none"
                rows={3}
              />
            </div>
          )}

          {!isSuspend && (
            <p className="text-sm text-[var(--text-secondary)]">
              This will restore the user&apos;s access to the platform.
            </p>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button onClick={onClose} className="btn btn-secondary text-sm">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className={`btn text-sm ${
                isSuspend
                  ? 'bg-red-500/90 hover:bg-red-600 text-white'
                  : 'btn-primary'
              }`}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isSuspend ? (
                'Suspend'
              ) : (
                'Unsuspend'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Plan Override Modal
// ---------------------------------------------------------------------------

function PlanOverrideModal({
  user,
  onClose,
  onApplied,
}: {
  user: UserRecord | null
  onClose: () => void
  onApplied: () => void
}) {
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>('pro')
  const [durationOption, setDurationOption] = useState<DurationOption>('30')
  const [customDays, setCustomDays] = useState<number>(30)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Pre-fill selected plan to the user's current plan
  useEffect(() => {
    if (user) {
      const p = user.plan.toLowerCase()
      if (p === 'free' || p === 'pro' || p === 'enterprise') {
        setSelectedPlan(p as PlanTier)
      }
    }
  }, [user])

  const resolvedDays = durationToDays(durationOption, customDays)

  const handleApply = async () => {
    if (!user) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      await apiPatch(
        '/api/admin/users/override-plan',
        overridePlanResponseSchema,
        {
          email: user.email,
          plan: selectedPlan,
          days: resolvedDays,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        },
      )
      const durationLabel = durationOption === 'forever'
        ? 'forever'
        : `for ${resolvedDays} day${resolvedDays !== 1 ? 's' : ''}`
      setSuccess(`Plan updated to ${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} ${durationLabel}`)
      setConfirmOpen(false)
      onApplied()
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Failed to update plan'
      setError(msg)
      setConfirmOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Promote Plan
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* User info */}
          {user && (
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]/40 p-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
                  {planIcon(user.plan)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {user.fullName}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{user.email}</p>
                </div>
                <span
                  className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border capitalize ${planBadgeClass(user.plan)}`}
                >
                  {planIcon(user.plan)}
                  {user.plan}
                </span>
              </div>
            </div>
          )}

          {/* Target plan selection */}
          <div>
            <div className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              <ShieldCheck className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              Target Plan
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(['free', 'pro', 'enterprise'] as PlanTier[]).map((plan) => (
                <button
                  key={plan}
                  type="button"
                  onClick={() => setSelectedPlan(plan)}
                  className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors text-left ${
                    selectedPlan === plan
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                      : 'border-[var(--border-color)] bg-[var(--bg-tertiary)]/30 hover:border-[var(--accent)]/40'
                  }`}
                >
                  <span className={`shrink-0 ${planBadgeClass(plan).split(' ').find(c => c.startsWith('text-')) ?? ''}`}>
                    {planIcon(plan)}
                  </span>
                  <span className="text-sm font-medium text-[var(--text-primary)] capitalize">
                    {plan}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Duration selection */}
          <div>
            <div className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              <Clock className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              Duration
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDurationOption(opt.value)}
                  className={`flex items-center gap-1.5 rounded-lg border p-2.5 cursor-pointer transition-colors text-left text-sm ${
                    durationOption === opt.value
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-primary)]'
                      : 'border-[var(--border-color)] bg-[var(--bg-tertiary)]/30 text-[var(--text-secondary)] hover:border-[var(--accent)]/40'
                  }`}
                >
                  {opt.value === 'forever' && <CalendarDays className="w-3.5 h-3.5 shrink-0" />}
                  {opt.value !== 'forever' && opt.value !== 'custom' && <Clock className="w-3.5 h-3.5 shrink-0" />}
                  {opt.value === 'custom' && <Clock className="w-3.5 h-3.5 shrink-0" />}
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>

            {/* Custom days input */}
            {durationOption === 'custom' && (
              <div className="mt-3">
                <label htmlFor="override-days" className="block text-xs text-[var(--text-muted)] mb-1.5">
                  Number of days
                </label>
                <input id="override-days"
                  type="number"
                  min={1}
                  max={3650}
                  value={customDays}
                  onChange={(e) => setCustomDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className="input w-32"
                />
              </div>
            )}
          </div>

          {/* Reason */}
          <div>
            <label htmlFor="override-reason" className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              Reason (optional)
            </label>
            <textarea
              id="override-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for plan override..."
              className="input w-full min-h-[60px] resize-none"
              rows={2}
            />
          </div>

          {/* Success message */}
          {success && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {success}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button onClick={onClose} className="btn btn-secondary text-sm">
              Cancel
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={submitting || !user || (durationOption === 'custom' && customDays < 1)}
              className="btn btn-primary text-sm flex items-center gap-2"
            >
              <Crown className="w-4 h-4" />
              Apply Override
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="card w-full max-w-sm">
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/15 text-amber-400">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                    Confirm Plan Override
                  </h4>
                  <p className="text-xs text-[var(--text-muted)]">
                    This will change the user&apos;s subscription plan.
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-[var(--bg-tertiary)]/60 border border-[var(--border-color)] p-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">User</span>
                  <span className="text-[var(--text-primary)] font-medium">{user?.email}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">New Plan</span>
                  <span className={`inline-flex items-center gap-1 capitalize font-medium ${planBadgeClass(selectedPlan).split(' ').find(c => c.startsWith('text-')) ?? ''}`}>
                    {planIcon(selectedPlan)}
                    {selectedPlan}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Duration</span>
                  <span className="text-[var(--text-primary)] font-medium">
                    {durationOption === 'forever'
                      ? 'Forever'
                      : `${resolvedDays} day${resolvedDays !== 1 ? 's' : ''}`}
                  </span>
                </div>
                {reason.trim() && (
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--text-muted)]">Reason</span>
                    <span className="text-[var(--text-primary)] font-medium max-w-[180px] truncate">{reason.trim()}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmOpen(false)}
                  disabled={submitting}
                  className="btn btn-secondary text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  disabled={submitting}
                  className="btn text-sm bg-amber-500/90 hover:bg-amber-600 text-black flex items-center gap-2"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Crown className="w-4 h-4" />
                  )}
                  Confirm Override
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AdminUsersPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [users, setUsers] = useState<UserRecord[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
    hasMore: false,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [activeModal, setActiveModal] = useState<
    | { type: 'role'; user: UserRecord }
    | { type: 'suspend'; user: UserRecord }
    | { type: 'plan'; user: UserRecord | null }
    | null
  >(null)

  const currentRole = (session?.user as { role?: string })?.role ?? ''

  const fetchUsers = useCallback(
    async (page = 1) => {
      try {
        setLoading(true)
        setError(null)
        const params = new URLSearchParams({
          page: String(page),
          limit: '25',
        })
        if (search) params.set('search', search)
        if (roleFilter) params.set('role', roleFilter)
        if (statusFilter) params.set('status', statusFilter)

        const data = await apiGet(
          `/api/admin/users?${params}`,
          usersResponseSchema,
          { ttlMs: 0 },
        )
        setUsers(data.users as unknown as UserRecord[])
        setPagination(data.pagination as unknown as Pagination)
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
          setError(err instanceof Error ? err.message : 'Failed to load users')
        }
      } finally {
        setLoading(false)
      }
    },
    [search, roleFilter, statusFilter, router],
  )

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (sessionStatus === 'authenticated') {
      fetchUsers(1)
    }
  }, [sessionStatus, fetchUsers, router])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (sessionStatus === 'authenticated') {
        fetchUsers(1)
      }
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter, statusFilter])

  const handlePageChange = (newPage: number) => {
    fetchUsers(newPage)
  }

  // Auth loading
  if (sessionStatus === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">User Management</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Manage platform users, roles, and access
          </p>
        </div>
        {(currentRole === 'admin' || currentRole === 'super_admin') && (
          <button
            onClick={() => setActiveModal({ type: 'plan', user: null })}
            className="btn btn-primary text-sm flex items-center gap-2 shrink-0 self-start sm:self-auto"
          >
            <Crown className="w-4 h-4" />
            Promote Plan
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              aria-label="Search users" placeholder="Search by email or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9"
            />
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="input pl-9 pr-8 min-w-[140px]"
              >
                <option value="">All Roles</option>
                {AVAILABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input min-w-[130px]"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="card p-4 border-red-500/30 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => fetchUsers(pagination.page)}
            className="ml-auto text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            Retry
          </button>
        </div>
      )}

      {/* Users — Card layout on mobile, table on lg+ */}
      {/* Mobile: card list */}
      <div className="lg:hidden space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-[var(--accent)] animate-spin" />
            <p className="text-sm text-[var(--text-muted)] ml-2">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-2" />
            <p className="text-sm text-[var(--text-muted)]">No users found</p>
          </div>
        ) : (
          users.map((user) => (
            <MobileUserCard
              key={user.id}
              user={user}
              onRoleClick={() => setActiveModal({ type: 'role', user })}
              onSuspendClick={() => setActiveModal({ type: 'suspend', user })}
              onPlanClick={() => setActiveModal({ type: 'plan', user })}
            />
          ))
        )}
      </div>

      {/* Desktop: table */}
      <div className="card overflow-hidden hidden lg:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Loader2 className="w-6 h-6 text-[var(--accent)] animate-spin mx-auto" />
                    <p className="text-sm text-[var(--text-muted)] mt-2">Loading users...</p>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Users className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-2" />
                    <p className="text-sm text-[var(--text-muted)]">No users found</p>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="table-row">
                    <td className="table-cell">
                      <div>
                        <p className="text-[var(--text-primary)] font-medium text-sm">
                          {user.fullName}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">{user.email}</p>
                        {user.verifiedIsk && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-400 mt-0.5">
                            <ShieldCheck className="w-3 h-3" /> ISK Verified
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="table-cell">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${roleBadgeClass(user.role)}`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border capitalize ${planBadgeClass(user.plan)}`}
                      >
                        {planIcon(user.plan)}
                        {user.plan}
                      </span>
                    </td>
                    <td className="table-cell">
                      {user.isSuspended ? (
                        <span className="inline-flex items-center gap-1 text-xs text-red-400">
                          <Ban className="w-3 h-3" /> Suspended
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-green-400">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      )}
                    </td>
                    <td className="table-cell text-sm text-[var(--text-muted)]">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(currentRole === 'admin' || currentRole === 'super_admin') && (
                          <button
                            onClick={() =>
                              setActiveModal({ type: 'plan', user })
                            }
                            className="text-xs text-amber-400 hover:underline flex items-center gap-1"
                            title="Override plan"
                          >
                            <Crown className="w-3 h-3" />
                            Plan
                          </button>
                        )}
                        {(currentRole === 'admin' || currentRole === 'super_admin') && (
                          <button
                            onClick={() =>
                              setActiveModal({ type: 'role', user })
                            }
                            className="text-xs text-[var(--accent)] hover:underline"
                            title="Change role"
                          >
                            Role
                          </button>
                        )}
                        <button
                          onClick={() =>
                            setActiveModal({ type: 'suspend', user })
                          }
                          className={`text-xs ${
                            user.isSuspended
                              ? 'text-green-400 hover:underline'
                              : 'text-red-400 hover:underline'
                          }`}
                          title={user.isSuspended ? 'Unsuspend' : 'Suspend'}
                        >
                          {user.isSuspended ? 'Unsuspend' : 'Suspend'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-color)]">
            <p className="text-xs text-[var(--text-muted)]">
              Showing {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total} users
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="btn btn-secondary text-xs px-4 py-2.5 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <span className="text-xs text-[var(--text-muted)]">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={!pagination.hasMore}
                className="btn btn-secondary text-xs px-4 py-2.5 disabled:opacity-40"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile pagination */}
      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between lg:hidden px-2">
          <p className="text-xs text-[var(--text-muted)]">
            {pagination.page} / {pagination.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="btn btn-secondary text-xs px-3 py-2 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={!pagination.hasMore}
              className="btn btn-secondary text-xs px-3 py-2 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {activeModal?.type === 'role' && (
        <RoleAssignModal
          user={activeModal.user}
          currentCallerRole={currentRole}
          onClose={() => setActiveModal(null)}
          onAssigned={() => fetchUsers(pagination.page)}
        />
      )}
      {activeModal?.type === 'suspend' && (
        <SuspendModal
          user={activeModal.user}
          onClose={() => setActiveModal(null)}
          onAction={() => fetchUsers(pagination.page)}
        />
      )}
      {activeModal?.type === 'plan' && (
        <PlanOverrideModal
          user={activeModal.user}
          onClose={() => setActiveModal(null)}
          onApplied={() => fetchUsers(pagination.page)}
        />
      )}
    </div>
  )
}
