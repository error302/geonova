/**
 * Statutory Gate — Project Data Loader
 * ====================================
 *
 * Fetches project data from the database and assembles it into the
 * StatutoryGateInput shape required by runStatutoryGate().
 *
 * This is the integration layer between the project database and the
 * pure-function gate. Keeping it separate from the gate itself means
 * the gate remains trivially testable (no DB mocking required) while
 * this loader can be tested with a test database.
 *
 * Usage:
 *   import { loadGateInputForProject } from '@/lib/validation/statutoryGateLoader'
 *   import { runStatutoryGate } from '@/lib/validation/statutoryGate'
 *
 *   const input = await loadGateInputForProject(projectId)
 *   const result = runStatutoryGate(input)
 *   if (!result.passed) {
 *     // refuse export, show result.violations
 *   }
 */

import { db } from '@/lib/db'
import type { SurveyPoint } from '@/types/surveyPoint'
import type { SurveyType } from '@/types/project'
import type { StatutoryGateInput } from './statutoryGate'
import { shoelaceArea } from '@/lib/engine/area'

// ─── Types matching DB row shapes ───────────────────────────────────────

interface ProjectRow {
  id: string
  survey_type: string | null
  utm_zone: number | null
  hemisphere: string | null
}

interface TraverseRow {
  id: string
  linear_misclosure: number | null
  precision_ratio: number | null
  angular_misclosure: number | null
}

interface TraverseCoordinateRow {
  station: string
  easting: number | string
  northing: number | string
  rl: number | string | null
}

interface FieldBookEntryRow {
  row_index: number
  station: string | null
  raw_data: Record<string, unknown> | null
}

interface ParcelRow {
  id: string
  parcel_number: string | null
  boundary_points: unknown
  area_sqm: number | string | null
}

// ─── Helpers ────────────────────────────────────────────────────────────

function normalizeSurveyType(raw: string | null): SurveyType {
  const v = (raw ?? '').toLowerCase()
  if (v.includes('cadastral') || v.includes('boundary')) return 'cadastral'
  if (v.includes('engineering') || v.includes('road') || v.includes('construction')) return 'engineering'
  if (v.includes('geodetic') || v.includes('control')) return 'geodetic'
  if (v.includes('drone') || v.includes('uav')) return 'drone'
  if (v.includes('deformation') || v.includes('monitor')) return 'deformation'
  return 'topographic'
}

/**
 * Extract traverse station count from field book entries.
 * Each unique station name counts as one station.
 */
function countStations(entries: FieldBookEntryRow[]): number {
  const stations = new Set<string>()
  for (const e of entries) {
    if (e.station) stations.add(e.station)
    else if (e.raw_data?.station) stations.add(String(e.raw_data.station))
  }
  return stations.size
}

/**
 * Parse boundary points from a parcel row. The boundary_points column
 * can be either a JSON array of {easting, northing} objects, or a JSON
 * string of the same. Returns an empty array if unparseable.
 */
function parseBoundaryPoints(raw: unknown, fallbackAreaSqm: number | null): {
  vertices: SurveyPoint[]
  areaHectares: number | null
} {
  let pts: Array<{ easting?: number; northing?: number; name?: string }> = []

  if (Array.isArray(raw)) {
    pts = raw as typeof pts
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) pts = parsed as typeof pts
    } catch {
      // not JSON — ignore
    }
  }

  const vertices: SurveyPoint[] = pts.map((p, i) => ({
    name: p.name ?? `P${i + 1}`,
    easting: Number(p.easting ?? 0),
    northing: Number(p.northing ?? 0),
  }))

  // Prefer the stored area; fall back to shoelace if vertices exist
  let areaHectares: number | null = null
  if (fallbackAreaSqm !== null && !Number.isNaN(Number(fallbackAreaSqm))) {
    areaHectares = Number(fallbackAreaSqm) / 10000
  } else if (vertices.length >= 3) {
    areaHectares = shoelaceArea(vertices) / 10000
  }

  return { vertices, areaHectares }
}

// shoelaceArea is imported from @/lib/engine/area (canonical implementation)

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Load project data from the database and assemble it into a
 * StatutoryGateInput ready for runStatutoryGate().
 *
 * Returns null if the project cannot be found.
 *
 * The loader is defensive: missing tables or NULL columns degrade
 * gracefully (the corresponding gate input field is omitted) rather
 * than throwing. This means the gate can run on partial data and
 * report which rules couldn't be evaluated.
 */
