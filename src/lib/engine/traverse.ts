/**
 * Calculation standard: N.N. Basak — Surveying and Levelling
 * Source: N.N. Basak, Surveying and Levelling, Chapters 10-11
 * Source: Ghilani & Wolf, Elementary Surveying 16th Ed., Chapters 10, 12
 * Source: Survey Regulations 1994, Cap 299, Regulation 97
 * - No intermediate rounding
 * - Full floating point precision throughout
 * - Round only at final display layer
 * - Bearings: WCB 0-360° clockwise from North
 */

// METARDU Engine - Traverse calculations

import { NamedPoint2D, TraverseResult, TraverseLeg } from './types';
import { toRadians, bearingToString } from './angles';

export interface TraverseInput {
  points: NamedPoint2D[];
  distances: number[];
  bearings: number[];
  closingPoint?: { easting: number; northing: number };
}

export interface ForwardTraverseInput {
  start: NamedPoint2D;
  stations: string[]; // next stations (length = legs)
  distances: number[];
  bearings: number[]; // WCB degrees (length = legs)
}

export interface ForwardTraverseResult {
  legs: Array<{
    from: string;
    to: string;
    distance: number;
    bearing: number;
    bearingDMS: string;
    deltaE: number;
    deltaN: number;
    easting: number;
    northing: number;
  }>;
  totalDistance: number;
  end: NamedPoint2D;
}

function calculatePrecisionGrade(ratio: number): 'excellent' | 'good' | 'acceptable' | 'poor' {
  if (ratio <= 1/5000) return 'excellent';
  if (ratio <= 1/3000) return 'good';
  if (ratio <= 1/1000) return 'acceptable';
  return 'poor';
}

/**
 * Forward (unadjusted) traverse coordinate propagation.
 * Derived from standard traverse computation:
 *  ΔN = D·cos(WCB), ΔE = D·sin(WCB)
 */
export function forwardTraverse(input: ForwardTraverseInput): ForwardTraverseResult {
  const { start, stations, distances, bearings } = input
  const legs: ForwardTraverseResult['legs'] = []

  let totalDistance = 0
  let currentE = start.easting
  let currentN = start.northing

  const startName = start.name || 'START'

  for (let i = 0; i < bearings.length; i++) {
    const bearing = bearings[i]
    const distance = distances[i]
    const rad = toRadians(bearing)

    const deltaN = distance * Math.cos(rad)
    const deltaE = distance * Math.sin(rad)

    currentN += deltaN
    currentE += deltaE
    totalDistance += distance

    legs.push({
      from: i === 0 ? startName : stations[i - 1] || `P${i + 1}`,
      to: stations[i] || `P${i + 2}`,
      distance,
      bearing,
      bearingDMS: bearingToString(bearing),
      deltaE,
      deltaN,
      easting: currentE,
      northing: currentN,
    })
  }

  return {
    legs,
    totalDistance,
    end: { name: stations[stations.length - 1] || 'END', easting: currentE, northing: currentN },
  }
}

