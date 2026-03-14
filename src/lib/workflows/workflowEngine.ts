/**
 * Survey Workflow Engine
 * Reads uploaded CSV, detects survey type, runs calculation workflow
 * 
 * GeoNova Calculation Standards: N.N. Basak
 * - No intermediate rounding
 * - Full floating point precision
 * - Round only at display layer
 */

import { bowditchAdjustment, TraverseInput } from '../engine/traverse'
import { riseAndFall, LevelingInput } from '../engine/leveling'
import { radiation } from '../engine/cogo'

export type SurveyType = 'traverse' | 'leveling' | 'radiation' | 'coordinates' | 'unknown'

export interface SurveyDataset {
  surveyType: SurveyType
  observations: SurveyObservation[]
  metadata: Record<string, any>
}

export interface SurveyObservation {
  station: string
  target?: string
  type: 'BS' | 'IS' | 'FS' | 'BEARING' | 'DISTANCE' | 'ANGLE' | 'COORDINATE' | 'ELEVATION'
  value1?: number
  value2?: number
  value3?: number
}

export interface WorkflowResult {
  success: boolean
  surveyType: SurveyType
  results: any
  validation: ValidationResult
  warnings: string[]
  errors: string[]
}

export interface CoordinateImportResult {
  type: 'coordinates'
  points: Array<{
    name: string
    easting: number
    northing: number
    elevation?: number
  }>
}

export interface ValidationResult {
  passed: boolean
  checks: ValidationCheck[]
  precision?: number
  precisionGrade?: string
  angularMisclosure?: number
  linearMisclosure?: number
}

export interface ValidationCheck {
  name: string
  passed: boolean
  message: string
  value?: number
}

export interface TraverseWorkflowData {
  legs: Array<{
    fromStation: string
    toStation: string
    bearing: number
    distance: number
  }>
  openingPoint?: {
    name: string
    easting: number
    northing: number
  }
  closingPoint?: {
    name: string
    easting: number
    northing: number
  }
}

export interface LevelingWorkflowData {
  readings: Array<{
    station: string
    bs?: number
    is?: number
    fs?: number
  }>
  openingRL: number
  closingRL?: number
}

export interface RadiationWorkflowData {
  station: {
    name: string
    easting: number
    northing: number
    elevation?: number
  }
  observations: Array<{
    pointName: string
    bearing: number
    distance: number
    verticalAngle?: number
    targetHeight?: number
  }>
}

export function detectSurveyType(observations: SurveyObservation[]): SurveyType {
  if (observations.length === 0) return 'unknown'

  const types = new Set(observations.map(o => o.type))
  
  if (types.has('BS') || types.has('IS') || types.has('FS')) {
    return 'leveling'
  }
  
  if (types.has('BEARING') && types.has('DISTANCE')) {
    return 'traverse'
  }
  
  if (types.has('ANGLE') && types.has('DISTANCE')) {
    return 'radiation'
  }
  
  if (types.has('COORDINATE')) {
    return 'coordinates'
  }

  return 'unknown'
}

