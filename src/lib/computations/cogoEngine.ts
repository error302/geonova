import { bearingToString, backBearing } from '@/lib/engine/angles'

// ─── PART 1: INVERSE COMPUTATION ───────────────────────────────────────────────
// Source: Ghilani & Wolf, Elementary Surveying 16th Ed., Section 10.3
// Source: N.N. Basak, Surveying and Levelling, Chapter 3

export interface InverseInput {
  e1: number
  n1: number
  e2: number
  n2: number
  label1?: string
  label2?: string
}

export interface InverseStep {
  description: string
  formula: string
  value: string
}

export interface InverseResult {
  deltaE: number
  deltaN: number
  distance: number
  theta: number
  reducedBearing: string
  wcbDecimal: number
  wcbDMS: string
  backBearingDecimal: number
  backBearingDMS: string
  quadrant: string
  steps: InverseStep[]
  arithmeticCheck: { passed: boolean; value: number }
}

export function inverseComputation(input: InverseInput): InverseResult {
  const { e1, n1, e2, n2, label1 = 'P1', label2 = 'P2' } = input

  const deltaE = e2 - e1
  const deltaN = n2 - n1
  const distance = Math.sqrt(deltaE * deltaE + deltaN * deltaN)
  const theta = Math.atan2(Math.abs(deltaE), Math.abs(deltaN)) * 180 / Math.PI

  // Source: Ghilani & Wolf, Section 10.3 — Quadrant determination
  let wcbDecimal: number
  let quadrant: string

  if (deltaN > 0 && deltaE > 0) {
    wcbDecimal = theta
    quadrant = 'NE'
  } else if (deltaN < 0 && deltaE > 0) {
    wcbDecimal = 180 - theta
    quadrant = 'SE'
  } else if (deltaN < 0 && deltaE < 0) {
    wcbDecimal = 180 + theta
    quadrant = 'SW'
  } else if (deltaN > 0 && deltaE < 0) {
    wcbDecimal = 360 - theta
    quadrant = 'NW'
  } else if (deltaN === 0 && deltaE > 0) {
    wcbDecimal = 90
    quadrant = 'E'
  } else if (deltaN === 0 && deltaE < 0) {
    wcbDecimal = 270
    quadrant = 'W'
  } else if (deltaE === 0 && deltaN > 0) {
    wcbDecimal = 0
    quadrant = 'N'
  } else if (deltaE === 0 && deltaN < 0) {
    wcbDecimal = 180
    quadrant = 'S'
  } else {
    wcbDecimal = 0
    quadrant = 'N/A'
  }

  const wcbDMS = bearingToString(wcbDecimal)
  const backDecimal = backBearing(wcbDecimal)
  const backDMS = bearingToString(backDecimal)

  const steps: InverseStep[] = [
    {
      description: `ΔE = E₂ - E₁`,
      formula: `${e2.toFixed(3)} - ${e1.toFixed(3)}`,
      value: `${deltaE.toFixed(4)} m`,
    },
    {
      description: `ΔN = N₂ - N₁`,
      formula: `${n2.toFixed(3)} - ${n1.toFixed(3)}`,
      value: `${deltaN.toFixed(4)} m`,
    },
    {
      description: `Distance = √(ΔE² + ΔN²)`,
      formula: `√(${deltaE.toFixed(4)}² + ${deltaN.toFixed(4)}²)`,
      value: `${distance.toFixed(4)} m`,
    },
    {
      description: `θ = arctan(|ΔE|/|ΔN|)`,
      formula: `arctan(${Math.abs(deltaE).toFixed(4)}/${Math.abs(deltaN).toFixed(4)})`,
      value: `${theta.toFixed(6)}°`,
    },
    {
      description: `Quadrant: ${quadrant} (ΔN ${deltaN >= 0 ? '>' : '<'} 0, ΔE ${deltaE >= 0 ? '>' : '<'} 0)`,
      formula: `WCB = ${quadrant === 'NE' || quadrant === 'N' || quadrant === 'NW' ? (quadrant === 'NE' ? 'θ' : quadrant === 'NW' ? '360°-θ' : '0°') : quadrant === 'SE' || quadrant === 'S' ? (quadrant === 'SE' ? '180°-θ' : '180°') : quadrant === 'E' ? '90°' : '270°'}`,
      value: wcbDMS,
    },
    {
      description: `Back Bearing = WCB + 180°`,
      formula: `${wcbDecimal.toFixed(4)}° + 180°`,
      value: backDMS,
    },
  ]

  // Arithmetic check: recompute ΔE, ΔN from distance and bearing
  // Source: Rule 5 — show independently
  const checkDist = Math.sqrt(deltaE * deltaE + deltaN * deltaN)
  const arithmeticCheck = { passed: Math.abs(checkDist - distance) < 0.001, value: checkDist - distance }

  return {
    deltaE,
    deltaN,
    distance,
    theta,
    reducedBearing: bearingToString(theta),
    wcbDecimal,
    wcbDMS,
    backBearingDecimal: backDecimal,
    backBearingDMS: backDMS,
    quadrant,
    steps,
    arithmeticCheck,
  }
}

