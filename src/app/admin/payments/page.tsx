'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  CreditCard, DollarSign, Loader2, AlertCircle,
  ChevronLeft, ChevronRight, Download,
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
      return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
    case 'failed':
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

  const [payments, setPayments] = useState<PaymentRecord[]>([])
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

                const data: PaymentsResponse = await res.json() as unknown as PaymentsResponse
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

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (sessionStatus === 'authenticated') {
      fetchPayments(1)
    }
  }, [sessionStatus, fetchPayments, router])

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
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Payments</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Track revenue, transactions, and payout status
          </p>
        </div>
      </div>

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
          icon={Download}
          label="Pending Payouts"
          value={formatCurrency(summary.pendingPayouts)}
          subValue="Awaiting processing"
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

      {/* Payments — Card layout on mobile, table on lg+ */}
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
                        <p className="text-[var(--text-primary)] font-medium text-sm">
                          {payment.userName}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">{payment.userEmail}</p>
                      </div>
                    </td>
                    <td className="table-cell text-sm font-medium text-[var(--text-primary)]">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="table-cell text-sm capitalize text-[var(--text-secondary)]">
                      {payment.planId}
                    </td>
                    <td className="table-cell text-sm text-[var(--text-secondary)] capitalize">
                      {payment.method}
                    </td>
                    <td className="table-cell">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${statusBadgeClass(payment.status)}`}
                      >
                        {payment.status}
                      </span>
                    </td>
                    <td className="table-cell text-sm text-[var(--text-muted)]">
                      {formatDate(payment.createdAt)}
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
              {pagination.total} payments
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
    </div>
  )
}
