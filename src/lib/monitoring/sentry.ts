import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN
const SENTRY_ENVIRONMENT = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 'production'

export function initSentry() {
  if (SENTRY_DSN && process.env.NODE_ENV === 'production') {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: SENTRY_ENVIRONMENT,
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      integrations: [
        Sentry.replayIntegration(),
        Sentry.browserTracingIntegration()
      ],
      beforeSend(event) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Sentry event:', event)
          return null
        }
        return event
      }
    })
  }
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error, {
      extra: context
    })
  } else {
    console.error('Error captured:', error, context)
  }
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureMessage(message, level)
  } else {
    console.log(`[${level}] ${message}`)
  }
}

export function setUser(user: { id: string; email?: string; username?: string } | null) {
  if (process.env.NODE_ENV === 'production') {
    Sentry.setUser(user)
  }
}

export function addBreadcrumb(breadcrumb: {
  category?: string
  message: string
  level?: Sentry.SeverityLevel
  data?: Record<string, unknown>
}) {
  if (process.env.NODE_ENV === 'production') {
    Sentry.addBreadcrumb(breadcrumb)
  }
}

export { Sentry }
