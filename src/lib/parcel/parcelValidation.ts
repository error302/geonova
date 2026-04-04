/**
 * Parcel Validation Module
 * Phase 9 - Compare survey boundaries with registry data
 * Detect boundary discrepancies and conflicts
 */

import { distanceBearing } from '@/lib/engine/distance'
import { coordinateArea } from '@/lib/engine/area'

export interface SurveyPoint {
  name: string
  easting: number
  northing: number
}

export interface SurveyBoundary {
  points: SurveyPoint[]
}

export interface RegistryBoundary {
  coordinates: number[][]
}

export interface BoundaryComparisonResult {
  areaDifference: {
    registry: number
    survey: number
    difference: number
    percentage: number
  }
  cornerOffsets: {
    corner: string
    offset: number
  }[]
  bearingDifferences: {
    edge: string
    registryBearing: string
    surveyBearing: string
    difference: number
  }[]
  overallOffset: number
  warnings: string[]
}

export interface ConflictDetectionResult {
  hasConflict: boolean
  severity: 'none' | 'minor' | 'moderate' | 'severe'
  conflicts: {
    type: string
    description: string
    location?: string
    severity: 'minor' | 'moderate' | 'severe'
    recommendation: string
  }[]
}

export function compareBoundaries(
  surveyBoundary: SurveyBoundary,
  registryBoundary: RegistryBoundary,
  tolerance: number = 0.5
): BoundaryComparisonResult {
  const surveyArea = calculateAreaFromPoints(surveyBoundary.points)
  const registryArea = calculatePolygonArea(registryBoundary.coordinates)
  
  const areaDifference = registryArea - surveyArea
  const percentage = registryArea > 0 ? (Math.abs(areaDifference) / registryArea) * 100 : 0
  
  const cornerOffsets: BoundaryComparisonResult['cornerOffsets'] = []
  const maxCorners = Math.min(surveyBoundary.points.length, registryBoundary.coordinates.length)
  
  for (let i = 0; i < maxCorners; i++) {
    const surveyPt = surveyBoundary.points[i]
    const regPt = registryBoundary.coordinates[i]
    
    const dist = Math.sqrt(
      Math.pow(surveyPt.easting - regPt[0], 2) +
      Math.pow(surveyPt.northing - regPt[1], 2)
    )
    
    cornerOffsets.push({
      corner: surveyPt.name || `Corner ${i + 1}`,
      offset: Math.round(dist * 1000) / 1000
    })
  }
  
  const bearingDiffs: BoundaryComparisonResult['bearingDifferences'] = []
  const n = registryBoundary.coordinates.length
  
  for (let i = 0; i < n; i++) {
    const current = registryBoundary.coordinates[i]
    const next = registryBoundary.coordinates[(i + 1) % n]
    const regDist = Math.sqrt(Math.pow(next[0] - current[0], 2) + Math.pow(next[1] - current[1], 2))
    const regBearing = Math.atan2(next[0] - current[0], next[1] - current[1]) * 180 / Math.PI
    
    if (surveyBoundary.points[i + 1]) {
      const sCurrent = surveyBoundary.points[i]
      const sNext = surveyBoundary.points[i + 1]
      const sDist = Math.sqrt(Math.pow(sNext.easting - sCurrent.easting, 2) + Math.pow(sNext.northing - sCurrent.northing, 2))
      const sBearing = Math.atan2(sNext.easting - sCurrent.easting, sNext.northing - sCurrent.northing) * 180 / Math.PI
      
      let diff = sBearing - regBearing
      if (diff > 180) diff -= 360
      if (diff < -180) diff += 360
      
      bearingDiffs.push({
        edge: `${sCurrent.name || i + 1} - ${sNext.name || i + 2}`,
        registryBearing: `${regBearing.toFixed(2)}°`,
        surveyBearing: `${sBearing.toFixed(2)}°`,
        difference: Math.round(Math.abs(diff) * 100) / 100
      })
    }
  }
  
  const avgOffset = cornerOffsets.reduce((sum, c) => sum + c.offset, 0) / cornerOffsets.length
  
  const warnings: string[] = []
  if (percentage > 5) {
    warnings.push(`Area discrepancy exceeds 5% (${percentage.toFixed(2)}%)`)
  }
  if (avgOffset > tolerance) {
    warnings.push(`Average boundary offset (${avgOffset.toFixed(2)}m) exceeds tolerance (${tolerance}m)`)
  }
  const maxOffset = Math.max(...cornerOffsets.map((c: any) => c.offset))
  if (maxOffset > tolerance * 2) {
    warnings.push(`Corner offset (${maxOffset.toFixed(2)}m) significantly exceeds tolerance`)
  }
  
  return {
    areaDifference: {
      registry: Math.round(registryArea * 100) / 100,
      survey: Math.round(surveyArea * 100) / 100,
      difference: Math.round(areaDifference * 100) / 100,
      percentage: Math.round(percentage * 100) / 100
    },
    cornerOffsets,
    bearingDifferences: bearingDiffs.slice(0, 4),
    overallOffset: Math.round(avgOffset * 1000) / 1000,
    warnings
  }
}

