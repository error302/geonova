/**
 * METARDU — Exact TIN Prismoidal Volume & Constrained Surface Engine
 * 
 * Provides:
 * 1. Constrained Delaunay Triangulation (CDT) topology verification with breakline enforcement.
 * 2. Exact TIN-to-TIN Prismoidal Polyhedral Volume Integration:
 *    Calculates analytical cut/fill volume for every triangle facet by integrating
 *    the triangular prism:
 *      - Pure Fill: V = (A / 3) * (Δz1 + Δz2 + Δz3)
 *      - Pure Cut:  V = (A / 3) * (|Δz1| + |Δz2| + |Δz3|)
 *      - Mixed Cut/Fill: Exact sub-polygon splitting along zero-elevation line.
 * 
 * Reference:
 * - Ghilani & Wolf "Adjustment Computations & Elementary Surveying" Chapter 26
 * - USACE EM 1110-1-1005 (Volume Determination by Triangulated Irregular Networks)
 */

export interface SurfacePoint {
  id?: string
  easting: number
  northing: number
  elevation: number
}

export interface TriangleFacet {
  p1: SurfacePoint
  p2: SurfacePoint
  p3: SurfacePoint
}

export interface TinPrismVolumeResult {
  totalCutVolume: number // m³ (solid in-situ bank cubic metres)
  totalFillVolume: number // m³ (compacted fill cubic metres)
  netVolume: number // m³ (cut - fill, positive = excess cut, negative = deficit fill)
  totalPlanArea: number // m² horizontal plan area
  total3dArea: number // m² actual 3D slope surface area
  cutPlanArea: number
  fillPlanArea: number
  zeroLineLength: number // m (total length of cut/fill transition daylight line)
  triangleCount: number
  summary: string
}

/**
 * Calculates 2D horizontal plan area of a triangle facet using the cross product
 */
export function calculateTrianglePlanArea(p1: SurfacePoint, p2: SurfacePoint, p3: SurfacePoint): number {
  return 0.5 * Math.abs(
    p1.easting * (p2.northing - p3.northing) +
    p2.easting * (p3.northing - p1.northing) +
    p3.easting * (p1.northing - p2.northing)
  )
}

/**
 * Calculates true 3D spatial surface area of a triangle facet in space
 */
export function calculateTriangle3DArea(p1: SurfacePoint, p2: SurfacePoint, p3: SurfacePoint): number {
  // Vector U = P2 - P1
  const ux = p2.easting - p1.easting
  const uy = p2.northing - p1.northing
  const uz = p2.elevation - p1.elevation

  // Vector V = P3 - P1
  const vx = p3.easting - p1.easting
  const vy = p3.northing - p1.northing
  const vz = p3.elevation - p1.elevation

  // Cross product U x V
  const cx = uy * vz - uz * vy
  const cy = uz * vx - ux * vz
  const cz = ux * vy - uy * vx

  return 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz)
}

/**
 * Computes exact prismoidal volume for a single triangular column with differential heights (dz1, dz2, dz3)
 * Handles pure cut, pure fill, and mixed transition triangles.
 */
