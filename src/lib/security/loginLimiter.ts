/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Login brute-force protection for METARDU.
 *
 * Distinction from rateLimit.ts:
 *   • This module tracks failed login attempts per email+IP and locks
 *     accounts after too many failures (5 failures → 30-min lockout).
 *   • rateLimit.ts handles general per-IP request quotas for API routes.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Login Brute-Force Protection for METARDU
 *
 * Tracks failed login attempts per email+IP combination.
 * After MAX_FAILED_ATTEMPTS failures within the LOCKOUT_WINDOW,
 * the account is temporarily locked out.
 *
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * are set (production). Falls back to in-memory for local development.
 */
import { logger } from '@/lib/logger'

interface LoginAttempt {
  count: number
  firstAttemptAt: number
  lockedUntil: number | null
}

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000   // 15 minutes — count failures within this window
const LOCKOUT_DURATION_MS = 30 * 60 * 1000  // 30 minutes — how long the lockout lasts
const REDIS_KEY_PREFIX = 'metardu_login:'
const REDIS_TTL_SEC = Math.ceil(LOCKOUT_WINDOW_MS / 1000) + Math.ceil(LOCKOUT_DURATION_MS / 1000)

// ─── In-memory fallback (local dev only) ─────────────────────────────────────

const attemptStore = new Map<string, LoginAttempt>()

// Periodic cleanup of expired entries (every 10 minutes)
setInterval(() => {
  const now = Date.now()
  const keysToDelete: string[] = []
  attemptStore.forEach((record, key) => {
    const lockoutExpired = !record.lockedUntil || record.lockedUntil < now
    const windowExpired = record.firstAttemptAt + LOCKOUT_WINDOW_MS < now
    if (lockoutExpired && windowExpired) {
      keysToDelete.push(key)
    }
  })
  keysToDelete.forEach(key => attemptStore.delete(key))
}, 10 * 60 * 1000)

function getKey(email: string, ip: string): string {
  return `${email.toLowerCase()}:${ip}`
}

// ─── Upstash Redis helpers ───────────────────────────────────────────────────

function hasUpstashConfig(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

function upstashEnv(): { url: string; token: string } {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set')
  }
  return { url, token }
}

async function upstashGet(key: string): Promise<LoginAttempt | null> {
  const { url, token } = upstashEnv()

  const res = await fetch(`${url}/GET`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([key]),
  })

  const data = await res.json() as { result?: string | null }
  const raw: string | null = data?.result ?? null
  if (!raw) return null
  try {
    return JSON.parse(raw) as LoginAttempt
  } catch {
    return null
  }
}

async function upstashSet(key: string, record: LoginAttempt): Promise<void> {
  const { url, token } = upstashEnv()

  await fetch(`${url}/SET`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([key, JSON.stringify(record), 'EX', REDIS_TTL_SEC]),
  })
}

async function upstashDel(key: string): Promise<void> {
  const { url, token } = upstashEnv()

  await fetch(`${url}/DEL`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([key]),
  })
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Check if a login attempt is allowed.
 * Returns { allowed, reason } — if not allowed, reason explains why.
 */
export async function checkLoginAllowed(email: string, ip: string): Promise<{ allowed: boolean; reason?: string; retryAfterMs?: number }> {
  const memKey = getKey(email, ip)
  const now = Date.now()

  if (hasUpstashConfig()) {
    const redisKey = `${REDIS_KEY_PREFIX}${memKey}`
    const record = await upstashGet(redisKey)

    if (!record) return { allowed: true }

    if (record.lockedUntil && record.lockedUntil > now) {
      const retryAfterMs = record.lockedUntil - now
      return {
        allowed: false,
        reason: `Account temporarily locked due to too many failed login attempts. Try again in ${Math.ceil(retryAfterMs / 60000)} minutes.`,
        retryAfterMs,
      }
    }

    if (record.firstAttemptAt + LOCKOUT_WINDOW_MS < now) return { allowed: true }

    return { allowed: true }
  }

  // In-memory fallback
  const record = attemptStore.get(memKey)
  if (!record) return { allowed: true }

  if (record.lockedUntil && record.lockedUntil > now) {
    const retryAfterMs = record.lockedUntil - now
    return {
      allowed: false,
      reason: `Account temporarily locked due to too many failed login attempts. Try again in ${Math.ceil(retryAfterMs / 60000)} minutes.`,
      retryAfterMs,
    }
  }

  if (record.firstAttemptAt + LOCKOUT_WINDOW_MS < now) {
    attemptStore.delete(memKey)
    return { allowed: true }
  }

  return { allowed: true }
}

/**
 * Record a failed login attempt.
 * After MAX_FAILED_ATTEMPTS, triggers a lockout.
 */
export async function recordFailedLogin(email: string, ip: string): Promise<void> {
  const memKey = getKey(email, ip)
  const now = Date.now()

  if (hasUpstashConfig()) {
    const redisKey = `${REDIS_KEY_PREFIX}${memKey}`
    const record = await upstashGet(redisKey)

    if (!record || record.firstAttemptAt + LOCKOUT_WINDOW_MS < now) {
      await upstashSet(redisKey, { count: 1, firstAttemptAt: now, lockedUntil: null })
      return
    }

    record.count += 1

    if (record.count >= MAX_FAILED_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_DURATION_MS
      logger.warn(`[loginLimiter] Account locked: ${email} from ${ip} after ${record.count} failed attempts. Locked for ${LOCKOUT_DURATION_MS / 60000} minutes.`)
    }

    await upstashSet(redisKey, record)
    return
  }

  // In-memory fallback
  const record = attemptStore.get(memKey)

  if (!record || record.firstAttemptAt + LOCKOUT_WINDOW_MS < now) {
    attemptStore.set(memKey, { count: 1, firstAttemptAt: now, lockedUntil: null })
    return
  }

  record.count += 1

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS
    logger.warn(`[loginLimiter] Account locked: ${email} from ${ip} after ${record.count} failed attempts. Locked for ${LOCKOUT_DURATION_MS / 60000} minutes.`)
  }
}

/**
 * Record a successful login — clears the failure count.
 */
export async function recordSuccessfulLogin(email: string, ip: string): Promise<void> {
  const memKey = getKey(email, ip)

  if (hasUpstashConfig()) {
    await upstashDel(`${REDIS_KEY_PREFIX}${memKey}`)
    return
  }

  attemptStore.delete(memKey)
}

/**
 * Get the current failure count for an email+IP (useful for warnings).
 */
export async function getFailedAttemptCount(email: string, ip: string): Promise<number> {
  const memKey = getKey(email, ip)
  const now = Date.now()

  if (hasUpstashConfig()) {
    const record = await upstashGet(`${REDIS_KEY_PREFIX}${memKey}`)
    if (!record) return 0
    if (record.firstAttemptAt + LOCKOUT_WINDOW_MS < now) return 0
    return record.count
  }

  const record = attemptStore.get(memKey)
  if (!record) return 0
  if (record.firstAttemptAt + LOCKOUT_WINDOW_MS < now) return 0
  return record.count
}
