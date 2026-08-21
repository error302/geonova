import type { DeedPlanInput, BoundaryLeg, ClosureCheck } from '@/types/deedPlan'
import type { SurveyPlanData, PlanOptions, MonumentType } from './types'
import { SurveyPlanRenderer } from './renderer'
import { DEED_PLAN_OUTPUT_TYPES, type DeedPlanOutputType } from './outputTypes'

/**
 * Bridge between the legacy A1 deed-plan renderer input and the professional
 * A3 landscape SurveyPlanRenderer.
 *
 * The deed-plan product (DeedPlanGenerator + /api/deed-plan/generate) used to
 * produce an A1 (841x594) SVG. This module builds the richer SurveyPlanData
 * consumed by SurveyPlanRenderer so the same cadastral information renders in
 * the professional A3 two-column layout (drawing 73% / info panel 27%).
 *
 * The mapping intentionally keeps the renderer as the single source of layout
 * truth — this file only translates field names/types.
 */

/** Map a deed-plan beacon type/status to a survey-plan monument symbol. */
export function deedPlanMarkToMonument(
  markType: string | undefined,
  markStatus: string | undefined,
): MonumentType {
  const found = (markStatus || '').toUpperCase() === 'FOUND'
  const t = (markType || '').toUpperCase()
  if (found) return 'found'
  switch (t) {
    case 'MASONRY_NAIL':
      return 'masonry_nail'
    case 'IRON_PIN':
      return 'iron_pin'
    case 'INDICATORY':
      return 'indicatory_beacon'
    default:
      return 'set'
  }
}

export interface BuildDeedPlanDataOptions {
  area?: number
  closureCheck?: ClosureCheck
  bearingSchedule?: BoundaryLeg[]
  /** plan_title to stamp; defaults to DEED PLAN DRAFT. */
  planTitle?: string
}

/** Translate a DeedPlanInput into SurveyPlanData for the professional renderer. */
export function buildSurveyPlanDataFromDeedPlan(
  input: DeedPlanInput,
  opts: BuildDeedPlanDataOptions = {},
): SurveyPlanData {
  const boundaryPoints = input.boundaryPoints.map((p) => ({
    name: p.id,
    easting: p.easting,
    northing: p.northing,
  }))

  const schedule = (opts.bearingSchedule || []).map((leg) => ({
    from: leg.fromPoint,
    to: leg.toPoint,
    bearing: leg.bearing,
    distance: leg.distance,
  }))

  return {
    project: {
      name: input.firmName || 'DEED PLAN',
      location: input.locality || input.county || '',
      municipality: input.registrationSection || input.county || undefined,
      utm_zone: input.utmZone,
      hemisphere: input.hemisphere,
      datum: input.datum,
      client_name: input.clientName,
      surveyor_name: input.surveyorName,
      surveyor_licence: input.iskNumber.replace(/^ISK[-_]/i, ''),
      firm_name: input.firmName,
      firm_address: input.firmAddress,
      drawing_no: input.drawingNumber,
      reference: input.surveyNumber,
      plan_title: opts.planTitle || 'DEED PLAN DRAFT',
      area_sqm: opts.area ?? input.area,
      area_ha: (opts.area ?? input.area) / 10000,
      parcel_id: input.parcelNumber,
      lrNumber: input.parcelNumber,
      plotParcelNumber: input.parcelNumber,
      registrationDistrict: input.registrationSection,
      locality: input.locality,
      firNumber: input.firNumber,
      scale: String(input.scale || 1000),
      bearingSchedule: schedule.length > 0 ? schedule : undefined,
      sheetNo: input.sheetNumber ? String(input.sheetNumber) : undefined,
      totalSheets: input.totalSheets ? String(input.totalSheets) : undefined,
      // Abuttals (kept from the legacy deed-plan form so the data is not lost).
      abuttalNorth: input.abuttalNorth,
      abuttalSouth: input.abuttalSouth,
      abuttalEast: input.abuttalEast,
      abuttalWest: input.abuttalWest,
      revisions: [
        {
          rev: 'A',
          date: input.surveyDate || new Date().toISOString().slice(0, 10),
          description: 'Initial issue',
          by: input.drawnBy || input.surveyorName || '',
        },
      ],
    },
    parcel: {
      boundaryPoints,
      area_sqm: opts.area ?? input.area,
      perimeter_m: opts.closureCheck?.perimeter ?? 0,
    },
    traverse: opts.closureCheck
      ? {
          linearError: Math.sqrt(
            opts.closureCheck.closingErrorE ** 2 + opts.closureCheck.closingErrorN ** 2,
          ),
        }
      : undefined,
    controlPoints: input.boundaryPoints.map((p) => ({
      name: p.id,
      easting: p.easting,
      northing: p.northing,
      elevation: p.elevation,
      monumentType: deedPlanMarkToMonument(p.markType, p.markStatus),
      beaconDescription: p.description,
    })),
  }
}

export interface RenderDeedPlanOptions {
  outputType?: DeedPlanOutputType
  area?: number
  paperSize?: PlanOptions['paperSize']
  includeGrid?: boolean
  includePanel?: boolean
  watermarkPlan?: PlanOptions['watermarkPlan']
}

/** Render the professional A3 deed-plan SVG for a DeedPlanInput. */
export function renderDeedPlanDraftSVG(
  input: DeedPlanInput,
  bearingSchedule: BoundaryLeg[],
  closureCheck: ClosureCheck,
  options: RenderDeedPlanOptions = {},
): string {
  const type = DEED_PLAN_OUTPUT_TYPES.find((t) => t.id === (options.outputType ?? 'deed'))
  const data = buildSurveyPlanDataFromDeedPlan(input, {
    area: options.area,
    closureCheck,
    bearingSchedule,
    planTitle: type?.title,
  })
  const renderer = new SurveyPlanRenderer(data, {
    paperSize: options.paperSize ?? 'a3',
    scale: input.scale || 0,
    includeGrid: options.includeGrid ?? true,
    includePanel: options.includePanel ?? true,
    watermarkPlan: options.watermarkPlan ?? 'free',
  })
  return renderer.render()
}