export const dynamic = 'force-dynamic'

/**
 * Enhanced Health Check Endpoint
 *
 * Returns comprehensive application health status including:
 * - Database connectivity (ping query)
 * - Redis connectivity (if configured)
 * - Memory usage
 * - Uptime
 * - PM2 status (if available)
 * - Version from package.json
 *
 * 200 — { status: "ok", ...checks }
 * 503 — { status: "degraded", ...checks }
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'

interface Pm2Process {
  name: string
  pm2_env?: { status: string }
}

interface HealthCheck {
  status: 'ok' | 'degraded'
  timestamp: string
  uptime: number
  version: string
  db: { status: string; latencyMs?: number; error?: string }
  redis: { status: string; latencyMs?: number; error?: string }
  memory: {
    rss: string
    heapTotal: string
    heapUsed: string
    external: string
    arrayBuffers: string
  }
  pm2?: {
    status: string
    instances?: number
    error?: string
  }
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

async function checkDb(): Promise<{ status: string; latencyMs?: number; error?: string }> {
  const start = Date.now()
  try {
    await db.query('SELECT 1 AS health_check')
    return { status: 'connected', latencyMs: Date.now() - start }
  } catch (error) {
    return { status: 'error', latencyMs: Date.now() - start, error: String(error) }
  }
}

async function checkRedis(): Promise<{ status: string; latencyMs?: number; error?: string }> {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    return { status: 'not_configured' }
  }

  const start = Date.now()
  try {
    // Dynamic import to avoid loading redis when not configured
    const { createClient } = await import('redis')
    const client = createClient({ url: redisUrl, socket: { reconnectStrategy: false } })
    await client.connect()
    const pong = await client.ping()
    await client.quit()
    return { status: pong === 'PONG' ? 'connected' : 'error', latencyMs: Date.now() - start }
  } catch (error) {
    return { status: 'error', latencyMs: Date.now() - start, error: String(error) }
  }
}

function checkPm2(): { status: string; instances?: number; error?: string } {
  try {
    const output = execSync('pm2 jlist 2>/dev/null', {
      timeout: 3000,
      encoding: 'utf-8',
    })
    const processes = JSON.parse(output) as Pm2Process[]
    const metarduProcesses = processes.filter(
      (p) => p.name === 'metardu' || p.name === 'metardu-worker'
    )
    const onlineCount = metarduProcesses.filter(
      (p) => p.pm2_env?.status === 'online'
    ).length
    return {
      status: onlineCount === metarduProcesses.length ? 'healthy' : 'degraded',
      instances: metarduProcesses.length,
    }
  } catch {
    return { status: 'unavailable' }
  }
}

function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8')) as { version?: string }
    return pkg.version || 'unknown'
  } catch {
    return 'unknown'
  }
}

function getMemoryUsage() {
  const mem = process.memoryUsage()
  return {
    rss: formatBytes(mem.rss),
    heapTotal: formatBytes(mem.heapTotal),
    heapUsed: formatBytes(mem.heapUsed),
    external: formatBytes(mem.external),
    arrayBuffers: formatBytes(mem.arrayBuffers),
  }
}

export async function GET() {
  const timestamp = new Date().toISOString()
  const uptime = process.uptime()

  const [dbHealth, redisHealth] = await Promise.all([checkDb(), checkRedis()])
  const pm2Health = checkPm2()

  const memory = getMemoryUsage()
  const version = getVersion()

  const isHealthy = dbHealth.status === 'connected'
  const status: HealthCheck['status'] = isHealthy ? 'ok' : 'degraded'

  const response: HealthCheck = {
    status,
    timestamp,
    uptime,
    version,
    db: dbHealth,
    redis: redisHealth,
    memory,
  }

  if (pm2Health.status !== 'unavailable') {
    response.pm2 = pm2Health
  }

  return NextResponse.json(response, {
    status: isHealthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Content-Type': 'application/json',
    },
  })
}
