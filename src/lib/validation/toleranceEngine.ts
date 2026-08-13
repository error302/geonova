/**
 * Tolerance Engine
 * Validates survey results against tolerance profiles following Basak standards
 * 
 * METARDU Calculation Standards: N.N. Basak
 * - No intermediate rounding
 * - Full floating point precision
 * - Round only at display layer
 */

export type ToleranceProfile = 'cadastral' | 'engineering' | 'control'

export interface ToleranceConfig {
  name: string
  description: string
  linearPrecision: number
  angularMisclosure: number
  closingErrorMmPerKm: number
}

export interface ToleranceCheckResult {
  passed: boolean
  profile: ToleranceProfile
  checks: ToleranceCheck[]
  precisionGrade: string
  recommendations: string[]
}

export interface ToleranceCheck {
  name: string
  passed: boolean
  actual: number
  allowable: number
  unit: string
  message: string
}

const TOLERANCE_CONFIGS: Record<ToleranceProfile, ToleranceConfig> = {
  cadastral: {
    name: 'Cadastral',
    description: 'Urban property boundary surveys',
    linearPrecision: 5000,
    angularMisclosure: 60,
    closingErrorMmPerKm: 10 // RDM 1.1 (2025) Table 5.1: 10√K mm
  },
  engineering: {
    name: 'Engineering',
    description: 'Construction and engineering surveys',
    linearPrecision: 10000,
    angularMisclosure: 30,
    closingErrorMmPerKm: 8
  },
  control: {
    name: 'Control',
    description: 'High-precision control networks',
    linearPrecision: 20000,
    angularMisclosure: 10,
    closingErrorMmPerKm: 4
  }
}

export function getToleranceConfig(profile: ToleranceProfile): ToleranceConfig {
  return TOLERANCE_CONFIGS[profile]
}

export function getAllToleranceProfiles(): ToleranceProfile[] {
  return ['cadastral', 'engineering', 'control']
}

export interface TraverseValidationInput {
  precisionRatio: number
  angularMisclosure: number | null
  linearError: number
  totalDistance: number
  numStations: number
}

export interface LevelingValidationInput {
  arithmeticCheckPassed: boolean
  arithmeticDiff: number
  closingError: number
  distanceKm: number
}

export interface ValidationInput {
  traverse?: TraverseValidationInput
  leveling?: LevelingValidationInput
}

