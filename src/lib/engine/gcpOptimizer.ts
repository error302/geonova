/**
 * @module gcpOptimizer
 *
 * Ground Control Point (GCP) Planning & Optimization for Drone Surveys
 *
 * Features:
 * 1. Optimal GCP placement using geometric algorithms
 * 2. GCP distribution across project area
 * 3. Field validation checklist
 * 4. Photo binding (GCP photo + RTK coordinate)
 * 5. Export for Pix4D, WebODM, Agisoft
 *
 * GCP placement strategy:
 * - Minimum 3 GCPs for small areas (< 5 ha)
 * - 5-7 GCPs for medium areas (5-50 ha)
 * - 1 GCP per 10 ha for large areas
 * - Place at corners + center
 * - Avoid edges (need overlap area)
 * - Checkboard pattern for large sites
 *
 * Reference: "UAV Photogrammetry" by Colomina & Molina (2014)
 */

import { utmToGeographic } from '@/lib/geodesy/coordinates'

/**
 * Default UTM zone for METARDU — Kenya Arc 1960 / UTM Zone 37S (EPSG:21037).
 * Used when a project-level zone is not supplied to the exporters.
 * Most of Kenya (incl. Nairobi, Mombasa) falls in Zone 37S; western Kenya
 * (incl. Kisumu, Eldoret, Turkana) falls in Zone 36S (EPSG:21036).
 */
export const DEFAULT_UTM_ZONE = 37
export const DEFAULT_HEMISPHERE: 'N' | 'S' = 'S'

export interface ProjectArea {
  /** Polygon vertices defining the project boundary */
  boundary: Array<{ easting: number; northing: number }>
  /** Area in hectares */
  areaHa: number
}

export interface GCPPoint {
  id: string
  name: string
  easting: number
  northing: number
  elevation?: number
  rtkFixed: boolean
  accuracy?: number
  photoCaptured: boolean
  photoUrl?: string
  status: 'planned' | 'surveyed' | 'validated'
  targetPattern: 'checkerboard' | 'cross' | 'circle'
}

export interface GCPPlan {
  gcps: GCPPoint[]
  totalGCPs: number
  estimatedAccuracy: number  // cm
  distribution: 'corners' | 'checkerboard' | 'perimeter'
  coveragePercent: number
}

/**
 * Calculate the centroid of a polygon.
 */
function getCentroid(vertices: Array<{ easting: number; northing: number }>): { easting: number; northing: number } {
  let sumE = 0, sumN = 0
  for (const v of vertices) {
    sumE += v.easting
    sumN += v.northing
  }
  return { easting: sumE / vertices.length, northing: sumN / vertices.length }
}

/**
 * Calculate bounding box of a polygon.
 */
function getBoundingBox(vertices: Array<{ easting: number; northing: number }>): {
  minE: number; maxE: number; minN: number; maxN: number
  width: number; height: number
} {
  let minE = vertices[0].easting, maxE = vertices[0].easting
  let minN = vertices[0].northing, maxN = vertices[0].northing

  for (const v of vertices) {
    minE = Math.min(minE, v.easting)
    maxE = Math.max(maxE, v.easting)
    minN = Math.min(minN, v.northing)
    maxN = Math.max(maxN, v.northing)
  }

  return { minE, maxE, minN, maxN, width: maxE - minE, height: maxN - minN }
}

/**
 * Generate optimal GCP placement for a project area.
 *
 * Algorithm:
 * 1. Determine number of GCPs based on area
 * 2. Place GCPs at corners + center for small areas
 * 3. Use checkerboard pattern for large areas
 * 4. Ensure even distribution
 */
export function generateGCPPlan(area: ProjectArea): GCPPlan {
  const bbox = getBoundingBox(area.boundary)
  const centroid = getCentroid(area.boundary)

  // Determine number of GCPs
  let gcpCount: number
  let distribution: 'corners' | 'checkerboard' | 'perimeter'

  if (area.areaHa < 5) {
    gcpCount = 3
    distribution = 'corners'
  } else if (area.areaHa < 50) {
    gcpCount = 5
    distribution = 'corners'
  } else {
    gcpCount = Math.ceil(area.areaHa / 10)
    distribution = 'checkerboard'
  }

  const gcps: GCPPoint[] = []

  if (distribution === 'corners' || distribution === 'checkerboard') {
    // Place at bounding box corners
    const corners = [
      { name: 'GCP-01', easting: bbox.minE + bbox.width * 0.1, northing: bbox.minN + bbox.height * 0.1 },
      { name: 'GCP-02', easting: bbox.maxE - bbox.width * 0.1, northing: bbox.minN + bbox.height * 0.1 },
      { name: 'GCP-03', easting: bbox.maxE - bbox.width * 0.1, northing: bbox.maxN - bbox.height * 0.1 },
      { name: 'GCP-04', easting: bbox.minE + bbox.width * 0.1, northing: bbox.maxN - bbox.height * 0.1 },
    ]

    for (let i = 0; i < Math.min(gcpCount, 4); i++) {
      gcps.push({
        id: crypto.randomUUID(),
        name: corners[i].name,
        easting: corners[i].easting,
        northing: corners[i].northing,
        rtkFixed: false,
        photoCaptured: false,
        status: 'planned',
        targetPattern: 'checkerboard',
      })
    }

    // Add center GCP if needed
    if (gcpCount >= 5) {
      gcps.push({
        id: crypto.randomUUID(),
        name: 'GCP-05',
        easting: centroid.easting,
        northing: centroid.northing,
        rtkFixed: false,
        photoCaptured: false,
        status: 'planned',
        targetPattern: 'cross',
      })
    }

    // Add additional GCPs in checkerboard pattern
    if (gcpCount > 5) {
      const extraCount = gcpCount - 5
      for (let i = 0; i < extraCount; i++) {
        const t = (i + 1) / (extraCount + 1)
        gcps.push({
          id: crypto.randomUUID(),
          name: `GCP-${String(6 + i).padStart(2, '0')}`,
          easting: bbox.minE + bbox.width * t,
          northing: centroid.northing,
          rtkFixed: false,
          photoCaptured: false,
          status: 'planned',
          targetPattern: 'checkerboard',
        })
      }
    }
  }

  // Estimated accuracy based on GCP density
  const density = gcpCount / area.areaHa
  const estimatedAccuracy = density > 1 ? 1.5 : density > 0.5 ? 2.5 : 5.0

  return {
    gcps,
    totalGCPs: gcps.length,
    estimatedAccuracy,
    distribution,
    coveragePercent: Math.min(100, (gcpCount / Math.max(3, area.areaHa / 10)) * 100),
  }
}

