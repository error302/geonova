import { Point2D, Point3D, SurveyResult, ok, err } from "./types";
import { toRadians, toDegrees, normalizeBearing } from "./angles";

// ─── DISTANCE & BEARING ───────────────────────────────────────────────────────

export interface DistanceBearingResult {
  distance: number;         // horizontal distance, metres
  forwardBearing: number;   // A → B, decimal degrees
  backBearing: number;      // B → A, decimal degrees
  deltaEasting: number;     // B.easting  - A.easting
  deltaNorthing: number;    // B.northing - A.northing
}

export interface SlopeResult extends DistanceBearingResult {
  slopeDistance: number;    // metres, along slope
  verticalDifference: number;
  gradientPercent: number;
  gradientDegrees: number;
}

/**
 * Horizontal distance and whole-circle bearing between two 2D grid points.
 *
 * Bearing convention: 0° = North, clockwise positive (whole-circle bearing).
 *
 * @example
 *   distanceBearing({ easting: 1000, northing: 1000 },
 *                   { easting: 1100, northing: 1050 })
 *   // → { distance: 111.803, forwardBearing: 63.435, ... }
 */
export function distanceBearing(
  a: Point2D,
  b: Point2D
): SurveyResult<DistanceBearingResult> {
  const dE = b.easting - a.easting;
  const dN = b.northing - a.northing;

  if (dE === 0 && dN === 0) {
    return err("Points A and B are identical — bearing is undefined.");
  }

  const distance = Math.sqrt(dE * dE + dN * dN);

  // atan2 gives the angle from the Y-axis (North) clockwise — correct for surveying
  const forwardBearing = normalizeBearing(toDegrees(Math.atan2(dE, dN)));
  const backBearing = normalizeBearing(forwardBearing + 180);

  return ok({ distance, forwardBearing, backBearing, deltaEasting: dE, deltaNorthing: dN });
}

/**
 * Slope distance, vertical difference and gradient between two 3D points.
 * Also returns the full 2D distance/bearing result.
 */
export function slopeDistance(
  a: Point3D,
  b: Point3D
): SurveyResult<SlopeResult> {
  const horizontal = distanceBearing(a, b);
  if (!horizontal.ok) return horizontal;

  const dZ = b.elevation - a.elevation;
  const slope = Math.sqrt(
    horizontal.value.distance ** 2 + dZ ** 2
  );
  const gradientPercent =
    horizontal.value.distance === 0
      ? 0
      : (dZ / horizontal.value.distance) * 100;
  const gradientDegrees = toDegrees(Math.atan(dZ / horizontal.value.distance));

  return ok({
    ...horizontal.value,
    slopeDistance: slope,
    verticalDifference: dZ,
    gradientPercent,
    gradientDegrees,
  });
}

/**
 * Compute the 2D position of a point given a starting point,
 * bearing (whole-circle, decimal degrees), and horizontal distance.
 * This is the core of RADIATION / POLAR COMPUTATION.
 *
 * @example
 *   polarPoint({ easting: 1000, northing: 1000 }, 90, 50)
 *   // → { easting: 1050, northing: 1000 }
 */
// ─── SLOPE CORRECTION (Kenya Survey Regs Reg 62) ─────────────────────────────
// Kenya Reg 62: All slope measurements must be reduced to horizontal distance.
// Slopes >10° must be observed on both faces (face left and face right).
// Corrections required for: temperature, tension, sag.
// This module handles the geometric (zenith angle / slope) correction.

export interface SlopeCorrectionResult {
  slopeDistance: number;     // measured slope distance (m)
  verticalAngle: number;     // vertical angle in decimal degrees (0° = horizontal)
  zenithAngle: number;        // zenith angle in decimal degrees (90° = horizontal)
  horizontalDistance: number; // corrected horizontal distance (m)
  verticalDifference: number; // height difference (m)
  temperature?: number;       // °C — for temp correction
  pressure?: number;          // hPa/mbar — for pressure correction
  ppmGeodetic?: number;       // scale/ppm correction
  totalCorrection: number;    // total applied correction (m)
  correctedDistance: number;  // final corrected distance (m)
  gradientPercent: number;
  requiresTwoFace: boolean;   // Kenya Reg 62: >10° needs both faces
  warnings: string[];
}

