/**
 * API Route Caching Layer
 * Cache GET requests automatically
 */

import { NextRequest, NextResponse } from 'next/server'
import redisCache, { RedisCache } from './redis'

interface CacheConfig {
  ttl?: number // seconds
  keyGenerator?: (req: NextRequest) => string
  tags?: string[] // for cache invalidation
}

export function withApiCache(
  handler: (req: NextRequest) => Promise<NextResponse>,
  config: CacheConfig = {}
) {
  const { ttl = 60, keyGenerator, tags = [] } = config

  return async function cachedHandler(req: NextRequest): Promise<NextResponse> {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return handler(req)
    }

    const cacheKey = keyGenerator
      ? keyGenerator(req)
      : `api:${req.nextUrl.pathname}:${req.nextUrl.search}`

    // Try cache
    const cached = await redisCache.get<{ data: unknown; headers: Record<string, string> }>(cacheKey)
    
    if (cached) {
      return NextResponse.json(cached.data, {
        headers: {
          ...cached.headers,
          'X-Cache': 'HIT',
          'X-Cache-Key': cacheKey,
        },
      })
    }

    // Execute handler
    const response = await handler(req)

    // Cache successful responses
    if (response.status === 200) {
      try {
        const data = await response.json()
        const headers: Record<string, string> = {}
        response.headers.forEach((value, key) => {
          headers[key] = value
        })

        await redisCache.set(cacheKey, { data, headers, tags }, ttl)

        return NextResponse.json(data, {
          headers: {
            ...headers,
            'X-Cache': 'MISS',
            'X-Cache-Key': cacheKey,
          },
        })
      } catch {
        // If we can't cache, just return the response
        return response
      }
    }

    return response
  }
}

// Cache invalidation helpers
export async function invalidateCache(tags: string[]): Promise<void> {
  // In production, use Redis KEYS to find and delete by pattern
  // For now, we'll just delete specific known keys
  for (const tag of tags) {
    await redisCache.delPattern(`*:${tag}:*`)
  }
}

export async function invalidateProjectCache(projectId: string): Promise<void> {
  await redisCache.del(RedisCache.keys.project(projectId))
  await redisCache.del(RedisCache.keys.surveyPoints(projectId))
  await redisCache.del(RedisCache.keys.submissions(projectId))
  await redisCache.delPattern(`count:*"project_id":"${projectId}"*`)
}

// Revalidate tag for Next.js ISR
export async function revalidateTag(tag: string): Promise<void> {
  try {
    await fetch(`/api/revalidate?tag=${tag}`, { method: 'POST' })
  } catch {
    // Ignore errors
  }
}