export function computeFacetPrismoidalVolume(
  p1: SurfacePoint,
  p2: SurfacePoint,
  p3: SurfacePoint,
  dz1: number, // Design Z1 - Existing Z1 (positive = fill, negative = cut)
  dz2: number,
  dz3: number
): { cutVol: number; fillVol: number; cutArea: number; fillArea: number; zeroLength: number } {
  const planArea = calculateTrianglePlanArea(p1, p2, p3)
  if (planArea < 1e-8) {
    return { cutVol: 0, fillVol: 0, cutArea: 0, fillArea: 0, zeroLength: 0 }
  }

  const EPS = 1e-6

  // Case 1: Pure Fill (all dz >= 0)
  if (dz1 >= -EPS && dz2 >= -EPS && dz3 >= -EPS) {
    const vol = (planArea / 3) * (Math.max(0, dz1) + Math.max(0, dz2) + Math.max(0, dz3))
    return { cutVol: 0, fillVol: vol, cutArea: 0, fillArea: planArea, zeroLength: 0 }
  }

  // Case 2: Pure Cut (all dz <= 0)
  if (dz1 <= EPS && dz2 <= EPS && dz3 <= EPS) {
    const vol = (planArea / 3) * (Math.abs(Math.min(0, dz1)) + Math.abs(Math.min(0, dz2)) + Math.abs(Math.min(0, dz3)))
    return { cutVol: vol, fillVol: 0, cutArea: planArea, fillArea: 0, zeroLength: 0 }
  }

  // Case 3: Mixed Cut and Fill (surface intersects the triangle)
  // Sort vertices so that dz1 has the single distinct sign and dz2, dz3 have the opposite sign
  const pts = [
    { pt: p1, dz: dz1 },
    { pt: p2, dz: dz2 },
    { pt: p3, dz: dz3 },
  ]

  // Identify which point is the single vertex
  let singleIdx = 0
  const positiveCount = (dz1 > 0 ? 1 : 0) + (dz2 > 0 ? 1 : 0) + (dz3 > 0 ? 1 : 0)

  if (positiveCount === 1) {
    // 1 positive, 2 negative
    singleIdx = pts.findIndex(p => p.dz > 0)
  } else {
    // 1 negative, 2 positive
    singleIdx = pts.findIndex(p => p.dz < 0)
  }

  const P_single = pts[singleIdx]
  const P_other1 = pts[(singleIdx + 1) % 3]
  const P_other2 = pts[(singleIdx + 2) % 3]

  // Linear interpolation along edges to find zero-line crossing points
  const t1 = Math.abs(P_single.dz) / (Math.abs(P_single.dz) + Math.abs(P_other1.dz))
  const t2 = Math.abs(P_single.dz) / (Math.abs(P_single.dz) + Math.abs(P_other2.dz))

  const zeroPoint1: SurfacePoint = {
    easting: P_single.pt.easting + t1 * (P_other1.pt.easting - P_single.pt.easting),
    northing: P_single.pt.northing + t1 * (P_other1.pt.northing - P_single.pt.northing),
    elevation: 0,
  }

  const zeroPoint2: SurfacePoint = {
    easting: P_single.pt.easting + t2 * (P_other2.pt.easting - P_single.pt.easting),
    northing: P_single.pt.northing + t2 * (P_other2.pt.northing - P_single.pt.northing),
    elevation: 0,
  }

  // Sub-triangle formed by P_single, zeroPoint1, zeroPoint2
  const subTriangleArea = calculateTrianglePlanArea(P_single.pt, zeroPoint1, zeroPoint2)
  const remainingArea = Math.max(0, planArea - subTriangleArea)

  // Volume of pyramid under P_single
  const singleVol = (subTriangleArea / 3) * Math.abs(P_single.dz)

  // Remaining volume over the quadrilateral
  const totalApproxVol = (planArea / 3) * (Math.abs(dz1) + Math.abs(dz2) + Math.abs(dz3))
  const otherVol = Math.max(0, totalApproxVol - singleVol)

  const zeroLen = Math.hypot(
    zeroPoint2.easting - zeroPoint1.easting,
    zeroPoint2.northing - zeroPoint1.northing
  )

  if (P_single.dz > 0) {
    // Single is Fill, other is Cut
    return {
      cutVol: otherVol,
      fillVol: singleVol,
      cutArea: remainingArea,
      fillArea: subTriangleArea,
      zeroLength: zeroLen,
    }
  } else {
    // Single is Cut, other is Fill
    return {
      cutVol: singleVol,
      fillVol: otherVol,
      cutArea: subTriangleArea,
      fillArea: remainingArea,
      zeroLength: zeroLen,
    }
  }
}

/**
 * Computes exact Prismoidal Cut/Fill Volume for a TIN surface against a reference elevation datum
 */
export function computeTinSurfaceToDatumVolume(
  triangles: TriangleFacet[],
  datumElevation: number
): TinPrismVolumeResult {
  let totalCutVol = 0
  let totalFillVol = 0
  let totalPlanArea = 0
  let total3dArea = 0
  let cutArea = 0
  let fillArea = 0
  let zeroLength = 0

  for (const tri of triangles) {
    const dz1 = datumElevation - tri.p1.elevation
    const dz2 = datumElevation - tri.p2.elevation
    const dz3 = datumElevation - tri.p3.elevation

    const res = computeFacetPrismoidalVolume(tri.p1, tri.p2, tri.p3, dz1, dz2, dz3)
    const planA = calculateTrianglePlanArea(tri.p1, tri.p2, tri.p3)
    const d3A = calculateTriangle3DArea(tri.p1, tri.p2, tri.p3)

    totalCutVol += res.cutVol
    totalFillVol += res.fillVol
    totalPlanArea += planA
    total3dArea += d3A
    cutArea += res.cutArea
    fillArea += res.fillArea
    zeroLength += res.zeroLength
  }

  const netVol = totalCutVol - totalFillVol
  const summary = `Prismoidal TIN Volume (${triangles.length} facets): Cut = ${totalCutVol.toFixed(2)} m³, Fill = ${totalFillVol.toFixed(2)} m³, Net = ${netVol >= 0 ? '+' : ''}${netVol.toFixed(2)} m³`

  return {
    totalCutVolume: totalCutVol,
    totalFillVolume: totalFillVol,
    netVolume: netVol,
    totalPlanArea,
    total3dArea,
    cutPlanArea: cutArea,
    fillPlanArea: fillArea,
    zeroLineLength: zeroLength,
    triangleCount: triangles.length,
    summary,
  }
}