export function runTraverseWorkflow(data: TraverseWorkflowData): WorkflowResult {
  const warnings: string[] = []
  const errors: string[] = []
  let validation: ValidationResult

  try {
    if (!data.openingPoint) {
      errors.push('Opening point coordinates required for traverse')
      return {
        success: false,
        surveyType: 'traverse',
        results: null,
        validation: { passed: false, checks: [] },
        warnings,
        errors
      }
    }

    const traverseInput: TraverseInput = {
      points: [
        { name: data.openingPoint.name, easting: data.openingPoint.easting, northing: data.openingPoint.northing }
      ],
      distances: data.legs.map(l => l.distance),
      bearings: data.legs.map(l => l.bearing)
    }

    const result = bowditchAdjustment(traverseInput)

    const angularMisclosure = calculateAngularMisclosure(data.legs)
    const linearPrecision = result.precisionRatio > 0 ? 1 / result.precisionRatio : 0

    const precisionGrade = getPrecisionGrade(linearPrecision)

    const checks: ValidationCheck[] = []

    if (angularMisclosure !== null) {
      const angularLimit = 60 * Math.sqrt(data.legs.length)
      checks.push({
        name: 'Angular Misclosure',
        passed: Math.abs(angularMisclosure) <= angularLimit,
        message: angularMisclosure > angularLimit 
          ? `Angular misclosure ${angularMisclosure.toFixed(1)}" exceeds limit ${angularLimit.toFixed(1)}"`
          : 'Angular check passed',
        value: angularMisclosure
      })
    }

    checks.push({
      name: 'Linear Precision',
      passed: linearPrecision >= 1000,
      message: linearPrecision < 1000 
        ? `Precision 1:${linearPrecision.toFixed(0)} below acceptable threshold`
        : `Precision 1:${linearPrecision.toFixed(0)} achieved`,
      value: linearPrecision
    })

    const linearError = Math.sqrt(result.closingErrorE ** 2 + result.closingErrorN ** 2)
    if (linearError > 0) {
      checks.push({
        name: 'Linear Misclosure',
        passed: true,
        message: `Closing error: ${linearError.toFixed(4)} m`,
        value: linearError
      })
    }

    validation = {
      passed: checks.every(c => c.passed),
      checks,
      precision: linearPrecision,
      precisionGrade,
      angularMisclosure: angularMisclosure || undefined,
      linearMisclosure: linearError
    }

    return {
      success: true,
      surveyType: 'traverse',
      results: result,
      validation,
      warnings,
      errors: []
    }

  } catch (e) {
    errors.push(`Traverse calculation failed: ${e}`)
    return {
      success: false,
      surveyType: 'traverse',
      results: null,
      validation: { passed: false, checks: [] },
      warnings,
      errors
    }
  }
}

export function runLevelingWorkflow(data: LevelingWorkflowData): WorkflowResult {
  const warnings: string[] = []
  const errors: string[] = []
  let validation: ValidationResult

  try {
    const levelingInput: LevelingInput = {
      readings: data.readings,
      openingRL: data.openingRL,
      closingRL: data.closingRL,
      method: 'rise_and_fall'
    }

    const result = riseAndFall(levelingInput)

    const arithmeticPassed = result.arithmeticCheck
    const arithmeticDiff = result.misclosure

    const checks: ValidationCheck[] = []

    checks.push({
      name: 'Arithmetic Check',
      passed: arithmeticPassed,
      message: arithmeticPassed 
        ? `Arithmetic check passed (diff: ${Math.abs(arithmeticDiff).toFixed(4)} m)`
        : `Arithmetic check failed (diff: ${arithmeticDiff.toFixed(4)} m)`,
      value: arithmeticDiff
    })

    if (data.closingRL && result.misclosure !== undefined) {
      const closingErrorMm = Math.abs(result.misclosure) * 1000
      const distanceKm = data.readings.length * 0.1
      const allowableMm = 12 * Math.sqrt(distanceKm)
      
      checks.push({
        name: 'Closing Error',
        passed: closingErrorMm <= allowableMm,
        message: `Closing error ${closingErrorMm.toFixed(1)}mm vs allowable ${allowableMm.toFixed(1)}mm`,
        value: closingErrorMm
      })
    }

    validation = {
      passed: checks.every(c => c.passed),
      checks
    }

    if (!arithmeticPassed) {
      errors.push('Arithmetic check failed - results blocked')
      return {
        success: false,
        surveyType: 'leveling',
        results: null,
        validation,
        warnings,
        errors
      }
    }

    return {
      success: true,
      surveyType: 'leveling',
      results: result,
      validation,
      warnings,
      errors: []
    }

  } catch (e) {
    errors.push(`Leveling calculation failed: ${e}`)
    return {
      success: false,
      surveyType: 'leveling',
      results: null,
      validation: { passed: false, checks: [] },
      warnings,
      errors
    }
  }
}

