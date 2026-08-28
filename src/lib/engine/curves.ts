/**
 * Calculation standard: N.N. Basak — Surveying and Levelling
 * Source: N.N. Basak, Surveying and Levelling, Chapters 14-16
 * Source: Ghilani & Wolf, Elementary Surveying 16th Ed., Chapters 24-25
 * Source: RDM 1.3 Kenya August 2023, Sections 5.2-5.4
 * - No intermediate rounding
 * - Full floating point precision throughout
 * - Round only at final display layer
 */

// METARDU Engine - Curve calculations

import { CurveElements, CurveStakeoutResult, CurveStakeoutPoint } from './types';
import { toRadians, bearingToString } from './angles';

export function curveElements(
  radius: number,
  deflectionAngle: number,
  _isExternal?: boolean
): CurveElements {
  const delta = toRadians(deflectionAngle);
  const halfDelta = delta / 2;
  
  // Source: RDM 1.3 Section 5.2 / Basak Chapter 14
  // Tangent length: T = R × tan(Δ/2)
  const T = radius * Math.tan(halfDelta);

  // Arc length: L = R × Δ (radians)
  const L = radius * delta;

  // Long chord: C = 2R × sin(Δ/2)
  const C = 2 * radius * Math.sin(halfDelta);

  // External distance: E = R × (sec(Δ/2) - 1)
  const E = radius * (1 / Math.cos(halfDelta) - 1);

  // Mid-ordinate: M = R × (1 - cos(Δ/2))
  const M = radius * (1 - Math.cos(halfDelta));

  // Degree of curve (arc definition): D = 1718.873/R
  const D = 1718.873 / radius;
  
  return {
    radius,
    deflectionAngle,
    tangentLength: T,
    arcLength: L,
    longChord: C,
    externalDistance: E,
    midOrdinate: M,
    degreeOfCurve: D
  };
}

export function curveStakeout(
  piChainage: number,
  bearingIn: number,
  radius: number,
  deflectionAngle: number,
  interval: number = 20
): CurveStakeoutResult {
  const elements = curveElements(radius, deflectionAngle);
  
  // Calculate chainages
  const pcChainage = piChainage - elements.tangentLength;
  const ptChainage = pcChainage + elements.arcLength;
  
  const points: CurveStakeoutPoint[] = [];
  
  // Generate stakeout points
  const numPoints = Math.floor(elements.arcLength / interval);
  
  for (let i = 0; i <= numPoints; i++) {
    const arcLength = Math.min(i * interval, elements.arcLength);
    const chainage = pcChainage + arcLength;
    
    // Deflection angle to this point
    const deflectionToPoint = (arcLength / elements.arcLength) * deflectionAngle;
    const totalDeflection = deflectionToPoint / 2;
    
    // Chord length to this point
    const chordLength = 2 * radius * Math.sin(toRadians(deflectionToPoint / 2));
    
    points.push({
      chainage,
      deflectionAngle: bearingToString(deflectionToPoint),
      totalDeflection: bearingToString(totalDeflection),
      chordLength
    });
  }
  
  return {
    elements,
    points,
    pcChainage,
    piChainage,
    ptChainage
  };
}

export function verticalCurve(
  incomingGrade: number,
  outgoingGrade: number,
  curveLength: number,
  startRL: number,
  interval: number = 10
): Array<{ chainage: number; rl: number; cutFill: number }> {
  // Parabolic vertical curve: y = (g2 - g1) * x^2 / (2L)
  // where x is distance from start of curve
  
  const gradeDiff = outgoingGrade - incomingGrade;
  const results: Array<{ chainage: number; rl: number; cutFill: number }> = [];
  
  const numPoints = Math.floor(curveLength / interval);
  
  for (let i = 0; i <= numPoints; i++) {
    const x = i * interval;
    const chainage = x;
    
    // Height of curve at this point
    const y = (gradeDiff * x * x) / (2 * curveLength);
    
    // RL at this point
    const rl = startRL + (incomingGrade * x / 100) + y;
    
    results.push({
      chainage,
      rl,
      cutFill: y
    });
  }
  
  // Find highest/lowest point
  if (gradeDiff !== 0) {
    const apexDistance = (incomingGrade * curveLength) / gradeDiff;
    if (apexDistance > 0 && apexDistance < curveLength) {
      // Add apex point
      const apexY = (gradeDiff * apexDistance * apexDistance) / (2 * curveLength);
      const apexRL = startRL + (incomingGrade * apexDistance / 100) + apexY;
      results.push({
        chainage: apexDistance,
        rl: apexRL,
        cutFill: apexY
      });
    }
  }
  
  return results.sort((a, b) => a.chainage - b.chainage);
}

