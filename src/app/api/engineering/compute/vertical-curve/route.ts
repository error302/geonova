export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { computeVerticalCurve } from '@/lib/engine/engineering'

export const POST = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (req, ctx) => {
  const { pvIChainage, pvIElevation, gradeIn, gradeOut, length } = ctx.body as {
    pvIChainage: number
    pvIElevation: number
    gradeIn: number
    gradeOut: number
    length: number
  }

  if (pvIChainage === undefined || pvIElevation === undefined || gradeIn === undefined || gradeOut === undefined || length === undefined) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const result = computeVerticalCurve(pvIChainage, pvIElevation, gradeIn, gradeOut, length)

  return NextResponse.json(result)
})
