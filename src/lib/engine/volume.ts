/**
 * Calculation standard: N.N. Basak — Surveying and Levelling
 * - No intermediate rounding
 * - Full floating point precision throughout
 * - Round only at final display layer
 *
 * Volume computation (Basak Ch. 8 style):
 * - End Area method
 * - Prismoidal formula
 *
 * Notes:
 * - This module covers cross-section area vs chainage volumes (deterministic, offline-safe).
 * - Surface-to-surface cut/fill (TIN/DEM) belongs in the Python compute layer.
 */

export type VolumeMethod = 'end_area' | 'prismoidal'

export interface VolumeSection {
  chainage: number // metres
  area: number // m^2 (can be signed if representing cut/fill convention)
}

export interface VolumeSegment {
  from: number
  to: number
  L: number
  A1: number
  A2: number
  Am?: number
  volume: number // m^3 (signed if areas are signed)
}

export interface VolumeResult {
  method: VolumeMethod
  totalVolume: number
  segments: VolumeSegment[]
}

export interface CutFillVolumeResult {
  cutVolume: number
  fillVolume: number
  netVolume: number
  segments: VolumeSegment[]
}

function sortByChainage(sections: VolumeSection[]): VolumeSection[] {
  return [...sections].sort((a, b) => a.chainage - b.chainage)
}

export function endAreaVolume(sections: VolumeSection[]): VolumeResult {
  const sorted = sortByChainage(sections)
  const segments: VolumeSegment[] = []
  let total = 0

  for (let i = 1; i < sorted.length; i++) {
    const s1 = sorted[i - 1]
    const s2 = sorted[i]
    const L = s2.chainage - s1.chainage
    const v = (L / 2) * (s1.area + s2.area)
    segments.push({ from: s1.chainage, to: s2.chainage, L, A1: s1.area, A2: s2.area, volume: v })
    total += v
  }

  return { method: 'end_area', totalVolume: total, segments }
}

export function prismoidalVolume(sections: VolumeSection[]): VolumeResult {
  const sorted = sortByChainage(sections)
  const segments: VolumeSegment[] = []
  let total = 0

  // Uses triplets: A1, Am, A2 across equal spacing:
  // V = (L/6) * (A1 + 4Am + A2), where L = chainage2 - chainage0
  for (let i = 0; i + 2 < sorted.length; i += 2) {
    const s1 = sorted[i]
    const sm = sorted[i + 1]
    const s2 = sorted[i + 2]
    const L = s2.chainage - s1.chainage
    const v = (L / 6) * (s1.area + 4 * sm.area + s2.area)
    segments.push({ from: s1.chainage, to: s2.chainage, L, A1: s1.area, Am: sm.area, A2: s2.area, volume: v })
    total += v
  }

  return { method: 'prismoidal', totalVolume: total, segments }
}

export function volumeFromSections(sections: VolumeSection[], method: VolumeMethod): VolumeResult {
  if (method === 'end_area') return endAreaVolume(sections)
  return prismoidalVolume(sections)
}

/**
 * Simple cut/fill summarization from signed cross-section areas.
 * Convention: +area = cut, -area = fill.
 * This matches the existing UI behaviour (does not attempt to split sign-changing segments).
 */
export function cutFillVolumeFromSignedSections(sections: VolumeSection[]): CutFillVolumeResult {
  const sorted = sortByChainage(sections)
  const segments: VolumeSegment[] = []
  let cutVolume = 0
  let fillVolume = 0

  for (let i = 1; i < sorted.length; i++) {
    const s1 = sorted[i - 1]
    const s2 = sorted[i]
    const L = s2.chainage - s1.chainage
    const v = (L / 2) * (s1.area + s2.area)
    segments.push({ from: s1.chainage, to: s2.chainage, L, A1: s1.area, A2: s2.area, volume: v })

    if (s1.area >= 0 && s2.area >= 0) cutVolume += v
    else if (s1.area <= 0 && s2.area <= 0) fillVolume += Math.abs(v)
  }

  return { cutVolume, fillVolume, netVolume: cutVolume - fillVolume, segments }
}
