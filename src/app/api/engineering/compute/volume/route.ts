export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { auth } from '@/lib/auth-v5'
import { z } from 'zod'
import { crossSectionVolume } from '@/lib/engineering/compute'

const VolumeComputeSchema = z.object({
  areas: z.array(z.number()).min(2),
  stationInterval: z.number().positive().max(100).default(20),
  method: z.enum(['prismoidal', 'end-area']).default('prismoidal'),
})

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body: unknown = await req.json()
    const input = VolumeComputeSchema.parse(body)
    
    const result = crossSectionVolume(input)
    
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 })
    }
    logger.error('Volume compute error:', { error })
    return NextResponse.json({ error: 'Computation failed' }, { status: 500 })
  }
}