export function detectConflicts(
  comparison: BoundaryComparisonResult,
  tolerance: number = 0.5
): ConflictDetectionResult {
  const conflicts: ConflictDetectionResult['conflicts'] = []
  
  if (comparison.areaDifference.percentage > 10) {
    conflicts.push({
      type: 'area_mismatch',
      description: `Area differs by ${comparison.areaDifference.percentage.toFixed(2)}%`,
      severity: 'severe',
      recommendation: 'Verify both measurements and check for encroachments or missing portions'
    })
  } else if (comparison.areaDifference.percentage > 5) {
    conflicts.push({
      type: 'area_mismatch',
      description: `Area differs by ${comparison.areaDifference.percentage.toFixed(2)}%`,
      severity: 'moderate',
      recommendation: 'Review survey methodology and registry records for potential discrepancies'
    })
  }
  
  const maxOffset = Math.max(...comparison.cornerOffsets.map((c: any) => c.offset))
  const highOffsetCorners = comparison.cornerOffsets.filter((c: any) => c.offset > tolerance)
  
  if (maxOffset > tolerance * 3) {
    conflicts.push({
      type: 'boundary_shift',
      description: `Maximum corner offset is ${maxOffset.toFixed(2)}m`,
      location: comparison.cornerOffsets.find((c: any) => c.offset === maxOffset)?.corner,
      severity: 'severe',
      recommendation: 'Original monuments may have been disturbed - verify with adjacent properties'
    })
  } else if (highOffsetCorners.length > 0) {
    conflicts.push({
      type: 'boundary_shift',
      description: `${highOffsetCorners.length} corner(s) exceed tolerance`,
      severity: 'moderate',
      recommendation: 'Check for monument replacement or boundary agreement changes'
    })
  }
  
  for (const diff of comparison.bearingDifferences) {
    if (Math.abs(diff.difference) > 5) {
      conflicts.push({
        type: 'bearing_mismatch',
        description: `Bearing difference of ${diff.difference.toFixed(2)}° on edge ${diff.edge}`,
        location: diff.edge,
        severity: 'minor',
        recommendation: 'Verify angle measurements - may indicate different boundary interpretation'
      })
    }
  }
  
  const hasConflict = conflicts.length > 0
  let severity: ConflictDetectionResult['severity'] = 'none'
  
  if (conflicts.some((c: any) => c.severity === 'severe')) {
    severity = 'severe'
  } else if (conflicts.some((c: any) => c.severity === 'moderate')) {
    severity = 'moderate'
  } else if (conflicts.some((c: any) => c.severity === 'minor')) {
    severity = 'minor'
  }
  
  return {
    hasConflict,
    severity,
    conflicts
  }
}

function calculateAreaFromPoints(points: SurveyPoint[]): number {
  if (points.length < 3) return 0
  
  const coords = points.map((p: any) => ({ easting: p.easting, northing: p.northing }))
  const result = coordinateArea(coords)
  return result.areaSqm
}

function calculatePolygonArea(coordinates: number[][]): number {
  if (coordinates.length < 3) return 0
  
  let area = 0
  const n = coordinates.length
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += coordinates[i][0] * coordinates[j][1]
    area -= coordinates[j][0] * coordinates[i][1]
  }
  
  return Math.abs(area) / 2
}

export function generateSurveyBoundary(surveyPoints: SurveyPoint[]): SurveyBoundary {
  return {
    points: surveyPoints
  }
}

export function extractRegistryBoundary(coordinates: number[][]): RegistryBoundary {
  return {
    coordinates
  }
}

export function getDiscrepancyLayer(comparison: BoundaryComparisonResult): {
  type: 'FeatureCollection'
  features: object[]
} {
  const features = comparison.cornerOffsets
    .filter((c: any) => c.offset > 0.3)
    .map((c: any) => ({
      type: 'Feature' as const,
      properties: {
        corner: c.corner,
        offset: c.offset,
        severity: c.offset > 1 ? 'high' : c.offset > 0.5 ? 'medium' : 'low'
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [0, 0]
      }
    }))
  
  return {
    type: 'FeatureCollection',
    features
  }
}
