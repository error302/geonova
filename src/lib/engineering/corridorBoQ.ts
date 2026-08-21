/**
 * Corridor BoQ (Bill of Quantities) Generator
 *
 * Computes end-area volumes between consecutive cross-sections,
 * classifies materials (excavation, fill, subgrade), and produces
 * a formatted BoQ table for submission packages.
 *
 * References:
 *   - Kenya RDM 1.1 2025, §8 — Earthworks quantities
 *   - Ghilani & Wolf, Elementary Surveying, §26.3 — End-area method
 *   - AASHTO — Construction estimation guidelines
 */

import type { ProfilePoint } from './crossSectionGeometry'
import { computeCutFillArea, determineSectionType } from './crossSectionGeometry'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CorridorSection {
  /** Chainage along alignment (metres). */
  chainage: number
  /** Natural ground profile points. */
  groundPoints: ProfilePoint[]
  /** Formation (road template) profile points. */
  formationPoints: ProfilePoint[]
  /** Road template parameters. */
  template: {
    carriagewayWidth: number
    shoulderWidth: number
    subgradeDepth: number
  }
}

export interface BoQItem {
  /** Item number (sequential). */
  itemNo: string
  /** Description of work. */
  description: string
  /** Unit of measurement. */
  unit: string
  /** Quantity. */
  quantity: number
  /** Rate per unit (KES). */
  rate: number
  /** Total amount (KES). */
  amount: number
}

export interface BoQRow {
  /** From chainage. */
  fromChainage: number
  /** To chainage. */
  toChainage: number
  /** Distance between sections (m). */
  distance: number
  /** Cut area at from section (m²). */
  cutAreaFrom: number
  /** Cut area at to section (m²). */
  cutAreaTo: number
  /** Fill area at from section (m²). */
  fillAreaFrom: number
  /** Fill area at to section (m²). */
  fillAreaTo: number
  /** End-area cut volume (m³). */
  cutVolume: number
  /** End-area fill volume (m³). */
  fillVolume: number
}

