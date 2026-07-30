/**
 * License Application Portfolio Generator
 *
 * Generates a portfolio package for Kenya Land Surveyors' Board license
 * application. Based on the official "Requirements for Land Survey License
 * Application" (effective March 2025) from the uploaded PDF.
 *
 * Requirements from the PDF:
 *   1. SCHEME CADASTRAL SURVEY — min 10 plots in 1-3 schemes
 *   2. TOPOGRAPHICAL SURVEY — 2-10 ha depending on density
 *   3. CONTROL SURVEY — GNSS (3 pts in 20km²) or theodolite (4+ pts)
 *   4. ELECTIVE (one of):
 *      a. Sectional Property — 30+ units
 *      b. Perimeter/Farm Survey — 4-5 ha, georeferenced
 *      c. Earth Observation & Remote Sensing — 20 ha
 *      d. Setting Out — 1km linear or 0.1 ha buildings
 *
 * The generator checks the user's projects against these requirements,
 * identifies gaps, and generates the declaration forms (Form A, Form B).
 */

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PortfolioRequirement {
  id: string
  category: string
  description: string
  minimumRequired: string
  userHas: string
  met: boolean
  projects: Array<{
    id: string
    name: string
    survey_type: string
    created_at: string
    details: string
  }>
}

export interface PortfolioReport {
  requirements: PortfolioRequirement[]
  electives: PortfolioRequirement[]
  allMandatoryMet: boolean
  atLeastOneElectiveMet: boolean
  summary: string
  missingItems: string[]
  declarationFormA: string
  declarationFormB: string
  timestamp: string
}

// ─── API ────────────────────────────────────────────────────────────────────

