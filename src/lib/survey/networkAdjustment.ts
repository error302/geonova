/**
 * @deprecated P1-5 (2026-07-24): Use `@/lib/engine/networkAdjustment.ts`
 *   (the `adjustNetwork` function) instead. That module is the canonical
 *   enterprise-grade LSA with sparse Cholesky, free-network inner
 *   constraints, Huber robust estimation, full Baarda reliability,
 *   and 2D/3D support.
 *
 * CONSOLIDATED (P1-5 phase 1): `adjustNetwork` below is now a thin adapter
 * over the canonical engine implementation — the former local dense
 * normal-equation solver (~230 LOC) has been deleted. The public contract
 * (Station/Observation inputs, Zod validation, AdjustmentResult output,
 * warning strings) is preserved for `NetworkAdjustmentPanel`,
 * `ErrorEllipseCanvas`, `ExportToolbar`, and `regulatoryCompliance.ts`.
 */

import { z } from 'zod'
import { adjustNetwork as engineAdjustNetwork } from '@/lib/engine/networkAdjustment'

export const StationSchema = z.object({
  id: z.string().min(1, 'Station ID is required'),
  name: z.string().min(1, 'Station name is required'),
  easting: z.number().finite(),
  northing: z.number().finite(),
  elevation: z.number().finite(),
  isFixed: z.boolean(),
})

export type Station = z.infer<typeof StationSchema>

export const ObservationSchema = z.object({
  from: z.string().min(1, 'From station is required'),
  to: z.string().min(1, 'To station is required'),
  deltaE: z.number().finite(),
  deltaN: z.number().finite(),
  deltaH: z.number().finite(),
  stdDevE: z.number().positive().max(1).default(0.005),
  stdDevN: z.number().positive().max(1).default(0.005),
  stdDevH: z.number().positive().max(1).default(0.010),
})

export type Observation = z.infer<typeof ObservationSchema>

export interface AdjustedStation extends Station {
  residualE: number
  residualN: number
  residualH: number
  semiMajor: number
  semiMinor: number
  orientation: number
  sigmaE: number
  sigmaN: number
  sigmaH: number
}

export interface AdjustmentResult {
  adjustedStations: AdjustedStation[]
  sigmaZero: number
  degreesOfFreedom: number
  iterations: number
  passedTolerance: boolean
  warnings: string[]
  /**
   * Optional LSA statistical report (global test, w-test, reliability).
   * Not produced by this adapter — the canonical engine exposes Baarda
   * reliability via `engine/networkAdjustment` residuals. Kept in the type
   * because `regulatoryCompliance.ts` consumes it when callers supply a
   * result from the full engine path.
   */
  statisticalReport?: import('./lsaStatisticalTesting').StatisticalReport
}


/**
 * Coordinate-difference network adjustment.
 *
 * Delegates to the canonical engine LSA (`@/lib/engine/networkAdjustment`).
 * Each Station/Observation pair is mapped onto the engine's
 * NetworkPoint / NetworkObservation (`gnss_baseline` observation type carries
 * ΔE/ΔN/ΔU components; per-component variances are supplied through the
 * diagonal 3×3 covariance so individual stdDevE/N/H weights are preserved).
 */
