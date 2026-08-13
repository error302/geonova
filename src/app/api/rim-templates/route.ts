import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { RIM_TEMPLATES, getTemplatesByCategory, searchTemplates, getTemplateCategories, createSectionFromTemplate } from '@/lib/rim'

export const dynamic = 'force-dynamic'

export const GET = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (request, _ctx) => {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const search = searchParams.get('search')
  const categories = searchParams.get('categories') === 'true'

  if (categories) {
    return NextResponse.json({ success: true, data: getTemplateCategories() })
  }

  if (category) {
    return NextResponse.json({ success: true, data: getTemplatesByCategory(category) })
  }

  if (search) {
    return NextResponse.json({ success: true, data: searchTemplates(search) })
  }

  // Return all templates
  const templates = RIM_TEMPLATES.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    tags: t.tags,
    defaults: t.defaults,
    parcelCount: t.sampleParcels.length,
    beaconCount: t.sampleBeacons.length,
    regulationReference: t.regulationReference,
  }))

  return NextResponse.json({ success: true, data: templates })
})

export const POST = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (req, ctx) => {
  const { templateId, customizations } = ctx.body as { templateId?: string; customizations?: Record<string, unknown> }

  if (!templateId) {
    return NextResponse.json({ error: 'Missing templateId.' }, { status: 400 })
  }

  const result = createSectionFromTemplate(templateId, customizations || {})
  return NextResponse.json({ success: true, data: result })
})
