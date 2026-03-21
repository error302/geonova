'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
// papaparse loaded dynamically on CSV export
// jsPDF loaded dynamically on PDF generation

import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { heightOfCollimation, riseAndFall } from '@/lib/engine/leveling'
import { bowditchAdjustment, forwardTraverse } from '@/lib/engine/traverse'
import { bearingToString, normalizeBearing, parseDMSString } from '@/lib/engine/angles'
import { applyTideCorrection } from '@/lib/engine/hydrographic'
import { polar3DWithHeights } from '@/lib/engine/polar'
import { isOnline, queueOperation, setupOnlineListener, syncPendingOperations } from '@/lib/offline/syncQueue'
import { getOfflineFieldbooks, saveFieldbookOffline } from '@/lib/offline/fieldbooks'
import { LevelingBook } from '@/components/fieldbook/LevelingBook'
import { TraverseBook } from '@/components/fieldbook/TraverseBook'
import { ControlBook } from '@/components/fieldbook/ControlBook'
import { HydroBook } from '@/components/fieldbook/HydroBook'
import { MiningBook } from '@/components/fieldbook/MiningBook'

type FieldbookType = 'leveling' | 'traverse' | 'control' | 'hydrographic' | 'mining'

type SaveStatus = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; when: string } | { kind: 'error'; message: string }

type LevelRow = { id: string; station: string; bs: string; is: string; fs: string; remarks: string }
type TravRow = { id: string; station: string; bearing: string; distance: string; remarks: string }
type ControlRow = {
  id: string
  pointId: string
  instrumentHeight: string
  targetHeight: string
  bearing: string
  verticalAngle: string
  slopeDistance: string
  remarks: string
}
type ControlSetup = {
  id: string
  station: { name: string; e: string; n: string; z: string }
  rows: ControlRow[]
}
type HydroRow = { id: string; soundingId: string; easting: string; northing: string; depth: string; tide: string; remarks: string }
type MiningRow = { id: string; pointId: string; bearing: string; verticalAngle: string; slopeDistance: string; remarks: string }

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function asNumber(value: string): number | null {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : null
}

function asBearing(bearingText: string): number | null {
  const parsed = parseDMSString(bearingText)
  if (parsed === null) {
    const raw = asNumber(bearingText)
    return raw === null ? null : normalizeBearing(raw)
  }
  return normalizeBearing(parsed)
}

