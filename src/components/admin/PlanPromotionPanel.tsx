'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search,
  User,
  Crown,
  Rocket,
  Building2,
  Clock,
  CalendarDays,
  Infinity,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  History,
  X,
} from 'lucide-react'
import { apiPatch, ApiError } from '@/lib/api/client'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PlanTier = 'free' | 'pro' | 'enterprise'

type DurationOption = '7' | '30' | '90' | '365' | 'custom' | 'forever'

interface UserInfo {
  id: string
  email: string
  name: string
  plan: PlanTier
  subscriptionStatus: 'active' | 'past_due' | 'canceled' | 'trialing' | 'none'
  createdAt: string
}

interface PromotionRecord {
  id: string
  email: string
  userName: string
  plan: PlanTier
  days: number | null
  reason: string | null
  appliedBy: string
  appliedAt: string
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const overridePlanResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLAN_LABELS: Record<PlanTier, string> = {
  free: 'Free',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

const PLAN_ICONS: Record<PlanTier, React.ReactNode> = {
  free: <User className="w-4 h-4" />,
  pro: <Rocket className="w-4 h-4" />,
  enterprise: <Building2 className="w-4 h-4" />,
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/15 text-green-400',
  trialing: 'bg-blue-500/15 text-blue-400',
  past_due: 'bg-yellow-500/15 text-yellow-400',
  canceled: 'bg-red-500/15 text-red-400',
  none: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]',
}

function formatAccountAge(isoDate: string): string {
  const created = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - created.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (days < 1) return 'Today'
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''}`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''}`
  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  return remainingMonths > 0
    ? `${years}y ${remainingMonths}m`
    : `${years} year${years !== 1 ? 's' : ''}`
}

function formatDurationLabel(key: DurationOption): string {
  switch (key) {
    case '7': return '7 days'
    case '30': return '30 days'
    case '90': return '90 days'
    case '365': return '1 year'
    case 'custom': return 'Custom'
    case 'forever': return 'Forever'
  }
}

