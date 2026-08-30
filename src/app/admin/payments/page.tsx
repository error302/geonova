'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  CreditCard, DollarSign, Loader2, AlertCircle,
  ChevronLeft, ChevronRight, Download, Smartphone,
  CheckCircle, XCircle, RefreshCw, ShieldCheck, Check, Copy
} from 'lucide-react'
import { MobilePaymentCard } from '@/components/admin/MobileCards'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaymentRecord {
  id: string
  userId: string
  userEmail: string
  userName: string
  amount: number
  currency: string
  status: string
  method: string
  planId: string
  createdAt: string
}

interface TillClaim {
  id: string
  userId: string
  userEmail: string
  userName: string
  amount: number
  currency: string
  mpesaCode: string
  planId: string
  phoneNumber: string
  tillNumber: string
  submittedAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore: boolean
}

interface PaymentsResponse {
  payments: PaymentRecord[]
  pagination: Pagination
  summary: {
    totalRevenue: number
    thisMonth: number
    pendingPayouts: number
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-green-500/15 text-green-400 border-green-500/30'
    case 'pending':
    case 'pending_review':
      return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
    case 'failed':
    case 'rejected':
      return 'bg-red-500/15 text-red-400 border-red-500/30'
    case 'refunded':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30'
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
  color = 'var(--accent)',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  subValue?: string
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

export default function AdminPaymentsPage() {
  const { status: sessionStatus } = useSession()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'history' | 'till-claims'>('history')
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [tillClaims, setTillClaims] = useState<TillClaim[]>([])
  const [claimsLoading, setClaimsLoading] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null)

  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
    hasMore: false,
  })
  const [summary, setSummary] = useState({ totalRevenue: 0, thisMonth: 0, pendingPayouts: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPayments = useCallback(
    async (page = 1) => {
      try {
        setLoading(true)
        setError(null)
        const params = new URLSearchParams({
          page: String(page),
          limit: '25',
        })

        const res = await fetch(`/api/admin/payments?${params}`)
        if (res.status === 401) {
          router.push('/login')
          return
        }
        if (res.status === 403) {
          router.push('/dashboard')
          return
        }
        if (!res.ok) throw new Error('Failed to fetch payments')

        const data: PaymentsResponse = (await res.json()) as unknown as PaymentsResponse
        setPayments(data.payments || [])
        setPagination((prev) => data.pagination || prev)
        setSummary((prev) => data.summary || prev)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load payments')
      } finally {
        setLoading(false)
      }
    },
    [router],
  )

  const fetchTillClaims = useCallback(async () => {
    try {
      setClaimsLoading(true)
      const res = await fetch('/api/admin/payments/till-claims')
      if (res.ok) {
        const data = await res.json()
        setTillClaims(data.claims || [])
      }
    } catch {
      // Ignored
    } finally {
      setClaimsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (sessionStatus === 'authenticated') {
      fetchPayments(1)
      fetchTillClaims()
    }
  }, [sessionStatus, fetchPayments, fetchTillClaims, router])

  const handleApproveClaim = async (claimId: string) => {
    try {
      setActionLoadingId(claimId)
      const res = await fetch('/api/admin/payments/till-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // CONTRACT FIX (2026-08-30): the API schema (till-claims ActionSchema)
        // expects `paymentId` — the old `claimId` body failed Zod validation
        // with a generic 400 on EVERY approve/reject click.
        body: JSON.stringify({ paymentId: claimId, action: 'approve' }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to approve claim')
      }

      setActionSuccessMsg('Payment approved! Subscription activated and receipt emailed.')
      setTimeout(() => setActionSuccessMsg(null), 4000)
      fetchTillClaims()
      fetchPayments(pagination.page)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve claim')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleRejectClaim = async (claimId: string) => {
    const reason = prompt('Please enter a rejection reason (optional):')
    if (reason === null) return // cancelled

    try {
      setActionLoadingId(claimId)
      const res = await fetch('/api/admin/payments/till-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: claimId, action: 'reject', reason }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to reject claim')
      }

      setActionSuccessMsg('Claim marked as rejected.')
      setTimeout(() => setActionSuccessMsg(null), 4000)
      fetchTillClaims()
      fetchPayments(pagination.page)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject claim')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const handlePageChange = (newPage: number) => {
    fetchPayments(newPage)
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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Payments &amp; Till Hub</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Track revenue, verify M-Pesa Buy Goods Till claims, and manage transactions
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-1">
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'history'
                ? 'bg-[var(--accent)] text-black shadow'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            All Transactions
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('till-claims')
              fetchTillClaims()
            }}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'till-claims'
                ? 'bg-emerald-500 text-black shadow'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Till Claims</span>
            {tillClaims.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] bg-red-500 text-white rounded-full font-bold ml-1">
                {tillClaims.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {actionSuccessMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={DollarSign}
          label="Total Revenue"
          value={formatCurrency(summary.totalRevenue)}
          color="#4ade80"
        />
        <StatCard
          icon={CreditCard}
          label="This Month"
          value={formatCurrency(summary.thisMonth)}
          subValue="Completed transactions"
          color="#60a5fa"
        />
        <StatCard
          icon={Smartphone}
          label="Pending Till Claims"
          value={tillClaims.length}
          subValue="Awaiting merchant verification"
          color="#f59e0b"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="card p-4 border-red-500/30 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => fetchPayments(pagination.page)}
            className="ml-auto text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            Retry
          </button>
        </div>
      )}

      {/* TAB 1: ALL TRANSACTIONS */}
      {activeTab === 'history' && (
        <>
          {/* Mobile: card list */}
          <div className="lg:hidden space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-[var(--accent)] animate-spin" />
                <p className="text-sm text-[var(--text-muted)] ml-2">Loading payments...</p>
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-12">
                <CreditCard className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-2" />
                <p className="text-sm text-[var(--text-muted)]">No payments found</p>
              </div>
            ) : (
              payments.map((payment) => (
                <MobilePaymentCard key={payment.id} payment={payment} />
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
                    <th className="px-4 py-3 text-left">Amount</th>
                    <th className="px-4 py-3 text-left">Plan</th>
                    <th className="px-4 py-3 text-left">Method</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <Loader2 className="w-6 h-6 text-[var(--accent)] animate-spin mx-auto" />
                        <p className="text-sm text-[var(--text-muted)] mt-2">Loading payments...</p>
                      </td>
                    </tr>
                  ) : payments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <CreditCard className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-2" />
                        <p className="text-sm text-[var(--text-muted)]">No payments found</p>
                      </td>
                    </tr>
                  ) : (
                    payments.map((payment) => (
                      <tr key={payment.id} className="table-row">
                        <td className="table-cell">
                          <div>
                            <p className="font-medium text-[var(--text-primary)]">
                              {payment.userName || 'Unnamed'}
                            </p>
                            <p className="text-xs text-[var(--text-muted)]">{payment.userEmail}</p>
                          </div>
                        </td>
                        <td className="table-cell font-mono font-medium">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="table-cell">
                          <span className="capitalize">{payment.planId || 'N/A'}</span>
                        </td>
                        <td className="table-cell">
                          <span className="capitalize">{payment.method || 'Unknown'}</span>
                        </td>
                        <td className="table-cell">
                          <span
                            className={`badge border text-xs px-2.5 py-0.5 rounded-full capitalize ${statusBadgeClass(
                              payment.status,
                            )}`}
                          >
                            {payment.status}
                          </span>
                        </td>
                        <td className="table-cell text-[var(--text-muted)] text-xs">
                          {formatDate(payment.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span>
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} payments
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1 || loading}
                  className="btn btn-secondary p-2 disabled:opacity-50"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span>
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!pagination.hasMore || loading}
                  className="btn btn-secondary p-2 disabled:opacity-50"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: M-PESA TILL CLAIMS */}
      {activeTab === 'till-claims' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-[var(--text-muted)]">
              Review customer-submitted M-Pesa transaction codes against your merchant M-Pesa Till statement.
            </div>
            <button
              type="button"
              onClick={fetchTillClaims}
              disabled={claimsLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-xs hover:bg-[var(--bg-tertiary)]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${claimsLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Claims</span>
            </button>
          </div>

          {claimsLoading ? (
            <div className="card p-12 text-center">
              <Loader2 className="w-6 h-6 text-emerald-400 animate-spin mx-auto mb-2" />
              <p className="text-xs text-[var(--text-muted)]">Fetching pending Till claims...</p>
            </div>
          ) : tillClaims.length === 0 ? (
            <div className="card p-12 text-center space-y-2">
              <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto" />
              <h4 className="text-base font-bold text-white">All Caught Up!</h4>
              <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                There are no pending M-Pesa Till claims to review. All customer submissions have been verified and processed.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tillClaims.map((claim) => (
                <div
                  key={claim.id}
                  className="card p-5 border-emerald-500/20 bg-emerald-500/5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-base text-[var(--accent)] tracking-wider">
                        {claim.mpesaCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(claim.mpesaCode)}
                        className="text-[var(--text-muted)] hover:text-white p-1 rounded"
                        title="Copy Code"
                      >
                        {copiedCode === claim.mpesaCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-full">
                        Pending Review
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-full uppercase">
                        {claim.planId} Plan
                      </span>
                    </div>

                    <div className="text-xs text-[var(--text-secondary)] flex flex-wrap gap-x-4 gap-y-1">
                      <span>Customer: <strong className="text-white">{claim.userName || 'Surveyor'}</strong> ({claim.userEmail})</span>
                      <span>Phone: <strong className="text-white font-mono">{claim.phoneNumber}</strong></span>
                      <span>Till: <strong className="text-white font-mono">{claim.tillNumber}</strong></span>
                    </div>

                    <div className="text-[11px] text-[var(--text-muted)] font-mono">
                      Submitted: {formatDate(claim.submittedAt)}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right mr-2">
                      <div className="text-xs text-[var(--text-muted)]">Claimed Amount</div>
                      <div className="text-lg font-bold text-emerald-400 font-mono">
                        KSh {claim.amount.toLocaleString()}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={actionLoadingId === claim.id}
                      onClick={() => handleApproveClaim(claim.id)}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {actionLoadingId === claim.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      <span>Approve &amp; Activate</span>
                    </button>

                    <button
                      type="button"
                      disabled={actionLoadingId === claim.id}
                      onClick={() => handleRejectClaim(claim.id)}
                      className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold rounded-xl transition-all flex items-center gap-1 disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
