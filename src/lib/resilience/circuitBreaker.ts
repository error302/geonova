/**
 * Circuit Breaker — protects outbound calls from cascading failures
 *
 * After N consecutive failures, the circuit "opens" — subsequent calls
 * fail immediately without hitting the network. After a cooldown period,
 * the circuit "half-opens" — one trial request is allowed.
 *
 * States: CLOSED → OPEN → HALF_OPEN → CLOSED (or back to OPEN)
 *
 * References: ByteByteGo system-design-101 Resiliency Patterns, Shopify Semian
 */

import { log } from '@/lib/logger'

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerOptions {
  name: string
  failureThreshold?: number  // default: 5
  cooldownMs?: number        // default: 30000
  timeoutMs?: number         // default: 10000
  onOpen?: (name: string, failureCount: number) => void
  onClose?: (name: string) => void
}

export class CircuitOpenError extends Error {
  constructor(public readonly circuitName: string) {
    super(`Circuit breaker OPEN for "${circuitName}" — failing fast`)
    this.name = 'CircuitOpenError'
  }
}

export class CircuitTimeoutError extends Error {
  constructor(public readonly circuitName: string, timeoutMs: number) {
    super(`Circuit "${circuitName}" timed out after ${timeoutMs}ms`)
    this.name = 'CircuitTimeoutError'
  }
}

class CircuitBreaker {
  private state: CircuitState = 'CLOSED'
  private failureCount = 0
  private lastFailureTime = 0
  private halfOpenInProgress = false

  constructor(private readonly options: CircuitBreakerOptions) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime
      if (elapsed < (this.options.cooldownMs ?? 30000)) {
        throw new CircuitOpenError(this.options.name)
      }
      this.state = 'HALF_OPEN'
      this.halfOpenInProgress = false
      log({ level: 'info', message: `[circuit-breaker] ${this.options.name}: OPEN → HALF_OPEN` })
    }

    if (this.state === 'HALF_OPEN' && this.halfOpenInProgress) {
      throw new CircuitOpenError(this.options.name)
    }

    if (this.state === 'HALF_OPEN') {
      this.halfOpenInProgress = true
    }

    const timeoutMs = this.options.timeoutMs ?? 10000
    try {
      const result = await this.executeWithTimeout(fn, timeoutMs)
      this.onSuccess()
      return result
    } catch (err) {
      this.onFailure(err)
      throw err
    }
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutId: any
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new CircuitTimeoutError(this.options.name, timeoutMs))
      }, timeoutMs)
    })

    try {
      return await Promise.race([fn(), timeoutPromise])
    } finally {
      clearTimeout(timeoutId)
    }
  }

  private onSuccess(): void {
    const wasOpen = this.state !== 'CLOSED'
    this.failureCount = 0
    this.state = 'CLOSED'
    this.halfOpenInProgress = false
    if (wasOpen) {
      log({ level: 'info', message: `[circuit-breaker] ${this.options.name}: → CLOSED (recovered)` })
      this.options.onClose?.(this.options.name)
    }
  }

  private onFailure(error: unknown): void {
    this.failureCount++
    this.lastFailureTime = Date.now()
    const threshold = this.options.failureThreshold ?? 5

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN'
      this.halfOpenInProgress = false
      log({ level: 'warn', message: `[circuit-breaker] ${this.options.name}: HALF_OPEN → OPEN` })
    } else if (this.failureCount >= threshold) {
      this.state = 'OPEN'
      log({
        level: 'warn',
        message: `[circuit-breaker] ${this.options.name}: CLOSED → OPEN (${this.failureCount} failures, last: ${error instanceof Error ? error.message : String(error)})`,
      })
      this.options.onOpen?.(this.options.name, this.failureCount)
    }
  }

  getState() {
    return {
      name: this.options.name,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    }
  }

  reset(): void {
    this.state = 'CLOSED'
    this.failureCount = 0
    this.lastFailureTime = 0
    this.halfOpenInProgress = false
  }
}

// ─── Registry ───────────────────────────────────────────────────────────────

const breakers = new Map<string, CircuitBreaker>()

export function getCircuitBreaker(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
  if (!breakers.has(name)) {
    breakers.set(name, new CircuitBreaker({ name, ...options }))
  }
  return breakers.get(name)!
}

export function getAllCircuitStates() {
  return Array.from(breakers.values()).map(b => b.getState())
}

// ─── Pre-configured Breakers ────────────────────────────────────────────────

export const stripeBreaker = getCircuitBreaker('stripe', { failureThreshold: 5, cooldownMs: 30000, timeoutMs: 15000 })
export const mpesaBreaker = getCircuitBreaker('mpesa', { failureThreshold: 5, cooldownMs: 60000, timeoutMs: 30000 })
export const paypalBreaker = getCircuitBreaker('paypal', { failureThreshold: 5, cooldownMs: 30000, timeoutMs: 15000 })
export const nlimsBreaker = getCircuitBreaker('nlims', { failureThreshold: 3, cooldownMs: 300000, timeoutMs: 30000 })
export const ardhisasaBreaker = getCircuitBreaker('ardhisasa', { failureThreshold: 3, cooldownMs: 300000, timeoutMs: 30000 })
export const kencorsBreaker = getCircuitBreaker('kencors', { failureThreshold: 5, cooldownMs: 120000, timeoutMs: 10000 })
export const webodmBreaker = getCircuitBreaker('webodm', { failureThreshold: 3, cooldownMs: 300000, timeoutMs: 120000 })
export const nvidiaBreaker = getCircuitBreaker('nvidia', { failureThreshold: 5, cooldownMs: 60000, timeoutMs: 30000 })
export const pythonWorkerBreaker = getCircuitBreaker('python-worker', { failureThreshold: 5, cooldownMs: 30000, timeoutMs: 60000 })

/**
 * Wrap an async function with circuit breaker protection.
 */
export async function withCircuit<T>(
  breakerName: string,
  fn: () => Promise<T>,
  options?: Partial<CircuitBreakerOptions>,
): Promise<T> {
  const breaker = getCircuitBreaker(breakerName, options)
  return breaker.execute(fn)
}
