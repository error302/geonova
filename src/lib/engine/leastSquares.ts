/**
 * Least Squares Adjustment (2D) — Weighted, iterative
 * References: standard surveying adjustment (Ghilani/Wolf; Ghilani "Adjustment Computations")
 *
 * This implementation supports mixed observation sets of:
 * - horizontal distances (m)
 * - whole-circle bearings (degrees, WCB from North)
 *
 * Notes:
 * - All computations keep full floating-point precision (no intermediate rounding).
 * - Observations use `weight = 1/σ²` (per-observation), where σ is in the observation's units.
 * - Bearings are internally handled in radians; residuals are wrapped to (-π, π].
 */

export interface Observation {
  from: string
  to: string
  distance?: number
  bearing?: number
  /**
   * Observation weight = 1/σ² in the SAME units as the residual:
   * - distance residuals: meters
   * - bearing residuals: radians
   *
   * If omitted, METARDU derives weight from `distanceSigma` / `bearingSigmaArcSec` when provided.
   */
  weight?: number
  /** Distance standard deviation (meters). Used only when `distance` is provided and `weight` is omitted. */
  distanceSigma?: number
  /** Bearing standard deviation (arc-seconds). Used only when `bearing` is provided and `weight` is omitted. */
  bearingSigmaArcSec?: number
}

export interface LSAdjustmentResult {
  ok: boolean
  adjustedPoints: Array<{
    name: string
    easting: number
    northing: number
    sigmaEasting: number
    sigmaNorthing: number
  }>
  residuals: Array<{
    observation: string
    residual: number
    standardizedResidual: number
  }>
  referenceVariance: number
  chiSquare: number
  degreesOfFreedom: number
  globalTest?: {
    alpha: number
    lower: number
    upper: number
    passed: boolean
  }
  passed: boolean
  error?: string
}

type Point = { easting: number; northing: number }

function toRadians(deg: number) {
  return (deg * Math.PI) / 180
}

function wrapAngleRad(rad: number) {
  let a = rad
  while (a <= -Math.PI) a += 2 * Math.PI
  while (a > Math.PI) a -= 2 * Math.PI
  return a
}

function zeros(rows: number, cols: number) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0))
}

function transpose(A: number[][]) {
  const rows = A.length
  const cols = A[0]?.length ?? 0
  const T = zeros(cols, rows)
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) T[j][i] = A[i][j]
  }
  return T
}

function matMul(A: number[][], B: number[][]) {
  const r = A.length
  const k = A[0]?.length ?? 0
  const c = B[0]?.length ?? 0
  const out = zeros(r, c)
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      let s = 0
      for (let t = 0; t < k; t++) s += A[i][t] * B[t][j]
      out[i][j] = s
    }
  }
  return out
}

function matVecMul(A: number[][], v: number[]) {
  const r = A.length
  const c = A[0]?.length ?? 0
  const out = new Array(r).fill(0)
  for (let i = 0; i < r; i++) {
    let s = 0
    for (let j = 0; j < c; j++) s += A[i][j] * v[j]
    out[i] = s
  }
  return out
}

function gaussianSolve(A: number[][], b: number[]) {
  const n = A.length
  const M = A.map((row, i) => [...row, b[i]])

  for (let k = 0; k < n; k++) {
    // pivot
    let pivotRow = k
    let max = Math.abs(M[k][k])
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(M[i][k])
      if (v > max) {
        max = v
        pivotRow = i
      }
    }
    if (max === 0 || !isFinite(max)) throw new Error('Normal matrix is singular or ill-conditioned')
    if (pivotRow !== k) {
      const tmp = M[k]
      M[k] = M[pivotRow]
      M[pivotRow] = tmp
    }

    // eliminate
    const pivot = M[k][k]
    for (let j = k; j <= n; j++) M[k][j] /= pivot

    for (let i = 0; i < n; i++) {
      if (i === k) continue
      const factor = M[i][k]
      if (factor === 0) continue
      for (let j = k; j <= n; j++) M[i][j] -= factor * M[k][j]
    }
  }

  return M.map(row => row[n])
}

function invertMatrix(A: number[][]) {
  const n = A.length
  const I = zeros(n, n)
  for (let i = 0; i < n; i++) I[i][i] = 1

  // Solve A * X = I column-by-column
  const inv = zeros(n, n)
  for (let col = 0; col < n; col++) {
    const e = I.map(row => row[col])
    const x = gaussianSolve(A.map(r => [...r]), [...e])
    for (let i = 0; i < n; i++) inv[i][col] = x[i]
  }
  return inv
}