export type CompoundCurveElements = {
  R1: number
  R2: number
  delta1Deg: number
  delta2Deg: number
  t1: number
  t2: number
  l1: number
  l2: number
  totalLength: number
  chainT1: number
  chainJ: number
  chainT2: number
}

/**
 * Compound curve elements (basic).
 * Uses standard simple-curve element formulas for each arc.
 */
export function compoundCurveElements(input: {
  R1: number
  R2: number
  delta1Deg: number
  delta2Deg: number
  junctionChainage: number
}): CompoundCurveElements {
  const toRad = (deg: number) => toRadians(deg)

  const t1 = input.R1 * Math.tan(toRad(input.delta1Deg) / 2)
  const t2 = input.R2 * Math.tan(toRad(input.delta2Deg) / 2)
  const l1 = input.R1 * toRad(input.delta1Deg)
  const l2 = input.R2 * toRad(input.delta2Deg)

  const chainJ = input.junctionChainage
  const chainT1 = chainJ - t1
  const chainT2 = chainJ + t2

  return {
    R1: input.R1,
    R2: input.R2,
    delta1Deg: input.delta1Deg,
    delta2Deg: input.delta2Deg,
    t1,
    t2,
    l1,
    l2,
    totalLength: l1 + l2,
    chainT1,
    chainJ,
    chainT2,
  }
}

export type ReverseCurveApprox = {
  R1: number
  R2: number
  AB: number
  commonTangent: number
  totalLength: number
  /** True when the total length is the rigorous value (deflection angles supplied); false when it's the 180°-arc approximation. */
  isApprox: boolean
}

/**
 * Reverse curve (approx.) helper used by the UI tool.
 *
 * AUDIT FIX (M3, 2026-07-02):
 *   The previous implementation computed `totalLength = π·R1 + π·R2`,
 *   which assumes both arcs deflect by 180°. That's wrong for the
 *   general case where Δ1 ≠ Δ2. The correct formula is
 *   `L = R1·Δ1 + R2·Δ2` (radians). When deflection angles are supplied
 *   via the optional `delta1`/`delta2` parameters (decimal degrees),
 *   the rigorous length is returned and `isApprox = false`. When angles
 *   are not supplied, the old 180° approximation is preserved for
 *   backward compatibility, and `isApprox = true` flags it.
 *
 * @param input.R1     Radius of first arc (metres)
 * @param input.R2     Radius of second arc (metres)
 * @param input.AB     Distance between PIs of the two curves (metres)
 * @param input.delta1 Optional deflection angle of first arc (decimal degrees)
 * @param input.delta2 Optional deflection angle of second arc (decimal degrees)
 */