export function bowditchAdjustment(input: TraverseInput): TraverseResult {
  const { points, distances, bearings, closingPoint } = input;
  
  // Source: Basak, Chapter 11 — Bowditch (Compass) Rule: corrections proportional to leg distance
  // Source: Ghilani & Wolf, Chapter 12 — Bowditch adjustment formula
  let sumLat = 0;
  let sumDep = 0;
  let totalDistance = 0;
  
  const legs: TraverseLeg[] = [];
  
  for (let i = 0; i < bearings.length; i++) {
    const bearing = bearings[i];
    const distance = distances[i];
    const rad = toRadians(bearing);
    
    const deltaN = distance * Math.cos(rad);
    const deltaE = distance * Math.sin(rad);
    
    sumLat += deltaN;
    sumDep += deltaE;
    totalDistance += distance;
    
    // Raw deltas
    const rawDeltaN = deltaN;
    const rawDeltaE = deltaE;
    
    legs.push({
      from: points[i]?.name || (i === 0 ? points[0]?.name || 'P1' : `P${i + 1}`),
      to: points[i + 1]?.name || `P${i + 2}`,
      distance,
      bearing,
      bearingDMS: bearingToString(bearing),
      rawDeltaE: rawDeltaE,
      rawDeltaN,
      correctionE: 0,
      correctionN: 0,
      adjDeltaE: rawDeltaE,
      adjDeltaN: rawDeltaN,
      adjEasting: 0,
      adjNorthing: 0
    });
  }
  
  // Calculate closing error
  const start = points[0]
  const computedEndNorthing = start.northing + sumLat
  const computedEndEasting = start.easting + sumDep

  const closingErrorN = closingPoint
    ? (closingPoint.northing - computedEndNorthing)
    : -sumLat
  const closingErrorE = closingPoint
    ? (closingPoint.easting - computedEndEasting)
    : -sumDep
  const linearError = Math.sqrt(closingErrorN * closingErrorN + closingErrorE * closingErrorE);
  const precisionRatio = totalDistance > 0 ? linearError / totalDistance : 1;
  
  // Apply Bowditch corrections
  let currentEasting = points[0].easting;
  let currentNorthing = points[0].northing;
  
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    const correctionN = (leg.distance / totalDistance) * closingErrorN;
    const correctionE = (leg.distance / totalDistance) * closingErrorE;
    
    leg.correctionN = correctionN;
    leg.correctionE = correctionE;
    
    leg.adjDeltaN = leg.rawDeltaN + correctionN;
    leg.adjDeltaE = leg.rawDeltaE + correctionE;
    
    currentNorthing += leg.adjDeltaN;
    currentEasting += leg.adjDeltaE;
    
    leg.adjNorthing = currentNorthing;
    leg.adjEasting = currentEasting;
  }
  
  return {
    legs,
    closingErrorE,
    closingErrorN,
    linearError,
    precisionRatio,
    precisionGrade: calculatePrecisionGrade(precisionRatio),
    totalDistance,
    isClosed: precisionRatio <= 1/1000
  };
}

export function transitAdjustment(input: TraverseInput): TraverseResult {
  const { points, distances, bearings } = input;
  
  // Source: Basak, Chapter 11 — Transit Rule: corrections proportional to |Δ| of each leg
  // Source: Ghilani & Wolf, Chapter 12 — Transit adjustment
  let sumLat = 0;
  let sumDep = 0;
  let absSumLat = 0;
  let absSumDep = 0;
  let totalDistance = 0;
  
  const legs: TraverseLeg[] = [];
  
  for (let i = 0; i < bearings.length; i++) {
    const bearing = bearings[i];
    const distance = distances[i];
    const rad = toRadians(bearing);
    
    const deltaN = distance * Math.cos(rad);
    const deltaE = distance * Math.sin(rad);
    
    sumLat += deltaN;
    sumDep += deltaE;
    absSumLat += Math.abs(deltaN);
    absSumDep += Math.abs(deltaE);
    totalDistance += distance;
    
    legs.push({
      from: points[i]?.name || (i === 0 ? points[0]?.name || 'P1' : `P${i + 1}`),
      to: points[i + 1]?.name || `P${i + 2}`,
      distance,
      bearing,
      bearingDMS: bearingToString(bearing),
      rawDeltaE: deltaE,
      rawDeltaN: deltaN,
      correctionE: 0,
      correctionN: 0,
      adjDeltaE: deltaE,
      adjDeltaN: deltaN,
      adjEasting: 0,
      adjNorthing: 0
    });
  }
  
  // Closing error
  const closingErrorN = -sumLat;
  const closingErrorE = -sumDep;
  const linearError = Math.sqrt(closingErrorN * closingErrorN + closingErrorE * closingErrorE);
  const precisionRatio = totalDistance > 0 ? linearError / totalDistance : 1;
  
  // Apply Transit rule corrections
  let currentEasting = points[0].easting;
  let currentNorthing = points[0].northing;
  
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    
    let correctionN = 0;
    let correctionE = 0;
    
    if (absSumLat > 0) {
      correctionN = -(Math.abs(leg.rawDeltaN) / absSumLat) * closingErrorN;
    }
    if (absSumDep > 0) {
      correctionE = -(Math.abs(leg.rawDeltaE) / absSumDep) * closingErrorE;
    }
    
    leg.correctionN = correctionN;
    leg.correctionE = correctionE;
    
    leg.adjDeltaN = leg.rawDeltaN + correctionN;
    leg.adjDeltaE = leg.rawDeltaE + correctionE;
    
    currentNorthing += leg.adjDeltaN;
    currentEasting += leg.adjDeltaE;
    
    leg.adjNorthing = currentNorthing;
    leg.adjEasting = currentEasting;
  }
  
  return {
    legs,
    closingErrorE,
    closingErrorN,
    linearError,
    precisionRatio,
    precisionGrade: calculatePrecisionGrade(precisionRatio),
    totalDistance,
    isClosed: precisionRatio <= 1/1000
  };
}
