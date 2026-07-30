export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { callPythonCompute } from '@/lib/compute/pythonService'
import { z } from 'zod'

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
    const result = await callPythonCompute('gnss_process_rinex', body)

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || 'GNSS processing failed', fallback: result.fallback },
        { status: 502 },
      )
    }

    return NextResponse.json({ data: result.value })
  },
)
