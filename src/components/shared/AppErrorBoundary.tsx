'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { logger } from '@/lib/logger'

interface AppErrorBoundaryProps {
  /** The error object from Next.js error boundary */
  error: Error & { digest?: string }
  /** Reset function from Next.js error boundary */
  reset: () => void
  /** Optional context label for area-specific messages (e.g. "Map failed to load") */
  context?: string
}

/**
 * Shared error boundary UI component used across all error.tsx pages.
 *
 * Features:
 * - Consistent error UI with project CSS variables
 * - Reports to Sentry via captureError
 * - Shows error digest for support reference
 * - "Try again" button calls reset()
 * - "Go to dashboard" fallback link
 * - Supports a context prop for area-specific messages
 */
export default function AppErrorBoundary({ error, reset, context }: AppErrorBoundaryProps) {
  useEffect(() => {
    // Report to Sentry via dynamic import
    import('@/lib/monitoring/sentry').then(({ captureError }) => {
      captureError(error, { context: context ?? 'global' })
    }).catch(() => {
      // Sentry not available — fall back to console
      logger.error('[error-boundary]', { error: error.message, digest: error.digest })
    })
  }, [error, context])

  return (
    <div
      className="min-h-[60vh] flex items-center justify-center px-4"
      style={{ background: 'var(--bg-primary)' }}
      role="alert"
      aria-live="assertive"
    >
      <div className="text-center max-w-md">
        {/* Error icon */}
        <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-5" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <svg
            className="w-7 h-7"
            style={{ color: 'var(--error)' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>

        <h2
          className="text-xl font-semibold mb-2"
          style={{ color: 'var(--text-primary)', fontFamily: "'Geist', sans-serif" }}
        >
          {context || 'Something went wrong'}
        </h2>

        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          {error.message || 'An unexpected error occurred. This is usually a temporary issue.'}
        </p>

        <div className="flex gap-3 justify-center flex-wrap">
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors"
            style={{ background: 'var(--accent)', color: '#000' }}
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors inline-flex items-center gap-1.5"
            style={{ border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
          >
            Go to dashboard
          </Link>
        </div>

        {error.digest && (
          <p
            className="text-xs mt-4 font-mono"
            style={{ color: 'var(--text-muted)' }}
          >
            Error ref: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
