// METARDU Traverse Computation Engine
// Source: N.N. Basak, Surveying and Levelling, Chapters 10-11
// Source: Ghilani & Wolf, Elementary Surveying 16th Ed., Chapters 10, 12
// Source: RDM 1.1 Kenya 2025, Table 2.4 — Accuracy Classification
// Source: Survey Regulations 1994, Cap 299, Regulation 97

import { dmsToDecimal, bearingToString } from '@/lib/engine/angles'

function dmsStr(d: number, m: number, s: number): string {
  return `${String(Math.floor(Math.abs(d))).padStart(3,'0')}° ${String(Math.floor(Math.abs(m))).padStart(2,'0')}' ${Math.abs(s).toFixed(3)}"`
}

function angleDMS(angleDeg: number): string {
  const norm = ((angleDeg % 360) + 360) % 360
  const d = Math.floor(norm)
  const mFloat = (norm - d) * 60
  const m = Math.floor(mFloat)
  const s = (mFloat - m) * 60
  return `${String(d).padStart(3,'0')}° ${String(m).padStart(2,'0')}' ${s.toFixed(1)}"`
}

export interface RawObservation {
  station: string
  bs: string
  fs: string
  hclDeg: string
  hclMin: string
  hclSec: string
  hcrDeg: string
  hcrMin: string
  hcrSec: string
  slopeDist: string
  vaDeg: string
  vaMin: string
  vaSec: string
  ih: string
  th: string
  remarks?: string
}

export interface ReducedObservation {
  station: string
  hcl: number
  hcr: number
  meanAngle: number
  meanAngleDMS: string
  slopeDist: number
  verticalAngle: number
  verticalAngleRad: number
  horizontalDist: number
  deltaH: number
  ih: number
  th: number
  remarks?: string
}

export interface TraverseComputationLeg {
  from: string
  to: string
  meanAngle: number
  meanAngleDMS: string
  wcb: number
  wcbDMS: string
  sd: number
  hd: number
  departure: number
  latitude: number
  depCorrection: number
  latCorrection: number
  adjDep: number
  adjLat: number
}

export interface TraverseComputationResult {
  rawObservations: RawObservation[]
  observations: ReducedObservation[]
  legs: TraverseComputationLeg[]
  coordinates: Array<{ station: string; easting: number; northing: number; rl?: number }>
  totalPerimeter: number
  sumDepartures: number
  sumLatitudes: number
  linearError: number
  precisionRatio: number
  accuracyOrder: string
  C_mm: number
  K_km: number
  formula: string
  allowable: number
  openingPoint: { easting: number; northing: number; rl?: number }
  closingPoint?: { easting: number; northing: number }
  isClosed: boolean
}

export interface AccuracyClass {
  order: string
  C_mm: number
  K_km: number
  allowable: number
  formula: string
  pass: boolean
}

function classifyAccuracy(C_mm: number, K_km: number): AccuracyClass {
  // Source: RDM 1.1 Kenya 2025, Table 2.4 — Accuracy Classification
  // m = C/√K (mm/√km), where C = closing error in mm, K = perimeter in km
  // Source: Ghilani & Wolf, Chapter 12 — Traverse accuracy standards
  const m = C_mm / 1000
  const K = K_km
  // Source: RDM 1.1 Table 2.4 — m values for each order
  const allow1a = 0.5 * Math.sqrt(K)
  const allow1b = 0.7 * Math.sqrt(K)
  const allow2a = 1.0 * Math.sqrt(K)
  const allow2b = 1.3 * Math.sqrt(K)
  const allow3 = 2.0 * Math.sqrt(K)

  let order: string
  let allowable: number
  if (m <= allow1a) {
    order = 'FIRST ORDER CLASS I'
    allowable = allow1a
  } else if (m <= allow1b) {
    order = 'FIRST ORDER CLASS II'
    allowable = allow1b
  } else if (m <= allow2a) {
    order = 'SECOND ORDER CLASS I'
    allowable = allow2a
  } else if (m <= allow2b) {
    order = 'SECOND ORDER CLASS II'
    allowable = allow2b
  } else if (m <= allow3) {
    order = 'THIRD ORDER'
    allowable = allow3
  } else {
    order = 'FOURTH ORDER'
    allowable = allow3
  }

  return {
    order,
    C_mm,
    K_km: K,
    allowable,
    formula: `C = ${C_mm.toFixed(2)} mm, K = ${K.toFixed(3)} km, Allowable = ${allowable.toFixed(2)} mm`,
    pass: m <= allow3,
  }
}