export function reverseCurveApprox(input: {
  R1: number
  R2: number
  AB: number
  delta1?: number
  delta2?: number
}): ReverseCurveApprox {
  const diff = input.R2 - input.R1
  const commonTangent = Math.sqrt(Math.max(0, input.AB * input.AB - diff * diff))

  let totalLength: number
  let isApprox: boolean

  if (
    typeof input.delta1 === 'number' &&
    typeof input.delta2 === 'number' &&
    !isNaN(input.delta1) &&
    !isNaN(input.delta2)
  ) {
    // Rigorous: L = R1·Δ1 + R2·Δ2 (angles in radians)
    const d1Rad = (input.delta1 * Math.PI) / 180
    const d2Rad = (input.delta2 * Math.PI) / 180
    totalLength = input.R1 * Math.abs(d1Rad) + input.R2 * Math.abs(d2Rad)
    isApprox = false
  } else {
    // Approximation: assumes both arcs are 180° (semicircles).
    // Flagged via isApprox = true so callers can warn the user.
    totalLength = Math.PI * input.R1 + Math.PI * input.R2
    isApprox = true
  }

  return { ...input, commonTangent, totalLength, isApprox }
}

// ─── CLOTHOID TRANSITION SPIRALS (EULER SPIRALS) ────────────────────────────

export interface ClothoidSpiralElements {
  radius: number // Circular curve radius R (metres)
  spiralLength: number // Spiral transition length Ls (metres)
  spiralParameter: number // Clothoid parameter A = sqrt(R * Ls)
  spiralAngleRadians: number // θs = Ls / (2R)
  spiralAngleDegrees: number
  spiralAngleDMS: string
  shiftP: number // p ≈ Ls^2 / (24R) - Ls^4 / (2688R^3)
  tangentShiftK: number // k ≈ Ls / 2 - Ls^3 / (240R^2)
  tangentX: number // X coordinate along tangent at SC
  tangentY: number // Y coordinate (offset) at SC
  longTangent: number // Long tangent Ts1 = X - Y / tan(θs)
  shortTangent: number // Short tangent Ts2 = Y / sin(θs)
  totalTangentLength?: number // Ts = (R + p) * tan(Δ / 2) + k
}

/**
 * Computes Clothoid Transition Spiral elements per RDM 1.3 / AASHTO standards.
 * Curvature increases linearly from 0 at TS (Tangent-Spiral) to 1/R at SC (Spiral-Curve).
 */
export function computeClothoidSpiral(
  radius: number,
  spiralLength: number,
  totalDeflectionDeg?: number
): ClothoidSpiralElements {
  const R = radius
  const Ls = spiralLength

  // Parameter A = sqrt(R * Ls)
  const A = Math.sqrt(R * Ls)

  // Total spiral angle θs = Ls / (2R) in radians
  const thetaS_rad = Ls / (2 * R)
  const thetaS_deg = (thetaS_rad * 180) / Math.PI
  const thetaS_DMS = bearingToString(thetaS_deg)

  // Shift of the circular arc (p): p ≈ Ls^2 / (24R) - Ls^4 / (2688R^3)
  const Ls2 = Ls * Ls
  const R2 = R * R
  const shiftP = Ls2 / (24 * R) - (Ls2 * Ls2) / (2688 * R * R2)

  // Tangent shift (k): k ≈ Ls / 2 - Ls^3 / (240R^2)
  const tangentShiftK = Ls / 2 - (Ls * Ls2) / (240 * R2)

  // Tangent coordinates (X, Y) at SC using Taylor series expansion:
  // X = Ls * (1 - Ls^2 / (40 R^2) + Ls^4 / (3456 R^4))
  // Y = (Ls^2 / (6 R)) * (1 - Ls^2 / (56 R^2))
  const tangentX = Ls * (1 - Ls2 / (40 * R2) + (Ls2 * Ls2) / (3456 * R2 * R2))
  const tangentY = (Ls2 / (6 * R)) * (1 - Ls2 / (56 * R2))

  // Spiral tangents
  const tanTheta = Math.tan(thetaS_rad)
  const sinTheta = Math.sin(thetaS_rad)
  const longTangent = tangentX - (tanTheta !== 0 ? tangentY / tanTheta : 0)
  const shortTangent = sinTheta !== 0 ? tangentY / sinTheta : 0

  let totalTangentLength: number | undefined
  if (totalDeflectionDeg !== undefined) {
    const deltaRad = (totalDeflectionDeg * Math.PI) / 180
    totalTangentLength = (R + shiftP) * Math.tan(deltaRad / 2) + tangentShiftK
  }

  return {
    radius: R,
    spiralLength: Ls,
    spiralParameter: A,
    spiralAngleRadians: thetaS_rad,
    spiralAngleDegrees: thetaS_deg,
    spiralAngleDMS: thetaS_DMS,
    shiftP,
    tangentShiftK,
    tangentX,
    tangentY,
    longTangent,
    shortTangent,
    totalTangentLength,
  }
}