/**
 * Kenya Survey Reg 62 — reduce a slope measurement to horizontal.
 *
 * Corrects for:
 *  1. Geometric slope reduction (zenith/vertical angle)
 *  2. Temperature correction for steel tape
 *  3. Atmospheric (ppm) correction for EDM
 *
 * @param slopeDistance  Measured slope distance in metres
 * @param verticalAngle  Vertical angle in decimal degrees (0° = horizontal)
 * @param opts.temperature  Ambient temperature in °C (for tape correction)
 * @param opts.pressure     Atmospheric pressure in hPa (for EDM ppm correction)
 * @param opts.zenithAngle  If set, use zenith angle instead of vertical angle
 */
export function horizontalFromSlope(
  slopeDistance: number,
  verticalAngle: number,
  opts?: {
    temperature?: number;
    pressure?: number;
    zenithAngle?: boolean;
    instrumentHeight?: number;
    targetHeight?: number;
  }
): SurveyResult<SlopeCorrectionResult> {
  if (slopeDistance <= 0) return err("Slope distance must be positive.");

  const zenith = opts?.zenithAngle ?? false;
  const vDeg = zenith ? 90 - verticalAngle : verticalAngle;
  const vRad = toRadians(vDeg);

  const horizontal = slopeDistance * Math.cos(vRad);
  const verticalDiff = slopeDistance * Math.sin(vRad);
  const gradientPercent = Math.tan(vRad) * 100;
  const requiresTwoFace = Math.abs(vDeg) > 10;

  const warnings: string[] = [];
  if (requiresTwoFace) {
    warnings.push(
      `Kenya Reg 62: Slope >10° — both faces must be observed and mean taken.`
    );
  }

  let totalCorrection = 0;
  let correctedDistance = horizontal;

  if (opts?.temperature !== undefined) {
    const tempCorr = tapeTemperatureCorrection(slopeDistance, opts.temperature, 20);
    correctedDistance += tempCorr;
    totalCorrection += tempCorr;
  }

  if (opts?.pressure !== undefined) {
    const ppmCorr = edmAtmosphericCorrection(slopeDistance, opts.pressure, 1013.25);
    correctedDistance += ppmCorr;
    totalCorrection += ppmCorr;
  }

  return ok({
    slopeDistance,
    verticalAngle: vDeg,
    zenithAngle: 90 - vDeg,
    horizontalDistance: horizontal,
    verticalDifference: verticalDiff,
    temperature: opts?.temperature,
    pressure: opts?.pressure,
    ppmGeodetic: opts?.pressure !== undefined
      ? edmAtmosphericCorrection(slopeDistance, opts.pressure, 1013.25)
      : undefined,
    totalCorrection,
    correctedDistance,
    gradientPercent,
    requiresTwoFace,
    warnings,
  });
}

export interface TapeCorrectionResult {
  measuredDistance: number;
  temperature: number;
  standardTemp: number;
  coeffThermal: number;    // per °C (steel = 0.0000117, invar = 0.000001)
  tension: number;          // N (if applied)
  sagCorrection: number;   // m
  totalCorrection: number;
  correctedDistance: number;
}

export function tapeTemperatureCorrection(
  measuredDistance: number,
  fieldTemp: number,
  standardTemp: number = 20,
  coeffThermal: number = 0.0000117
): number {
  return measuredDistance * coeffThermal * (fieldTemp - standardTemp);
}

export function edmAtmosphericCorrection(
  distance: number,
  pressureHPa: number,
  standardPressure: number = 1013.25,
  standardTempC: number = 15
): number {
  const k = 282.23;
  const tempK = standardTempC + 273.15;
  const ppm = (k * pressureHPa / tempK - k * standardPressure / tempK);
  return distance * ppm / 1_000_000;
}

export function sagCorrection(
  distance: number,
  weightPerMetre: number,
  tension: number
): number {
  if (tension <= 0) return 0;
  return (weightPerMetre * distance) ** 2 / (24 * tension ** 2);
}

export function polarPoint(
  from: Point2D,
  bearingDeg: number,
  distance: number
): SurveyResult<Point2D> {
  if (distance < 0) return err("Distance must be non-negative.");
  const rad = toRadians(bearingDeg);
  return ok({
    easting: from.easting + distance * Math.sin(rad),
    northing: from.northing + distance * Math.cos(rad),
  });
}
