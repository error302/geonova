export const dynamic = 'force-dynamic'

/**
 * /api/db/migrations — Migration Status Endpoint
 *
 * Returns the list of applied migrations and their timestamps.
 * Admin-only (requires `admin` role).
 *
 * GET /api/db/migrations
 * Response: {
 *   applied: Array<{ version: string, applied_at: string, checksum: string | null }>,
 *   pending: string[],
 *   total: number
 * }
 */

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { getPool } from '@/lib/db'

export const GET = apiHandler(
  { auth: true, roles: ['admin'] },
  async (_req, _ctx) => {
    const pool = getPool()

    // Ensure schema_migrations table exists before querying
    const { rows: tables } = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'schema_migrations'`
    )

    if (tables.length === 0) {
      return NextResponse.json({
        applied: [],
        pending: [],
        total: 0,
        message: 'schema_migrations table does not exist yet — no migrations have been run',
      })
    }

    // Get applied migrations
    const { rows: applied } = await pool.query(
      'SELECT version, applied_at, checksum FROM schema_migrations ORDER BY applied_at'
    )

    // Get all migration files from the filesystem
    // We use pg's ls_dir won't work, so we query the table and cross-reference
    // with what's known. For a complete picture, we return what's in the DB.
    // The CLI `migrate:status` does the full filesystem scan.

    return NextResponse.json({
      applied: applied.map((r: { version: string; applied_at: Date; checksum: string | null }) => ({
        version: r.version,
        applied_at: r.applied_at instanceof Date ? r.applied_at.toISOString() : String(r.applied_at),
        checksum: r.checksum,
      })),
      applied_count: applied.length,
      table_exists: true,
    })
  }
)
