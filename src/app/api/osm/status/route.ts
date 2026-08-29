/**
 * API: GET /api/osm/status
 *
 * Check if the OSM Python worker is running and the PBF file is loaded.
 *
 * SECURITY (audit H-12, 2026-08-30): now requires an authenticated session.
 * Previously anonymous callers could probe worker state and received
 * infrastructure setup instructions.
 */

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'

const PYTHON_WORKER_URL = process.env.PYTHON_WORKER_URL || 'http://localhost:8001'
const WORKER_SECRET = process.env.WORKER_SECRET || ''  // P0-5: fail-closed, no dev fallback

export const GET = apiHandler(
  { auth: true, rateLimit: { max: 30, windowMs: 60000 } },
  async () => {
    try {
      const res = await fetch(`${PYTHON_WORKER_URL}/osm/status`, {
        headers: { 'X-Worker-Secret': WORKER_SECRET },
      })

      if (!res.ok) {
        return NextResponse.json({
          worker_running: false,
          pyrosm_installed: false,
          pbf_file_found: false,
          pbf_loaded: false,
        })
      }

      const data = await res.json() as unknown as Record<string, unknown>
      return NextResponse.json({
        worker_running: true,
        ...data,
      })
    } catch {
      return NextResponse.json({
        worker_running: false,
        pyrosm_installed: false,
        pbf_file_found: false,
        pbf_loaded: false,
      })
    }
  }
)
