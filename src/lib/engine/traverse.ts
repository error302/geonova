// GeoNova Engine - Traverse calculations
// Based on N.N. Basak Surveying and Levelling

import { NamedPoint2D, TraverseResult, TraverseLeg } from './types';
import { toRadians, bearingToString } from './angles';
import { distanceBearing } from './distance';

export interface TraverseInput {
  points: NamedPoint2D[];
  distances: number[];
  bearings: number[];
}

function calculatePrecisionGrade(ratio: number): 'excellent' | 'good' | 'acceptable' | 'poor' {
  if (ratio <= 1/5000) return 'excellent';
  if (ratio <= 1/3000) return 'good';
  if (ratio <= 1/1000) return 'acceptable';
  return 'poor';
}

export function bowditchAdjustment(input: TraverseInput): TraverseResult {
  const { points, distances, bearings } = input;
  
  // Calculate raw latitude and departure
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
    let rawDeltaN = deltaN;
    let rawDeltaE = deltaE;
    
    // For closed traverse, use closing point
    if (points.length > bearings.length && i === bearings.length - 1) {
      const lastPoint = points[points.length - 1];
      const firstPoint = points[0];
      const closeResult = distanceBearing(lastPoint, firstPoint);
      rawDeltaN = closeResult.deltaN;
      rawDeltaE = closeResult.deltaE;
      sumLat += rawDeltaN;
      sumDep += rawDeltaE;
    }
    
    legs.push({
      from: points[i].name,
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
  const closingErrorN = -sumLat;
  const closingErrorE = -sumDep;
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
  
  // Calculate absolute sums for Transit rule
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
      from: points[i].name,
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
