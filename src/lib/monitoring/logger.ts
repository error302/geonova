type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: Record<string, unknown>
  userId?: string
  error?: string
}

const LOG_ENDPOINT = process.env.NEXT_PUBLIC_LOG_ENDPOINT

class Logger {
  private logs: LogEntry[] = []
  private maxLogs = 100

  private createEntry(level: LogLevel, message: string, context?: Record<string, unknown>, userId?: string): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      userId
    }

    if (level === 'error' && context?.error) {
      entry.error = String(context.error)
    }

    return entry
  }

  private addEntry(entry: LogEntry) {
    this.logs.push(entry)
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }
  }

  public log(level: LogLevel, message: string, context?: Record<string, unknown>, userId?: string) {
    const entry = this.createEntry(level, message, context, userId)
    this.addEntry(entry)

    if (LOG_ENDPOINT && process.env.NODE_ENV === 'production') {
      this.sendToEndpoint(entry)
    }

    const prefix = `[${level.toUpperCase()}]`
    const msg = `${prefix} ${message}`
    switch (level) {
      case 'debug':
        console.debug(msg, context || '')
        break
      case 'info':
        console.info(msg, context || '')
        break
      case 'warn':
        console.warn(msg, context || '')
        break
      case 'error':
        console.error(msg, context || '')
        break
    }
  }

  private async sendToEndpoint(entry: LogEntry) {
    if (!LOG_ENDPOINT) return
    try {
      await fetch(LOG_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
        signal: AbortSignal.timeout(5000)
      })
    } catch {
      // Silently fail
    }
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.log('debug', message, context)
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log('info', message, context)
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log('warn', message, context)
  }

  error(message: string, context?: Record<string, unknown>) {
    this.log('error', message, context)
  }

  getLogs(): LogEntry[] {
    return [...this.logs]
  }

  clearLogs() {
    this.logs = []
  }
}

export const logger = new Logger()

export function logApiRequest(
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  userId?: string
) {
  const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'
  
  logger.log(level, `${method} ${path}`, {
    statusCode,
    duration,
    userId
  })
}

export function logUserAction(
  action: string,
  details: Record<string, unknown>,
  userId?: string
) {
  logger.info(`User action: ${action}`, details)
}

export function logError(
  error: Error | unknown,
  context?: Record<string, unknown>
) {
  logger.error('Error occurred', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context
  })
}