export function adjustNetwork(
  stationsInput: Station[],
  observationsInput: Observation[]
): AdjustmentResult {
  const stationValidation = StationSchema.array().safeParse(stationsInput)
  if (!stationValidation.success) {
    const issues = stationValidation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Invalid stations: ${issues}`)
  }
  const stations = stationValidation.data

  const obsValidation = ObservationSchema.array().safeParse(observationsInput)
  if (!obsValidation.success) {
    const issues = obsValidation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Invalid observations: ${issues}`)
  }
  const observations = obsValidation.data

  const warnings: string[] = []

  const fixed = stations.filter(s => s.isFixed)
  if (fixed.length === 0) {
    throw new Error('At least one fixed control station is required.')
  }
  if (fixed.length < 2) {
    warnings.push('Only 1 fixed control station provided. Per Survey Regulations Reg. 60(2)(c) and Reg. 67, cadastral traverses must close between two previously fixed stations. A single fixed point results in an unconstrained network (swinging traverse) — prohibited for cadastral surveys.')
  }
  if (observations.length === 0) {
    throw new Error('At least one baseline observation is required.')
  }

  const freeCount = stations.filter(s => !s.isFixed).length
  const nParams = freeCount * 3 // 3D: E, N, H
  const nEquations = observations.length * 3 // 3 equations per baseline
  const dof = nEquations - nParams

  if (dof < 0) {
    throw new Error(
      `Insufficient observations. Need at least ${Math.ceil(nParams / 3)} baselines for ${freeCount} free stations.`
    )
  }

  // Zero redundancy: the MLE solution is the input configuration itself
  // (observations fit exactly); there is nothing to adjust and no reliable
  // variance estimate. Return unchanged coordinates with zero corrections.
  if (dof === 0) {
    warnings.push('Zero degrees of freedom — cannot compute reliable error estimates.')
    return {
      adjustedStations: stations.map(s => ({
        ...s,
        residualE: 0,
        residualN: 0,
        residualH: 0,
        semiMajor: 0,
        semiMinor: 0,
        orientation: 0,
        sigmaE: 0,
        sigmaN: 0,
        sigmaH: 0,
      })),
      sigmaZero: 0,
      degreesOfFreedom: 0,
      iterations: 1,
      passedTolerance: true,
      warnings,
    }
  }

  // Map onto the canonical engine types
  const enginePoints = stations.map(s => ({
    name: s.id,
    easting: s.easting,
    northing: s.northing,
    rl: s.elevation,
    fixed: s.isFixed,
  }))

  const engineObservations = observations.map(obs => ({
    type: 'gnss_baseline' as const,
    from: obs.from,
    to: obs.to,
    // Required by NetworkObservation but unused for gnss_baseline
    value: 0,
    sigma: 1,
    deltaE: obs.deltaE,
    deltaN: obs.deltaN,
    deltaU: obs.deltaH,
    // Diagonal covariance preserves per-component a priori weights exactly:
    // [C_EE, C_EN, C_NN, C_EU, C_NU, C_UU], units m²
    covariance3x3: [
      obs.stdDevE * obs.stdDevE,
      0,
      obs.stdDevN * obs.stdDevN,
      0,
      0,
      obs.stdDevH * obs.stdDevH,
    ] as [number, number, number, number, number, number],
  }))

  const result = engineAdjustNetwork(enginePoints, engineObservations, { dimension: '3D' })

  if (!result.ok) {
    throw new Error(result.error ?? 'Network adjustment failed.')
  }
  warnings.push(...result.warnings)

  const pointByName = new Map(result.adjustedPoints.map(p => [p.name, p]))

  const adjustedStations: AdjustedStation[] = stations.map(s => {
    if (s.isFixed) {
      return {
        ...s,
        residualE: 0,
        residualN: 0,
        residualH: 0,
        semiMajor: 0,
        semiMinor: 0,
        orientation: 0,
        sigmaE: 0,
        sigmaN: 0,
        sigmaH: 0,
      }
    }
    // The engine only returns adjusted (non-fixed) points
    const adj = pointByName.get(s.id)
    if (!adj) {
      throw new Error(`Missing adjusted result for station ${s.id}`)
    }
    const ellipse = adj.errorEllipse
    return {
      ...s,
      easting: adj.easting,
      northing: adj.northing,
      elevation: adj.rl ?? s.elevation,
      residualE: adj.correctionE,
      residualN: adj.correctionN,
      residualH: adj.correctionRL ?? 0,
      semiMajor: ellipse?.semiMajor ?? 0,
      semiMinor: ellipse?.semiMinor ?? 0,
      orientation: ellipse?.orientation ?? 0,
      sigmaE: adj.sigmaE,
      sigmaN: adj.sigmaN,
      sigmaH: adj.sigmaRL ?? 0,
    }
  })

  return {
    adjustedStations,
    sigmaZero: result.standardError,
    // Preserve this module's historical DoF convention: raw observation
    // equations minus unknowns (the engine subtracts datum constraint
    // dimensions, which would under-report for coordinate-difference LSA).
    degreesOfFreedom: dof,
    iterations: result.iterations,
    passedTolerance: result.passed,
    warnings,
  }
}
