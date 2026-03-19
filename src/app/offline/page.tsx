'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function OfflinePage() {
  const [retrying, setRetrying] = useState(false)

  const handleRetry = async () => {
    setRetrying(true)
    try {
      const res = await fetch('/api/compute', { method: 'GET' })
      if (res.ok) window.location.href = '/'
    } catch {
      // still offline
    } finally {
      setRetrying(false)
    }
  }

  // Auto-redirect when connection restores
  useEffect(() => {
    const onOnline = () => { window.location.href = '/' }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z"/>
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">You're offline</h1>
        <p className="text-[var(--text-secondary)] mb-2">
          No internet connection. Your saved projects and calculations are still available.
        </p>
        <p className="text-[var(--text-muted)] text-sm mb-8">
          Changes will sync automatically when you reconnect.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="btn btn-primary disabled:opacity-60"
          >
            {retrying ? (
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Checking…</>
            ) : 'Try again'}
          </button>
          <Link href="/tools" className="btn btn-secondary">
            Offline tools
          </Link>
        </div>

        <div className="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)] rounded-lg px-4 py-3 border border-[var(--border-color)]">
          All 15 calculation tools work fully offline — no connection needed for traverse, leveling, COGO, curves, and more.
        </div>
      </div>
    </div>
  )
}
