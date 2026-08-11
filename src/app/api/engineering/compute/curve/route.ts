export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { horizontalCurve } from '@/lib/engineering/compute'

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

/** Enhanced schema supporting multiple curve types */
const CurveComputeSchema = z.discriminatedUnion('curveType', [
  z.object({
    curveType: z.literal('horizontal'),
    R: z.number().positive().max(2000),
    deltaDeg: z.number().positive().max(180),
    chainageStart: z.number().min(0).default(0),
    designSpeed: z.number().positive().optional(),
  }),
  z.object({
    curveType: z.literal('vertical'),
    R: z.number().positive(),
    chainageStart: z.number().min(0).default(0),
    designSpeed: z.number().positive(),
    g1: z.number(),  // initial gradient (%)
    g2: z.number(),  // final gradient (%)
  }),
  z.object({
    curveType: z.literal('transition'),
    R: z.number().positive().max(2000),
    deltaDeg: z.number().positive().max(180),
    chainageStart: z.number().min(0).default(0),
    designSpeed: z.number().positive(),
    transitionLength: z.number().positive().optional(),
  }),
])

/** Legacy schema for backward compatibility (no curveType field) */
const LegacyCurveComputeSchema = z.object({
  R: z.number().positive().max(2000),
  deltaDeg: z.number().positive().max(180),
  chainageStart: z.number().min(0).default(0),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body: unknown = await req.json()

    // Try new schema first, fall back to legacy
    let input: z.infer<typeof CurveComputeSchema> | z.infer<typeof LegacyCurveComputeSchema>
    const newParsed = CurveComputeSchema.safeParse(body)
    if (newParsed.success) {
      input = newParsed.data
    } else {
      const legacyParsed = LegacyCurveComputeSchema.safeParse(body)
      if (!legacyParsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: [...newParsed.error.errors, ...legacyParsed.error.errors] },
          { status: 400 }
        )
      }
      input = legacyParsed.data
    }

    // For horizontal curve (new or legacy), use the existing horizontalCurve function
    if (!('curveType' in input) || input.curveType === 'horizontal') {
      const result = horizontalCurve(input)
      return NextResponse.json(result)
    }

    // For vertical and transition curves, return computed values
    if (input.curveType === 'vertical') {
      const { R, g1, g2, designSpeed, chainageStart } = input
      const A = g2 - g1 // algebraic difference in grades
      const L = Math.abs(A) * R / 100 // curve length
      const K = R / 100 // rate of vertical curvature
      const elevationPC = 0 // assumed
      const elevationPI = elevationPC + (g1 / 100) * (L / 2)
      const elevationPT = elevationPI + (g2 / 100) * (L / 2)

      return NextResponse.json({
        curveType: 'vertical',
        R,
        designSpeed,
        g1,
        g2,
        A,
        L,
        K,
        chainageStart,
        chainagePI: chainageStart + L / 2,
        chainagePC: chainageStart,
        chainagePT: chainageStart + L,
        elevationPC,
        elevationPI,
        elevationPT,
      })
    }

    if (input.curveType === 'transition') {
      const { R, deltaDeg, designSpeed, chainageStart, transitionLength } = input
      const deltaRad = (deltaDeg * Math.PI) / 180
      // Spiral length defaults
      const Ls = transitionLength ?? Math.max(R * 0.1, 20)
      // Shift
      const shift = (Ls * Ls) / (24 * R)
      // Tangent length
      const T = (R + shift) * Math.tan(deltaRad / 2) + Ls / 2
      // Curve length
      const Lc = R * deltaRad - Ls
      // Total curve length
      const Ltotal = Lc + 2 * Ls

      return NextResponse.json({
        curveType: 'transition',
        R,
        deltaDeg,
        designSpeed,
        chainageStart,
        transitionLength: Ls,
        shift,
        tangentLength: T,
        curveLength: Lc,
        totalLength: Ltotal,
        chainageTS: chainageStart,
        chainageSC: chainageStart + Ls,
        chainageCS: chainageStart + Ls + Lc,
        chainageST: chainageStart + Ltotal,
      })
    }

    return NextResponse.json({ error: 'Unknown curve type' }, { status: 400 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 })
    }
    logger.error('Curve compute error:', { error })
    return NextResponse.json({ error: 'Computation failed' }, { status: 500 })
  }
}
