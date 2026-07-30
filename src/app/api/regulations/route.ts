export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import {
  APPROVED_INSTRUMENTS,
  checkInstrumentApproval,
  checkFieldNoteCompliance,
  selectStandardScale,
  getAreaPrecision,
  formatAreaForPlan,
  generateSurveyorCertificate,
  ELECTIVE_SURVEY_TYPES,
  getElectiveSurveyType,
  checkElectiveRequirement,
  STANDARD_SCALES,
} from '@/lib/survey/surveyRegulationsExtended'
import { z } from 'zod'

export const GET = apiHandler(
  { auth: true },
  async (req) => {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')

    if (action === 'instruments') return NextResponse.json({ data: APPROVED_INSTRUMENTS })
    if (action === 'scales') return NextResponse.json({ data: STANDARD_SCALES })
    if (action === 'electives') return NextResponse.json({ data: ELECTIVE_SURVEY_TYPES })

    return NextResponse.json({
      data: { instruments: APPROVED_INSTRUMENTS, standardScales: STANDARD_SCALES, electives: ELECTIVE_SURVEY_TYPES },
    })
  },
)

const checkSchema = z.object({
  check_type: z.enum(['instrument', 'field_notes', 'scale', 'area', 'certificate', 'elective']),
  brand: z.string().optional(), model: z.string().optional(), requiredOrder: z.string().optional(),
  observations: z.array(z.object({
    station: z.string(), bs: z.string().optional(), fs: z.string().optional(),
    angle: z.string().optional(), distance: z.string().optional(),
    erased: z.boolean().optional(), corrected: z.boolean().optional(),
  })).optional(),
  hasPageNumbers: z.boolean().optional(), hasIndex: z.boolean().optional(),
  beaconNomenclature: z.boolean().optional(), topographicFeatures: z.boolean().optional(),
  areaHa: z.number().optional(),
  subdivisions: z.array(z.object({ name: z.string(), areaHa: z.number() })).optional(),
  surveyorName: z.string().optional(), surveyorLicense: z.string().optional(),
  surveyDate: z.string().optional(), surveyType: z.string().optional(),
  locality: z.string().optional(), scale: z.string().optional(),
  electiveId: z.string().optional(), unitCount: z.number().optional(), linearLengthKm: z.number().optional(),
})

export const POST = apiHandler(
  { auth: true, schema: checkSchema, rateLimit: { max: 30, windowMs: 60000 } },
  async (_req, ctx) => {
    const body = ctx.body as z.infer<typeof checkSchema>

    switch (body.check_type) {
      case 'instrument':
        if (!body.brand || !body.model || !body.requiredOrder)
          return NextResponse.json({ error: 'brand, model, requiredOrder required' }, { status: 400 })
        return NextResponse.json({ data: checkInstrumentApproval(body.brand, body.model, body.requiredOrder) })

      case 'field_notes':
        return NextResponse.json({
          data: checkFieldNoteCompliance({
            observations: body.observations || [],
            hasPageNumbers: body.hasPageNumbers, hasIndex: body.hasIndex,
            beaconNomenclature: body.beaconNomenclature, topographicFeatures: body.topographicFeatures,
          }),
        })

      case 'scale':
        if (body.areaHa === undefined) return NextResponse.json({ error: 'areaHa required' }, { status: 400 })
        return NextResponse.json({ data: selectStandardScale(body.areaHa) })

      case 'area':
        if (body.areaHa === undefined) return NextResponse.json({ error: 'areaHa required' }, { status: 400 })
        const precision = getAreaPrecision(body.areaHa)
        const formatted = body.subdivisions ? formatAreaForPlan(body.areaHa, body.subdivisions) : `${precision.formatted} ha`
        return NextResponse.json({ data: { ...precision, formatted } })

      case 'certificate':
        if (!body.surveyorName || !body.surveyorLicense)
          return NextResponse.json({ error: 'surveyorName, surveyorLicense required' }, { status: 400 })
        return NextResponse.json({ data: generateSurveyorCertificate({
          surveyorName: body.surveyorName, surveyorLicense: body.surveyorLicense,
          surveyDate: body.surveyDate || new Date().toISOString().split('T')[0],
          surveyType: body.surveyType || 'cadastral', locality: body.locality || 'Kenya',
          areaHa: body.areaHa || 0, scale: body.scale || '1:1250',
        }) })

      case 'elective':
        if (!body.electiveId) return NextResponse.json({ error: 'electiveId required' }, { status: 400 })
        return NextResponse.json({ data: {
          elective: getElectiveSurveyType(body.electiveId),
          check: checkElectiveRequirement(body.electiveId, {
            areaHa: body.areaHa, unitCount: body.unitCount, linearLengthKm: body.linearLengthKm,
          }),
        }})

      default: return NextResponse.json({ error: 'Invalid check_type' }, { status: 400 })
    }
  },
)