export function checkTolerance(
  input: ValidationInput,
  profile: ToleranceProfile
): ToleranceCheckResult {
  const config = TOLERANCE_CONFIGS[profile]
  const checks: ToleranceCheck[] = []
  const recommendations: string[] = []

  if (input.traverse) {
    const { precisionRatio, angularMisclosure, linearError, totalDistance, numStations } = input.traverse

    // FIXED: Previous version used `precision = 1/precisionRatio` which is a tiny decimal
  // (e.g. 0.0002 for 1:5000), and compared it against config.linearPrecision (e.g. 5000).
  // This meant the check ALWAYS failed. The precisionRatio IS already the large number
  // (e.g. 5000 means 1:5000), so compare it directly.
  // Source: Basak, Ghilani & Wolf — precision ratio = perimeter / linearMisclosure
  checks.push({
      name: 'Linear Precision',
      passed: precisionRatio >= config.linearPrecision,
      actual: precisionRatio,
      allowable: config.linearPrecision,
      unit: '1:X',
      message: precisionRatio >= config.linearPrecision
        ? `Precision 1:${Math.round(precisionRatio)} meets ${config.name} standard (1:${config.linearPrecision})`
        : `Precision 1:${Math.round(precisionRatio)} below ${config.name} standard (1:${config.linearPrecision})`
    })

    if (angularMisclosure !== null) {
      const angularAllowable = config.angularMisclosure * Math.sqrt(numStations)
      checks.push({
        name: 'Angular Misclosure',
        passed: Math.abs(angularMisclosure) <= angularAllowable,
        actual: Math.abs(angularMisclosure),
        allowable: angularAllowable,
        unit: 'seconds',
        message: Math.abs(angularMisclosure) <= angularAllowable
          ? `Angular misclosure ${angularMisclosure.toFixed(1)}" within limit ${angularAllowable.toFixed(1)}"`
          : `Angular misclosure ${angularMisclosure.toFixed(1)}" exceeds limit ${angularAllowable.toFixed(1)}"`
      })
    }

    if (totalDistance > 0 && linearError > 0) {
      const allowableMm = (config.closingErrorMmPerKm * totalDistance) / 1000
      
      checks.push({
        name: 'Linear Misclosure',
        passed: linearError <= allowableMm,
        actual: linearError,
        allowable: allowableMm,
        unit: 'm',
        message: linearError <= allowableMm
          ? `Closing error ${(linearError * 1000).toFixed(1)}mm within allowable ${allowableMm.toFixed(3)}m`
          : `Closing error ${(linearError * 1000).toFixed(1)}mm exceeds allowable ${allowableMm.toFixed(3)}m`
      })
    }
  }

  if (input.leveling) {
    const { arithmeticCheckPassed, arithmeticDiff, closingError, distanceKm } = input.leveling

    checks.push({
      name: 'Arithmetic Check',
      passed: arithmeticCheckPassed,
      actual: Math.abs(arithmeticDiff),
      allowable: 0,
      unit: 'm',
      message: arithmeticCheckPassed
        ? `Arithmetic check passed (diff: ${Math.abs(arithmeticDiff).toFixed(4)}m)`
        : `Arithmetic check failed (diff: ${arithmeticDiff.toFixed(4)}m) - BLOCKED`
    })

    if (distanceKm > 0 && closingError !== undefined) {
      const closingErrorMm = Math.abs(closingError) * 1000
      const allowableMm = config.closingErrorMmPerKm * Math.sqrt(distanceKm)
      
      checks.push({
        name: 'Closing Error',
        passed: closingErrorMm <= allowableMm,
        actual: closingErrorMm,
        allowable: allowableMm,
        unit: 'mm',
        message: closingErrorMm <= allowableMm
          ? `Closing error ${closingErrorMm.toFixed(1)}mm within allowable ${allowableMm.toFixed(1)}mm`
          : `Closing error ${closingErrorMm.toFixed(1)}mm exceeds allowable ${allowableMm.toFixed(1)}mm`
      })
    }
  }

  const allPassed = checks.every(c => c.passed)
  const precisionGrade = getPrecisionGrade(checks)

  if (!allPassed) {
    const failedChecks = checks.filter((c) => !c.passed)
    for (const failed of failedChecks) {
      if (failed.name === 'Linear Precision') {
        recommendations.push('Consider re-measuring traverse legs or adding control points')
      }
      if (failed.name === 'Angular Misclosure') {
        recommendations.push('Check angle measurements - possible instrument or booking error')
      }
      if (failed.name === 'Linear Misclosure') {
        recommendations.push('Review distance measurements - possible systematic error')
      }
      if (failed.name === 'Arithmetic Check') {
        recommendations.push('Recompute field notes - arithmetic error detected')
      }
      if (failed.name === 'Closing Error') {
        recommendations.push('Consider running double-run leveling for verification')
      }
    }
  }

  return {
    passed: allPassed,
    profile,
    checks,
    precisionGrade,
    recommendations
  }
}

function getPrecisionGrade(checks: ToleranceCheck[]): string {
  const linearCheck = checks.find((c) => c.name === 'Linear Precision')
  if (!linearCheck) return 'Unknown'

  // FIXED: linearCheck.actual is now the precision ratio (e.g. 5000 for 1:5000),
  // not the reciprocal (0.0002). Compare ratio directly against thresholds.
  const ratio = linearCheck.actual

  if (ratio >= 20000) return 'Control Grade'
  if (ratio >= 10000) return 'Engineering Grade'
  if (ratio >= 5000) return 'Cadastral Grade'
  if (ratio >= 3000) return 'Good'
  if (ratio >= 1000) return 'Acceptable'
  return 'Poor - Rejected'
}

export function formatToleranceCheck(result: ToleranceCheckResult): string {
  const status = result.passed ? ' PASS' : '[x] FAIL'
  const lines = [
    `Tolerance Check: ${status}`,
    `Profile: ${TOLERANCE_CONFIGS[result.profile].name}`,
    `Grade: ${result.precisionGrade}`,
    ''
  ]

  for (const check of result.checks) {
    lines.push(`${check.passed ? '' : '[x]'} ${check.name}: ${check.message}`)
  }

  if (result.recommendations.length > 0) {
    lines.push('')
    lines.push('Recommendations:')
    for (const rec of result.recommendations) {
      lines.push(`  • ${rec}`)
    }
  }

  return lines.join('\n')
}
