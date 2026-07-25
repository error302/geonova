/**
 * Composite plans + Community land survey + Adverse possession helpers.
 * Combined module for P2 cadastral gaps.
 */

// ─── 1. COMPOSITE PLANS ─────────────────────────────────────────────────────

export interface CompositePlanParcel {
  lrNumber: string
  area: number // m²
  easting: number // centroid easting
  northing: number // centroid northing
  sheetPosition?: { row: number; col: number }
}

export interface CompositePlanSheet {
  sheetNumber: number
  paperSize: 'A4' | 'A3' | 'A2' | 'A1' | 'A0'
  parcels: CompositePlanParcel[]
  scale: number
  title: string
}

export interface CompositePlanResult {
  sheets: CompositePlanSheet[]
  totalParcels: number
  totalSheets: number
  totalArea: number
  summary: string
}

/**
 * Layout multiple parcels onto composite plan sheets (registry index map).
 *
 * Groups parcels by proximity and fits them onto sheets at a suitable scale.
 *
 * @param parcels Array of parcels with LR number, area, centroid coords
 * @param paperSize Paper size for the sheets (default A1)
 * @param maxParcelsPerSheet Max parcels per sheet (default 12)
 */
export function createCompositePlan(
  parcels: CompositePlanParcel[],
  paperSize: 'A4' | 'A3' | 'A2' | 'A1' | 'A0' = 'A1',
  maxParcelsPerSheet: number = 12,
): CompositePlanResult {
  if (parcels.length === 0) {
    return { sheets: [], totalParcels: 0, totalSheets: 0, totalArea: 0, summary: 'No parcels to layout.' }
  }

  // Sort parcels by easting (left to right) then northing (bottom to top)
  const sorted = [...parcels].sort((a, b) => a.easting - b.easting || a.northing - b.northing)

  // Compute bounds
  const minE = Math.min(...sorted.map(p => p.easting))
  const maxE = Math.max(...sorted.map(p => p.easting))
  const minN = Math.min(...sorted.map(p => p.northing))
  const maxN = Math.max(...sorted.map(p => p.northing))
  const extentE = maxE - minE || 1
  const extentN = maxN - minN || 1

  // Determine scale to fit on sheet
  // A1 landscape drawing area: ~800mm × 560mm
  const sheetWidthMm = paperSize === 'A0' ? 1189 : paperSize === 'A1' ? 841 : paperSize === 'A2' ? 594 : 420
  const sheetHeightMm = paperSize === 'A0' ? 841 : paperSize === 'A1' ? 594 : paperSize === 'A2' ? 420 : 297
  const drawableW = sheetWidthMm - 100 // margin
  const drawableH = sheetHeightMm - 100

  const scaleX = drawableW / (extentE / 1000) // m to mm
  const scaleY = drawableH / (extentN / 1000)
  const scale = Math.min(scaleX, scaleY)
  const roundedScale = Math.floor(scale / 100) * 100 // round down to nearest 100

  // Group parcels into sheets
  const sheets: CompositePlanSheet[] = []
  let sheetNum = 1

  for (let i = 0; i < sorted.length; i += maxParcelsPerSheet) {
    const chunk = sorted.slice(i, i + maxParcelsPerSheet)
    sheets.push({
      sheetNumber: sheetNum++,
      paperSize,
      parcels: chunk,
      scale: roundedScale,
      title: `Composite Plan — Sheet ${sheetNum - 1} (${chunk.length} parcels)`,
    })
  }

  const totalArea = parcels.reduce((s, p) => s + p.area, 0)
  const summary = `${parcels.length} parcels on ${sheets.length} sheet(s) at 1:${roundedScale} on ${paperSize}. Total area: ${(totalArea / 10000).toFixed(4)} ha.`

  return { sheets, totalParcels: parcels.length, totalSheets: sheets.length, totalArea, summary }
}

// ─── 2. COMMUNITY LAND SURVEY ───────────────────────────────────────────────

export interface CommunityLandResult {
  communityName: string
  county: string
  totalArea: number // m²
  totalAreaHa: number
  boundaryLength: number // m
  householdCount: number
  grazingArea: number // m²
  farmingArea: number // m²
  settlementArea: number // m²
  publicFacilitiesArea: number // m²
  /** Participation quota per household (share of community land) */
  householdQuota: number // m² per household
  summary: string
}

/**
 * Compute community land survey data per Community Land Act 2016 (Kenya).
 *
 * @param boundary Boundary coordinates of the community land
 * @param householdCount Number of registered households
 * @param areaAllocation Area allocation by use (grazing, farming, etc.) as fractions
 */
