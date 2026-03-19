import Link from 'next/link'

export default function SubscriptionCancelPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
          <svg className="w-8 h-8 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Payment cancelled</h1>
        <p className="text-[var(--text-secondary)] mb-8">
          No charge was made. Your current plan is unchanged. You can upgrade whenever you're ready.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/pricing" className="btn btn-primary">View plans</Link>
          <Link href="/dashboard" className="btn btn-secondary">Go to dashboard</Link>
        </div>
      </div>
    </div>
  )
}
