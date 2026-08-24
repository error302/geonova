/**
 * Canonical vertical/zenith angle helpers — single source of truth.
 *
 * Kenyan field practice (Sokkia/Leica/Topcon) reports zenith angle:
 *   0° = nadir (straight up from instrument), 90° = horizontal, 180° = nadir down.
 * Most textbook engine formulas expect vertical-from-horizontal:
 *   0° = horizontal, +up.
 *
 * Conversion is always 90° − zenith. Every boundary that accepts a
 * user-supplied VA should go through one of these helpers so the
 * 4 parallel engines (lib/engine/*, lib/computations/*, lib/survey/*,
 * lib/engine/solution/wrappers/*) no longer diverge — see traverseEngine:187
 * (now sin) + polar.ts:25 (still cos, from-horizontal) + useFieldbookComputations:152.
 *
 * Mining/hydro (metardu-industrial) reuse these helpers verbatim.
 */

export function zenithToVertical(zenithDeg: number): number {
  return 90 - zenithDeg
}

export function verticalToZenith(verticalDeg: number): number {
  return 90 - verticalDeg
}

export function toZenithRad(zenithDeg: number): number {
  return (zenithDeg * Math.PI) / 180
}

export function toVerticalRad(verticalDeg: number): number {
  return (verticalDeg * Math.PI) / 180
}
