'use client';

import { useMemo } from 'react'
import { heightOfCollimation, riseAndFall } from '@/lib/engine/leveling'
import { bowditchAdjustment, forwardTraverse } from '@/lib/engine/traverse'
import { polar3DWithHeights } from '@/lib/engine/polar'
import { asBearing, asNumber } from './helpers'
import type {
  ControlRow,
  ControlStation,
  LevelRow,
  TravRow,
} from './types'

export interface FieldbookComputationsInput {
  // Leveling
  openingRL: string
  closingRL: string
  distanceKm: string
  levelMethod: 'rise_and_fall' | 'height_of_collimation'
  levelRows: LevelRow[]
  // Traverse
  travMode: 'open' | 'closed' | 'link'
  startStation: string
  startE: string
  startN: string
  closeE: string
  closeN: string
  travRows: TravRow[]
  // Control
  controlStation: ControlStation
  controlRows: ControlRow[]
}

export function useFieldbookComputations(input: FieldbookComputationsInput) {
  const {
    openingRL, closingRL, distanceKm, levelMethod, levelRows,
    travMode, startStation, startE, startN, closeE, closeN, travRows,
    controlStation, controlRows,
  } = input

  const levelingComputed = useMemo(() => {
    const open = asNumber(openingRL)
    if (open === null) return { ok: false as const, errors: ['Opening RL is required.'] }
    // Help TypeScript narrow the type: open should be number after validation
    const openingRLValue: number = open
    const close = closingRL.trim() ? asNumber(closingRL) : undefined
    if (closingRL.trim() && close === null) return { ok: false as const, errors: ['Closing RL must be a number.'] }
    // Help TypeScript narrow the type: close should be number | undefined after validation
    const closingRLValue: number | undefined = close === null ? undefined : close
    const k = asNumber(distanceKm) ?? 1

    const readings = levelRows.map((r) => ({
      station: r.station.trim(),
      bs: r.bs.trim() ? asNumber(r.bs) ?? undefined : undefined,
      is: r.is.trim() ? asNumber(r.is) ?? undefined : undefined,
      fs: r.fs.trim() ? asNumber(r.fs) ?? undefined : undefined,
    }))

    const errors: string[] = []
    const stationSet = new Set<string>()
    for (const r of readings) {
      if (!r.station) errors.push('Station names are required.')
      if (r.station) {
        const key = r.station.toUpperCase()
        if (stationSet.has(key)) errors.push(`Duplicate station: ${r.station}`)
        stationSet.add(key)
      }
    }
    if (errors.length) return { ok: false as const, errors }

    const calc =
      levelMethod === 'rise_and_fall'
        ? riseAndFall({ readings, openingRL: openingRLValue, closingRL: closingRLValue, method: 'rise_and_fall', distanceKm: k })
        : heightOfCollimation({ readings, openingRL: openingRLValue, closingRL: closingRLValue, method: 'height_of_collimation', distanceKm: k })

    return { ok: true as const, calc }
  }, [openingRL, closingRL, distanceKm, levelMethod, levelRows])

  const traverseComputed = useMemo(() => {
    const startEasting = asNumber(startE)
    const startNorthing = asNumber(startN)
    if (startEasting === null || startNorthing === null) return { ok: false as const, errors: ['Start coordinates are required.'] }
    if (!startStation.trim()) return { ok: false as const, errors: ['Start station name is required.'] }

    const errors: string[] = []
    const stations = travRows.map((r) => r.station.trim())
    const distances: number[] = []
    const bearings: number[] = []

    for (const r of travRows) {
      if (!r.station.trim()) errors.push('All traverse rows must have a station name.')
      const d = r.slopeDist.trim() ? asNumber(r.slopeDist) : null
      if (d === null || d <= 0) errors.push(`Invalid distance at ${r.station || '(blank)'}`)
      else distances.push(d)
      const b = r.bearing.trim() ? asBearing(r.bearing) : null
      if (b === null) errors.push(`Invalid bearing at ${r.station || '(blank)'}`)
      else bearings.push(b)
    }

    if (errors.length) return { ok: false as const, errors }

    if (travMode === 'open') {
      return {
        ok: true as const,
        mode: 'open' as const,
        raw: forwardTraverse({
          start: { name: startStation.trim(), easting: startEasting, northing: startNorthing },
          stations,
          distances,
          bearings,
        }),
      }
    }

    let closingPoint: { easting: number; northing: number } | undefined
    if (travMode === 'closed') closingPoint = { easting: startEasting, northing: startNorthing }
    else {
      const e = asNumber(closeE)
      const n = asNumber(closeN)
      if (e === null || n === null) return { ok: false as const, errors: ['Closing coordinates are required for Link Traverse.'] }
      closingPoint = { easting: e, northing: n }
    }

    const points = [{ name: startStation.trim(), easting: startEasting, northing: startNorthing }, ...stations.map((s) => ({ name: s, easting: 0, northing: 0 }))]
    const adjusted = bowditchAdjustment({ points, distances, bearings, closingPoint })
    return { ok: true as const, mode: travMode, adjusted }
  }, [travMode, startStation, startE, startN, closeE, closeN, travRows])

  const controlComputed = useMemo(() => {
    const e0 = asNumber(controlStation.e)
    const n0 = asNumber(controlStation.n)
    const z0 = asNumber(controlStation.z)
    if (e0 === null || n0 === null || z0 === null) return { ok: false as const, errors: ['Control station coordinates are required.'] }

    const errors: string[] = []
    const rows = controlRows.map((r) => {
      const b = asBearing(r.bearing)
      const v = asNumber(r.verticalAngle)
      const s = asNumber(r.slopeDistance)
      const hi = asNumber(r.instrumentHeight)
      const ht = asNumber(r.targetHeight)
      if (!r.pointId.trim()) errors.push('Point ID is required.')
      if (b === null) errors.push(`Invalid bearing at ${r.pointId || '(blank)'}`)
      if (v === null) errors.push(`Invalid vertical angle at ${r.pointId || '(blank)'}`)
      if (s === null || s <= 0) errors.push(`Invalid slope distance at ${r.pointId || '(blank)'}`)
      if (hi === null || hi < 0) errors.push(`Invalid instrument height at ${r.pointId || '(blank)'}`)
      if (ht === null || ht < 0) errors.push(`Invalid target height at ${r.pointId || '(blank)'}`)

      const computed =
        b !== null && v !== null && s !== null && hi !== null && ht !== null
          ? polar3DWithHeights({ station: { easting: e0, northing: n0, elevation: z0 }, bearing: b, verticalAngle: v, slopeDistance: s, instrumentHeight: hi, targetHeight: ht })
          : null
      return { ...r, computed, bearingNum: b }
    })
    if (errors.length) return { ok: false as const, errors }
    return { ok: true as const, rows }
  }, [controlRows, controlStation])

  return { levelingComputed, traverseComputed, controlComputed }
}

export type FieldbookComputations = ReturnType<typeof useFieldbookComputations>