function durationToDays(option: DurationOption, customDays: number): number | null {
  if (option === 'forever') return null
  if (option === 'custom') return customDays
  return Number(option)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PlanPromotionPanel() {
  // --- User lookup ---
  const [searchEmail, setSearchEmail] = useState('')
  const [user, setUser] = useState<UserInfo | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // --- Plan override form ---
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>('pro')
  const [durationOption, setDurationOption] = useState<DurationOption>('30')
  const [customDays, setCustomDays] = useState<number>(1)
  const [reason, setReason] = useState('')

  // --- Confirmation dialog ---
  const [confirmOpen, setConfirmOpen] = useState(false)

  // --- Submission state ---
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // --- Recent promotions ---
  const [recentPromotions, setRecentPromotions] = useState<PromotionRecord[]>([])

  // ---------------------------------------------------------------------------
  // Debounced user lookup
  // ---------------------------------------------------------------------------
  const lookupUser = useCallback(async (email: string) => {
    if (!email || !email.includes('@')) {
      setUser(null)
      setLookupError(null)
      return
    }
    try {
      setLookupLoading(true)
      setLookupError(null)
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(email)}`)
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? 'User not found')
      }
      const data = await res.json()
      const users: UserInfo[] = data.users ?? data.data ?? (Array.isArray(data) ? data : [])
      if (users.length === 0) {
        setUser(null)
        setLookupError('No user found with that email')
        return
      }
      setUser(users[0])
      setLookupError(null)
    } catch (err) {
      setUser(null)
      setLookupError(err instanceof Error ? err.message : 'Lookup failed')
    } finally {
      setLookupLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      lookupUser(searchEmail.trim())
    }, 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchEmail, lookupUser])

  // ---------------------------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------------------------
  const handleSubmit = () => {
    setFeedback(null)
    setConfirmOpen(true)
  }

  const confirmAndApply = async () => {
    if (!user) return
    const days = durationToDays(durationOption, customDays)
    setSubmitting(true)
    setFeedback(null)
    try {
      await apiPatch(
        '/api/admin/users/override-plan',
        overridePlanResponseSchema,
        {
          email: user.email,
          plan: selectedPlan,
          days,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        },
      )
      // Add to recent promotions list (prepend)
      const record: PromotionRecord = {
        id: crypto.randomUUID(),
        email: user.email,
        userName: user.name,
        plan: selectedPlan,
        days,
        reason: reason.trim() || null,
        appliedBy: 'You',
        appliedAt: new Date().toISOString(),
      }
      setRecentPromotions((prev) => [record, ...prev].slice(0, 5))
      // Update displayed user plan
      setUser((prev) => (prev ? { ...prev, plan: selectedPlan } : prev))
      setFeedback({ type: 'success', message: `Plan updated to ${PLAN_LABELS[selectedPlan]}${days !== null ? ` for ${days} day${days !== 1 ? 's' : ''}` : ' forever'}` })
      setReason('')
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Failed to update plan'
      setFeedback({ type: 'error', message: msg })
    } finally {
      setSubmitting(false)
      setConfirmOpen(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  const canSubmit =
    user !== null &&
    !submitting &&
    (durationOption !== 'custom' || customDays >= 1)

  const resolvedDays = durationToDays(durationOption, customDays)

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="card">
      {/* Header */}
      <div className="card-header">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-[var(--accent)]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Plan Promotion
          </h2>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* ── User Lookup ──────────────────────────────────────────────── */}
        <section>
          <div className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
            <Search className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
            User Lookup
          </div>
          <div className="relative">
            <Input
              type="email"
              placeholder="Search by email…"
              value={searchEmail}
              onChange={(e) => {
                setSearchEmail(e.target.value)
                setFeedback(null)
              }}
              className="pr-9"
            />
            {lookupLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--accent)] animate-spin" />
            )}
            {!lookupLoading && searchEmail && (
              <button
                onClick={() => {
                  setSearchEmail('')
                  setUser(null)
                  setLookupError(null)
                  setFeedback(null)
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {lookupError && (
            <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {lookupError}
            </p>
          )}
        </section>

        {/* ── User Info Card ───────────────────────────────────────────── */}
        {user && (
          <section className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]/40 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
                {PLAN_ICONS[user.plan]}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {user.name || user.email}
                </p>
                <p className="text-xs text-[var(--text-muted)] truncate">{user.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* Current Plan */}
              <div className="rounded-md bg-[var(--bg-tertiary)] p-2.5 text-center">
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">
                  Current Plan
                </p>
                <p className="text-sm font-semibold text-[var(--text-primary)] capitalize flex items-center justify-center gap-1">
                  {PLAN_ICONS[user.plan]}
                  {PLAN_LABELS[user.plan]}
                </p>
              </div>

              {/* Subscription Status */}
              <div className="rounded-md bg-[var(--bg-tertiary)] p-2.5 text-center">
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">
                  Status
                </p>
                <span
                  className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                    STATUS_COLORS[user.subscriptionStatus] ?? STATUS_COLORS.none
                  }`}
                >
                  {user.subscriptionStatus.replace('_', ' ')}
                </span>
              </div>

              {/* Account Age */}
              <div className="rounded-md bg-[var(--bg-tertiary)] p-2.5 text-center">
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">
                  Account Age
                </p>
                <p className="text-sm font-semibold text-[var(--text-primary)] flex items-center justify-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  {formatAccountAge(user.createdAt)}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ── Plan Selection ───────────────────────────────────────────── */}
        {user && (
          <section>
            <div className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              <ShieldCheck className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              New Plan
            </div>
            <RadioGroup
              value={selectedPlan}
              onValueChange={(v) => setSelectedPlan(v as PlanTier)}
              className="grid grid-cols-3 gap-3"
            >
              {(['free', 'pro', 'enterprise'] as PlanTier[]).map((plan) => (
                <label
                  key={plan}
                  aria-label={PLAN_LABELS[plan]}
                  className={`flex items-center gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors ${
                    selectedPlan === plan
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                      : 'border-[var(--border-color)] bg-[var(--bg-tertiary)]/30 hover:border-[var(--accent)]/40'
                  }`}
                >
                  <RadioGroupItem value={plan} id={`plan-${plan}`} />
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[var(--text-primary)] ${selectedPlan === plan ? 'text-[var(--accent)]' : ''}`}>
                      {PLAN_ICONS[plan]}
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        selectedPlan === plan ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
                      }`}
                    >
                      {PLAN_LABELS[plan]}
                    </span>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </section>
        )}

        {/* ── Duration ─────────────────────────────────────────────────── */}
        {user && (
          <section>
            <div className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              <Clock className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              Duration
            </div>
            <RadioGroup
              value={durationOption}
              onValueChange={(v) => setDurationOption(v as DurationOption)}
              className="grid grid-cols-3 sm:grid-cols-6 gap-2"
            >
              {(['7', '30', '90', '365', 'custom', 'forever'] as DurationOption[]).map((opt) => (
                <label
                  key={opt}
                  className={`flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                    durationOption === opt
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                      : 'border-[var(--border-color)] bg-[var(--bg-tertiary)]/30 hover:border-[var(--accent)]/40'
                  }`}
                >
                  <RadioGroupItem value={opt} id={`dur-${opt}`} />
                  <span
                    className={`text-xs font-medium flex items-center gap-1 ${
                      durationOption === opt ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {opt === 'forever' && <Infinity className="w-3.5 h-3.5" />}
                    {formatDurationLabel(opt)}
                  </span>
                </label>
              ))}
            </RadioGroup>

            {/* Custom days input */}
            {durationOption === 'custom' && (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={3650}
                  value={customDays}
                  onChange={(e) => setCustomDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-28"
                  placeholder="Days"
                />
                <span className="text-xs text-[var(--text-muted)]">days</span>
              </div>
            )}
          </section>
        )}

        {/* ── Reason / Note ────────────────────────────────────────────── */}
        {user && (
          <section>
            <div className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              <FileText className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              Reason / Note
              <span className="normal-case font-normal text-[var(--text-muted)] ml-1">(audit trail)</span>
            </div>
            <Textarea
              placeholder="e.g. Promotional upgrade for partner onboarding…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="text-sm"
            />
          </section>
        )}

        {/* ── Feedback ─────────────────────────────────────────────────── */}
        {feedback && (
          <div
            className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
              feedback.type === 'success'
                ? 'border-green-500/30 bg-green-500/10 text-green-400'
                : 'border-red-500/30 bg-red-500/10 text-red-400'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <p>{feedback.message}</p>
            <button
              onClick={() => setFeedback(null)}
              className="ml-auto shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── Submit ───────────────────────────────────────────────────── */}
        {user && (
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] text-black font-medium text-sm py-2.5 transition-colors hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            {submitting ? 'Applying…' : 'Apply Plan Override'}
          </button>
        )}

        {/* ── Recent Promotions ────────────────────────────────────────── */}
        {recentPromotions.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />
              Recent Promotions
            </h3>
            <div className="overflow-x-auto rounded-lg border border-[var(--border-color)]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/40">
                    <th className="text-left py-2 px-3 font-semibold text-[var(--text-muted)]">User</th>
                    <th className="text-left py-2 px-3 font-semibold text-[var(--text-muted)]">Plan</th>
                    <th className="text-left py-2 px-3 font-semibold text-[var(--text-muted)]">Duration</th>
                    <th className="text-left py-2 px-3 font-semibold text-[var(--text-muted)]">Reason</th>
                    <th className="text-left py-2 px-3 font-semibold text-[var(--text-muted)]">Applied</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPromotions.map((rec) => (
                    <tr
                      key={rec.id}
                      className="border-b border-[var(--border-color)] last:border-b-0 hover:bg-[var(--bg-tertiary)]/20 transition-colors"
                    >
                      <td className="py-2 px-3">
                        <div className="font-medium text-[var(--text-primary)] truncate max-w-[140px]">
                          {rec.userName || rec.email}
                        </div>
                        <div className="text-[var(--text-muted)] truncate max-w-[140px]">{rec.email}</div>
                      </td>
                      <td className="py-2 px-3 capitalize">
                        <span className="inline-flex items-center gap-1 font-medium text-[var(--text-primary)]">
                          {PLAN_ICONS[rec.plan]}
                          {PLAN_LABELS[rec.plan]}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-[var(--text-secondary)]">
                        {rec.days === null ? (
                          <span className="inline-flex items-center gap-1">
                            <Infinity className="w-3 h-3" />
                            Forever
                          </span>
                        ) : (
                          `${rec.days}d`
                        )}
                      </td>
                      <td className="py-2 px-3 text-[var(--text-muted)] max-w-[160px] truncate">
                        {rec.reason ?? '—'}
                      </td>
                      <td className="py-2 px-3 text-[var(--text-muted)] whitespace-nowrap">
                        {new Date(rec.appliedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* ── Confirmation Dialog ────────────────────────────────────────── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[var(--accent)]" />
              Confirm Plan Override
            </DialogTitle>
            <DialogDescription>
              This action will change the user&apos;s subscription plan. It will be recorded in the audit trail.
            </DialogDescription>
          </DialogHeader>

          {user && (
            <div className="space-y-3 py-2">
              {/* User summary */}
              <div className="rounded-lg bg-[var(--bg-tertiary)]/50 p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">User</span>
                  <span className="font-medium text-[var(--text-primary)]">{user.name || user.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-muted)]">Current Plan</span>
                  <span className="font-medium text-[var(--text-primary)] capitalize flex items-center gap-1">
                    {PLAN_ICONS[user.plan]}
                    {PLAN_LABELS[user.plan]}
                  </span>
                </div>
                <div className="flex items-center justify-center py-1">
                  <ArrowRight className="w-4 h-4 text-[var(--accent)]" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-muted)]">New Plan</span>
                  <span className="font-semibold text-[var(--accent)] capitalize flex items-center gap-1">
                    {PLAN_ICONS[selectedPlan]}
                    {PLAN_LABELS[selectedPlan]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Duration</span>
                  <span className="font-medium text-[var(--text-primary)] flex items-center gap-1">
                    {resolvedDays === null ? (
                      <>
                        <Infinity className="w-3.5 h-3.5" />
                        Forever
                      </>
                    ) : (
                      `${resolvedDays} day${resolvedDays !== 1 ? 's' : ''}`
                    )}
                  </span>
                </div>
                {reason.trim() && (
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Reason</span>
                    <span className="font-medium text-[var(--text-primary)] max-w-[200px] truncate">
                      {reason.trim()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <button className="px-4 py-2 text-sm rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors">
                Cancel
              </button>
            </DialogClose>
            <button
              onClick={confirmAndApply}
              disabled={submitting}
              className="px-4 py-2 text-sm rounded-lg bg-[var(--accent)] text-black font-medium hover:opacity-90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Confirm Override
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
