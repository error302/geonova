/**
 * API: GET /api/osm/status
 *
 * Check if the OSM Python worker is running and the PBF file is loaded.
 */

import { NextResponse } from 'next/server'

const PYTHON_WORKER_URL = process.env.PYTHON_WORKER_URL || 'http://localhost:8001'
const WORKER_SECRET = process.env.WORKER_SECRET || ''  // P0-5: fail-closed, no dev fallback

export async function GET() {
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

    const data = await res.json()
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
      setup_instructions: 'Start the Python worker: cd python_worker && pip install -r requirements.txt && uvicorn main:app --port 8001',
    })
  }
}
