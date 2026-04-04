import { env } from '@/lib/env'

type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'

/**
 * Structured, leveled logger for all components.
 * Compliant with Priority 8.5/10 Error Handling & Logging.
 * Never logs raw strings; outputs analyzable JSON.
 * Protects traces in production.
 */
export class Logger {
  private component: string

  constructor(component: string) {
    this.component = component
  }

  private log(level: LogLevel, message: string, meta?: Record<string, any>) {
    const timestamp = new Date().toISOString()
    
    // Prevent sensitive tokens from leaking into logs automatically
    const scrubbedMeta = meta ? JSON.parse(JSON.stringify(meta)) : undefined
    if (scrubbedMeta) {
      const sensitiveKeys = ['password', 'token', 'secret', 'key', 'credential', 'credit_card']
      Object.keys(scrubbedMeta).forEach((k: any) => {
        if (sensitiveKeys.some((sk: any) => k.toLowerCase().includes(sk))) {
          scrubbedMeta[k] = '[REDACTED]'
        }
      })
    }

    const payload = {
      timestamp,
      level,
      component: this.component,
      message,
      ...(scrubbedMeta && { meta: scrubbedMeta }),
    }

    // Skip DEBUG in production
    if (level === 'DEBUG' && env.NEXT_PUBLIC_SENTRY_ENVIRONMENT === 'production') {
      return
    }

    const logString = JSON.stringify(payload)
    
    switch (level) {
      case 'DEBUG':
      case 'INFO':
        console.log(logString)
        break
      case 'WARNING':
        console.warn(logString)
        break
      case 'ERROR':
      case 'CRITICAL':
        console.error(logString)
        break
    }
  }

  debug(message: string, meta?: Record<string, any>) { this.log('DEBUG', message, meta) }
  
  info(message: string, meta?: Record<string, any>) { this.log('INFO', message, meta) }
  
  warn(message: string, meta?: Record<string, any>) { this.log('WARNING', message, meta) }
  
  error(message: string, error?: Error | unknown, meta?: Record<string, any>) {
    const errorMeta = error instanceof Error 
      ? { 
          errorMessage: error.message, 
          // Never expose stack traces in production logs shipped to external services unless explicit
          stack: env.NEXT_PUBLIC_SENTRY_ENVIRONMENT === 'development' ? error.stack : undefined 
        }
      : { errorMessage: String(error) }
    this.log('ERROR', message, { ...meta, ...errorMeta })
  }
  
  critical(message: string, error?: Error | unknown, meta?: Record<string, any>) {
    const errorMeta = error instanceof Error 
      ? { 
          errorMessage: error.message, 
          stack: env.NEXT_PUBLIC_SENTRY_ENVIRONMENT !== 'production' ? error.stack : undefined 
        }
      : { errorMessage: String(error) }
    this.log('CRITICAL', message, { ...meta, ...errorMeta })
  }
}
