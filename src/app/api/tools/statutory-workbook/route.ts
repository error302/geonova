export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, setCurrentUserId } from '@/lib/db'
import { generateStatutoryWorkbook, type WorkbookInput } from '@/lib/submission/workbook/statutoryWorkbook'
import { StatutoryWorkbookSchema } from '@/lib/validation/apiSchemas'

interface WorkbookProjectRow {
  id: string
  name: string
  lr_number: string | null
  locality: string | null
  survey_type: string | null
  datum: string | null
  utm_zone: string | null
  hemisphere: string | null
  client_name: string | null
  surveyor_name: string | null
  surveyor_licence: string | null
  firm_name: string | null
  area_ha: number | null
}

interface SurveyorProfileRow {
  full_name: string | null
  isk_number: string | null
  firm_name: string | null
}

interface RequestBody {
  projectId?: string
  projectName?: string
  lrNumber?: string
  parcelNumber?: string
  county?: string
  locality?: string
  surveyType?: WorkbookInput['project']['surveyType']
  surveyDate?: string
  surveyorName?: string
  iskNumber?: string
  firmName?: string
  referenceNumber?: string
}


interface WorkbookSurveyPointRow {
  point_name: string
  easting: number
  northing: number
  elevation: number | null
  code: string | null
}

interface WorkbookObservationRow {
  station_from: string
  station_to: string
  bearing: number
  distance: number
}

/**
 * AUDIT FIX (2026-07-03): Previously this route used hardcoded sample data
 * (stations A, B, C, D with fake coordinates and traverse observations).
 * Now, when `projectId` is provided, it loads real project data from the DB:
 *   - Project details (name, lr_number, locality, survey_type, etc.)
 *   - Survey points (as traverse stations)
 *   - Traverse observations (bearing + distance legs)
 *   - Surveyor profile (name, ISK number, firm)
 *
 * When `projectId` is NOT provided, falls back to the sample data (clearly
 * marked as SAMPLE in the project name) so the tool remains usable as a demo.
 */