export async function loadGateInputForProject(
  projectId: string
): Promise<StatutoryGateInput | null> {
  // 1. Project row
  const projectRes = await db.query(
    'SELECT id, survey_type, utm_zone, hemisphere FROM projects WHERE id = $1',
    [projectId]
  )
  if (projectRes.rows.length === 0) return null
  const project = projectRes.rows[0] as ProjectRow
  const surveyType = normalizeSurveyType(project.survey_type)

  // 2. Traverse + coordinates (via parcels → parcel_traverses)
  let traverse: StatutoryGateInput['traverse'] | undefined
  try {
    const traverseRes = await db.query(
      `SELECT pt.id, pt.linear_misclosure, pt.precision_ratio, pt.angular_misclosure
       FROM parcel_traverses pt
       JOIN parcels p ON p.id = pt.parcel_id
       JOIN blocks b ON b.id = p.block_id
       WHERE b.project_id = $1
       ORDER BY pt.created_at DESC LIMIT 1`,
      [projectId]
    )
    if (traverseRes.rows.length > 0) {
      const t = traverseRes.rows[0] as TraverseRow
      const coordsRes = await db.query(
        'SELECT station, easting, northing, rl FROM traverse_coordinates WHERE traverse_id = $1 ORDER BY station',
        [t.id]
      )
      const stationCount = coordsRes.rows.length

      // Compute total traverse distance from consecutive coordinates
      let totalDistanceM = 0
      const coords = coordsRes.rows as TraverseCoordinateRow[]
      for (let i = 1; i < coords.length; i++) {
        const dx = Number(coords[i].easting) - Number(coords[i - 1].easting)
        const dy = Number(coords[i].northing) - Number(coords[i - 1].northing)
        totalDistanceM += Math.sqrt(dx * dx + dy * dy)
      }

      const linearErrorM = t.linear_misclosure ?? 0
      // precision_ratio in DB is typically stored as the large number (e.g. 5000 = 1:5000)
      // If it's stored as a decimal (e.g. 0.0002), convert.
      const storedRatio = t.precision_ratio ?? 0
      const precisionRatio = storedRatio > 0 && storedRatio < 1
        ? 1 / storedRatio
        : storedRatio

      const angularMisclosureSeconds = t.angular_misclosure ?? undefined

      traverse = {
        stationCount,
        angularMisclosureSeconds,
        linearErrorM,
        totalDistanceM,
        precisionRatio,
      }
    }
  } catch {
    // traverse tables may not exist — skip
  }

  // 3. Field book entries (for station count fallback if no traverse)
  if (!traverse) {
    try {
      const fbRes = await db.query(
        'SELECT row_index, station, raw_data FROM project_fieldbook_entries WHERE project_id = $1 ORDER BY row_index ASC',
        [projectId]
      )
      const entries = fbRes.rows as FieldBookEntryRow[]
      if (entries.length > 0) {
        traverse = {
          stationCount: countStations(entries),
          angularMisclosureSeconds: undefined,
          linearErrorM: 0,
          totalDistanceM: 0,
          precisionRatio: 0,
        }
      }
    } catch {
      // field book table may not exist — skip
    }
  }

  // 4. Parcels + parent parcel (for cadastral)
  let parcels: StatutoryGateInput['parcels'] | undefined
  let parentParcel: StatutoryGateInput['parentParcel'] | undefined
  try {
    const parcelRes = await db.query(
      'SELECT id, parcel_number, boundary_points, area_sqm FROM parcels WHERE project_id = $1 ORDER BY created_at ASC',
      [projectId]
    )
    if (parcelRes.rows.length > 0) {
      const parcelRows = parcelRes.rows as ParcelRow[]
      const parsed = parcelRows.map((p) =>
        parseBoundaryPoints(p.boundary_points, p.area_sqm === null ? null : Number(p.area_sqm))
      )
      parcels = parsed.map((p, i) => ({
        vertices: p.vertices,
        parcelNumber: parcelRows[i].parcel_number ?? `Parcel ${i + 1}`,
      }))

      // First parcel is treated as the parent if there's only one,
      // otherwise the parent is unknown (subdivisions should have a
      // separate parent parcel reference — for now we use the largest).
      if (parsed.length === 1 && parsed[0].areaHectares !== null) {
        parentParcel = {
          areaHectares: parsed[0].areaHectares,
          vertices: parsed[0].vertices,
        }
      } else if (parsed.length > 1) {
        // Find the largest parcel as the likely parent
        let maxIdx = 0
        let maxArea = -1
        for (let i = 0; i < parsed.length; i++) {
          if (parsed[i].areaHectares !== null && (parsed[i].areaHectares ?? 0) > maxArea) {
            maxArea = parsed[i].areaHectares ?? 0
            maxIdx = i
          }
        }
        if (parsed[maxIdx].areaHectares !== null) {
          parentParcel = {
            areaHectares: parsed[maxIdx].areaHectares!,
            vertices: parsed[maxIdx].vertices,
          }
        }
      }
    }
  } catch {
    // parcels table may not exist — skip
  }

  // 5. Surveyor (no DB table yet — use placeholder, real value comes from
  // the auth session or a future surveyor_profile table)
  // For now we use empty strings; the gate will block on missing name/license
  // and the caller must supply these from the request context.
  const surveyor = {
    name: '',
    licenseNumber: '',
  }

  return {
    surveyType,
    traverse,
    parcels,
    parentParcel,
    surveyor,
  }
}

/**
 * Merge a partial gate input (typically containing the surveyor identity
 * from the auth session) over the input loaded from the database.
 *
 * This is the pattern callers should use:
 *   const loaded = await loadGateInputForProject(projectId)
 *   if (!loaded) throw new Error('Project not found')
 *   const input = mergeGateInput(loaded, { surveyor: sessionSurveyor })
 *   const result = runStatutoryGate(input)
 */
export function mergeGateInput(
  base: StatutoryGateInput,
  override: Partial<StatutoryGateInput>
): StatutoryGateInput {
  const result: StatutoryGateInput = {
    surveyType: override.surveyType ?? base.surveyType,
    surveyor: {
      name: override.surveyor?.name ?? base.surveyor.name,
      licenseNumber: override.surveyor?.licenseNumber ?? base.surveyor.licenseNumber,
    },
    traverse: override.traverse ?? base.traverse,
    leveling: override.leveling ?? base.leveling,
    parcels: override.parcels ?? base.parcels,
    parentParcel: override.parentParcel ?? base.parentParcel,
    engineering: override.engineering ?? base.engineering,
    rimOverlaps: override.rimOverlaps ?? base.rimOverlaps,
    submissionType: override.submissionType ?? base.submissionType,
    toleranceProfileOverride: override.toleranceProfileOverride ?? base.toleranceProfileOverride,
    areaToleranceHectares: override.areaToleranceHectares ?? base.areaToleranceHectares,
  }
  return result
}
