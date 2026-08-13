export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { crossSectionCutFill, prismoidalVolume } from '@/lib/engine/engineering'

export const POST = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (req, ctx) => {
  const { crossSections, designElevations } = ctx.body as {
    crossSections: { chainage: number; levels: Array<{ offset: number; elevation: number }> }[]
    designElevations: number[]
  }

  if (!crossSections || !designElevations) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (crossSections.length !== designElevations.length) {
    return NextResponse.json({ error: 'crossSections and designElevations must have the same length' }, { status: 400 })
  }

  const sections = crossSections.map((cs, i) => {
    const { cutArea, fillArea } = crossSectionCutFill(designElevations[i], cs.levels)
    return { ...cs, cutArea, fillArea }
  })

  let totalCut = 0
  let totalFill = 0

  for (let i = 1; i < sections.length; i++) {
    const dist = sections[i].chainage - sections[i - 1].chainage
    totalCut += prismoidalVolume(sections[i - 1].cutArea, sections[i].cutArea, dist)
    totalFill += prismoidalVolume(sections[i - 1].fillArea, sections[i].fillArea, dist)
  }

  return NextResponse.json({
    sections,
    totalCutM3: totalCut,
    totalFillM3: totalFill,
    netM3: totalCut - totalFill
  })
})