export interface CorridorBoQResult {
  /** All section rows with volumes. */
  rows: BoQRow[]
  /** Total cut volume (m³). */
  totalCutVolume: number
  /** Total fill volume (m³). */
  totalFillVolume: number
  /** Net volume (positive = surplus cut, negative = deficit). */
  netVolume: number
  /** Formatted BoQ items for the submission package. */
  boqItems: BoQItem[]
  /** Summary statistics. */
  summary: {
    totalDistance: number
    numberOfSections: number
    cutSections: number
    fillSections: number
    mixedSections: number
  }
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Standard Kenya BoQ item codes for earthworks. */
const BOQ_CODES = {
  EXCAVATION: '1.1',
  FILL: '1.2',
  SUBGRADE: '1.3',
  DISPOSAL: '1.4',
} as const

/** Approximate KES rates (adjustable). */
const DEFAULT_RATES = {
  excavationPerM3: 350,
  fillPerM3: 280,
  subgradePerM3: 150,
  disposalPerM3: 120,
} as const

// ─── Computation ────────────────────────────────────────────────────────────

/**
 * Compute a full corridor BoQ from a series of cross-sections.
 *
 * @param sections - Array of cross-sections along the corridor, sorted by chainage
 * @param stationInterval - Distance between stations (metres). If omitted, computed from chainage differences.
 * @returns Complete BoQ result with volumes and formatted items
 */
export function buildCorridorBoQ(
  sections: CorridorSection[],
  options: { rates?: typeof DEFAULT_RATES } = {},
): CorridorBoQResult {
  const rates = { ...DEFAULT_RATES, ...options.rates }

  if (sections.length < 2) {
    return emptyBoQ()
  }

  // Compute areas for each section
  const sectionData = sections.map(s => {
    const cutFill = computeCutFillArea(s.groundPoints, s.formationPoints)
    const sectionType = determineSectionType(s.groundPoints, 0) // formation level at 0 offset
    const groundLevelAtCentre = interpolateCentre(s.groundPoints)
    const formationLevelAtCentre = interpolateCentre(s.formationPoints)
    const isCut = groundLevelAtCentre > formationLevelAtCentre

    return {
      chainage: s.chainage,
      cutArea: isCut ? Math.abs(cutFill) : 0,
      fillArea: !isCut ? Math.abs(cutFill) : 0,
      sectionType: isCut ? ('cut' as const) : ('fill' as const),
      template: s.template,
    }
  })

  // Build rows with end-area volumes
  const rows: BoQRow[] = []
  let totalCutVolume = 0
  let totalFillVolume = 0
  let cutSections = 0
  let fillSections = 0
  let mixedSections = 0

  for (let i = 0; i < sectionData.length; i++) {
    const s = sectionData[i]
    if (s.sectionType === 'cut') cutSections++
    else if (s.sectionType === 'fill') fillSections++
    else mixedSections++

    if (i === 0) continue

    const prev = sectionData[i - 1]
    const distance = s.chainage - prev.chainage

    // End-area method: V = (A1 + A2) / 2 * L
    const cutVolume = ((prev.cutArea + s.cutArea) / 2) * distance
    const fillVolume = ((prev.fillArea + s.fillArea) / 2) * distance

    totalCutVolume += cutVolume
    totalFillVolume += fillVolume

    rows.push({
      fromChainage: prev.chainage,
      toChainage: s.chainage,
      distance,
      cutAreaFrom: prev.cutArea,
      cutAreaTo: s.cutArea,
      fillAreaFrom: prev.fillArea,
      fillAreaTo: s.fillArea,
      cutVolume,
      fillVolume,
    })
  }

  const totalDistance = sectionData.length > 1
    ? sectionData[sectionData.length - 1].chainage - sectionData[0].chainage
    : 0

  const netVolume = totalCutVolume - totalFillVolume

  // Build BoQ items
  const boqItems = buildBoqItems(totalCutVolume, totalFillVolume, rates)

  return {
    rows,
    totalCutVolume,
    totalFillVolume,
    netVolume,
    boqItems,
    summary: {
      totalDistance,
      numberOfSections: sectionData.length,
      cutSections,
      fillSections,
      mixedSections,
    },
  }
}

// ─── BoQ Formatting ─────────────────────────────────────────────────────────

function buildBoqItems(
  totalCut: number,
  totalFill: number,
  rates: typeof DEFAULT_RATES,
): BoQItem[] {
  const items: BoQItem[] = []

  if (totalCut > 0.01) {
    items.push({
      itemNo: BOQ_CODES.EXCAVATION,
      description: 'Excavation of earthwork in cut (ordinary soil)',
      unit: 'm\u00B3',
      quantity: roundQty(totalCut),
      rate: rates.excavationPerM3,
      amount: roundQty(totalCut) * rates.excavationPerM3,
    })
  }

  if (totalFill > 0.01) {
    items.push({
      itemNo: BOQ_CODES.FILL,
      description: 'Embankment in fill from borrow (compacted)',
      unit: 'm\u00B3',
      quantity: roundQty(totalFill),
      rate: rates.fillPerM3,
      amount: roundQty(totalFill) * rates.fillPerM3,
    })
  }

  // Disposal of surplus
  const surplus = totalCut - totalFill
  if (surplus > 0.01) {
    items.push({
      itemNo: BOQ_CODES.DISPOSAL,
      description: 'Disposal of surplus excavated material',
      unit: 'm\u00B3',
      quantity: roundQty(surplus),
      rate: rates.disposalPerM3,
      amount: roundQty(surplus) * rates.disposalPerM3,
    })
  }

  return items
}

// ─── Formatting ─────────────────────────────────────────────────────────────

/**
 * Format the BoQ as a printable text table.
 */
export function formatBoQText(result: CorridorBoQResult): string {
  const lines: string[] = []

  lines.push('='.repeat(80))
  lines.push('  BILL OF QUANTITIES — EARTHWORKS')
  lines.push('  Road Corridor Cross-Section Volumes (End-Area Method)')
  lines.push('='.repeat(80))
  lines.push('')

  // Summary
  lines.push(`  Total Distance:    ${result.summary.totalDistance.toFixed(2)} m`)
  lines.push(`  Number of Sections: ${result.summary.numberOfSections}`)
  lines.push(`  Cut Sections:      ${result.summary.cutSections}`)
  lines.push(`  Fill Sections:     ${result.summary.fillSections}`)
  lines.push(`  Mixed Sections:    ${result.summary.mixedSections}`)
  lines.push('')

  // Volume Summary
  lines.push('-'.repeat(80))
  lines.push('  VOLUME SUMMARY')
  lines.push('-'.repeat(80))
  lines.push(`  Total Cut Volume:  ${result.totalCutVolume.toFixed(2)} m\u00B3`)
  lines.push(`  Total Fill Volume: ${result.totalFillVolume.toFixed(2)} m\u00B3`)
  lines.push(`  Net Volume:        ${result.netVolume.toFixed(2)} m\u00B3 (${result.netVolume > 0 ? 'surplus' : 'deficit'})`)
  lines.push('')

  // Section Details
  lines.push('-'.repeat(80))
  lines.push('  SECTION DETAILS')
  lines.push('-'.repeat(80))
  lines.push(padRow(['From', 'To', 'Dist', 'Cut A\u2081', 'Cut A\u2082', 'Fill A\u2081', 'Fill A\u2082', 'Cut Vol', 'Fill Vol']))
  lines.push('-'.repeat(80))

  for (const row of result.rows) {
    lines.push(padRow([
      formatCh(row.fromChainage),
      formatCh(row.toChainage),
      row.distance.toFixed(1),
      row.cutAreaFrom.toFixed(2),
      row.cutAreaTo.toFixed(2),
      row.fillAreaFrom.toFixed(2),
      row.fillAreaTo.toFixed(2),
      row.cutVolume.toFixed(1),
      row.fillVolume.toFixed(1),
    ]))
  }

  lines.push('-'.repeat(80))
  lines.push(padRow(['', '', '', '', '', '', '', result.totalCutVolume.toFixed(1), result.totalFillVolume.toFixed(1)]))
  lines.push('')

  // BoQ Items
  if (result.boqItems.length > 0) {
    lines.push('-'.repeat(80))
    lines.push('  PRICED BOQ ITEMS')
    lines.push('-'.repeat(80))
    lines.push(padRow(['Item', 'Description', 'Unit', 'Qty', 'Rate (KES)', 'Amount (KES)']))
    lines.push('-'.repeat(80))

    let totalAmount = 0
    for (const item of result.boqItems) {
      lines.push(padRow([
        item.itemNo,
        item.description.length > 35 ? item.description.slice(0, 33) + '..' : item.description,
        item.unit,
        item.quantity.toFixed(2),
        item.rate.toLocaleString(),
        item.amount.toLocaleString(),
      ]))
      totalAmount += item.amount
    }
    lines.push('-'.repeat(80))
    lines.push(`  TOTAL: KES ${totalAmount.toLocaleString()}`)
  }

  return lines.join('\n')
}

/**
 * Format the BoQ as CSV.
 */
export function formatBoQCSV(result: CorridorBoQResult): string {
  const lines: string[] = []
  lines.push('From Chainage,To Chainage,Distance (m),Cut Area From (m2),Cut Area To (m2),Fill Area From (m2),Fill Area To (m2),Cut Volume (m3),Fill Volume (m3)')
  for (const row of result.rows) {
    lines.push([
      row.fromChainage.toFixed(3),
      row.toChainage.toFixed(3),
      row.distance.toFixed(2),
      row.cutAreaFrom.toFixed(2),
      row.cutAreaTo.toFixed(2),
      row.fillAreaFrom.toFixed(2),
      row.fillAreaTo.toFixed(2),
      row.cutVolume.toFixed(2),
      row.fillVolume.toFixed(2),
    ].join(','))
  }
  lines.push('')
  lines.push(`Total Cut Volume (m3),${result.totalCutVolume.toFixed(2)}`)
  lines.push(`Total Fill Volume (m3),${result.totalFillVolume.toFixed(2)}`)
  lines.push(`Net Volume (m3),${result.netVolume.toFixed(2)}`)
  return lines.join('\n')
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function interpolateCentre(points: ProfilePoint[]): number {
  const sorted = [...points].sort((a, b) => a.offset - b.offset)
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].offset <= 0 && sorted[i + 1].offset >= 0) {
      const segLen = sorted[i + 1].offset - sorted[i].offset
      if (segLen < 1e-12) return sorted[i].level
      const t = -sorted[i].offset / segLen
      return sorted[i].level + t * (sorted[i + 1].level - sorted[i].level)
    }
  }
  return sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)].level : 0
}

function roundQty(v: number): number {
  return Math.round(v * 100) / 100
}

function formatCh(ch: number): string {
  if (ch >= 1000) {
    return `${Math.floor(ch / 1000)}+${(ch % 1000).toFixed(3).padStart(6, '0')}`
  }
  return ch.toFixed(3)
}

function padRow(cells: string[]): string {
  const widths = [10, 10, 6, 10, 10, 10, 10, 10, 10]
  return cells.map((c, i) => c.padEnd(widths[i] ?? 10)).join('  ')
}

function emptyBoQ(): CorridorBoQResult {
  return {
    rows: [],
    totalCutVolume: 0,
    totalFillVolume: 0,
    netVolume: 0,
    boqItems: [],
    summary: {
      totalDistance: 0,
      numberOfSections: 0,
      cutSections: 0,
      fillSections: 0,
      mixedSections: 0,
    },
  }
}