export function runRadiationWorkflow(data: RadiationWorkflowData): WorkflowResult {
  const warnings: string[] = []
  const errors: string[] = []

  try {
    const points = data.observations.map(obs => {
      const rad = radiation(
        { easting: data.station.easting, northing: data.station.northing },
        obs.bearing,
        obs.distance
      )
      return {
        name: obs.pointName,
        easting: rad.point.easting,
        northing: rad.point.northing,
        distance: rad.distance,
        bearing: rad.bearing
      }
    })

    const checks: ValidationCheck[] = []

    checks.push({
      name: 'Observations',
      passed: points.length > 0,
      message: `${points.length} points computed from radiation`,
      value: points.length
    })

    return {
      success: true,
      surveyType: 'radiation',
      results: { points },
      validation: { passed: true, checks },
      warnings,
      errors: []
    }

  } catch (e) {
    errors.push(`Radiation calculation failed: ${e}`)
    return {
      success: false,
      surveyType: 'radiation',
      results: null,
      validation: { passed: false, checks: [] },
      warnings,
      errors
    }
  }
}

export function runCoordinatesWorkflow(observations: SurveyObservation[]): WorkflowResult {
  const warnings: string[] = []
  const errors: string[] = []

  try {
    const points = observations
      .filter(o => o.type === 'COORDINATE' && o.value1 !== undefined && o.value2 !== undefined)
      .map(o => ({
        name: o.station,
        easting: o.value1!,
        northing: o.value2!,
        elevation: o.value3
      }))

    if (points.length === 0) {
      errors.push('No valid coordinate observations found')
      return {
        success: false,
        surveyType: 'coordinates',
        results: null,
        validation: { passed: false, checks: [] },
        warnings,
        errors
      }
    }

    const result = {
      type: 'coordinates' as const,
      points
    }

    return {
      success: true,
      surveyType: 'coordinates',
      results: result,
      validation: { 
        passed: true, 
        checks: [{
          name: 'Points Import',
          passed: true,
          message: `${points.length} points imported successfully`,
          value: points.length
        }] 
      },
      warnings,
      errors: []
    }

  } catch (e) {
    errors.push(`Coordinate import failed: ${e}`)
    return {
      success: false,
      surveyType: 'coordinates',
      results: null,
      validation: { passed: false, checks: [] },
      warnings,
      errors
    }
  }
}

function calculateAngularMisclosure(legs: TraverseWorkflowData['legs']): number | null {
  if (legs.length < 3) return null

  let sumAngle = 0
  for (let i = 0; i < legs.length; i++) {
    const currentBearing = legs[i].bearing
    const nextBearing = legs[(i + 1) % legs.length].bearing
    
    let angle = nextBearing - currentBearing
    if (angle < 0) angle += 360
    if (angle > 180) angle = 360 - angle
    
    sumAngle += angle
  }

  const interiorSum = (legs.length - 2) * 180
  const misclosure = sumAngle - interiorSum

  return misclosure * 3600
}

function getPrecisionGrade(precision: number): string {
  if (precision >= 5000) return 'Excellent (urban cadastral)'
  if (precision >= 3000) return 'Good (suburban)'
  if (precision >= 1000) return 'Acceptable (rural)'
  return 'Poor (rejected)'
}

export function runWorkflow(
  surveyType: SurveyType,
  data: TraverseWorkflowData | LevelingWorkflowData | RadiationWorkflowData
): WorkflowResult {
  switch (surveyType) {
    case 'traverse':
      return runTraverseWorkflow(data as TraverseWorkflowData)
    case 'leveling':
      return runLevelingWorkflow(data as LevelingWorkflowData)
    case 'radiation':
      return runRadiationWorkflow(data as RadiationWorkflowData)
    default:
      return {
        success: false,
        surveyType,
        results: null,
        validation: { passed: false, checks: [] },
        warnings: [],
        errors: [`Unknown survey type: ${surveyType}`]
      }
  }
}