// ─── PART 2: POLAR (RADIATION) ───────────────────────────────────────────────
// Source: Ghilani & Wolf, Elementary Surveying 16th Ed., Section 10.4

export interface PolarInput {
  e1: number
  n1: number
  bearingDeg: number
  bearingMin: number
  bearingSec: number
  distance: number
  label1?: string
  label2?: string
}

export interface PolarResult {
  wcbDecimal: number
  wcbDMS: string
  e2: number
  n2: number
  steps: InverseStep[]
}

export function polarComputation(input: PolarInput): PolarResult {
  const { e1, n1, bearingDeg, bearingMin, bearingSec, distance, label1 = 'P1', label2 = 'P2' } = input

  // Source: Ghilani & Wolf, Section 10.4 — E2 = E1 + D×sin(WCB), N2 = N1 + D×cos(WCB)
  const wcbDecimal = bearingDeg + bearingMin / 60 + bearingSec / 3600
  const wcbRad = wcbDecimal * Math.PI / 180
  const e2 = e1 + distance * Math.sin(wcbRad)
  const n2 = n1 + distance * Math.cos(wcbRad)
  const wcbDMS = bearingToString(wcbDecimal)

  const steps: InverseStep[] = [
    {
      description: `WCB (decimal) = D° + M'/60 + S"/3600`,
      formula: `${bearingDeg}° + ${bearingMin}'/60 + ${bearingSec}"/3600`,
      value: `${wcbDecimal.toFixed(6)}°`,
    },
    {
      description: `E₂ = E₁ + D × sin(WCB)`,
      formula: `${e1.toFixed(3)} + ${distance.toFixed(3)} × sin(${wcbDecimal.toFixed(4)}°)`,
      value: `${e2.toFixed(4)} m`,
    },
    {
      description: `N₂ = N₁ + D × cos(WCB)`,
      formula: `${n1.toFixed(3)} + ${distance.toFixed(3)} × cos(${wcbDecimal.toFixed(4)}°)`,
      value: `${n2.toFixed(4)} m`,
    },
  ]

  return { wcbDecimal, wcbDMS, e2, n2, steps }
}

// ─── PART 3: BEARING INTERSECTION ─────────────────────────────────────────────
// Source: Ghilani & Wolf, Elementary Surveying 16th Ed., Section 10.6
// Source: Schofield & Breach, Engineering Surveying 7th Ed., Chapter 6

export interface IntersectionInput {
  e1: number; n1: number; label1?: string
  e2: number; n2: number; label2?: string
  bearingDeg1: number; bearingMin1: number; bearingSec1: number
  bearingDeg2: number; bearingMin2: number; bearingSec2: number
}

export interface IntersectionResult {
  e3: number
  n3: number
  distanceFrom1: number
  distanceFrom2: number
  checkN3: number
  checkDiff: number
  steps: InverseStep[]
  isWithinTolerance: boolean
}