export function computeCommunityLand(
  boundary: Array<{ easting: number; northing: number }>,
  communityName: string,
  county: string,
  householdCount: number,
  areaAllocation: { grazing: number; farming: number; settlement: number; public: number } = { grazing: 0.5, farming: 0.3, settlement: 0.15, public: 0.05 },
): CommunityLandResult {
  // Shoelace area
  let area = 0
  for (let i = 0; i < boundary.length; i++) {
    const j = (i + 1) % boundary.length
    area += boundary[i].easting * boundary[j].northing
    area -= boundary[j].easting * boundary[i].northing
  }
  const totalArea = Math.abs(area / 2)

  // Boundary length
  let boundaryLength = 0
  for (let i = 0; i < boundary.length; i++) {
    const j = (i + 1) % boundary.length
    const dx = boundary[j].easting - boundary[i].easting
    const dy = boundary[j].northing - boundary[i].northing
    boundaryLength += Math.sqrt(dx * dx + dy * dy)
  }

  const grazingArea = totalArea * areaAllocation.grazing
  const farmingArea = totalArea * areaAllocation.farming
  const settlementArea = totalArea * areaAllocation.settlement
  const publicArea = totalArea * areaAllocation.public
  const householdQuota = householdCount > 0 ? settlementArea / householdCount : 0

  const summary = `${communityName} (${county}): ${(totalArea / 10000).toFixed(4)} ha, ${householdCount} households. ` +
    `Grazing: ${(grazingArea / 10000).toFixed(2)} ha, Farming: ${(farmingArea / 10000).toFixed(2)} ha, ` +
    `Settlement: ${(settlementArea / 10000).toFixed(2)} ha. Each household: ${householdQuota.toFixed(0)} m².`

  return {
    communityName, county, totalArea, totalAreaHa: totalArea / 10000,
    boundaryLength, householdCount, grazingArea, farmingArea, settlementArea,
    publicFacilitiesArea: publicArea, householdQuota, summary,
  }
}

// ─── 3. ADVERSE POSSESSION ──────────────────────────────────────────────────

export interface AdversePossessionResult {
  /** Years of continuous occupation */
  yearsOfOccupation: number
  /** Whether the 12-year statutory period is met */
  meetsStatutoryPeriod: boolean
  /** Years remaining to meet the 12-year threshold */
  yearsRemaining: number
  /** Area under adverse possession (m²) */
  area: number
  /** Whether the possession is open and notorious */
  isOpenAndNotorious: boolean
  /** Whether the possession is exclusive */
  isExclusive: boolean
  /** Whether the possession is hostile (without permission) */
  isHostile: boolean
  /** Whether the possession is continuous */
  isContinuous: boolean
  /** All elements met */
  allElementsMet: boolean
  /** Recommendation */
  recommendation: string
}

/**
 * Evaluate an adverse possession claim per Limitation of Actions Act (Kenya).
 *
 * The claimant must show 12 years of continuous, open, notorious, hostile,
 * and exclusive possession of the land.
 *
 * @param startYear Year occupation began
 * @param currentYear Current year
 * @param area Area under possession (m²)
 * @param isOpen Open and notorious?
 * @param isExclusive Exclusive?
 * @param isHostile Hostile (without owner's permission)?
 * @param isContinuous Continuous (no gaps)?
 */
export function evaluateAdversePossession(
  startYear: number,
  currentYear: number = new Date().getFullYear(),
  area: number,
  isOpen: boolean = true,
  isExclusive: boolean = true,
  isHostile: boolean = true,
  isContinuous: boolean = true,
): AdversePossessionResult {
  const yearsOfOccupation = currentYear - startYear
  const meetsStatutoryPeriod = yearsOfOccupation >= 12
  const yearsRemaining = Math.max(0, 12 - yearsOfOccupation)
  const allElementsMet = meetsStatutoryPeriod && isOpen && isExclusive && isHostile && isContinuous

  let recommendation: string
  if (allElementsMet) {
    recommendation = 'All elements of adverse possession are met. Claimant may file for title registration under Section 38 of the Limitation of Actions Act.'
  } else if (!meetsStatutoryPeriod) {
    recommendation = `Statutory period not yet met. ${yearsRemaining} year(s) remaining to complete the 12-year requirement.`
  } else {
    const missing: string[] = []
    if (!isOpen) missing.push('open and notorious')
    if (!isExclusive) missing.push('exclusive')
    if (!isHostile) missing.push('hostile (without permission)')
    if (!isContinuous) missing.push('continuous')
    recommendation = `Statutory period met but possession is not ${missing.join(', ')}. Claim may fail.`
  }

  return {
    yearsOfOccupation, meetsStatutoryPeriod, yearsRemaining, area,
    isOpenAndNotorious: isOpen, isExclusive, isHostile, isContinuous,
    allElementsMet, recommendation,
  }
}