export function computeTraverse(input: {
  openingEasting: number
  openingNorthing: number
  openingRL?: number
  openingStation: string
  closingEasting?: number
  closingNorthing?: number
  closingStation?: string
  observations: RawObservation[]
  backsightBearingDeg: number
  backsightBearingMin: number
  backsightBearingSec: number
}): TraverseComputationResult {
  const obs = input.observations.filter((o: any) => o.station && o.slopeDist)
  if (obs.length === 0) throw new Error('No valid observations')

  const reduced: ReducedObservation[] = obs.map((o: any) => {
    // Source: Basak, Chapter 10 — Mean angle from face-left and face-right horizontal circle readings
    // Source: Ghilani & Wolf, Chapter 12 — HCR_adj = HCR + 180° when HCR < 180°
    const hcl = dmsToDecimal({ degrees: parseInt(o.hclDeg) || 0, minutes: parseInt(o.hclMin) || 0, seconds: parseFloat(o.hclSec) || 0, direction: 'N' })
    const hcr = dmsToDecimal({ degrees: parseInt(o.hcrDeg) || 0, minutes: parseInt(o.hcrMin) || 0, seconds: parseFloat(o.hcrSec) || 0, direction: 'N' })
    let hcrAdj = hcr + 180
    if (hcrAdj >= 360) hcrAdj -= 360
    // Source: Basak, Eq. 10.2 — meanAngle = (HCL + HCR_adj) / 2
    const meanAngle = (hcl + hcrAdj) / 2
    const meanAngleNorm = meanAngle >= 360 ? meanAngle - 360 : meanAngle < 0 ? meanAngle + 360 : meanAngle

    const sd = parseFloat(o.slopeDist) || 0
    const vaDeg = parseFloat(o.vaDeg) || 0
    const vaMin = parseFloat(o.vaMin) || 0
    const vaSec = parseFloat(o.vaSec) || 0
    const va = dmsToDecimal({ degrees: vaDeg, minutes: vaMin, seconds: vaSec, direction: 'N' })
    const vaRad = va * Math.PI / 180
    // Source: Ghilani & Wolf, Eq. 13.1 — Horizontal Distance = SD × cos(zenith angle)
    // Source: Basak — HD from slope distance and vertical/zenith angle
    const hd = sd * Math.cos(vaRad)
    const ih = parseFloat(o.ih) || 0
    const th = parseFloat(o.th) || 0
    // Source: Ghilani & Wolf — ΔH = SD × sin(VA) + IH - TH
    const deltaH = sd * Math.sin(vaRad) + ih - th

    return {
      station: o.station,
      hcl,
      hcr,
      meanAngle: meanAngleNorm,
      meanAngleDMS: angleDMS(meanAngleNorm),
      slopeDist: sd,
      verticalAngle: va,
      verticalAngleRad: vaRad,
      horizontalDist: hd,
      deltaH,
      ih,
      th,
      remarks: o.remarks,
    }
  })

  const backsightRad = dmsToDecimal({
    degrees: input.backsightBearingDeg,
    minutes: input.backsightBearingMin,
    seconds: input.backsightBearingSec,
    direction: 'N',
  }) * Math.PI / 180

  const legs: TraverseComputationLeg[] = []
  let currentWCB = backsightRad
  const prevStation = obs[0]?.bs || input.openingStation
  let currentE = input.openingEasting
  let currentN = input.openingNorthing
  let currentRL = input.openingRL ?? 0

  const stations = [input.openingStation, ...obs.map((o: any) => o.station)]

  for (let i = 0; i < obs.length; i++) {
    // Source: Basak, Chapter 10 — WCB(n) = WCB(n-1) + interiorAngle
    const angle = reduced[i].meanAngle * Math.PI / 180
    let wcb = currentWCB + angle
    if (wcb < 0) wcb += 2 * Math.PI
    if (wcb >= 2 * Math.PI) wcb -= 2 * Math.PI
    const wcbDeg = wcb * 180 / Math.PI
    const hd = reduced[i].horizontalDist
    // Source: Basak, Eq. 10.3 — Departure = HD × sin(WCB), Latitude = HD × cos(WCB)
    const dep = hd * Math.sin(wcb)
    const lat = hd * Math.cos(wcb)
    currentE += dep
    currentN += lat
    currentRL += reduced[i].deltaH

    legs.push({
      from: stations[i],
      to: stations[i + 1] || obs[i].fs || `T${i + 1}`,
      meanAngle: reduced[i].meanAngle,
      meanAngleDMS: reduced[i].meanAngleDMS,
      wcb: wcbDeg,
      wcbDMS: angleDMS(wcbDeg),
      sd: reduced[i].slopeDist,
      hd,
      departure: dep,
      latitude: lat,
      depCorrection: 0,
      latCorrection: 0,
      adjDep: dep,
      adjLat: lat,
    })

    currentWCB = wcb
  }

  const closingE = input.closingEasting
  const closingN = input.closingNorthing
  const isClosed = closingE !== undefined && closingN !== undefined

  let sumDep = legs.reduce((s, l) => s + l.departure, 0)
  let sumLat = legs.reduce((s, l) => s + l.latitude, 0)

  let linearError = 0
  let precisionRatio = 0
  let C_mm = 0
  let K_km = 0

  if (isClosed && closingE !== undefined && closingN !== undefined) {
    const actualDep = closingE - currentE
    const actualLat = closingN - currentN
    sumDep += actualDep
    sumLat += actualLat
    linearError = Math.sqrt(sumDep * sumDep + sumLat * sumLat)
    const totalDist = legs.reduce((s, l) => s + l.hd, 0)
    K_km = totalDist / 1000
    precisionRatio = totalDist / Math.max(linearError, 1e-12)
    C_mm = linearError * 1000

    const totalPerimeter = totalDist

    // Source: Ghilani & Wolf, Chapter 12 — Bowditch rule: correction_i = -(C/ΣD) × D_i
    // Source: Basak, Chapter 11 — Bowditch correction proportional to leg distance
    for (const leg of legs) {
      leg.depCorrection = -sumDep * (leg.hd / totalDist)
      leg.latCorrection = -sumLat * (leg.hd / totalDist)
      leg.adjDep = leg.departure + leg.depCorrection
      leg.adjLat = leg.latitude + leg.latCorrection
    }

    sumDep = legs.reduce((s, l) => s + l.adjDep, 0)
    sumLat = legs.reduce((s, l) => s + l.adjLat, 0)
  }

  const coords: Array<{ station: string; easting: number; northing: number; rl?: number }> = [
    { station: input.openingStation, easting: input.openingEasting, northing: input.openingNorthing, rl: input.openingRL },
  ]

  let adjE = input.openingEasting
  let adjN = input.openingNorthing
  let adjRL = input.openingRL ?? 0

  for (let i = 0; i < legs.length; i++) {
    adjE += legs[i].adjDep
    adjN += legs[i].adjLat
    adjRL += reduced[i].deltaH
    coords.push({ station: legs[i].to, easting: adjE, northing: adjN, rl: adjRL })
  }

  const totalPerimeter = legs.reduce((s, l) => s + l.hd, 0)
  K_km = totalPerimeter / 1000
  if (isClosed) C_mm = linearError * 1000
  else C_mm = 0

  const accClass = classifyAccuracy(C_mm, K_km)

  return {
    rawObservations: obs,
    observations: reduced,
    legs,
    coordinates: coords,
    totalPerimeter,
    sumDepartures: sumDep,
    sumLatitudes: sumLat,
    linearError,
    precisionRatio,
    accuracyOrder: accClass.order,
    C_mm,
    K_km,
    formula: accClass.formula,
    allowable: accClass.allowable,
    openingPoint: { easting: input.openingEasting, northing: input.openingNorthing, rl: input.openingRL },
    closingPoint: isClosed ? { easting: closingE!, northing: closingN! } : undefined,
    isClosed,
  }
}

