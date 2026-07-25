/**
 * @module sectionalProperties
 *
 * Sectional properties management per Sectional Properties Act 2020 (Kenya).
 *
 * Manages sectional plans for apartment buildings, commercial buildings,
 * and mixed-use developments. Each unit (apartment, office, parking bay,
 * common area) has its own sectional title.
 *
 * Features:
 *   - Define building floors and units
 *   - Compute unit areas + share of common property
 *   - Generate sectional plan per SoK standards
 *   - Compute participation quotas (unit's share of total)
 *
 * References:
 *   - Sectional Properties Act 2020 (Kenya)
 *   - Survey of Kenya: Sectional Plans Manual
 */

export interface SectionalUnit {
  id: string
  /** Unit number (e.g., "A1", "PARK-01") */
  unitNumber: string
  /** Floor number (0 = ground, 1 = first, -1 = basement) */
  floor: number
  /** Unit type */
  type: 'residential' | 'commercial' | 'parking' | 'storage' | 'common'
  /** Unit area in m² */
  area: number
  /** Description (e.g., "2-bedroom apartment") */
  description?: string
  /** Unit boundary coordinates (closed polygon, relative to building origin) */
  boundary?: Array<{ x: number; y: number }>
}

export interface SectionalFloor {
  floor: number
  /** Floor name (e.g., "Ground Floor", "1st Floor", "Basement") */
  name: string
  /** Total floor area in m² */
  totalArea: number
  /** Units on this floor */
  units: SectionalUnit[]
}

export interface SectionalPlan {
  buildingName: string
  lrNumber: string
  /** Total floors (including basement) */
  totalFloors: number
  floors: SectionalFloor[]
  /** Total building area (all floors) */
  totalArea: number
  /** Total unit area (excludes common areas) */
  totalUnitArea: number
  /** Total common area */
  totalCommonArea: number
  /** Participation quota per unit (percentage of total) */
  participationQuotas: Array<{ unitId: string; unitNumber: string; quota: number }>
}

/**
 * Create a sectional plan from floor + unit data.
 * Computes areas, common areas, and participation quotas.
 */
export function createSectionalPlan(
  buildingName: string,
  lrNumber: string,
  floors: SectionalFloor[],
): SectionalPlan {
  let totalArea = 0
  let totalUnitArea = 0
  let totalCommonArea = 0

  for (const floor of floors) {
    totalArea += floor.totalArea
    let floorUnitArea = 0
    for (const unit of floor.units) {
      if (unit.type !== 'common') {
        floorUnitArea += unit.area
        totalUnitArea += unit.area
      }
    }
    totalCommonArea += floor.totalArea - floorUnitArea
  }

  // Participation quota = unit area / total unit area × 100
  const participationQuotas = floors
    .flatMap(f => f.units)
    .filter(u => u.type !== 'common')
    .map(u => ({
      unitId: u.id,
      unitNumber: u.unitNumber,
      quota: totalUnitArea > 0 ? (u.area / totalUnitArea) * 100 : 0,
    }))

  return {
    buildingName,
    lrNumber,
    totalFloors: floors.length,
    floors,
    totalArea,
    totalUnitArea,
    totalCommonArea,
    participationQuotas,
  }
}

// ─── Encumbrance Registration ───────────────────────────────────────────────

export type EncumbranceType =
  | 'wayleave'        // KPLC wayleave, water pipeline
  | 'easement'        // right of way, access easement
  | 'restriction'     // development restriction
  | 'caveat'          // legal caveat
  | 'lease'           // leasehold interest
  | 'charge'          // mortgage/charge

export interface Encumbrance {
  id: string
  type: EncumbranceType
  /** Description (e.g., "KPLC 33kV power line wayleave") */
  description: string
  /** Holder/beneficiary (e.g., "Kenya Power & Lighting Co.") */
  holder: string
  /** Encumbrance line/corridor coordinates */
  coordinates: Array<{ easting: number; northing: number }>
  /** Width of corridor in metres (for wayleaves) */
  corridorWidth?: number
  /** Registration date */
  registeredDate: string
  /** Reference number (e.g., wayleave permit number) */
  referenceNumber?: string
}

export interface EncumbranceResult {
  encumbrances: Encumbrance[]
  /** Total area affected by encumbrances (m²) */
  totalAffectedArea: number
  /** Percentage of parcel affected */
  affectedPercent: number
  /** List of encumbrances that restrict development */
  restrictions: Encumbrance[]
  /** Summary */
  summary: string
}

/**
 * Register and analyze encumbrances on a parcel.
 *
 * @param encumbrances List of encumbrances
 * @param parcelArea Total parcel area in m²
 */
export function analyzeEncumbrances(
  encumbrances: Encumbrance[],
  parcelArea: number,
): EncumbranceResult {
  let totalAffectedArea = 0

  for (const enc of encumbrances) {
    if (enc.corridorWidth && enc.coordinates.length >= 2) {
      // Compute corridor area = length × width
      let length = 0
      for (let i = 0; i < enc.coordinates.length - 1; i++) {
        const dx = enc.coordinates[i + 1].easting - enc.coordinates[i].easting
        const dy = enc.coordinates[i + 1].northing - enc.coordinates[i].northing
        length += Math.sqrt(dx * dx + dy * dy)
      }
      totalAffectedArea += length * enc.corridorWidth
    }
  }

  const affectedPercent = parcelArea > 0 ? (totalAffectedArea / parcelArea) * 100 : 0
  const restrictions = encumbrances.filter(e =>
    e.type === 'restriction' || e.type === 'caveat' || e.type === 'wayleave'
  )

  const summary = encumbrances.length === 0
    ? 'No encumbrances registered on this parcel.'
    : `${encumbrances.length} encumbrance(s) affecting ${totalAffectedArea.toFixed(2)} m² (${affectedPercent.toFixed(2)}% of parcel). ${restrictions.length} development restriction(s).`

  return {
    encumbrances,
    totalAffectedArea,
    affectedPercent,
    restrictions,
    summary,
  }
}
