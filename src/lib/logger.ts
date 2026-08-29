/* eslint-disable no-console */
/**
 * Structured application logging for PM2 + audit trail + Sentry.
 *
 * ByteByteGo audit fix: Centralized logger with structured JSON output.
 * Replaces scattered console.error/log/warn calls with a single API that
 * emits structured logs, forwards errors to Sentry, and supports filtering.
 *
 * Usage:
 *   import { logger } from '@/lib/logger'
 *   logger.info('User created', { userId: '...' })
 *   logger.warn('Deprecated API used', { endpoint: '/api/old' })
 *   logger.error('Payment failed', { amount: 500, error: err })
 *   logger.audit(userId, 'create', 'survey_point', { pointId: '...' })
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'audit'

/**
 * Marker for log calls that must NOT be re-forwarded to Sentry.
 * Used by captureError's dev-branch log to break the otherwise infinite
 * captureError → logger.error → captureError loop (each pass embeds the
 * previous context, growing the log line exponentially — this once flooded
 * the build worker's stdout socket until ENOBUFS crashed `next build`).
 * Symbol keys are skipped by JSON.stringify, so the marker never appears
 * in the emitted log entry.
 */
export const NO_FORWARD = Symbol('logger.noForward')

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  user_id?: string
  action?: string
  resource?: string
  ip?: string
  metadata?: Record<string, unknown>
  requestId?: string
}

// ─── Core Logger ────────────────────────────────────────────────────────────

class Logger {
  private isServer = typeof window === 'undefined'

  debug(message: string, metadata?: Record<string, unknown>) {
    this.write('debug', message, metadata)
  }

  info(message: string, metadata?: Record<string, unknown>) {
    this.write('info', message, metadata)
  }

  warn(message: string, metadata?: Record<string, unknown>) {
    this.write('warn', message, metadata)
  }

  error(message: string, metadata?: Record<string, unknown> & { error?: Error | unknown }) {
    this.write('error', message, metadata)

    // Forward to Sentry on server-side (if available) — unless the caller
    // marked the entry NO_FORWARD (see captureError: forwarding a log that
    // itself came from captureError re-enters captureError forever).
    if (
      this.isServer &&
      metadata?.error instanceof Error &&
      !(metadata as Record<symbol, unknown>)[NO_FORWARD]
    ) {
      try {
        import('@/lib/monitoring/sentry').then(({ captureError }) => {
          captureError(metadata.error as Error, { message, ...metadata })
        }).catch(() => {})
      } catch {}
    }
  }

  audit(userId: string, action: string, resource: string, metadata?: Record<string, unknown>) {
    this.write('audit', `${action} on ${resource}`, {
      ...metadata,
      user_id: userId,
      action,
      resource,
    })
  }

  private write(level: LogLevel, message: string, metadata?: Record<string, unknown>) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...metadata,
    }

    // Server-side: structured JSON to stdout (PM2, Docker, Vercel capture this)
    if (this.isServer) {
      if (level === 'error') {
        console.error(JSON.stringify(entry))
      } else if (level === 'warn') {
        console.warn(JSON.stringify(entry))
      } else {
        console.log(JSON.stringify(entry))
      }
    } else {
      // Client-side: console with prefix
      const prefix = `[${level.toUpperCase()}]`
      if (level === 'error') {
        console.error(prefix, message, metadata || '')
      } else if (level === 'warn') {
        console.warn(prefix, message, metadata || '')
      } else {
        console.log(prefix, message, metadata || '')
      }
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const logger = new Logger()

// ─── Legacy API (backward compatibility) ────────────────────────────────────

export function log(entry: Omit<LogEntry, 'timestamp'>) {
  const full: LogEntry = { ...entry, timestamp: new Date().toISOString() }
  if (entry.level === 'error') {
    console.error(JSON.stringify(full))
  } else {
    console.log(JSON.stringify(full))
  }
}

export function auditLog(
  userId: string,
  action: string,
  resource: string,
  metadata?: Record<string, unknown>
) {
  logger.audit(userId, action, resource, metadata)
}
