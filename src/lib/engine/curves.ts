/**
 * Calculation standard: N.N. Basak — Surveying and Levelling
 * - No intermediate rounding
 * - Full floating point precision throughout
 * - Round only at final display layer
 * - Bearings: WCB 0-360° clockwise from North
 */

// GeoNova Engine - Curve calculations

import { CurveElements, CurveStakeoutResult, CurveStakeoutPoint } from './types';
import { toRadians, toDegrees, bearingToString } from './angles';

export function curveElements(
  radius: number,
  deflectionAngle: number,
  isExternal?: boolean
): CurveElements {
  const delta = toRadians(deflectionAngle);
  const halfDelta = delta / 2;
  
  // Tangent length
  const T = radius * Math.tan(halfDelta);
  
  // Arc length
  const L = radius * delta;
  
  // Long chord
  const C = 2 * radius * Math.sin(halfDelta);
  
  // External distance
  const E = radius * (1 / Math.cos(halfDelta) - 1);
  
  // Mid-ordinate
  const M = radius * (1 - Math.cos(halfDelta));
  
  // Degree of curve (arc definition)
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
  
  return results.sort((a, b) => a.chainage - b.chainage);
}