function dot(a: number[], b: number[]) {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

function normalQuantile(p: number) {
  // Acklam's inverse normal CDF approximation (sufficient for chi-square quantile approximation).
  if (!(p > 0 && p < 1) || !Number.isFinite(p)) return NaN

  const a = [
    -3.969683028665376e+01,
    2.209460984245205e+02,
    -2.759285104469687e+02,
    1.383577518672690e+02,
    -3.066479806614716e+01,
    2.506628277459239e+00,
  ]
  const b = [
    -5.447609879822406e+01,
    1.615858368580409e+02,
    -1.556989798598866e+02,
    6.680131188771972e+01,
    -1.328068155288572e+01,
  ]
  const c = [
    -7.784894002430293e-03,
    -3.223964580411365e-01,
    -2.400758277161838e+00,
    -2.549732539343734e+00,
    4.374664141464968e+00,
    2.938163982698783e+00,
  ]
  const d = [
    7.784695709041462e-03,
    3.224671290700398e-01,
    2.445134137142996e+00,
    3.754408661907416e+00,
  ]

  const plow = 0.02425
  const phigh = 1 - plow

  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    )
  }

  if (p > phigh) {
    const q = Math.sqrt(-2 * Math.log(1 - p))
    return -(
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    )
  }

  const q = p - 0.5
  const r = q * q
  return (
    (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  )
}

function chiSquareQuantileApprox(p: number, dof: number) {
  // Wilson–Hilferty transform approximation.
  if (!(dof > 0) || !(p > 0 && p < 1)) return NaN
  const z = normalQuantile(p)
  const a = 2 / (9 * dof)
  return dof * Math.pow(1 - a + z * Math.sqrt(a), 3)
}

