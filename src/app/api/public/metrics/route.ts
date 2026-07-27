// ──────────────────────────────────────────────────────────────────────────
// METARDU — Prometheus Metrics Endpoint
// ──────────────────────────────────────────────────────────────────────────
// GET /api/public/metrics → Prometheus text format
//
// No authentication required (Prometheus needs open access).
// Security: This endpoint should be restricted at the reverse proxy level
// to only allow connections from your Prometheus scraper IP.
//
// Caddy example:
//   handle /api/public/metrics {
//     @blocked not remote_ip 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16
//     respond @blocked 403
//     reverse_proxy metardu-app:3000
//   }
// ──────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import {
  getMetrics,
  getContentType,
  setAppVersion,
  projectsTotal,
  activeUsers,
} from '@/lib/monitoring/metrics';

// Track if we've initialized version info
let initialized = false;

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
    const { getPool } = await import('@/lib/db/pool');
    const pool = getPool();

    const result = await pool.query(
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

export async function GET() {
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
    console.error('[Metrics] Error generating metrics:', err);
    return new NextResponse('# Error generating metrics\n', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