/**
 * Update a GCP with surveyed coordinates.
 */
export function updateGCPWithSurvey(
  gcp: GCPPoint,
  easting: number,
  northing: number,
  elevation: number,
  accuracy: number,
  rtkFixed: boolean,
): GCPPoint {
  return {
    ...gcp,
    easting,
    northing,
    elevation,
    accuracy,
    rtkFixed,
    status: 'surveyed',
  }
}

/**
 * Mark a GCP as photo-captured.
 */
export function markGCPPhotoCaptured(
  gcp: GCPPoint,
  photoUrl: string,
): GCPPoint {
  return {
    ...gcp,
    photoCaptured: true,
    photoUrl,
    status: 'validated',
  }
}

/**
 * Generate a GCP export file for Pix4D.
 * Format: GCP Name, Lat (WGS84), Lon (WGS84), Alt, Accuracy X, Accuracy Y, Accuracy Z
 *
 * P0-1 FIX (2026-07-24): Previously exported `lat=0, lng=0` with the comment
 * "Would be transformed" — producing a file full of zeros that Pix4D would
 * silently accept and then fail to georeference. Now transforms UTM→WGS84
 * via the Redfearn formula in `geodesy/coordinates.ts` (Basak Ch.3,
 * Ghilani & Wolf Ch.7, EPSG Guidance Note 7-2).
 *
 * @param gcps        - GCPs with easting/northing in the project's UTM zone
 * @param utmZone     - UTM zone (1-60). Defaults to 37 (Kenya).
 * @param hemisphere  - 'N' or 'S'. Defaults to 'S' (Kenya).
 */
export function exportForPix4D(
  gcps: GCPPoint[],
  utmZone: number = DEFAULT_UTM_ZONE,
  hemisphere: 'N' | 'S' = DEFAULT_HEMISPHERE,
): string {
  let csv = 'GCP Label,Latitude (WGS84),Longitude (WGS84),Altitude (WGS84),Horizontal Accuracy (m),Vertical Accuracy (m)\n'

  for (const gcp of gcps) {
    const { lat, lon } = utmToGeographic(gcp.easting, gcp.northing, utmZone, hemisphere)
    const alt = gcp.elevation || 0
    const acc = gcp.accuracy || 0.02

    csv += `${gcp.name},${lat.toFixed(9)},${lon.toFixed(9)},${alt.toFixed(4)},${acc.toFixed(4)},${acc.toFixed(4)}\n`
  }

  return csv
}

/**
 * Generate a GCP export file for WebODM.
 * Format: lon,lat,alt,name
 *
 * P0-1 FIX (2026-07-24): Same zero-export bug as `exportForPix4D`. Now
 * transforms UTM→WGS84 via Redfearn.
 *
 * @param gcps        - GCPs with easting/northing in the project's UTM zone
 * @param utmZone     - UTM zone (1-60). Defaults to 37 (Kenya).
 * @param hemisphere  - 'N' or 'S'. Defaults to 'S' (Kenya).
 */
export function exportForWebODM(
  gcps: GCPPoint[],
  utmZone: number = DEFAULT_UTM_ZONE,
  hemisphere: 'N' | 'S' = DEFAULT_HEMISPHERE,
): string {
  let csv = ''

  for (const gcp of gcps) {
    const { lat, lon } = utmToGeographic(gcp.easting, gcp.northing, utmZone, hemisphere)
    const alt = gcp.elevation || 0

    csv += `${lon.toFixed(9)},${lat.toFixed(9)},${alt.toFixed(4)},${gcp.name}\n`
  }

  return csv
}

/**
 * Generate a validation checklist for field work.
 */
export function generateValidationChecklist(plan: GCPPlan): Array<{
  item: string
  completed: boolean
  gcpsCompleted: number
  totalGCPs: number
}> {
  return [
    {
      item: 'GCP targets placed at planned locations',
      completed: plan.gcps.every(g => g.status !== 'planned'),
      gcpsCompleted: plan.gcps.filter(g => g.status !== 'planned').length,
      totalGCPs: plan.totalGCPs,
    },
    {
      item: 'RTK coordinates captured for all GCPs',
      completed: plan.gcps.every(g => g.rtkFixed),
      gcpsCompleted: plan.gcps.filter(g => g.rtkFixed).length,
      totalGCPs: plan.totalGCPs,
    },
    {
      item: 'Photos captured for all GCPs',
      completed: plan.gcps.every(g => g.photoCaptured),
      gcpsCompleted: plan.gcps.filter(g => g.photoCaptured).length,
      totalGCPs: plan.totalGCPs,
    },
    {
      item: 'All GCPs validated',
      completed: plan.gcps.every(g => g.status === 'validated'),
      gcpsCompleted: plan.gcps.filter(g => g.status === 'validated').length,
      totalGCPs: plan.totalGCPs,
    },
  ]
}