export function leastSquaresAdjustment(
  fixedPoints: Array<{ name: string; easting: number; northing: number }>,
  unknownPoints: Array<{ name: string; eastingApprox: number; northingApprox: number }>,
  observations: Observation[],
  options?: {
    maxIterations?: number
    convergenceMm?: number
    standardizedResidualLimit?: number
    globalTestAlpha?: number
  }
): LSAdjustmentResult {
  const maxIterations = options?.maxIterations ?? 20
  const convergenceMm = options?.convergenceMm ?? 0.001
  const standardizedResidualLimit = options?.standardizedResidualLimit ?? 3.0
  const globalTestAlpha = options?.globalTestAlpha ?? 0.05

  if (fixedPoints.length < 1) {
    return {
      ok: false,
      adjustedPoints: [],
      residuals: [],
      referenceVariance: 0,
      chiSquare: 0,
      degreesOfFreedom: 0,
      passed: false,
      error: 'Least squares requires at least 1 fixed control point'
    }
  }

  const hasAtLeastOneBearing = observations.some(o => typeof o.bearing === 'number')
  if (!hasAtLeastOneBearing && fixedPoints.length < 2) {
    return {
      ok: false,
      adjustedPoints: [],
      residuals: [],
      referenceVariance: 0,
      chiSquare: 0,
      degreesOfFreedom: 0,
      passed: false,
      error: 'With distance-only observations, at least 2 fixed points are required to prevent rotation'
    }
  }

  const unknownIndex = new Map<string, number>()
  unknownPoints.forEach((p, i) => unknownIndex.set(p.name, i))

  const fixed = new Map<string, Point>()
  fixedPoints.forEach(p => fixed.set(p.name, { easting: p.easting, northing: p.northing }))

  const x: number[] = new Array(unknownPoints.length * 2)
  for (let i = 0; i < unknownPoints.length; i++) {
    x[2 * i] = unknownPoints[i].eastingApprox
    x[2 * i + 1] = unknownPoints[i].northingApprox
  }

  const getPoint = (name: string): Point | null => {
    const f = fixed.get(name)
    if (f) return f
    const idx = unknownIndex.get(name)
    if (idx === undefined) return null
    return { easting: x[2 * idx], northing: x[2 * idx + 1] }
  }

  const activeObservations = observations.filter(o => o.distance !== undefined || o.bearing !== undefined)
  const m = activeObservations.length
  const n = unknownPoints.length * 2
  if (m <= n) {
    return {
      ok: false,
      adjustedPoints: [],
      residuals: [],
      referenceVariance: 0,
      chiSquare: 0,
      degreesOfFreedom: 0,
      passed: false,
      error: `Insufficient redundancy: observations=${m}, unknowns=${n}`
    }
  }

  let lastDxMax = Infinity

  let A: number[][] = []
  let w: number[] = []
  let Pdiag: number[] = []
  let computedResiduals: Array<{ key: string; residual: number; weight: number; aRow: number[] }> = []

  for (let iter = 0; iter < maxIterations; iter++) {
    A = zeros(m, n)
    w = new Array(m).fill(0)
    Pdiag = new Array(m).fill(0)
    computedResiduals = []

    for (let i = 0; i < m; i++) {
      const obs = activeObservations[i]
      const from = getPoint(obs.from)
      const to = getPoint(obs.to)
      if (!from || !to) {
        return {
          ok: false,
          adjustedPoints: [],
          residuals: [],
          referenceVariance: 0,
          chiSquare: 0,
          degreesOfFreedom: 0,
          passed: false,
          error: `Unknown point referenced in observation: ${obs.from} -> ${obs.to}`
        }
      }

      const dE = to.easting - from.easting
      const dN = to.northing - from.northing
      const r2 = dE * dE + dN * dN
      const r = Math.sqrt(r2)

      const fromUnknown = unknownIndex.get(obs.from)
      const toUnknown = unknownIndex.get(obs.to)

      let row = new Array(n).fill(0)
      let residual = 0

      if (obs.distance !== undefined) {
        if (r === 0) {
          return {
            ok: false,
            adjustedPoints: [],
            residuals: [],
            referenceVariance: 0,
            chiSquare: 0,
            degreesOfFreedom: 0,
            passed: false,
            error: `Zero distance geometry in observation: ${obs.from} -> ${obs.to}`
          }
        }

        // f = sqrt(dE^2 + dN^2)
        // partials w.r.t coords of from/to
        const dfdE = dE / r
        const dfdN = dN / r

        if (fromUnknown !== undefined) {
          row[2 * fromUnknown] = -dfdE
          row[2 * fromUnknown + 1] = -dfdN
        }
        if (toUnknown !== undefined) {
          row[2 * toUnknown] = dfdE
          row[2 * toUnknown + 1] = dfdN
        }

        residual = obs.distance - r
      } else if (obs.bearing !== undefined) {
        if (r2 === 0) {
          return {
            ok: false,
            adjustedPoints: [],
            residuals: [],
            referenceVariance: 0,
            chiSquare: 0,
            degreesOfFreedom: 0,
            passed: false,
            error: `Zero bearing geometry in observation: ${obs.from} -> ${obs.to}`
          }
        }

        const theta = Math.atan2(dE, dN) // WCB, radians
        const l = toRadians(obs.bearing)
        residual = wrapAngleRad(l - theta)

        // θ = atan2(dE, dN)
        // ∂θ/∂dE = dN / (dE^2 + dN^2)
        // ∂θ/∂dN = -dE / (dE^2 + dN^2)
        const dtdE = dN / r2
        const dtdN = -dE / r2

        if (fromUnknown !== undefined) {
          row[2 * fromUnknown] = -(-dtdE) // because dE = E_to - E_from
          row[2 * fromUnknown + 1] = -(-dtdN) // dN = N_to - N_from
          // Simplify: θ depends on dE,dN; with respect to E_from: ∂θ/∂E_from = -∂θ/∂dE
          row[2 * fromUnknown] = -dtdE
          row[2 * fromUnknown + 1] = -dtdN
        }
        if (toUnknown !== undefined) {
          row[2 * toUnknown] = dtdE
          row[2 * toUnknown + 1] = dtdN
        }
      }

      A[i] = row
      w[i] = residual
      const weightFromSigmas = () => {
        if (obs.distance !== undefined && typeof obs.distanceSigma === 'number' && obs.distanceSigma > 0) {
          return 1 / (obs.distanceSigma * obs.distanceSigma)
        }
        if (obs.bearing !== undefined && typeof obs.bearingSigmaArcSec === 'number' && obs.bearingSigmaArcSec > 0) {
          const sigmaRad = (obs.bearingSigmaArcSec * Math.PI) / (180 * 3600)
          return 1 / (sigmaRad * sigmaRad)
        }
        return 1
      }

      const weight = typeof obs.weight === 'number' && obs.weight > 0 ? obs.weight : weightFromSigmas()
      Pdiag[i] = weight

      computedResiduals.push({
        key: `${obs.from}->${obs.to}:${obs.distance !== undefined ? 'D' : 'B'}`,
        residual,
        weight,
        aRow: row,
      })
    }

    // Build normal equations: N = A^T P A, u = A^T P w
    const At = transpose(A)

    const PA = zeros(m, n)
    const Pw = new Array(m).fill(0)
    for (let i = 0; i < m; i++) {
      const p = Pdiag[i]
      Pw[i] = p * w[i]
      for (let j = 0; j < n; j++) PA[i][j] = p * A[i][j]
    }

    const Nmat = matMul(At, PA)
    const u = matVecMul(At, Pw)

    let dx: number[]
    try {
      dx = gaussianSolve(Nmat.map(r => [...r]), u)
    } catch (e: any) {
      return {
        ok: false,
        adjustedPoints: [],
        residuals: [],
        referenceVariance: 0,
        chiSquare: 0,
        degreesOfFreedom: 0,
        passed: false,
        error: e?.message ?? String(e),
      }
    }

    let dxMax = 0
    for (let i = 0; i < dx.length; i++) {
      x[i] += dx[i]
      dxMax = Math.max(dxMax, Math.abs(dx[i]))
    }

    lastDxMax = dxMax
    if (dxMax * 1000 <= convergenceMm) break
    if (!isFinite(dxMax)) break
  }

  if (!isFinite(lastDxMax)) {
    return {
      ok: false,
      adjustedPoints: [],
      residuals: [],
      referenceVariance: 0,
      chiSquare: 0,
      degreesOfFreedom: 0,
      passed: false,
      error: 'Adjustment diverged',
    }
  }

  // Rebuild design matrix at final estimates (for covariance + residual tests).
  A = zeros(m, n)
  w = new Array(m).fill(0)
  Pdiag = new Array(m).fill(0)
  computedResiduals = []

  for (let i = 0; i < m; i++) {
    const obs = activeObservations[i]
    const from = getPoint(obs.from)
    const to = getPoint(obs.to)
    if (!from || !to) {
      return {
        ok: false,
        adjustedPoints: [],
        residuals: [],
        referenceVariance: 0,
        chiSquare: 0,
        degreesOfFreedom: 0,
        passed: false,
        error: `Unknown point referenced in observation: ${obs.from} -> ${obs.to}`,
      }
    }

    const dE = to.easting - from.easting
    const dN = to.northing - from.northing
    const r2 = dE * dE + dN * dN
    const r = Math.sqrt(r2)

    const fromUnknown = unknownIndex.get(obs.from)
    const toUnknown = unknownIndex.get(obs.to)

    let row = new Array(n).fill(0)
    let residual = 0

    if (obs.distance !== undefined) {
      if (r === 0) {
        return {
          ok: false,
          adjustedPoints: [],
          residuals: [],
          referenceVariance: 0,
          chiSquare: 0,
          degreesOfFreedom: 0,
          passed: false,
          error: `Zero distance geometry in observation: ${obs.from} -> ${obs.to}`,
        }
      }

      const dfdE = dE / r
      const dfdN = dN / r

      if (fromUnknown !== undefined) {
        row[2 * fromUnknown] = -dfdE
        row[2 * fromUnknown + 1] = -dfdN
      }
      if (toUnknown !== undefined) {
        row[2 * toUnknown] = dfdE
        row[2 * toUnknown + 1] = dfdN
      }

      residual = obs.distance - r
    } else if (obs.bearing !== undefined) {
      if (r2 === 0) {
        return {
          ok: false,
          adjustedPoints: [],
          residuals: [],
          referenceVariance: 0,
          chiSquare: 0,
          degreesOfFreedom: 0,
          passed: false,
          error: `Zero bearing geometry in observation: ${obs.from} -> ${obs.to}`,
        }
      }

      const theta = Math.atan2(dE, dN)
      const l = toRadians(obs.bearing)
      residual = wrapAngleRad(l - theta)

      const dtdE = dN / r2
      const dtdN = -dE / r2

      if (fromUnknown !== undefined) {
        row[2 * fromUnknown] = -dtdE
        row[2 * fromUnknown + 1] = -dtdN
      }
      if (toUnknown !== undefined) {
        row[2 * toUnknown] = dtdE
        row[2 * toUnknown + 1] = dtdN
      }
    }

      A[i] = row
      w[i] = residual
      const weightFromSigmas = () => {
        if (obs.distance !== undefined && typeof obs.distanceSigma === 'number' && obs.distanceSigma > 0) {
          return 1 / (obs.distanceSigma * obs.distanceSigma)
        }
        if (obs.bearing !== undefined && typeof obs.bearingSigmaArcSec === 'number' && obs.bearingSigmaArcSec > 0) {
          const sigmaRad = (obs.bearingSigmaArcSec * Math.PI) / (180 * 3600)
          return 1 / (sigmaRad * sigmaRad)
        }
        return 1
      }

      const weight = typeof obs.weight === 'number' && obs.weight > 0 ? obs.weight : weightFromSigmas()
      Pdiag[i] = weight
      computedResiduals.push({
        key: `${obs.from}->${obs.to}:${obs.distance !== undefined ? 'D' : 'B'}`,
        residual,
        weight,
        aRow: row,
      })
  }

  // Compute final residuals:
  // w_final = l - f(x̂); v = -w_final.
  const v = new Array(m).fill(0)
  const obsLabel: string[] = new Array(m).fill('')
  for (let i = 0; i < m; i++) {
    const obs = activeObservations[i]
    const from = getPoint(obs.from)!
    const to = getPoint(obs.to)!
    const dE = to.easting - from.easting
    const dN = to.northing - from.northing
    const r2 = dE * dE + dN * dN
    const r = Math.sqrt(r2)

    if (obs.distance !== undefined) {
      v[i] = -(obs.distance - r)
      obsLabel[i] = `${obs.from}→${obs.to} distance`
    } else if (obs.bearing !== undefined) {
      const theta = Math.atan2(dE, dN)
      const l = toRadians(obs.bearing)
      v[i] = -wrapAngleRad(l - theta)
      obsLabel[i] = `${obs.from}→${obs.to} bearing`
    }
  }

  const dof = m - n
  const vPv = v.reduce((sum, vi, i) => sum + Pdiag[i] * vi * vi, 0)
  const referenceVariance = dof > 0 ? vPv / dof : 0

  // Parameter covariance: Σxx = σ0^2 * N^{-1}
  let Ninv: number[][]
  try {
    // Rebuild N at final for covariance
    const At = transpose(A)
    const PA = zeros(m, n)
    for (let i = 0; i < m; i++) {
      const p = Pdiag[i]
      for (let j = 0; j < n; j++) PA[i][j] = p * A[i][j]
    }
    const Nmat = matMul(At, PA)
    Ninv = invertMatrix(Nmat)
  } catch {
    Ninv = zeros(n, n)
  }

  const adjustedPoints = unknownPoints.map((p, i) => {
    const varE = referenceVariance * (Ninv[2 * i]?.[2 * i] ?? 0)
    const varN = referenceVariance * (Ninv[2 * i + 1]?.[2 * i + 1] ?? 0)
    return {
      name: p.name,
      easting: x[2 * i],
      northing: x[2 * i + 1],
      sigmaEasting: varE > 0 ? Math.sqrt(varE) : 0,
      sigmaNorthing: varN > 0 ? Math.sqrt(varN) : 0,
    }
  })

  // Residual covariance diagonal: qvv_i = 1/weight - a_i^T Qxx a_i
  const residuals = computedResiduals.map((r, i) => {
    const a = r.aRow
    const Qxx = Ninv
    const Qa = matVecMul(Qxx, a)
    const aTQa = dot(a, Qa)

    const qll = 1 / r.weight
    const qvv = Math.max(0, qll - aTQa)
    const denom = Math.sqrt((referenceVariance || 1) * (qvv || qll || 1))

    return {
      observation: obsLabel[i] || r.key,
      residual: v[i],
      standardizedResidual: denom > 0 ? v[i] / denom : 0,
    }
  })

  const passed = residuals.every(r => Math.abs(r.standardizedResidual) <= standardizedResidualLimit)

  const globalTest =
    dof > 0 && globalTestAlpha > 0 && globalTestAlpha < 1
      ? (() => {
          const lower = chiSquareQuantileApprox(globalTestAlpha / 2, dof)
          const upper = chiSquareQuantileApprox(1 - globalTestAlpha / 2, dof)
          const globalPassed = Number.isFinite(lower) && Number.isFinite(upper) ? vPv >= lower && vPv <= upper : true
          return { alpha: globalTestAlpha, lower, upper, passed: globalPassed }
        })()
      : undefined

  return {
    ok: true,
    adjustedPoints,
    residuals,
    referenceVariance,
    chiSquare: vPv,
    degreesOfFreedom: dof,
    globalTest,
    passed,
  }
}

export function calculateRedundancy(unknowns: number, observations: number): number {
  return observations - unknowns * 2
}

export function getPrecisionGrade(ratio: number): string {
  if (ratio >= 5000) return 'excellent'
  if (ratio >= 3000) return 'good'
  if (ratio >= 1000) return 'acceptable'
  return 'poor'
}