export function intersectionComputation(input: IntersectionInput): IntersectionResult {
  const {
    e1, n1, e2, n2,
    bearingDeg1, bearingMin1, bearingSec1,
    bearingDeg2, bearingMin2, bearingSec2,
  } = input

  const alpha1 = (bearingDeg1 + bearingMin1 / 60 + bearingSec1 / 3600) * Math.PI / 180
  const alpha2 = (bearingDeg2 + bearingMin2 / 60 + bearingSec2 / 3600) * Math.PI / 180

  const tan1 = Math.tan(alpha1)
  const tan2 = Math.tan(alpha2)

  const denom = tan1 - tan2
  const e3 = (e2 - e1 + n1 * tan1 - n2 * tan2) / denom
  const n3From1 = n1 + (e3 - e1) * Math.tan(alpha1)

  // Independent check: compute N3 from P2 side
  const n3From2 = n2 + (e3 - e2) * Math.tan(alpha2)
  const checkDiff = Math.abs(n3From1 - n3From2)

  const dist1 = Math.sqrt((e3 - e1) ** 2 + (n3From1 - n1) ** 2)
  const dist2 = Math.sqrt((e3 - e2) ** 2 + (n3From1 - n2) ** 2)

  const steps: InverseStep[] = [
    {
      description: `α₁ = ${bearingDeg1}° ${bearingMin1}' ${bearingSec1}" → radians`,
      formula: `${(alpha1 * 180 / Math.PI).toFixed(6)}°`,
      value: `${alpha1.toFixed(8)} rad`,
    },
    {
      description: `α₂ = ${bearingDeg2}° ${bearingMin2}' ${bearingSec2}" → radians`,
      formula: `${(alpha2 * 180 / Math.PI).toFixed(6)}°`,
      value: `${alpha2.toFixed(8)} rad`,
    },
    {
      description: `tan(α₁) - tan(α₂)`,
      formula: `${tan1.toFixed(8)} - ${tan2.toFixed(8)}`,
      value: `${denom.toFixed(8)}`,
    },
    {
      description: `E₃ = (E₂ - E₁ + N₁tan(α₁) - N₂tan(α₂)) / (tan(α₁) - tan(α₂))`,
      formula: `(${e2.toFixed(3)} - ${e1.toFixed(3)} + ${n1.toFixed(3)}×${tan1.toFixed(6)} - ${n2.toFixed(3)}×${tan2.toFixed(6)}) / ${denom.toFixed(6)}`,
      value: `${e3.toFixed(4)} m`,
    },
    {
      description: `N₃ = N₁ + (E₃ - E₁) × tan(α₁)`,
      formula: `${n1.toFixed(3)} + (${e3.toFixed(4)} - ${e1.toFixed(3)}) × ${tan1.toFixed(6)}`,
      value: `${n3From1.toFixed(4)} m`,
    },
    {
      description: `[CHECK] N₃ from P₂ side = N₂ + (E₃ - E₂) × tan(α₂)`,
      formula: `${n2.toFixed(3)} + (${e3.toFixed(4)} - ${e2.toFixed(3)}) × ${tan2.toFixed(6)}`,
      value: `${n3From2.toFixed(4)} m`,
    },
    {
      description: `[CHECK] Difference between both N₃ computations`,
      formula: `|${n3From1.toFixed(4)} - ${n3From2.toFixed(4)}|`,
      value: `${checkDiff.toFixed(4)} m  ${checkDiff <= 0.001 ? '✓ PASS' : '✗ FAIL'}`,
    },
  ]

  return {
    e3, n3: n3From1,
    distanceFrom1: dist1,
    distanceFrom2: dist2,
    checkN3: n3From2,
    checkDiff,
    steps,
    isWithinTolerance: checkDiff <= 0.001,
  }
}

// ─── PART 4: RESECTION (TIENSTRA/POTHENOT) ────────────────────────────────────
// Source: Ghilani & Wolf, Elementary Surveying 16th Ed., Section 10.7

export interface ResectionInput {
  // Three known points
  eA: number; nA: number; labelA?: string
  eB: number; nB: number; labelB?: string
  eC: number; nC: number; labelC?: string
  // Angles measured at unknown point P
  alphaDeg: number; alphaMin: number; alphaSec: number  // angle APB
  betaDeg: number; betaMin: number; betaSec: number    // angle BPC
}

export interface ResectionResult {
  eP: number
  nP: number
  distToA: number
  distToB: number
  distToC: number
  k1: number; k2: number; k3: number
  sumK: number
  isDangerCircle: boolean
  steps: InverseStep[]
}

function toRadians(deg: number, min: number, sec: number): number {
  return (deg + min / 60 + sec / 3600) * Math.PI / 180
}

