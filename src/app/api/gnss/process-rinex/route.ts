export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { callPythonCompute } from '@/lib/compute/pythonService'
import { z } from 'zod'

/**
 * POST /api/gnss/process-rinex — single-station RINEX processing (SPP).
 *
 * REVIVED 2026-08-31 (audit C9 "make it work"): this endpoint is backed by
 * the compute worker's real SPP engine (python_worker/gnss_processor.py) —
 * RINEX 2/3 parsing, IS-GPS-200 broadcast ephemeris or IGS SP3 precise
 * orbits/clocks, multi-epoch weighted least squares, honest SPP/SPP-IF/
 * SPP-SP3 labelling with accuracy statements. It is NOT PPP (carrier-phase
 * ambiguities are not estimated) and never claims to be.
 *
 * When no navigation file is uploaded, the worker auto-downloads the daily
 * broadcast ephemeris (BKG IGS mirror); `use_precise_ephemeris` switches to
 * IGS SP3 (NOAA CORS mirror). All failures return actionable errors —
 * nothing is fabricated.
 */

const schema = z.object({
  rinex_obs: z.string(), // base64-encoded RINEX observation file
  rinex_nav: z.string().optional(),
  use_precise_ephemeris: z.boolean().default(false),
  station_name: z.string().default('unknown'),
})

export const POST = apiHandler(
  { auth: true, schema, rateLimit: { max: 5, windowMs: 60000 } },
  async (_req, ctx) => {
    const body = ctx.body as z.infer<typeof schema>
    // RINEX files are multi-megabyte; ephemeris download + multi-epoch WLS
    // can take a while — allow up to 5 minutes.
    const result = await callPythonCompute('gnss_process_rinex', body, {
      timeoutMs: 300_000,
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || 'GNSS processing failed' },
        { status: result.status },
      )
    }

    return NextResponse.json({ data: result.value })
  },
)
