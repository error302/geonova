/**
 * Redis Cache Layer for METARDU
 * Enterprise-grade caching for API responses and session data
 */

import { createClient } from 'redis'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const IS_NEXT_BUILD = process.env.NEXT_PHASE === 'phase-production-build'

class RedisCache {
  private client: ReturnType<typeof createClient> | null = null
  private isConnected = false
  private connectionAttempted = false
  private disabled = false

  async connect(): Promise<void> {
    if (this.isConnected || this.disabled || IS_NEXT_BUILD) return

    try {
      this.connectionAttempted = true
      this.client = createClient({
        url: REDIS_URL,
        socket: {
          reconnectStrategy: false,
        },
      })
      this.client.on('error', () => {
        this.disabled = true
      })
      await this.client.connect()
      this.isConnected = true
    } catch (error) {
      this.disabled = true
      this.client = null
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Redis] Cache disabled; Redis is not reachable.')
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.connectionAttempted) await this.connect()
    if (!this.isConnected || !this.client) return null

    try {
      const value = await this.client.get(key)
      return value ? JSON.parse(value as string) : null
    } catch {
      return null
    }
  }

  async set<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
    if (!this.connectionAttempted) await this.connect()
    if (!this.isConnected || !this.client) return

    try {
      await this.client.setEx(key, ttlSeconds, JSON.stringify(value))
    } catch {
      // Silently fail - app continues working
    }
  }

  async del(key: string): Promise<void> {
    if (!this.connectionAttempted) await this.connect()
    if (!this.isConnected || !this.client) return

    try {
      await this.client.del(key)
    } catch {
      // Silently fail
    }
  }

  async delPattern(pattern: string): Promise<void> {
    if (!this.connectionAttempted) await this.connect()
    if (!this.isConnected || !this.client) return

    try {
      // ByteByteGo audit fix: use SCAN instead of KEYS to avoid blocking Redis
      // in production. KEYS * scans the entire keyspace and blocks the event loop.
      // SCAN is non-blocking and returns { cursor, keys } for iteration.
      let cursor = '0'
      do {
        const result = await this.client.scan(cursor, { MATCH: pattern, COUNT: 100 })
        cursor = result.cursor
        const keys = result.keys
        if (keys.length > 0) {
          await this.client.del(keys)
        }
      } while (cursor !== '0')
    } catch {
      // Silently fail
    }
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds = 300): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached) return cached

    const value = await factory()
    await this.set(key, value, ttlSeconds)
    return value
  }

  async increment(key: string, amount = 1): Promise<number> {
    if (!this.connectionAttempted) await this.connect()
    if (!this.isConnected || !this.client) return 0

    try {
      return await this.client.incrBy(key, amount) as number
    } catch {
      return 0
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (!this.connectionAttempted) await this.connect()
    if (!this.isConnected || !this.client) return

    try {
      await this.client.expire(key, seconds)
    } catch {
      // Silently fail
    }
  }

  // Cache keys generators
  static keys = {
    project: (id: string) => `project:${id}`,
    projectList: (userId: string) => `projects:list:${userId}`,
    surveyPoints: (projectId: string) => `survey_points:${projectId}`,
    submissions: (projectId: string) => `submissions:${projectId}`,
    surveyTool: (tool: string, params: string) => `tool:${tool}:${params}`,
    userSession: (sessionId: string) => `session:${sessionId}`,
    rateLimit: (key: string) => `ratelimit:${key}`,
  }
}

// Singleton instance
const redisCache = new RedisCache()
export default redisCache
export { RedisCache }

// Helper for API route caching
export function withCache<T>(
  fn: () => Promise<T>,
  key: string,
  ttlSeconds = 300
): Promise<T> {
  return redisCache.getOrSet(key, fn, ttlSeconds)
}

// Cache middleware for Next.js API routes
export async function cacheMiddleware(
  request: Request,
  cacheKey: string,
  ttlSeconds = 60
): Promise<Response | null> {
  // Only cache GET requests
  if (request.method !== 'GET') return null

  const cached = await redisCache.get<ResponseCache>(cacheKey)
  if (cached) {
    return new Response(JSON.stringify(cached.data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'HIT',
        'X-Cache-TTL': ttlSeconds.toString(),
      },
    })
  }

  return null
}

interface ResponseCache {
  data: any
  timestamp: number
}