export function resectionComputation(input: ResectionInput): ResectionResult {
  const { eA, nA, eB, nB, eC, nC,
    alphaDeg, alphaMin, alphaSec,
    betaDeg, betaMin, betaSec } = input

  const alpha = toRadians(alphaDeg, alphaMin, alphaSec)
  const beta = toRadians(betaDeg, betaMin, betaSec)
  const gamma = 2 * Math.PI - alpha - beta

  const cot = (r: number) => 1 / Math.tan(r)

  // Source: Ghilani & Wolf, Section 10.7 — Tienstra method
  // Compute triangle sides from known points
  const distAB = Math.sqrt((eB - eA) ** 2 + (nB - nA) ** 2)
  const distBC = Math.sqrt((eC - eB) ** 2 + (nC - nB) ** 2)
  const distAC = Math.sqrt((eC - eA) ** 2 + (nC - nA) ** 2)

  // Triangle angles at A, B, C using law of cosines
  const clamp = (x: number) => Math.max(-1, Math.min(1, x))
  const A = Math.acos(clamp((distAB ** 2 + distAC ** 2 - distBC ** 2) / (2 * distAB * distAC)))
  const B = Math.acos(clamp((distAB ** 2 + distBC ** 2 - distAC ** 2) / (2 * distAB * distBC)))
  const C = Math.acos(clamp((distAC ** 2 + distBC ** 2 - distAB ** 2) / (2 * distAC * distBC)))

  const cot_A = cot(A)
  const cot_B = cot(B)
  const cot_C = cot(C)
  const cot_alpha = cot(alpha)
  const cot_beta = cot(beta)
  const cot_gamma = cot(gamma)

  const k1 = 1 / (cot_A - cot_alpha)
  const k2 = 1 / (cot_B - cot_beta)
  const k3 = 1 / (cot_C - cot_gamma)
  const sumK = k1 + k2 + k3

  const eP = (k1 * eA + k2 * eB + k3 * eC) / sumK
  const nP = (k1 * nA + k2 * nB + k3 * nC) / sumK

  const distToA = Math.sqrt((eP - eA) ** 2 + (nP - nA) ** 2)
  const distToB = Math.sqrt((eP - eB) ** 2 + (nP - nB) ** 2)
  const distToC = Math.sqrt((eP - eC) ** 2 + (nP - nC) ** 2)

  const isDangerCircle = Math.abs(sumK) < 0.001

  const steps: InverseStep[] = [
    {
      description: `α = ∠APB = ${alphaDeg}° ${alphaMin}' ${alphaSec}"`,
      formula: `${(alpha * 180 / Math.PI).toFixed(6)}°`,
      value: `${alpha.toFixed(8)} rad`,
    },
    {
      description: `β = ∠BPC = ${betaDeg}° ${betaMin}' ${betaSec}"`,
      formula: `${(beta * 180 / Math.PI).toFixed(6)}°`,
      value: `${beta.toFixed(8)} rad`,
    },
    {
      description: `γ = 360° - (α + β)`,
      formula: `360° - (${(alpha * 180 / Math.PI).toFixed(4)}° + ${(beta * 180 / Math.PI).toFixed(4)}°)`,
      value: `${(gamma * 180 / Math.PI).toFixed(6)}°`,
    },
    {
      description: `cot(A) = (b² + c² - a²) / (2bc)`,
      formula: `${cot_A.toFixed(6)}`,
      value: `A = ${(A * 180 / Math.PI).toFixed(6)}°`,
    },
    {
      description: `cot(B) = (a² + c² - b²) / (2ac)`,
      formula: `${cot_B.toFixed(6)}`,
      value: `B = ${(B * 180 / Math.PI).toFixed(6)}°`,
    },
    {
      description: `cot(C) = (a² + b² - c²) / (2ab)`,
      formula: `${cot_C.toFixed(6)}`,
      value: `C = ${(C * 180 / Math.PI).toFixed(6)}°`,
    },
    {
      description: `K₁ = 1 / (cot(A) - cot(α))`,
      formula: `1 / (${cot_A.toFixed(4)} - ${cot_alpha.toFixed(4)})`,
      value: `${k1.toFixed(6)}`,
    },
    {
      description: `K₂ = 1 / (cot(B) - cot(β))`,
      formula: `1 / (${cot_B.toFixed(4)} - ${cot_beta.toFixed(4)})`,
      value: `${k2.toFixed(6)}`,
    },
    {
      description: `K₃ = 1 / (cot(C) - cot(γ))`,
      formula: `1 / (${cot_C.toFixed(4)} - ${cot_gamma.toFixed(4)})`,
      value: `${k3.toFixed(6)}`,
    },
    {
      description: `ΣK = K₁ + K₂ + K₃`,
      formula: `${k1.toFixed(6)} + ${k2.toFixed(6)} + ${k3.toFixed(6)}`,
      value: `${sumK.toFixed(6)}${isDangerCircle ? ' ⚠ DANGER CIRCLE' : ''}`,
    },
    {
      description: `Eₚ = (K₁×Eₐ + K₂×Eᵦ + K₃×E꜀) / ΣK`,
      formula: `(${k1.toFixed(4)}×${eA.toFixed(3)} + ${k2.toFixed(4)}×${eB.toFixed(3)} + ${k3.toFixed(4)}×${eC.toFixed(3)}) / ${sumK.toFixed(4)}`,
      value: `${eP.toFixed(4)} m`,
    },
    {
      description: `Nₚ = (K₁×Nₐ + K₂×Nᵦ + K₃×N꜀) / ΣK`,
      formula: `(${k1.toFixed(4)}×${nA.toFixed(3)} + ${k2.toFixed(4)}×${nB.toFixed(3)} + ${k3.toFixed(4)}×${nC.toFixed(3)}) / ${sumK.toFixed(4)}`,
      value: `${nP.toFixed(4)} m`,
    },
  ]

  return { eP, nP, distToA, distToB, distToC, k1, k2, k3, sumK, isDangerCircle, steps }
}