export const GET = apiHandler(
  { auth: true, rateLimit: { max: 10, windowMs: 60000 } },
  async (_req, ctx) => {
    const userId = ctx.userId!

    // Fetch the user's projects grouped by survey type
    const { rows: projects } = await db.query(
      `SELECT id, name, survey_type, location, area_ha, created_at,
              (SELECT COUNT(*) FROM survey_points WHERE project_id = projects.id AND is_control = true) as control_point_count,
              (SELECT COUNT(*) FROM deed_plans WHERE project_id = projects.id) as deed_plan_count,
              (SELECT COUNT(*) FROM parcels WHERE project_id = projects.id) as parcel_count
       FROM projects
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    )

    // Get user profile for declaration forms
    const { rows: profile } = await db.query(
      `SELECT u.email, u.full_name, sp.firm_name, sp.license_number
       FROM users u
       LEFT JOIN surveyor_profiles sp ON sp.user_id = u.id
       WHERE u.id = $1`,
      [userId],
    )

    const user = profile[0] || { email: '', full_name: 'Unknown', firm_name: '', license_number: '' }

    // ─── Check each requirement ───

    // 1. Scheme Cadastral: min 10 plots in 1-3 schemes
    const cadastralProjects = projects.filter((p: any) =>
      p.survey_type === 'cadastral' || p.survey_type === 'Cadastral'
    )
    const totalParcels = cadastralProjects.reduce((sum: number, p: any) => sum + parseInt(p.parcel_count || '0', 10), 0)
    const cadastralReq: PortfolioRequirement = {
      id: 'cadastral',
      category: 'Scheme Cadastral Survey',
      description: 'A minimum of 10 plots either in one scheme or at most in 3 schemes based on newly established control(s).',
      minimumRequired: '≥ 10 plots in 1-3 schemes',
      userHas: `${totalParcels} plots in ${cadastralProjects.length} scheme(s)`,
      met: totalParcels >= 10 && cadastralProjects.length <= 3 && cadastralProjects.length >= 1,
      projects: cadastralProjects.map((p: any) => ({
        id: p.id, name: p.name, survey_type: p.survey_type,
        created_at: p.created_at,
        details: `${p.parcel_count || 0} plots`,
      })),
    }

    // 2. Topographical: 2-10 ha depending on density
    const topoProjects = projects.filter((p: any) =>
      p.survey_type === 'topographic' || p.survey_type === 'Topographic'
    )
    const totalTopoArea = topoProjects.reduce((sum: number, p: any) => sum + (p.area_ha || 0), 0)
    const topoReq: PortfolioRequirement = {
      id: 'topographic',
      category: 'Topographical Survey',
      description: 'a) 2 ha (high density, 60%+ coverage), b) 4 ha (medium, 40-60%), or c) 10 ha (low density, 20%+).',
      minimumRequired: '≥ 2 ha (high density) / 4 ha (medium) / 10 ha (low)',
      userHas: `${totalTopoArea.toFixed(2)} ha in ${topoProjects.length} survey(s)`,
      met: totalTopoArea >= 2 && topoProjects.length >= 1,
      projects: topoProjects.map((p: any) => ({
        id: p.id, name: p.name, survey_type: p.survey_type,
        created_at: p.created_at,
        details: `${(p.area_ha || 0).toFixed(2)} ha`,
      })),
    }

    // 3. Control Survey: GNSS (3 pts in 20km²) or theodolite (4+ pts)
    const controlProjects = projects.filter((p: any) =>
      p.survey_type === 'control' || p.survey_type === 'Control' ||
      parseInt(p.control_point_count || '0', 10) >= 3
    )
    const totalControlPoints = controlProjects.reduce((sum: number, p: any) => sum + parseInt(p.control_point_count || '0', 10), 0)
    const controlReq: PortfolioRequirement = {
      id: 'control',
      category: 'Control Survey',
      description: 'a) GNSS: at least 3 points within ~20km² by static mode, OR b) Theodolite/TS: at least 4 points established.',
      minimumRequired: '≥ 3 GNSS points (20km²) OR ≥ 4 theodolite points',
      userHas: `${totalControlPoints} control points in ${controlProjects.length} survey(s)`,
      met: totalControlPoints >= 3 && controlProjects.length >= 1,
      projects: controlProjects.map((p: any) => ({
        id: p.id, name: p.name, survey_type: p.survey_type,
        created_at: p.created_at,
        details: `${p.control_point_count || 0} control points`,
      })),
    }

    // 4. Electives (select one)
    const sectionalProjects = projects.filter((p: any) => p.survey_type === 'sectional')
    const perimeterProjects = projects.filter((p: any) => p.survey_type === 'perimeter' || (p.area_ha >= 4 && p.survey_type === 'cadastral'))
    const settingOutProjects = projects.filter((p: any) => p.survey_type === 'engineering' || p.survey_type === 'construction')

    const electives: PortfolioRequirement[] = [
      {
        id: 'sectional',
        category: 'Sectional Property Survey',
        description: 'A project consisting of at least 30 units.',
        minimumRequired: '≥ 30 units',
        userHas: `${sectionalProjects.length} project(s)`,
        met: false, // Would need unit count from sectional_properties table
        projects: [],
      },
      {
        id: 'perimeter',
        category: 'Perimeter (Farm) Survey',
        description: 'New perimeter survey beacons of a new parcel. Minimum 4 ha (production) or 5 ha (supervised). Must be georeferenced.',
        minimumRequired: '≥ 4 ha, georeferenced',
        userHas: `${perimeterProjects.length} project(s), ${(perimeterProjects.reduce((s: number, p: any) => s + (p.area_ha || 0), 0)).toFixed(2)} ha`,
        met: perimeterProjects.length >= 1 && perimeterProjects.reduce((s: number, p: any) => s + (p.area_ha || 0), 0) >= 4,
        projects: perimeterProjects.map((p: any) => ({
          id: p.id, name: p.name, survey_type: p.survey_type, created_at: p.created_at,
          details: `${(p.area_ha || 0).toFixed(2)} ha`,
        })),
      },
      {
        id: 'setting_out',
        category: 'Setting Out Works',
        description: 'Setting out of not less than 1km (linear) or 0.1 ha (buildings).',
        minimumRequired: '≥ 1km linear OR ≥ 0.1 ha buildings',
        userHas: `${settingOutProjects.length} project(s)`,
        met: settingOutProjects.length >= 1,
        projects: settingOutProjects.map((p: any) => ({
          id: p.id, name: p.name, survey_type: p.survey_type, created_at: p.created_at,
          details: p.location || '',
        })),
      },
    ]

    // ─── Summary ───
    const mandatoryReqs = [cadastralReq, topoReq, controlReq]
    const allMandatoryMet = mandatoryReqs.every(r => r.met)
    const atLeastOneElectiveMet = electives.some(e => e.met)

    const missingItems: string[] = []
    if (!cadastralReq.met) missingItems.push(`Cadastral: need ≥10 plots in 1-3 schemes (have ${totalParcels})`)
    if (!topoReq.met) missingItems.push(`Topographic: need ≥2 ha (have ${totalTopoArea.toFixed(2)} ha)`)
    if (!controlReq.met) missingItems.push(`Control: need ≥3 GNSS or ≥4 theodolite points (have ${totalControlPoints})`)
    if (!atLeastOneElectiveMet) missingItems.push('Elective: need at least one of: Sectional (30 units), Perimeter (4 ha), Setting Out (1km/0.1 ha)')

    let summary: string
    if (allMandatoryMet && atLeastOneElectiveMet) {
      summary = 'Portfolio meets ALL requirements for Land Survey License application. Ready to generate declaration forms.'
    } else {
      summary = `Portfolio is INCOMPLETE. ${missingItems.length} requirement(s) not met: ${missingItems.join('; ')}.`
    }

    // ─── Declaration Forms ───
    const declarationFormA = generateFormA(user, projects)
    const declarationFormB = generateFormB(user)

    const report: PortfolioReport = {
      requirements: mandatoryReqs,
      electives,
      allMandatoryMet,
      atLeastOneElectiveMet,
      summary,
      missingItems,
      declarationFormA,
      declarationFormB,
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json({ data: report })
  },
)

// ─── Form Generators ────────────────────────────────────────────────────────

/**
 * Generate Form A (Declaration of employment/supervision) per Third Schedule.
 */
function generateFormA(user: any, projects: any[]): string {
  const surveyorName = user.full_name || '___________________________'
  const firmName = user.firm_name || '___________________________'
  const licenseNumber = user.license_number || '___________________________'

  return `FORM A (rr. 13, 14)
THIRD SCHEDULE — DECLARATION

I, ${surveyorName}, solemnly and sincerely declare that the candidate
___________________________ has served regularly and faithfully with
${firmName} as a student surveyor/surveyor for a period of
____ years and ____ months from ____________ to ____________.

The nature of this employment during the period specified is as follows:

SUMMARY OF EMPLOYMENT:
${projects.slice(0, 10).map((p, i) => `${i + 1}. ${p.name} (${p.survey_type}) — ${p.location || 'Kenya'}`).join('\n')}

Declared at ___________________________ this ______ day of ________________, 20____

Signature: ___________________________
Name: ${surveyorName}
License No: ${licenseNumber}

NOTE: This form must be signed by the Principal/Licensed Surveyor who supervised
the candidate's work. The Director of Surveys may verify any of the declared work.`
}

/**
 * Generate Form B (Declaration of qualifications) per Third Schedule.
 */
function generateFormB(user: any): string {
  const surveyorName = user.full_name || '___________________________'

  return `FORM B (r. 14)
THIRD SCHEDULE — DECLARATION

I, ${surveyorName}, of ___________________________ solemnly and sincerely
declare that I am a graduate of the University of ___________________________
and I have taken a degree in ___________________________ and that I have pursued
the courses of study and have had practical experience in land surveying as set
out in the summary below.

SUMMARY:
Course(s) of study at ___________________________ from ___________________________
to ___________________________

Period of practical experience at ___________________________
From ___________________________ to ___________________________

Declared at ___________________________
this ______ day of ________________, 20____

Signature: ___________________________
Name: ${surveyorName}`
}
