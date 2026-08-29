// ──────────────────────────────────────────────────────────────────────────
// METARDU — Prometheus Metrics Endpoint
// ──────────────────────────────────────────────────────────────────────────
// GET /api/public/metrics → Prometheus text format
//
// No authentication required (Prometheus needs open access) — SUPERSEDED,
// see isAuthorized below (audit H-13).
//
// Caddy example:
//   handle /api/public/metrics {
//     @blocked not remote_ip 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16
//     respond @blocked 403
//     reverse_proxy metardu-app:3000
//   }
// ──────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import {
  getMetrics,
  getContentType,
  setAppVersion,
  projectsTotal,
} from '@/lib/monitoring/metrics';
import { logger } from '@/lib/logger'

// Track if we've initialized version info
let initialized = false;

/** COUNT(*) returns BIGINT → pg yields string. */
interface ProjectStatusCounts {
  active: string
  archived: string
  completed: string
}

async function initializeMetrics() {
  if (initialized) return;
  initialized = true;

  // Set version info
  setAppVersion(
    process.env.npm_package_version || '1.0.1',
    process.env.NODE_ENV || 'development'
  );

  // Set initial project counts (if DB is available)
  try {
    const { getPool } = await import('@/lib/db');
    const pool = getPool();

    const result = await pool.query<ProjectStatusCounts>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'ACTIVE') as active,
         COUNT(*) FILTER (WHERE status = 'ARCHIVED') as archived,
         COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed
       FROM projects`
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      projectsTotal.set({ status: 'active' }, parseInt(row.active, 10) || 0);
      projectsTotal.set({ status: 'archived' }, parseInt(row.archived, 10) || 0);
      projectsTotal.set({ status: 'completed' }, parseInt(row.completed, 10) || 0);
    }
  } catch {
    // DB not available — skip project metrics
  }
}

// SECURITY (audit H-13, 2026-08-30): requires the API_ADMIN_KEY bearer token.
// The old comment said "restrict at the reverse proxy" — no such rule ever
// existed, and the audit confirmed the full Prometheus dump was reachable
// anonymously in production.

export const dynamic = 'force-dynamic'

function isAuthorized(request: NextRequest): boolean {
  const adminKey = process.env.API_ADMIN_KEY
  if (!adminKey) {
    // Fail closed: no key configured → nobody may scrape
    return false
  }
  const authHeader = request.headers.get('authorization') || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  return bearer === adminKey
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Metrics require the API admin bearer token' },
      { status: 401 },
    )
  }

  try {
    await initializeMetrics();

    const metrics = await getMetrics();

    return new NextResponse(metrics, {
      status: 200,
      headers: {
        'Content-Type': getContentType(),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err) {
    logger.error('[Metrics] Error generating metrics:', { error: err });
    return new NextResponse('# Error generating metrics\n', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