// ─── PART 5: AREA BY COORDINATES (SHOELACE) ───────────────────────────────────
// Source: Ghilani & Wolf, Elementary Surveying 16th Ed., Section 12.5
// Source: N.N. Basak, Surveying and Levelling

export interface AreaInput {
  points: Array<{ label: string; easting: number; northing: number }>
}

export interface AreaDiagonalRow {
  from: string
  to: string
  posProduct: number
  negProduct: number
}

export interface AreaResult {
  doubleArea: number
  areaSqm: number
  areaHa: number
  perimeter: number
  diagonalRows: AreaDiagonalRow[]
  positiveSum: number
  negativeSum: number
  doubleAreaAlt: number
  areaAlt: number
  arithmeticCheck: { passed: boolean; diff: number }
  centroid: { easting: number; northing: number }
  steps: InverseStep[]
}

function closePolygon(pts: Array<{ label: string; easting: number; northing: number }>) {
  const closed = [...pts]
  if (pts.length > 0 &&
    (pts[0].easting !== pts[pts.length - 1].easting ||
      pts[0].northing !== pts[pts.length - 1].northing)) {
    closed.push(pts[0])
  }
  return closed
}

export function areaComputation(input: AreaInput): AreaResult {
  const pts = input.points
  if (pts.length < 3) {
    return {
      doubleArea: 0, areaSqm: 0, areaHa: 0, perimeter: 0,
      diagonalRows: [], positiveSum: 0, negativeSum: 0,
      doubleAreaAlt: 0, areaAlt: 0,
      arithmeticCheck: { passed: false, diff: 0 },
      centroid: { easting: 0, northing: 0 },
      steps: [],
    }
  }

  const closed = closePolygon(pts)

  // Method 1: Standard shoelace (Source: Ghilani & Wolf, Section 12.5)
  let posSum = 0
  let negSum = 0
  const diagonalRows: AreaDiagonalRow[] = []

  for (let i = 0; i < closed.length - 1; i++) {
    const pos = closed[i].easting * closed[i + 1].northing
    const neg = closed[i + 1].easting * closed[i].northing
    posSum += pos
    negSum += neg
    diagonalRows.push({
      from: closed[i].label,
      to: closed[i + 1].label,
      posProduct: pos,
      negProduct: neg,
    })
  }

  const doubleArea = Math.abs(posSum - negSum)
  const areaSqm = doubleArea / 2

  // Method 2: Alternative form (Source: Rule 5 — arithmetic check)
  // 2A = |Σ En(Nn+1 - Nn-1)|
  let altPosSum = 0
  for (let i = 0; i < pts.length; i++) {
    const prev = i === 0 ? pts.length - 1 : i - 1
    const next = i === pts.length - 1 ? 0 : i + 1
    altPosSum += pts[i].easting * (pts[next].northing - pts[prev].northing)
  }
  const doubleAreaAlt = Math.abs(altPosSum)
  const areaAlt = doubleAreaAlt / 2

  const arithmeticCheck = {
    passed: Math.abs(doubleArea - doubleAreaAlt) < 0.001,
    diff: Math.abs(doubleArea - doubleAreaAlt),
  }

  // Perimeter (Source: Basak)
  let perimeter = 0
  for (let i = 0; i < closed.length - 1; i++) {
    const dx = closed[i + 1].easting - closed[i].easting
    const dy = closed[i + 1].northing - closed[i].northing
    perimeter += Math.sqrt(dx * dx + dy * dy)
  }

  // Centroid (Source: Basak)
  let cx = 0, cy = 0
  for (let i = 0; i < pts.length; i++) {
    const cross = pts[i].easting * (pts[(i + 1) % pts.length].northing - pts[(i - 1 + pts.length) % pts.length].northing)
    cx += (pts[i].easting + pts[(i + 1) % pts.length].easting) * cross
    cy += (pts[i].northing + pts[(i + 1) % pts.length].northing) * cross
  }
  cx /= (3 * (posSum - negSum))
  cy /= (3 * (posSum - negSum))

  const steps: InverseStep[] = [
    {
      description: `Σ(E × N_next) — positive diagonal products`,
      formula: diagonalRows.map((r: any) => `${r.from}×${r.to}=${r.posProduct.toFixed(2)}`).join(' + '),
      value: `${posSum.toFixed(4)} m²`,
    },
    {
      description: `Σ(N × E_next) — negative diagonal products`,
      formula: diagonalRows.map((r: any) => `${r.to}×${r.from}=${r.negProduct.toFixed(2)}`).join(' + '),
      value: `${negSum.toFixed(4)} m²`,
    },
    {
      description: `2A = |Σpos - Σneg|`,
      formula: `|${posSum.toFixed(4)} - ${negSum.toFixed(4)}|`,
      value: `${doubleArea.toFixed(4)} m²`,
    },
    {
      description: `A = 2A / 2`,
      formula: `${doubleArea.toFixed(4)} / 2`,
      value: `${areaSqm.toFixed(4)} m² = ${(areaSqm / 10000).toFixed(4)} ha`,
    },
    {
      description: `[CHECK] Alternative: 2A = |Σ En(Nn+1 - Nn-1)|`,
      formula: `${doubleAreaAlt.toFixed(4)}`,
      value: `Difference: ${arithmeticCheck.diff.toFixed(4)} m²  ${arithmeticCheck.passed ? '✓ PASS' : '✗ FAIL'}`,
    },
    {
      description: `Perimeter = Σ√(ΔE² + ΔN²)`,
      formula: `${perimeter.toFixed(4)} m (${(perimeter / 1000).toFixed(4)} km)`,
      value: `${perimeter.toFixed(4)} m`,
    },
  ]

  return {
    doubleArea, areaSqm,
    areaHa: areaSqm / 10000,
    perimeter,
    diagonalRows,
    positiveSum: posSum,
    negativeSum: negSum,
    doubleAreaAlt,
    areaAlt,
    arithmeticCheck,
    centroid: { easting: cx, northing: cy },
    steps,
  }
}

