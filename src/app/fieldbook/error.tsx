'use client';

import { useEffect } from "react"
import Link from "next/link"
import { logger } from '@/lib/logger'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error(error instanceof Error ? error.message : String(error))
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-6 inline-flex items-center justify-center w-14 h-14 rounded-xl bg-red-500/10 border border-red-500/20">
          <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Something went wrong</h2>
        <p className="text-[var(--text-secondary)] text-sm mb-6">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="btn btn-primary">Try again</button>
          <Link href="/" className="btn btn-secondary">Go home</Link>
        </div>
      </div>
    </div>
  )
}
