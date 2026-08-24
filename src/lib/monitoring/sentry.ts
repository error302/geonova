/**
 * Sentry monitoring integration for Metardu.
 *
 * In production (NEXT_PUBLIC_SENTRY_DSN set), errors are sent to Sentry.
 * In development, all capture functions log to console instead.
 *
 * Special tags:
 * - ai_error: NVIDIA API errors
 * - db_error: PostgreSQL errors
 * - payment_error: Payment processing errors
 */

import * as Sentry from '@sentry/nextjs'
import { logger } from '@/lib/logger'

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN
const SENTRY_ENVIRONMENT = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 'production'

const isProduction = () => !!SENTRY_DSN && !SENTRY_DSN.includes('mockup')

export function initSentry() {
  if (isProduction() && process.env.NODE_ENV === 'production') {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: SENTRY_ENVIRONMENT,
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      beforeSend(event) {
        // Silence known non-actionable build noise: /api/portfolio dynamic server usage
        const digest = (event as unknown as { digest?: string })?.digest || (event.exception?.values?.[0] as unknown as { digest?: string })?.digest
        const msg = event.exception?.values?.[0]?.value || ''
        if (digest === 'DYNAMIC_SERVER_USAGE' && msg.includes('/api/portfolio')) return null
        if (msg.includes("Route /api/portfolio couldn't be rendered statically")) return null
        // Scrub any API keys that might leak into error messages
        if (event.request?.headers) {
          delete event.request.headers['Authorization']
          delete event.request.headers['authorization']
        }
        // Scrub from exception messages
        if (event.exception?.values) {
          for (const exc of event.exception.values) {
            if (exc.value) {
              exc.value = exc.value
                .replace(/nvapi-[A-Za-z0-9_-]+/g, 'nvapi-[REDACTED]')
                .replace(/Bearer [A-Za-z0-9_-]+/g, 'Bearer [REDACTED]')
            }
          }
        }
        return event
      },
    })
  }
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  if (isProduction()) {
    Sentry.captureException(error, { extra: context })
  } else {
    logger.error('[sentry] Error captured:', { error, context })
  }
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  if (isProduction()) {
    Sentry.captureMessage(message, level)
  } else {
    // Dev/staging: Sentry is disabled — nothing to capture.
  }
}

export function setUser(user: { id: string; email?: string; username?: string } | null) {
  if (isProduction()) {
    Sentry.setUser(user)
  }
}

export function addBreadcrumb(breadcrumb: {
  category?: string
  message: string
  level?: Sentry.SeverityLevel
  data?: Record<string, unknown>
}) {
  if (isProduction()) {
    Sentry.addBreadcrumb(breadcrumb)
  }
}

/** Capture AI-specific errors with structured context */
export function captureAiError(error: Error, context: {
  action: string
  model?: string
  userId?: string
  latencyMs?: number
  httpStatus?: number
}) {
  if (isProduction()) {
    Sentry.withScope((scope) => {
      scope.setTag('ai_error', 'true')
      scope.setTag('ai_action', context.action)
      if (context.model) scope.setTag('ai_model', context.model)
      if (context.httpStatus) scope.setTag('http_status', String(context.httpStatus))
      scope.setExtra('latencyMs', context.latencyMs)
      if (context.userId) scope.setUser({ id: context.userId })
      Sentry.captureException(error)
    })
  } else {
    logger.error(`[sentry] AI error (${context.action}):`, { error: error.message, context })
  }
}

export { Sentry }
