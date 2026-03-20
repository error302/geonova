import { Point2D, SurveyResult, ok, err } from "./types";
import { distanceBearing } from "./distance";

// ─── AREA PRECISION FORMATTING (Kenya Survey Regs Reg 84) ─────────────────────
// Kenya Reg 84 — decimal places for area computation:
//   ≤1 ha     → 4 decimal places  (0.0001 ha = 1 m²)
//   1–10 ha   → 3 decimal places
//   10–100 ha → 2 decimal places
//   >100 ha   → 1 decimal place

export type AreaPrecision = 1 | 2 | 3 | 4;

export interface AreaPrecisionResult {
  hectares: number;
  decimalPlaces: AreaPrecision;
  formattedValue: string;
  unit: "ha" | "m²" | "acres";
  regulation: string;
  warnings: string[];
}

export function formatAreaForDisplay(
  squareMetres: number,
  unit: "ha" | "m2" | "acres" = "ha"
): AreaPrecisionResult {
  const sqM = Math.abs(squareMetres);
  const sqHa = sqM / 10_000;
  const sqAcres = sqM / 4_046.856_422;

  let value: number;
  let decimals: AreaPrecision;
  let formattedValue: string;
  const warnings: string[] = [];

  if (sqHa <= 1) {
    decimals = 4;
    value = unit === "ha" ? sqHa : unit === "m2" ? sqM : sqAcres;
    formattedValue = value.toFixed(decimals);
    if (unit === "m2") {
      formattedValue = `${parseFloat(formattedValue).toLocaleString()} m²`;
    } else {
      formattedValue = `${parseFloat(formattedValue).toLocaleString()} ${unit === "ha" ? "ha" : "ac"}`;
    }
  } else if (sqHa <= 10) {
    decimals = 3;
    value = unit === "ha" ? sqHa : unit === "m2" ? sqM : sqAcres;
    formattedValue = `${parseFloat(value.toFixed(decimals)).toLocaleString()} ${unit === "ha" ? "ha" : unit === "m2" ? "m²" : "ac"}`;
  } else if (sqHa <= 100) {
    decimals = 2;
    value = unit === "ha" ? sqHa : unit === "m2" ? sqM : sqAcres;
    formattedValue = `${parseFloat(value.toFixed(decimals)).toLocaleString()} ${unit === "ha" ? "ha" : unit === "m2" ? "m²" : "ac"}`;
  } else {
    decimals = 1;
    value = unit === "ha" ? sqHa : unit === "m2" ? sqM : sqAcres;
    formattedValue = `${parseFloat(value.toFixed(decimals)).toLocaleString()} ${unit === "ha" ? "ha" : unit === "m2" ? "m²" : "ac"}`;
  }

  if (sqHa < 0.01) {
    warnings.push("Parcel area < 100 m² — verify against minimum cadastral parcel size.");
  }

  const label =
    decimals === 4 ? "≤ 1 ha" :
    decimals === 3 ? "1 – 10 ha" :
    decimals === 2 ? "10 – 100 ha" : "> 100 ha";

  return {
    hectares: sqHa,
    decimalPlaces: decimals,
    formattedValue,
    unit: unit === "m2" ? "m²" : unit === "ha" ? "ha" : "acres",
    regulation: `Kenya Survey Reg 84 — ${label} → ${decimals} decimal place(s)`,
    warnings,
  };
}

export function minimumParcelAreaWarning(areaSqM: number, jurisdiction: "kenya" | "bahrain" | "nz" = "kenya"): string[] {
  const warnings: string[] = [];
  if (jurisdiction === "kenya") {
    const minHa = 0.0001;
    if (areaSqM < minHa * 10_000) {
      warnings.push(`Kenya: Parcel area (${areaSqM.toFixed(2)} m²) below typical minimum. Verify against Physical Planning Act.`);
    }
  }
  if (jurisdiction === "bahrain") {
    if (areaSqM < 10) {
      warnings.push(`Bahrain: Parcel area (${areaSqM.toFixed(2)} m²) below 10 m² threshold — may not be registerable.`);
    }
  }
  return warnings;
}

// ─── AREA COMPUTATION ─────────────────────────────────────────────────────────

export interface AreaResult {
  squareMetres: number;
  hectares: number;
  acres: number;
  squareFeet: number;
  perimeter: number;        // metres
  centroid: Point2D;
  pointCount: number;
}

/**
 * Coordinate (Shoelace / Gauss) method for polygon area.
 *
 * Formula:
 *   2A = Σ (Eᵢ × Nᵢ₊₁ − Eᵢ₊₁ × Nᵢ)
 *
 * Points may be given in clockwise OR anti-clockwise order — the absolute
 * value is taken. The polygon is automatically closed (last point → first point).
 *
 * @param points  Boundary vertices in order (minimum 3)
 */
export function coordinateArea(
  points: Point2D[]
): SurveyResult<AreaResult> {
  if (points.length < 3) {
    return err("Area calculation requires at least 3 points.");
  }

  const n = points.length;
  let crossSum = 0;
  let perimeter = 0;
  let cx = 0, cy = 0;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const p = points[i];
    const q = points[j];

    // Shoelace terms
    crossSum += p.easting * q.northing;
    crossSum -= q.easting * p.northing;

    // Perimeter
    const legResult = distanceBearing(p, q);
    if (legResult.ok) perimeter += legResult.value.distance;

    // Centroid accumulation
    const cross = p.easting * q.northing - q.easting * p.northing;
    cx += (p.easting + q.easting) * cross;
    cy += (p.northing + q.northing) * cross;
  }

  const squareMetres = Math.abs(crossSum) / 2;
  if (squareMetres === 0) {
    return err("All points are collinear — area is zero.");
  }

  const centroid: Point2D = {
    easting: cx / (6 * squareMetres),
    northing: cy / (6 * squareMetres),
  };

  return ok({
    squareMetres,
    hectares: squareMetres / 10_000,
    acres: squareMetres / 4_046.856_422,
    squareFeet: squareMetres * 10.763_910_4,
    perimeter,
    centroid,
    pointCount: n,
  });
}

/**
 * Subdivide a polygon into two parts along a line from vertex[splitFrom]
 * to vertex[splitTo]. Returns the areas of both sub-polygons.
 *
 * Useful for cadastral subdivision calculations.
 */
export interface SubdivisionResult {
  partA: AreaResult;
  partB: AreaResult;
  totalArea: AreaResult;
}

export function subdividePolygon(
  points: Point2D[],
  splitFrom: number,
  splitTo: number
): SurveyResult<SubdivisionResult> {
  const n = points.length;
  if (splitFrom < 0 || splitFrom >= n || splitTo < 0 || splitTo >= n) {
    return err("Split indices are out of range.");
  }
  if (splitFrom === splitTo) {
    return err("Split from and to cannot be the same vertex.");
  }

  // Build the two sub-polygons
  const [lo, hi] =
    splitFrom < splitTo
      ? [splitFrom, splitTo]
      : [splitTo, splitFrom];

  const partA = points.slice(lo, hi + 1);
  const partB = [...points.slice(hi), ...points.slice(0, lo + 1)];

  const areaA = coordinateArea(partA);
  const areaB = coordinateArea(partB);
  const areaTotal = coordinateArea(points);

  if (!areaA.ok) return areaA;
  if (!areaB.ok) return areaB;
  if (!areaTotal.ok) return areaTotal;

  return ok({ partA: areaA.value, partB: areaB.value, totalArea: areaTotal.value });
}