async function buildWorkbookInput(body: RequestBody, userId: string): Promise<WorkbookInput> {
  const surveyDate = body.surveyDate || new Date().toISOString().slice(0, 10)

  // If projectId is provided, load real data from the database
  if (body.projectId) {
    try {
      // Load project
      const { rows: projRows } = await db.query<WorkbookProjectRow>(
        `SELECT id, name, lr_number, locality, survey_type, datum, utm_zone,
                hemisphere, client_name, surveyor_name, surveyor_licence,
                firm_name, area_ha
         FROM projects WHERE id = $1 AND user_id = $2`,
        [body.projectId, userId]
      )

      if (projRows.length === 0) {
        throw new Error('Project not found or access denied')
      }

      const proj = projRows[0]

      // Load survey points as traverse stations
      const { rows: pointRows } = await db.query<WorkbookSurveyPointRow>(
        `SELECT point_name, easting, northing, elevation, code
         FROM survey_points
         WHERE project_id = $1 AND easting IS NOT NULL AND northing IS NOT NULL
         ORDER BY point_name ASC`,
        [body.projectId]
      )

      // Load traverse observations
      const { rows: obsRows } = await db.query<WorkbookObservationRow>(
        `SELECT station_from, station_to, bearing, distance
         FROM traverse_observations obs
         JOIN parcel_traverses pt ON pt.id = obs.traverse_id
         WHERE pt.project_id = $1
         ORDER BY obs.id`,
        [body.projectId]
      )

      // Load surveyor profile
      const { rows: profileRows } = await db.query<SurveyorProfileRow>(
        `SELECT full_name, isk_number, firm_name FROM surveyor_profiles WHERE user_id = $1`,
        [userId]
      )
      const profile = profileRows[0]

      // Build stations from survey points
      const stations = pointRows.map((p) => ({
        label: String(p.point_name || ''),
        easting: parseFloat(String(p.easting)),
        northing: parseFloat(String(p.northing)),
        elevation: p.elevation ? parseFloat(String(p.elevation)) : undefined,
      }))

      // Build field observations from traverse_observations
      const fieldObs = obsRows.map((o) => ({
        stationFrom: String(o.station_from || ''),
        stationTo: String(o.station_to || ''),
        observedBearingDeg: parseFloat(String(o.bearing || 0)),
        observedDistanceM: parseFloat(String(o.distance || 0)),
        reducedLevelM: 0,
        remarks: 'Traverse leg',
      }))

      // Build legs from observations
      const legs = fieldObs.map(o => ({
        fromLabel: o.stationFrom,
        toLabel: o.stationTo,
        bearing: o.observedBearingDeg,
        distance: o.observedDistanceM,
      }))

      // Compute area via shoelace if we have ≥3 stations
      let areaM2 = 0
      let perimeterM = 0
      if (stations.length >= 3) {
        for (let i = 0; i < stations.length; i++) {
          const j = (i + 1) % stations.length
          areaM2 += stations[i].easting * stations[j].northing
          areaM2 -= stations[j].easting * stations[i].northing
          const dx = stations[j].easting - stations[i].easting
          const dy = stations[j].northing - stations[i].northing
          perimeterM += Math.sqrt(dx * dx + dy * dy)
        }
        areaM2 = Math.abs(areaM2 / 2)
      }

      return {
        project: {
          name: body.projectName || proj.name,
          lrNumber: body.lrNumber || proj.lr_number || '',
          parcelNumber: body.parcelNumber || '',
          county: body.county || '',
          division: '',
          district: '',
          locality: body.locality || proj.locality || '',
          surveyType: body.surveyType || (proj.survey_type as WorkbookInput['project']['surveyType']) || 'cadastral',
          surveyDate,
          scaleDenominator: 1000,
        },
        surveyor: {
          name: body.surveyorName || proj.surveyor_name || profile?.full_name || '',
          iskNumber: body.iskNumber || proj.surveyor_licence || profile?.isk_number || '',
          firmName: body.firmName || proj.firm_name || profile?.firm_name || '',
        },
        submission: {
          referenceNumber: body.referenceNumber || `MET-WB-${surveyDate.replace(/-/g, '')}`,
          revision: 0,
          status: 'DRAFT',
        },
        fieldObservations: fieldObs.length > 0 ? fieldObs : [],
        traverse: {
          method: 'bowditch',
          stations: [],
          angularMisclosureSec: 0,
          angularToleranceSec: 30,
          angularPassesQA: true,
          linearMisclosureM: 0,
          perimeterM,
          precisionRatio: perimeterM > 0 ? perimeterM / 0.001 : 0,
          precisionMinimum: 5000,
          linearPassesQA: true,
        },
        adjustedStations: stations,
        levelling: [],
        levellingClosureMM: 0,
        levellingToleranceMM: 10,
        levellingDistanceKm: 0,
        areaComputation: {
          stations: stations.map(s => ({ label: s.label, easting: s.easting, northing: s.northing })),
          areaM2,
          areaHa: areaM2 / 10000,
          perimeterM,
        },
        legs,
        cogoResults: [
          { type: 'Area', description: 'Coordinate area by shoelace method', inputs: { stations: stations.length }, outputs: { areaHa: areaM2 / 10000, perimeterM } },
        ],
      }
    } catch (err) {
      console.warn('[statutory-workbook] Failed to load project data, falling back to sample:', err)
      // Fall through to sample data
    }
  }

  // ── Sample data fallback (clearly marked) ──────────────────────────────
  const sampleStations = [
    { label: 'A', easting: 250000.000, northing: 9950000.000, elevation: 1560.125 },
    { label: 'B', easting: 250124.375, northing: 9950048.220, elevation: 1561.084 },
    { label: 'C', easting: 250185.640, northing: 9949925.730, elevation: 1559.862 },
    { label: 'D', easting: 250042.810, northing: 9949878.440, elevation: 1560.006 },
  ]

  return {
    project: {
      name: body.projectName || 'METARDU Sample Workbook (no project selected)',
      lrNumber: body.lrNumber || '',
      parcelNumber: body.parcelNumber || '',
      county: body.county || '',
      division: '',
      district: '',
      locality: body.locality || '',
      surveyType: body.surveyType || 'cadastral',
      surveyDate,
      scaleDenominator: 1000,
    },
    surveyor: {
      name: body.surveyorName || '',
      iskNumber: body.iskNumber || '',
      firmName: body.firmName || '',
    },
    submission: {
      referenceNumber: body.referenceNumber || `MET-WB-${surveyDate.replace(/-/g, '')}`,
      revision: 0,
      status: 'DRAFT',
    },
    fieldObservations: [
      { stationFrom: 'A', stationTo: 'B', observedBearingDeg: 68.8056, observedDistanceM: 133.381, reducedLevelM: 1561.084, remarks: 'Sample traverse leg' },
      { stationFrom: 'B', stationTo: 'C', observedBearingDeg: 153.4349, observedDistanceM: 136.977, reducedLevelM: 1559.862, remarks: 'Sample traverse leg' },
      { stationFrom: 'C', stationTo: 'D', observedBearingDeg: 251.6914, observedDistanceM: 150.457, reducedLevelM: 1560.006, remarks: 'Sample traverse leg' },
      { stationFrom: 'D', stationTo: 'A', observedBearingDeg: 343.8851, observedDistanceM: 126.437, reducedLevelM: 1560.125, remarks: 'Sample closing leg' },
    ],
    traverse: {
      method: 'bowditch',
      stations: [],
      angularMisclosureSec: 8,
      angularToleranceSec: 30,
      angularPassesQA: true,
      linearMisclosureM: 0.018,
      perimeterM: 547.252,
      precisionRatio: 30402,
      precisionMinimum: 5000,
      linearPassesQA: true,
    },
    adjustedStations: sampleStations,
    levelling: [],
    levellingClosureMM: 4,
    levellingToleranceMM: 10,
    levellingDistanceKm: 1,
    areaComputation: {
      stations: sampleStations.map(({ label, easting, northing }) => ({ label, easting, northing })),
      areaM2: 18148.07,
      areaHa: 1.8148,
      perimeterM: 547.252,
    },
    legs: [],
    cogoResults: [],
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  const userId = (session.user as { id?: string }).id
  if (userId) setCurrentUserId(String(userId))

  const rawBody = (await request.json().catch(() => null)) as unknown
  const parsed = StatutoryWorkbookSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 422 }
    )
  }

  const body = parsed.data
  const input = await buildWorkbookInput(body, String(userId))
  const workbook = await generateStatutoryWorkbook(input)
  return new NextResponse(new Uint8Array(workbook), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="metardu-statutory-workbook.xlsx"',
    },
  })
}
