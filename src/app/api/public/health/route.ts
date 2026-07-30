import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const start = Date.now()
  const checks: Record<string, { status: 'ok' | 'error'; latencyMs?: number; error?: string }> = {}

  // ── Database check ──
  try {
    const dbStart = Date.now()
    await db.query('SELECT 1')
    checks.database = { status: 'ok', latencyMs: Date.now() - dbStart }
  } catch (err) {
    checks.database = { status: 'error', error: String(err) }
  }

  // ── Redis check (if configured) ──
  if (process.env.REDIS_URL) {
    try {
      const { RedisCache } = await import('@/lib/cache/redis')
      const redis = new RedisCache()
      const redisStart = Date.now()
      await redis.connect()
      checks.redis = { status: 'ok', latencyMs: Date.now() - redisStart }
    } catch (err) {
      checks.redis = { status: 'error', error: String(err) }
    }
  }

  // ── Disk space check ──
  try {
    const { execSync } = await import('child_process')
    const df = execSync("df -h / | tail -1 | awk '{print $5}'").toString().trim()
    const usage = parseInt(df, 10)
    checks.disk = {
      status: usage > 90 ? 'error' : 'ok',
      ...(usage > 90 ? { error: `${usage}% used — critical` } : {}),
    }
  } catch {
    // Skip on non-Linux
  }

  const allOk = Object.values(checks).every(v => v.status === 'ok')
  const anyError = Object.values(checks).some(v => v.status === 'error')

  return NextResponse.json({
    status: allOk ? 'healthy' : anyError ? 'unhealthy' : 'degraded',
    checks,
    latencyMs: Date.now() - start,
    version: process.env.npm_package_version ?? '1.0.1',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  }, { status: allOk ? 200 : 503 })
}
