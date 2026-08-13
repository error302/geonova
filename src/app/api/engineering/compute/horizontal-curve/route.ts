export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { computeHorizontalCurve } from '@/lib/engine/engineering'

export const POST = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (req, ctx) => {
  const { radius, delta, piChainage } = ctx.body as {
    radius: number
    delta: number
    piChainage: number
  }

  if (radius === undefined || delta === undefined || piChainage === undefined) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const result = computeHorizontalCurve(radius, delta, piChainage)

  return NextResponse.json(result)
})
