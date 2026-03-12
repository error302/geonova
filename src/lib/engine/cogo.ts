// GeoNova Engine - COGO (Coordinate Geometry)
// Based on N.N. Basak Surveying and Levelling

import { Point2D, COGOIntersection, COGORadiation, COOResection } from './types';
import { toRadians, toDegrees } from './angles';
import { distanceBearing } from './distance';

export function bearingIntersection(
  stationA: Point2D,
  bearingA: number,
  stationB: Point2D,
  bearingB: number
): COGOIntersection | null {
  // Solve for intersection of two bearings
  const radA = toRadians(bearingA);
  const radB = toRadians(bearingB);
  
  // Calculate using law of sines
  const dx = stationB.easting - stationA.easting;
  const dy = stationB.northing - stationA.northing;
  
  const theta = toDegrees(Math.atan2(dx, dy));
  const angleB = bearingB - theta;
  const angleA = bearingA - theta + 180;
  
  const radB_rad = toRadians(angleB);
  const radA_rad = toRadians(angleA);
  
  const distAB = Math.sqrt(dx * dx + dy * dy);
  
  if (Math.abs(Math.sin(radA_rad - radB_rad)) < 0.0001) {
    return null; // Lines are parallel
  }
  
  const distAP = (distAB * Math.sin(radB_rad)) / Math.sin(radA_rad - radB_rad);
  const distBP = (distAB * Math.sin(radA_rad)) / Math.sin(radA_rad - radB_rad);
  
  const point: Point2D = {
    easting: stationA.easting + distAP * Math.sin(toRadians(bearingA)),
    northing: stationA.northing + distAP * Math.cos(toRadians(bearingA))
  };
  
  return {
    point,
    distanceFromA: Math.round(distAP * 1000) / 1000,
    distanceFromB: Math.round(distBP * 1000) / 1000
  };
}

export function distanceIntersection(
  stationA: Point2D,
  distanceA: number,
  stationB: Point2D,
  distanceB: number
): [Point2D, Point2D] | null {
  // Circle-circle intersection
  const dx = stationB.easting - stationA.easting;
  const dy = stationB.northing - stationA.northing;
  const distAB = Math.sqrt(dx * dx + dy * dy);
  
  // Check if circles intersect
  if (distAB > distanceA + distanceB || distAB < Math.abs(distanceA - distanceB) || distAB === 0) {
    return null;
  }
  
  const a = (distanceA * distanceA - distanceB * distanceB + distAB * distAB) / (2 * distAB);
  const h = Math.sqrt(distanceA * distanceA - a * a);
  
  const cx = stationA.easting + a * dx / distAB;
  const cy = stationA.northing + a * dy / distAB;
  
  const point1: Point2D = {
    easting: cx + h * dy / distAB,
    northing: cy - h * dx / distAB
  };
  
  const point2: Point2D = {
    easting: cx - h * dy / distAB,
    northing: cy + h * dx / distAB
  };
  
  return [point1, point2];
}

export function tienstraResection(
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  angle1: number,  // Angle at P1 (between lines to P2 and unknown point)
  angle2: number   // Angle at P2 (between lines to P3 and unknown point)
): COOResection | null {
  // Tienstra's method for three-point resection
  
  const d12 = distanceBearing(p1, p2).distance;
  const d23 = distanceBearing(p2, p3).distance;
  const d31 = distanceBearing(p3, p1).distance;
  
  const theta1 = toRadians(angle1);
  const theta2 = toRadians(angle2);
  
  const cot1 = 1 / Math.tan(theta1);
  const cot2 = 1 / Math.tan(theta2);
  
  // Calculate weights
  const w1 = 1 / (d12 * d12);
  const w2 = 1 / (d23 * d23);
  const w3 = 1 / (d31 * d31);
  
  // Calculate coordinates
  const totalW = w1 + w2 + w3;
  
  const easting = (w1 * p1.easting + w2 * p2.easting + w3 * p3.easting) / totalW;
  const northing = (w1 * p1.northing + w2 * p2.northing + w3 * p3.northing) / totalW;
  
  const point: Point2D = { easting, northing };
  
  const d1 = distanceBearing(p1, point).distance;
  const d2 = distanceBearing(p2, point).distance;
  const d3 = distanceBearing(p3, point).distance;
  
  return {
    point,
    distanceToP1: Math.round(d1 * 1000) / 1000,
    distanceToP2: Math.round(d2 * 1000) / 1000,
    distanceToP3: Math.round(d3 * 1000) / 1000
  };
}

export function radiation(
  from: Point2D,
  bearing: number,
  distance: number
): COGORadiation {
  const rad = toRadians(bearing);
  const point: Point2D = {
    easting: from.easting + distance * Math.sin(rad),
    northing: from.northing + distance * Math.cos(rad)
  };
  
  return {
    point,
    distance,
    bearing
  };
}

export function offsetPoint(
  point: Point2D,
  bearing: number,
  offset: number
): Point2D {
  const rad = toRadians(bearing);
  return {
    easting: point.easting + offset * Math.sin(rad),
    northing: point.northing + offset * Math.cos(rad)
  };
}