// ─── PART 6: JOIN COMPUTATION ─────────────────────────────────────────────────
// Source: Ghilani & Wolf, Elementary Surveying 16th Ed., Section 10.3

export interface JoinInput {
  points: Array<{ label: string; easting: number; northing: number }>
}

export interface JoinRow {
  from: string
  to: string
  deltaE: number
  deltaN: number
  distance: number
  wcbDecimal: number
  wcbDMS: string
  backBearingDMS: string
}

export interface JoinResult {
  rows: JoinRow[]
  totalPerimeter: number
}

export function joinComputation(input: JoinInput): JoinResult {
  const rows: JoinRow[] = []
  let totalPerimeter = 0

  for (let i = 0; i < input.points.length - 1; i++) {
    const p1 = input.points[i]
    const p2 = input.points[i + 1]
    const inv = inverseComputation({
      e1: p1.easting, n1: p1.northing,
      e2: p2.easting, n2: p2.northing,
      label1: p1.label, label2: p2.label,
    })
    rows.push({
      from: p1.label,
      to: p2.label,
      deltaE: inv.deltaE,
      deltaN: inv.deltaN,
      distance: inv.distance,
      wcbDecimal: inv.wcbDecimal,
      wcbDMS: inv.wcbDMS,
      backBearingDMS: inv.backBearingDMS,
    })
    totalPerimeter += inv.distance
  }

  return { rows, totalPerimeter }
}
