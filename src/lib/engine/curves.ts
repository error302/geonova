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
import { toRadians, toDegrees, bearingToString } from './angles';

export function curveElements(
  radius: number,
  deflectionAngle: number,
  isExternal?: boolean
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
  const delta = toRadians(deflectionAngle);
  
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
  
  return results.sort((a: any, b: any) => a.chainage - b.chainage);
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
}

/**
 * Reverse curve (approx.) helper used by the UI tool.
 */
export function reverseCurveApprox(input: { R1: number; R2: number; AB: number }): ReverseCurveApprox {
  const diff = input.R2 - input.R1
  const commonTangent = Math.sqrt(Math.max(0, input.AB * input.AB - diff * diff))
  const totalLength = Math.PI * input.R1 + Math.PI * input.R2
  return { ...input, commonTangent, totalLength }
}
