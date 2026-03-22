// METARDU Traverse Accuracy Classification
// Source: RDM 1.1 Kenya 2025, Table 2.4 — Accuracy Classification Standards
// Source: Ghilani & Wolf, Elementary Surveying 16th Ed., Chapter 12
// Formula: m = C/√K (mm/√km), where C = linear misclosure (mm), K = perimeter (km)

export interface TraverseAccuracyClass {
  order: string
  m_mm: number
  color: string
  bgClass: string
  textColor: string
}

export const ACCURACY_CLASSES: TraverseAccuracyClass[] = [
  { order: 'FIRST ORDER CLASS I', m_mm: 0.5, color: '#006400', bgClass: 'bg-green-100', textColor: 'text-green-800' },
  { order: 'FIRST ORDER CLASS II', m_mm: 0.7, color: '#228B22', bgClass: 'bg-green-50', textColor: 'text-green-700' },
  { order: 'SECOND ORDER CLASS I', m_mm: 1.0, color: '#DAA520', bgClass: 'bg-yellow-100', textColor: 'text-yellow-800' },
  { order: 'SECOND ORDER CLASS II', m_mm: 1.3, color: '#FF8C00', bgClass: 'bg-orange-100', textColor: 'text-orange-800' },
  { order: 'THIRD ORDER', m_mm: 2.0, color: '#DC143C', bgClass: 'bg-red-100', textColor: 'text-red-800' },
]

export interface TraverseAccuracyResult {
  order: string
  m_mm: number
  C_mm: number
  K_km: number
  allowed: number
  color: string
  bgClass: string
  textColor: string
  formula: string
}

export function computeTraverseAccuracy(
  closingErrorMetres: number,
  perimeterMetres: number
): TraverseAccuracyResult | null {
  if (perimeterMetres <= 0 || isNaN(closingErrorMetres)) return null

  const C_mm = Math.abs(closingErrorMetres) * 1000
  const K_km = perimeterMetres / 1000
  const allowed = C_mm / Math.sqrt(K_km)

  let match = ACCURACY_CLASSES[ACCURACY_CLASSES.length - 1]
  for (const cls of ACCURACY_CLASSES) {
    if (allowed <= cls.m_mm) {
      match = cls
      break
    }
  }

  const formula = `C = m\u221AK = ${C_mm.toFixed(2)}mm / \u221A${K_km.toFixed(2)}km = ${allowed.toFixed(2)}mm (m=${match.m_mm}mm, RDM 1.1 Table 2.4)`

  return {
    order: match.order,
    m_mm: match.m_mm,
    C_mm,
    K_km,
    allowed,
    color: match.color,
    bgClass: match.bgClass,
    textColor: match.textColor,
    formula,
  }
}

export function getAccuracyBadgeLabel(result: TraverseAccuracyResult | null): string {
  if (!result) return 'UNCLASSIFIED'
  return `${result.order} \u2713`
}

export function getAccuracyBadgeClass(result: TraverseAccuracyResult | null): string {
  if (!result) return 'bg-gray-100 text-gray-600'
  return `${result.bgClass} ${result.textColor}`
}