export function computeBowditchAdjustment(legs: TraverseComputationLeg[], closingE: number, closingN: number): void {
  const totalDist = legs.reduce((s, l) => s + l.hd, 0)
  let sumDep = legs.reduce((s, l) => s + l.departure, 0)
  let sumLat = legs.reduce((s, l) => s + l.latitude, 0)

  const actualDep = closingE - (legs.reduce((s, l) => s + l.departure, 0))
  const actualLat = closingN - (legs.reduce((s, l) => s + l.latitude, 0))
  sumDep += actualDep
  sumLat += actualLat

  for (const leg of legs) {
    leg.depCorrection = -sumDep * (leg.hd / totalDist)
    leg.latCorrection = -sumLat * (leg.hd / totalDist)
    leg.adjDep = leg.departure + leg.depCorrection
    leg.adjLat = leg.latitude + leg.latCorrection
  }
}

export interface LevelBookRow {
  station: string
  bs?: number
  is?: number
  fs?: number
  hi?: number
  rl?: number
  rise?: number
  fall?: number
  distance?: number
  remarks?: string
}

export interface LevelBookResult {
  rows: LevelBookRow[]
  method: 'rise_and_fall' | 'height_of_collimation'
  sumBS: number
  sumFS: number
  sumRise: number
  sumFall: number
  arithmeticCheck: number
  arithmeticPass: boolean
  misclosure: number
  allowableMisclosure: number
  isAcceptable: boolean
  openingRL: number
  closingRL?: number
  distanceKm: number
  formula: string
}