// ─── ADVANCED VERTICAL CURVE WITH TURNING POINTS & DRAINAGE ─────────────────

export interface VerticalCurveAnalysis {
  curveType: 'crest' | 'sag' | 'flat'
  g1: number // %
  g2: number // %
  gradeDifferenceA: number // |g2 - g1| %
  length: number // m
  kValue: number // K = L / A
  stationVPC: number
  elevationVPC: number
  stationVPI: number
  elevationVPI: number
  stationVPT: number
  elevationVPT: number
  turningStation?: number // High point for crest, low point for sag
  turningElevation?: number
  hasDrainageTurningPoint: boolean
  isKCompliantRDM: boolean // Min K >= 15 for 80 km/h crest per RDM 1.3
}

/**
 * Calculates Vertical Parabolic Curve geometry with exact high/low turning points for drainage design.
 */
export function computeVerticalCurveAnalysis(input: {
  g1: number // incoming grade in % (e.g. +3.5)
  g2: number // outgoing grade in % (e.g. -2.0)
  length: number // curve length L in metres
  stationVPI: number
  elevationVPI: number
  designSpeedKmh?: number // default 80 km/h
}): VerticalCurveAnalysis {
  const { g1, g2, length: L, stationVPI, elevationVPI, designSpeedKmh = 80 } = input

  const A = Math.abs(g2 - g1)
  const kVal = A > 0 ? L / A : 0

  const halfL = L / 2
  const stationVPC = stationVPI - halfL
  const stationVPT = stationVPI + halfL

  // VPC & VPT elevations
  const elevationVPC = elevationVPI - (g1 / 100) * halfL
  const elevationVPT = elevationVPI + (g2 / 100) * halfL

  // Determine curve type
  let curveType: 'crest' | 'sag' | 'flat' = 'flat'
  if (g1 > g2) curveType = 'crest'
  else if (g1 < g2) curveType = 'sag'

  // Turning point: x = -g1 * L / (g2 - g1)
  let turningStation: number | undefined
  let turningElevation: number | undefined
  let hasDrainageTurningPoint = false

  if (g1 * g2 < 0 && g2 !== g1) {
    // Turning point lies inside the curve if grades have opposite signs
    const xTurning = (-g1 * L) / (g2 - g1)
    if (xTurning >= 0 && xTurning <= L) {
      hasDrainageTurningPoint = true
      turningStation = stationVPC + xTurning
      // Elevation: y(x) = yVPC + (g1/100)*x + (g2 - g1)/(200*L) * x^2
      const yOffset = ((g2 - g1) / (200 * L)) * xTurning * xTurning
      turningElevation = elevationVPC + (g1 / 100) * xTurning + yOffset
    }
  }

  // Minimum K standards per Kenya RDM 1.3 Table 5.4:
  // 80 km/h: Crest K_min = 26, Sag K_min = 20
  const minK = curveType === 'crest' ? (designSpeedKmh >= 100 ? 52 : 26) : (designSpeedKmh >= 100 ? 30 : 20)
  const isKCompliantRDM = kVal >= minK

  return {
    curveType,
    g1,
    g2,
    gradeDifferenceA: A,
    length: L,
    kValue: kVal,
    stationVPC,
    elevationVPC,
    stationVPI,
    elevationVPI,
    stationVPT,
    elevationVPT,
    turningStation,
    turningElevation,
    hasDrainageTurningPoint,
    isKCompliantRDM,
  }
}

