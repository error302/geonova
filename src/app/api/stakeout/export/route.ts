export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { exportStakeout, getAvailableFormats, type InstrumentFormat } from '@/lib/survey/instrumentWriters'
import type { SettingOutResult } from '@/lib/computations/settingOutEngine'
import { z } from 'zod'

const schema = z.object({
  settingOutResult: z.custom<SettingOutResult>((val) => val && typeof val === 'object'),
  format: z.enum(['CSV', 'GSI-8', 'GSI-16', 'SDR', 'JobXML']),
  stationName: z.string().optional(),
})

export const POST = apiHandler(
  { auth: true, schema, rateLimit: { max: 30, windowMs: 60000 } },
  async (_req, ctx) => {
    const body = ctx.body as z.infer<typeof schema>
    const result = exportStakeout(body.settingOutResult, body.format as InstrumentFormat, {
      stationName: body.stationName,
    })
    return NextResponse.json(result)
  },
)

export const GET = apiHandler(
  { auth: true },
  async () => {
    return NextResponse.json({ formats: getAvailableFormats() })
  },
)