export function computeLevelBook(input: {
  openingRL: number
  closingRL?: number
  distanceKm: number
  method: 'rise_and_fall' | 'height_of_collimation'
  rows: Array<{ station: string; bs?: number; is?: number; fs?: number; distance?: number; remarks?: string }>
}): LevelBookResult {
  const { openingRL, closingRL, distanceKm, method, rows } = input
  const result: LevelBookRow[] = []

  let sumBS = 0, sumFS = 0, sumRise = 0, sumFall = 0
  let hi: number | null = null
  let currentRL = openingRL
  let lastBS: number | null = null

  for (const row of rows) {
    const out: LevelBookRow = { station: row.station, distance: row.distance, remarks: row.remarks }

    if (row.bs !== undefined && row.bs !== null) {
      out.bs = row.bs
      sumBS += row.bs
      hi = currentRL + row.bs
      out.hi = hi
      out.rl = hi
      lastBS = row.bs
    }

    if (row.is !== undefined && row.is !== null && hi !== null) {
      out.is = row.is
      const rl = hi - row.is
      out.rl = rl
      if (method === 'rise_and_fall') {
        const prevRL = result.length > 0 ? (result[result.length - 1].rl ?? currentRL) : currentRL
        const diff = prevRL - rl
        if (diff >= 0) { out.rise = diff; sumRise += diff }
        else { out.fall = Math.abs(diff); sumFall += Math.abs(diff) }
      }
      currentRL = rl
    }

    if (row.fs !== undefined && row.fs !== null && hi !== null) {
      out.fs = row.fs
      sumFS += row.fs
      const rl = hi - row.fs
      out.rl = rl
      if (method === 'rise_and_fall') {
        const prevRL = result.length > 0 ? (result[result.length - 1].rl ?? currentRL) : currentRL
        const diff = prevRL - rl
        if (diff >= 0) { out.rise = diff; sumRise += diff }
        else { out.fall = Math.abs(diff); sumFall += Math.abs(diff) }
      }
      currentRL = rl
      hi = null
    }

    result.push(out)
  }

  const arithmeticCheck = (sumBS - sumFS) - (currentRL - openingRL)
  const arithmeticPass = Math.abs(arithmeticCheck) < 0.001

  const misclosure = closingRL !== undefined ? Math.abs(currentRL - closingRL) : 0
  const allowable = (10 * Math.sqrt(distanceKm)) / 1000 // Kenya RDM 1.1 Table 5.1: 10√K mm
  const isAcceptable = closingRL !== undefined ? misclosure <= allowable : true

  return {
    rows: result,
    method,
    sumBS,
    sumFS,
    sumRise,
    sumFall,
    arithmeticCheck,
    arithmeticPass,
    misclosure,
    allowableMisclosure: allowable,
    isAcceptable,
    openingRL,
    closingRL,
    distanceKm,
    formula: `Allowable = 10√K = 10√${distanceKm.toFixed(3)} = ${allowable.toFixed(3)} m (RDM 1.1 Table 5.1)`,
  }
}
