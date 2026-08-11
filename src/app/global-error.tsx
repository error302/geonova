'use client';

import { useEffect } from "react"
import AppErrorBoundary from '@/components/shared/AppErrorBoundary'
import { logger } from '@/lib/logger'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Report via dynamic import (not require) to avoid bundling issues
    import('@/lib/monitoring/sentry').then(({ captureError }) => {
      captureError(error, { context: 'global-error' })
    }).catch(() => {
      logger.error('[global-error]', { error: error.message, digest: error.digest })
    })
  }, [error])

  return (
    <html lang="en">
      <body style={{ background: "var(--bg-primary, #0a0a0f)", color: "var(--text-primary, #e5e5e5)", fontFamily: "system-ui, sans-serif" }}>
        <AppErrorBoundary error={error} reset={reset} context="METARDU encountered a critical error" />
      </body>
    </html>
  )
}