function niceNow() {
  return new Date().toISOString()
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
        active ? 'bg-amber-500/10 border-amber-500/40 text-amber-300' : 'bg-[var(--bg-secondary)]/40 border-[var(--border-color)] text-[var(--text-secondary)] hover:border-amber-500/30'
      } whitespace-nowrap`}
    >
      {children}
    </button>
  )
}

export default function DigitalFieldBookPage() {
  const { t } = useLanguage()
  const supabase = createClient()

  const [type, setType] = useState<FieldbookType>('leveling')
  const [projectId, setProjectId] = useState('')
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    const pid = new URLSearchParams(window.location.search).get('project')
    if (pid) setProjectId(pid)
  }, [])

  const [name, setName] = useState('')
  const [fieldbookId, setFieldbookId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: 'idle' })
  const [syncStatus, setSyncStatus] = useState<{ synced: number; failed: number } | null>(null)

  const [openingRL, setOpeningRL] = useState('100.0000')
  const [closingRL, setClosingRL] = useState('')
  const [distanceKm, setDistanceKm] = useState('1')
  const [levelMethod, setLevelMethod] = useState<'rise_and_fall' | 'height_of_collimation'>('rise_and_fall')
  const [levelRows, setLevelRows] = useState<LevelRow[]>([
    { id: crypto.randomUUID(), station: 'TP1', bs: '1.245', is: '', fs: '', remarks: '' },
    { id: crypto.randomUUID(), station: 'TP2', bs: '', is: '', fs: '2.335', remarks: '' },
  ])

  const [travMode, setTravMode] = useState<'open' | 'closed' | 'link'>('closed')
  const [startStation, setStartStation] = useState('A')
  const [startE, setStartE] = useState('500000.0000')
  const [startN, setStartN] = useState('0.0000')
  const [closeE, setCloseE] = useState('')
  const [closeN, setCloseN] = useState('')
  const [travRows, setTravRows] = useState<TravRow[]>([
    { id: crypto.randomUUID(), station: 'B', bearing: `045° 30' 00"`, distance: '100.000', remarks: '' },
    { id: crypto.randomUUID(), station: 'C', bearing: `120° 15' 00"`, distance: '85.000', remarks: '' },
    { id: crypto.randomUUID(), station: 'A', bearing: `200° 00' 00"`, distance: '95.000', remarks: '' },
  ])

  const initialControlSetupId = useRef<string>(crypto.randomUUID()).current
  const [controlSetups, setControlSetups] = useState<ControlSetup[]>([
    {
      id: initialControlSetupId,
      station: { name: 'STN', e: '500000.0000', n: '0.0000', z: '100.0000' },
      rows: [{ id: crypto.randomUUID(), pointId: 'P1', instrumentHeight: '1.500', targetHeight: '1.500', bearing: `025° 30' 00"`, verticalAngle: '0', slopeDistance: '20.000', remarks: '' }],
    },
  ])
  const [activeControlSetupId, setActiveControlSetupId] = useState<string>(initialControlSetupId)
  const activeControlSetup = useMemo(() => {
    return controlSetups.find((s) => s.id === activeControlSetupId) ?? controlSetups[0]
  }, [controlSetups, activeControlSetupId])

  const controlStation = activeControlSetup?.station ?? { name: 'STN', e: '500000.0000', n: '0.0000', z: '100.0000' }
  const controlRows = activeControlSetup?.rows ?? []
  const setControlStation = (next: { name: string; e: string; n: string; z: string } | ((p: { name: string; e: string; n: string; z: string }) => { name: string; e: string; n: string; z: string })) => {
    setControlSetups((prev) =>
      prev.map((s) => {
        if (s.id !== activeControlSetupId) return s
        const station = typeof next === 'function' ? (next as any)(s.station) : next
        return { ...s, station }
      })
    )
  }
  const setControlRows = (next: ControlRow[] | ((p: ControlRow[]) => ControlRow[])) => {
    setControlSetups((prev) =>
      prev.map((s) => {
        if (s.id !== activeControlSetupId) return s
        const rows = typeof next === 'function' ? (next as any)(s.rows) : next
        return { ...s, rows }
      })
    )
  }

  const [hydroRows, setHydroRows] = useState<HydroRow[]>([
    { id: crypto.randomUUID(), soundingId: 'S1', easting: '500000.0000', northing: '0.0000', depth: '4.250', tide: '-0.120', remarks: '' },
  ])

  const [miningStation, setMiningStation] = useState({ name: 'UG1', e: '500000.0000', n: '0.0000', z: '100.0000' })
  const [miningRows, setMiningRows] = useState<MiningRow[]>([
    { id: crypto.randomUUID(), pointId: 'P2', bearing: `082° 12' 00"`, verticalAngle: '-12.5', slopeDistance: '18.000', remarks: '' },
  ])

  const panelRef = useRef<HTMLDivElement>(null)
  const [savedFieldbooks, setSavedFieldbooks] = useState<Array<{ id: string; type: FieldbookType; name: string; updated_at?: string; created_at?: string; data: any }>>([])

  useEffect(() => {
    let isMounted = true
    ;(async () => {
      try {
        const session = await supabase.auth.getSession()
        if (!session.data.session?.user) return
        const { data, error } = await supabase.from('projects').select('id, name').order('created_at', { ascending: false })
        if (!error && data && isMounted) setProjects(data as any)
      } catch {}
    })()
    return () => {
      isMounted = false
    }
  }, [supabase])

  useEffect(() => {
    let isMounted = true
    ;(async () => {
      try {
        const offline = await getOfflineFieldbooks(projectId, type)
        if (isMounted) setSavedFieldbooks(offline)
      } catch {}

      if (!projectId || !isOnline()) return
      try {
        const { data, error } = await supabase
          .from('fieldbooks')
          .select('id, type, name, data, updated_at, created_at')
          .eq('project_id', projectId)
          .eq('type', type)
          .order('updated_at', { ascending: false })
        if (!error && data && isMounted) {
          setSavedFieldbooks((prev) => {
            const byId = new Map(prev.map((x) => [x.id, x]))
            for (const row of data as any[]) byId.set(row.id, row)
            return Array.from(byId.values()).sort((a, b) => String(b.updated_at ?? b.created_at ?? '').localeCompare(String(a.updated_at ?? a.created_at ?? '')))
          })
        }
      } catch {}
    })()
    return () => {
      isMounted = false
    }
  }, [projectId, type, supabase])

  useEffect(() => {
    setupOnlineListener(async () => {
      try {
        const r = await syncPendingOperations(supabase)
        setSyncStatus(r)
      } catch {}
    })
  }, [supabase])

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
      const d = r.distance.trim() ? asNumber(r.distance) : null
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

  const hydroComputed = useMemo(() => {
    const errors: string[] = []
    const rows = hydroRows.map((r) => {
      const depth = asNumber(r.depth)
      const tide = asNumber(r.tide) ?? 0
      if (depth === null) errors.push(`Invalid depth at ${r.soundingId || '(blank)'}`)
      const e = asNumber(r.easting)
      const n = asNumber(r.northing)
      if (e === null || n === null) errors.push(`Invalid coordinates at ${r.soundingId || '(blank)'}`)
      return { ...r, corrected: depth === null ? null : applyTideCorrection(depth, tide) }
    })
    if (errors.length) return { ok: false as const, errors }
    return { ok: true as const, rows }
  }, [hydroRows])

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

  const miningComputed = useMemo(() => {
    const e0 = asNumber(miningStation.e)
    const n0 = asNumber(miningStation.n)
    const z0 = asNumber(miningStation.z)
    if (e0 === null || n0 === null || z0 === null) return { ok: false as const, errors: ['Mining station coordinates are required.'] }

    const errors: string[] = []
    const rows = miningRows.map((r) => {
      const b = asBearing(r.bearing)
      const v = asNumber(r.verticalAngle)
      const s = asNumber(r.slopeDistance)
      if (!r.pointId.trim()) errors.push('Point ID is required.')
      if (b === null) errors.push(`Invalid bearing at ${r.pointId || '(blank)'}`)
      if (v === null) errors.push(`Invalid vertical angle at ${r.pointId || '(blank)'}`)
      if (s === null || s <= 0) errors.push(`Invalid slope distance at ${r.pointId || '(blank)'}`)
      const computed = b !== null && v !== null && s !== null ? polar3DWithHeights({ station: { easting: e0, northing: n0, elevation: z0 }, bearing: b, verticalAngle: v, slopeDistance: s, instrumentHeight: 0, targetHeight: 0 }) : null
      return { ...r, computed, bearingNum: b }
    })
    if (errors.length) return { ok: false as const, errors }
    return { ok: true as const, rows }
  }, [miningRows, miningStation])

  const currentComputed = type === 'leveling' ? levelingComputed : type === 'traverse' ? traverseComputed : type === 'control' ? controlComputed : type === 'hydrographic' ? hydroComputed : miningComputed

  function currentDataPayload() {
    if (type === 'leveling') return { method: levelMethod, openingRL, closingRL, distanceKm, rows: levelRows }
    if (type === 'traverse') return { mode: travMode, startStation, startE, startN, closeE, closeN, rows: travRows }
    if (type === 'control') return { activeSetupId: activeControlSetupId, setups: controlSetups }
    if (type === 'hydrographic') return { rows: hydroRows }
    return { station: miningStation, rows: miningRows }
  }

  function resetForType(next: FieldbookType) {
    setType(next)
    setFieldbookId(null)
    setName('')
    setSaveStatus({ kind: 'idle' })
    setSyncStatus(null)
  }

  function loadFieldbook(entry: any) {
    setFieldbookId(entry.id)
    setName(entry.name || '')
    const data = entry.data || {}

    if (entry.type === 'leveling') {
      setLevelMethod(data.method || 'rise_and_fall')
      setOpeningRL(String(data.openingRL ?? openingRL))
      setClosingRL(data.closingRL !== undefined && data.closingRL !== null ? String(data.closingRL) : '')
      setDistanceKm(String(data.distanceKm ?? distanceKm))
      setLevelRows((data.rows ?? levelRows).map((r: any) => ({ ...r, id: r.id || crypto.randomUUID() })))
    } else if (entry.type === 'traverse') {
      setTravMode(data.mode || 'closed')
      setStartStation(String(data.startStation ?? startStation))
      setStartE(String(data.startE ?? startE))
      setStartN(String(data.startN ?? startN))
      setCloseE(String(data.closeE ?? ''))
      setCloseN(String(data.closeN ?? ''))
      setTravRows((data.rows ?? travRows).map((r: any) => ({ ...r, id: r.id || crypto.randomUUID() })))
    } else if (entry.type === 'control') {
      const setupsRaw = Array.isArray(data.setups) ? data.setups : null
      if (setupsRaw && setupsRaw.length > 0) {
        const setups: ControlSetup[] = setupsRaw.map((s: any) => ({
          id: String(s.id || crypto.randomUUID()),
          station: {
            name: String(s.station?.name ?? 'STN'),
            e: String(s.station?.e ?? '500000.0000'),
            n: String(s.station?.n ?? '0.0000'),
            z: String(s.station?.z ?? '100.0000'),
          },
          rows: (s.rows ?? []).map((r: any) => ({ ...r, id: r.id || crypto.randomUUID() })),
        }))
        setControlSetups(setups)
        const preferred = String(data.activeSetupId ?? setups[0].id)
        setActiveControlSetupId(setups.some((x) => x.id === preferred) ? preferred : setups[0].id)
      } else {
        // Backward compatibility: older payloads stored a single station + rows.
        const id = crypto.randomUUID()
        setControlSetups([
          {
            id,
            station: {
              name: String(data.station?.name ?? 'STN'),
              e: String(data.station?.e ?? '500000.0000'),
              n: String(data.station?.n ?? '0.0000'),
              z: String(data.station?.z ?? '100.0000'),
            },
            rows: (data.rows ?? []).map((r: any) => ({ ...r, id: r.id || crypto.randomUUID() })),
          },
        ])
        setActiveControlSetupId(id)
      }
    } else if (entry.type === 'hydrographic') {
      setHydroRows((data.rows ?? hydroRows).map((r: any) => ({ ...r, id: r.id || crypto.randomUUID() })))
    } else if (entry.type === 'mining') {
      setMiningStation({
        name: String(data.station?.name ?? miningStation.name),
        e: String(data.station?.e ?? miningStation.e),
        n: String(data.station?.n ?? miningStation.n),
        z: String(data.station?.z ?? miningStation.z),
      })
      setMiningRows((data.rows ?? miningRows).map((r: any) => ({ ...r, id: r.id || crypto.randomUUID() })))
    }

    panelRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSyncNow() {
    setSyncStatus(null)
    try {
      const r = await syncPendingOperations(supabase)
      setSyncStatus(r)
    } catch {
      setSyncStatus({ synced: 0, failed: 1 })
    }
  }

  async function handleSave() {
    if (!projectId) {
      setSaveStatus({ kind: 'error', message: 'Select a project to save.' })
      return
    }

    setSaveStatus({ kind: 'saving' })
    const now = niceNow()

    const session = await supabase.auth.getSession()
    const userId = session.data.session?.user?.id
    if (!userId) {
      setSaveStatus({ kind: 'error', message: 'You must be signed in to save.' })
      return
    }

    const id = fieldbookId ?? crypto.randomUUID()
    const record = {
      id,
      project_id: projectId,
      user_id: userId,
      type,
      name: name.trim() || `${type.toUpperCase()} Field Book`,
      data: currentDataPayload(),
      updated_at: now,
    }

    try {
      await saveFieldbookOffline(record)

      if (isOnline()) {
        const { error } = await supabase.from('fieldbooks').upsert({ ...record, updated_at: undefined }).select('id')
        if (error) throw error
      } else {
        await queueOperation({
          type: fieldbookId ? 'UPDATE' : 'INSERT',
          table: 'fieldbooks',
          data: { ...record, updated_at: undefined },
          timestamp: now,
          projectId,
          priority: 'normal'
        })
      }

      setFieldbookId(id)
      setSaveStatus({ kind: 'saved', when: now })
    } catch (e: any) {
      setSaveStatus({ kind: 'error', message: e?.message || 'Save failed.' })
    }
  }

  function exportJSON() {
    const payload = { id: fieldbookId, type, name: name.trim() || `${type.toUpperCase()} Field Book`, projectId, createdAt: new Date().toISOString(), data: currentDataPayload() }
    downloadBlob(`geonova-fieldbook-${type}.json`, new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
  }

   async function exportCSV() {
     let rows: any[] = []
     if (type === 'leveling') {
       rows = levelRows.map((r) => ({ Station: r.station, BS: r.bs, IS: r.is, FS: r.fs, Remarks: r.remarks }))
     } else if (type === 'traverse') {
       rows = travRows.map((r) => ({ Station: r.station, Bearing: r.bearing, Distance: r.distance, Remarks: r.remarks }))
     } else if (type === 'control') {
       rows = controlSetups.flatMap((setup) =>
         setup.rows.map((r) => ({
           Station: setup.station.name,
           PointID: r.pointId,
           IH: r.instrumentHeight,
           TH: r.targetHeight,
           Bearing: r.bearing,
           VAngle: r.verticalAngle,
           SlopeDist: r.slopeDistance,
           Remarks: r.remarks,
         }))
       )
     } else if (type === 'hydrographic') {
       rows = hydroRows.map((r) => ({ SoundingID: r.soundingId, Easting: r.easting, Northing: r.northing, Depth: r.depth, Tide: r.tide, Remarks: r.remarks }))
     } else {
       rows = miningRows.map((r) => ({ PointID: r.pointId, Bearing: r.bearing, VAngle: r.verticalAngle, SlopeDist: r.slopeDistance, Remarks: r.remarks }))
     }

     const Papa = (await import('papaparse')).default
     downloadBlob(`geonova-fieldbook-${type}.csv`, new Blob([Papa.unparse(rows)], { type: 'text/csv' }))
   }

  async function exportPDF() {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const title = name.trim() || `${type.toUpperCase()} Field Book`
    doc.setFontSize(14)
    doc.text('METARDU — Digital Field Book', 14, 14)
    doc.setFontSize(11)
    doc.text(title, 14, 22)
    doc.setFontSize(9)
    doc.text(`Type: ${type}   Project: ${projectId || '—'}   Generated: ${new Date().toLocaleString()}`, 14, 28)

    if (type === 'leveling') {
      autoTable(doc, { startY: 32, head: [['Station', 'BS', 'IS', 'FS', 'Rise', 'Fall', 'RL', 'Remarks']], body: levelingComputed.ok ? levelingComputed.calc.readings.filter((r) => r.station !== 'BM').map((r) => [r.station, r.bs ?? '', r.is ?? '', r.fs ?? '', r.rise ?? '', r.fall ?? '', r.reducedLevel ?? '', '']) : [], styles: { fontSize: 8 } })
    } else if (type === 'traverse') {
      autoTable(doc, {
        startY: 32,
        head: [['Station', 'Bearing', 'Distance', 'Lat (ΔN)', 'Dep (ΔE)', 'Easting', 'Northing', 'Remarks']],
        body: (() => {
          if (!traverseComputed.ok) return []
          if (traverseComputed.mode === 'open') return traverseComputed.raw.legs.map((l) => [l.to, l.bearingDMS, l.distance, l.deltaN, l.deltaE, l.easting, l.northing, ''])
          return traverseComputed.adjusted.legs.map((l) => [l.to, l.bearingDMS, l.distance, l.adjDeltaN, l.adjDeltaE, l.adjEasting, l.adjNorthing, ''])
        })(),
        styles: { fontSize: 8 },
      })
    } else if (type === 'hydrographic') {
      autoTable(doc, { startY: 32, head: [['Sounding', 'Easting', 'Northing', 'Depth', 'Tide', 'Corrected', 'Remarks']], body: hydroComputed.ok ? hydroComputed.rows.map((r: any) => [r.soundingId, r.easting, r.northing, r.depth, r.tide, r.corrected ?? '', r.remarks]) : [], styles: { fontSize: 8 } })
    } else if (type === 'control') {
      let y = 32
      for (const setup of controlSetups) {
        const e0 = asNumber(setup.station.e)
        const n0 = asNumber(setup.station.n)
        const z0 = asNumber(setup.station.z)

        doc.setFontSize(10)
        doc.text(
          `Station: ${setup.station.name}   E: ${setup.station.e}   N: ${setup.station.n}   RL: ${setup.station.z}`,
          14,
          y
        )
        y += 4

        const body = (() => {
          if (e0 === null || n0 === null || z0 === null) return []
          return setup.rows.map((r) => {
            const b = asBearing(r.bearing)
            const v = asNumber(r.verticalAngle)
            const s = asNumber(r.slopeDistance)
            const hi = asNumber(r.instrumentHeight)
            const ht = asNumber(r.targetHeight)
            const computed =
              b !== null && v !== null && s !== null && hi !== null && ht !== null
                ? polar3DWithHeights({
                    station: { easting: e0, northing: n0, elevation: z0 },
                    bearing: b,
                    verticalAngle: v,
                    slopeDistance: s,
                    instrumentHeight: hi,
                    targetHeight: ht,
                  })
                : null
            const bearingOut = b !== null ? bearingToString(b) : r.bearing
            return [
              r.pointId,
              r.instrumentHeight,
              r.targetHeight,
              bearingOut,
              r.verticalAngle,
              r.slopeDistance,
              computed ? computed.easting : '',
              computed ? computed.northing : '',
              computed ? computed.elevation : '',
              r.remarks,
            ]
          })
        })()

        autoTable(doc, {
          startY: y,
          head: [['Point', 'IH', 'TH', 'Bearing', 'V.Ang', 'Slope', 'Easting', 'Northing', 'RL', 'Remarks']],
          body,
          styles: { fontSize: 8 },
        })

        const lastY = (doc as any).lastAutoTable?.finalY
        y = (typeof lastY === 'number' ? lastY : y) + 8
        if (y > 270) {
          doc.addPage()
          y = 20
        }
      }
    } else {
      autoTable(doc, { startY: 32, head: [['Point', 'Bearing', 'V.Ang', 'Slope', 'Easting', 'Northing', 'RL', 'Remarks']], body: miningComputed.ok ? miningComputed.rows.map((r: any) => [r.pointId, r.bearingNum !== null && r.bearingNum !== undefined ? bearingToString(r.bearingNum) : r.bearing, r.verticalAngle, r.slopeDistance, r.computed ? r.computed.easting : '', r.computed ? r.computed.northing : '', r.computed ? r.computed.elevation : '', r.remarks]) : [], styles: { fontSize: 8 } })
    }

    downloadBlob(`geonova-fieldbook-${type}.pdf`, doc.output('blob'))
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">{t('field.fieldBook')}</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{t('field.fieldBookSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSyncNow} className="btn btn-secondary">
            {t('field.syncOffline')}
          </button>
          <Link className="btn btn-secondary" href="/fieldbook/ai">
            {t('field.fieldBookAI')}
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 space-y-4" ref={panelRef}>
          <div className="card p-4 space-y-3">
            <div>
              <label className="label">{t('projects.project')}</label>
              <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">{t('projects.selectProject')}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">{t('field.fieldBookName')}</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('field.fieldBookNamePlaceholder')} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleSave} className="btn btn-primary">
                {saveStatus.kind === 'saving' ? t('common.saving') : t('common.save')}
              </button>
              <button
                onClick={() => {
                  setFieldbookId(null)
                  setName('')
                  setSaveStatus({ kind: 'idle' })
                }}
                className="btn btn-secondary"
              >
                {t('common.new')}
              </button>
            </div>

            {saveStatus.kind === 'saved' && <p className="text-xs text-green-400">Saved: {new Date(saveStatus.when).toLocaleString()}</p>}
            {saveStatus.kind === 'error' && <p className="text-xs text-red-400">{saveStatus.message}</p>}
            {syncStatus && (
              <p className={`text-xs ${syncStatus.failed ? 'text-yellow-400' : 'text-green-400'}`}>
                Sync: {syncStatus.synced} synced, {syncStatus.failed} failed
              </p>
            )}

            <div className="pt-2 border-t border-[var(--border-color)] flex gap-2">
              <button onClick={exportPDF} className="btn btn-secondary flex-1">
                {t('common.exportPdf')}
              </button>
              <button onClick={exportCSV} className="btn btn-secondary flex-1">
                {t('common.exportCsv')}
              </button>
              <button onClick={exportJSON} className="btn btn-secondary flex-1">
                {t('common.exportJson')}
              </button>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="label">{t('field.savedFieldbooks')}</span>
              <span className="text-xs text-[var(--text-muted)]">{isOnline() ? t('common.online') : t('common.offline')}</span>
            </div>
            <div className="space-y-2 max-h-[45vh] overflow-auto pr-1">
              {savedFieldbooks.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">{t('field.noSavedFieldbooks')}</p>
              ) : (
                savedFieldbooks.map((fb) => (
                  <button
                    key={fb.id}
                    onClick={() => loadFieldbook(fb)}
                    className={`w-full text-left px-3 py-2 rounded border ${
                      fieldbookId === fb.id ? 'border-amber-500/50 bg-amber-500/10' : 'border-[var(--border-color)] bg-[var(--bg-primary)]/30 hover:border-amber-500/20'
                    }`}
                  >
                    <div className="text-sm text-[var(--text-primary)] truncate">{fb.name || fb.id}</div>
                     <div className="text-xs text-[var(--text-muted)]">{fb.updated_at ?? fb.created_at ? new Date(fb.updated_at ?? fb.created_at as string | number | Date).toLocaleString() : ''}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-9 space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <TabButton active={type === 'leveling'} onClick={() => resetForType('leveling')}>
              {t('leveling.title')}
            </TabButton>
            <TabButton active={type === 'traverse'} onClick={() => resetForType('traverse')}>
              {t('traverse.title')}
            </TabButton>
            <TabButton active={type === 'control'} onClick={() => resetForType('control')}>
              {t('field.controlNotes')}
            </TabButton>
            <TabButton active={type === 'hydrographic'} onClick={() => resetForType('hydrographic')}>
              {t('field.hydroNotes')}
            </TabButton>
            <TabButton active={type === 'mining'} onClick={() => resetForType('mining')}>
              {t('field.miningNotes')}
            </TabButton>
          </div>

          {!currentComputed.ok && (
            <div className="p-3 bg-red-900/15 border border-red-700 rounded text-sm text-red-300">
              {currentComputed.errors.map((e: string, i: number) => (
                <div key={i}>{e}</div>
              ))}
            </div>
          )}

          {type === 'leveling' && (
            <LevelingBook
              t={t}
              openingRL={openingRL}
              closingRL={closingRL}
              distanceKm={distanceKm}
              levelMethod={levelMethod}
              setOpeningRL={setOpeningRL}
              setClosingRL={setClosingRL}
              setDistanceKm={setDistanceKm}
              setLevelMethod={setLevelMethod}
              levelRows={levelRows as any}
              setLevelRows={setLevelRows as any}
              computed={levelingComputed as any}
            />
          )}

          {type === 'traverse' && (
            <TraverseBook
              t={t}
              travMode={travMode}
              setTravMode={setTravMode}
              startStation={startStation}
              startE={startE}
              startN={startN}
              closeE={closeE}
              closeN={closeN}
              setStartStation={setStartStation}
              setStartE={setStartE}
              setStartN={setStartN}
              setCloseE={setCloseE}
              setCloseN={setCloseN}
              travRows={travRows as any}
              setTravRows={setTravRows as any}
              computed={traverseComputed as any}
            />
          )}

          {type === 'control' && (
            <div className="space-y-3">
              <div className="card p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {controlSetups.map((s, idx) => {
                      const label = s.station.name?.trim() ? s.station.name.trim() : `Setup ${idx + 1}`
                      const active = s.id === activeControlSetupId
                      return (
                        <button
                          key={s.id}
                          onClick={() => setActiveControlSetupId(s.id)}
                          className={`px-3 py-2 rounded-lg text-sm border whitespace-nowrap transition-colors ${
                            active ? 'bg-amber-500/10 border-amber-500/40 text-amber-300' : 'bg-[var(--bg-secondary)]/40 border-[var(--border-color)] text-[var(--text-secondary)] hover:border-amber-500/30'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}

                    <button
                      className="px-3 py-2 rounded-lg text-sm border bg-[var(--bg-secondary)]/40 border-[var(--border-color)] text-[var(--text-secondary)] hover:border-amber-500/30 whitespace-nowrap"
                      onClick={() => {
                        const id = crypto.randomUUID()
                        const suffix = controlSetups.length + 1
                        const template = controlStation
                        setControlSetups((prev) => [
                          ...prev,
                          {
                            id,
                            station: { ...template, name: template.name ? `${template.name}_${suffix}` : `STN${suffix}` },
                            rows: [
                              {
                                id: crypto.randomUUID(),
                                pointId: `P1`,
                                instrumentHeight: '1.500',
                                targetHeight: '1.500',
                                bearing: '',
                                verticalAngle: '0',
                                slopeDistance: '',
                                remarks: '',
                              },
                            ],
                          },
                        ])
                        setActiveControlSetupId(id)
                      }}
                    >
                      + Setup
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        const src = controlSetups.find((s) => s.id === activeControlSetupId)
                        if (!src) return
                        const id = crypto.randomUUID()
                        const suffix = controlSetups.length + 1
                        setControlSetups((prev) => [
                          ...prev,
                          {
                            id,
                            station: { ...src.station, name: src.station.name ? `${src.station.name}_copy${suffix}` : `STN_copy${suffix}` },
                            rows: src.rows.map((r) => ({ ...r, id: crypto.randomUUID() })),
                          },
                        ])
                        setActiveControlSetupId(id)
                      }}
                    >
                      Duplicate
                    </button>
                    <button
                      className="btn btn-secondary"
                      disabled={controlSetups.length <= 1}
                      onClick={() => {
                        if (controlSetups.length <= 1) return
                        if (!confirm('Remove this setup?')) return
                        const next = controlSetups.filter((s) => s.id !== activeControlSetupId)
                        const nextActive = next[0]?.id ?? controlSetups[0]?.id
                        setControlSetups(next.length ? next : controlSetups)
                        if (nextActive) setActiveControlSetupId(nextActive)
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="text-xs text-[var(--text-muted)]">
                  A “setup” is one instrument station (HI) with multiple shots/points in the table below. Use <span className="text-[var(--text-primary)] font-semibold">Add Row</span> to record more than one control/detail point.
                </div>
              </div>

              <ControlBook
                t={t}
                station={controlStation}
                setStation={setControlStation as any}
                rows={controlRows as any}
                setRows={setControlRows as any}
                computed={controlComputed as any}
              />
            </div>
          )}
          {type === 'hydrographic' && <HydroBook t={t} rows={hydroRows as any} setRows={setHydroRows as any} computed={hydroComputed as any} />}
          {type === 'mining' && (
            <MiningBook t={t} station={miningStation} setStation={setMiningStation as any} rows={miningRows as any} setRows={setMiningRows as any} computed={miningComputed as any} />
          )}
        </div>
      </div>
    </div>
  )
 }
