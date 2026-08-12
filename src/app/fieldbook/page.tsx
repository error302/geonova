'use client';

import { useEffect, useMemo, useRef, useState } from 'react'

// AUDIT FIX (H-003, 2026-07-27): useMemo to prevent infinite loop.
// Previously `const dbClient = createClient()` ran on every render, creating
// a new client object each time. useEffects with `[dbClient]` deps (lines
// 374, 390, 420) then re-ran on every render, triggering API calls in an
// infinite loop. (Confirmed on /fieldbook causing 100s of /api/db and
// /api/auth/session requests.)
// papaparse loaded dynamically on CSV export
// jsPDF loaded dynamically on PDF generation

import { createClient } from '@/lib/api-client/client'
import ErrorBoundary from '@/components/ErrorBoundary'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { heightOfCollimation, riseAndFall } from '@/lib/engine/leveling'
import { logger } from '@/lib/logger'
import { bowditchAdjustment, forwardTraverse } from '@/lib/engine/traverse'
import { TRAVERSE_PRECISION_STANDARDS } from '@/lib/engine/traverse'
import { bearingToString, normalizeBearing, parseFieldAngle } from '@/lib/engine/angles'
import { polar3DWithHeights } from '@/lib/engine/polar'
import { isOnline, queueOperation, setupOnlineListener, syncPendingOperations } from '@/lib/offline/syncQueue'
import { getOfflineFieldbooks, saveFieldbookOffline } from '@/lib/offline/fieldbooks'
import { LevelingBook } from '@/components/fieldbook/LevelingBook'
import { TraverseBook } from '@/components/fieldbook/TraverseBook'
import { ControlBook } from '@/components/fieldbook/ControlBook'
import { MobileFieldbookShell } from '@/components/fieldbook/MobileFieldbookShell'
import { type CapturedMeasurement } from '@/components/fieldbook/MobileMeasurementCapture'
import { GNSSRoverConnection } from '@/components/survey/GNSSRoverConnection'
import { NTRIPClientPanel } from '@/components/survey/NTRIPClientPanel'
import { GNSSQualityReport } from '@/components/survey/GNSSQualityReport'
import { FieldbookAuditDrawer } from '@/components/fieldbook/FieldbookAuditDrawer'
import type { CapturedBeaconPhoto } from '@/components/fieldbook/BeaconPhotoCapture'
import { CheckCircle2 } from 'lucide-react'
import { RealTimeQCPanel } from '@/components/survey/RealTimeQCPanel'
import { InstrumentStreamBar, type StreamedReading, type SurveyType as StreamSurveyType } from '@/components/fieldbook/InstrumentStreamBar'
import { InstantClosureFeedback } from '@/components/fieldbook/InstantClosureFeedback'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useNotifications } from '@/hooks/useNotifications'
import { crossCheckArea, crossCheckClosure } from '@/lib/engine/calculationCrossCheck'

/** useIsMobile — SSR-safe media-query hook (lg breakpoint = 1024px). */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(max-width: 1023px)')
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches)
    onChange(mq)
    if (mq.addEventListener) mq.addEventListener('change', onChange as (e: MediaQueryListEvent) => void)
    else mq.addListener(onChange as (e: MediaQueryListEvent) => void)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange as (e: MediaQueryListEvent) => void)
      else mq.removeListener(onChange as (e: MediaQueryListEvent) => void)
    }
  }, [])
  return isMobile
}


type FieldbookType = 'leveling' | 'traverse' | 'control'

type SaveStatus = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; when: string } | { kind: 'error'; message: string }

type SavedFieldbook = {
  id: string
  type: FieldbookType
  name: string
  updated_at?: string
  created_at?: string
  data: Record<string, unknown>
}

type LevelRow = { id: string; station: string; bs: string; is: string; fs: string; remarks: string }
type TravRow = {
  id: string
  station: string
  bearing: string
  hclDeg: string; hclMin: string; hclSec: string
  hcrDeg: string; hcrMin: string; hcrSec: string
  slopeDist: string
  vaDeg: string; vaMin: string; vaSec: string
  ih: string; th: string
  remarks: string
}
import type { ControlSetup, Row } from '@/components/fieldbook/MobileFieldbookShell'

type ControlRow = Row

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
  const parsed = parseFieldAngle(bearingText)
  return parsed === null ? null : normalizeBearing(parsed)
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

// ─── Bowditch Adjustment Summary ────────────────────────────────────
// Displays precision stats and statutory compliance for closed/link traverses.
// Uses the TraverseResult from the existing bowditchAdjustment() engine.

function BowditchSummary({ adjusted, threshold = TRAVERSE_PRECISION_STANDARDS.cadastral, surveyClassLabel = 'cadastral' }: {
  adjusted: import('@/lib/engine/types').TraverseResult
  threshold?: number
  surveyClassLabel?: string
}) {
  const precisionRatio = adjusted.precisionRatio
  const linearError = adjusted.linearError
  const totalDistance = adjusted.totalDistance
  const grade = adjusted.precisionGrade

  const isAcceptable = precisionRatio >= threshold
  // AUDIT FIX (M-007, 2026-07-27): handle zero/invalid precision — previously
  // showed "1:0" when no observations were added. Show placeholder instead.
  const ratioDisplay = precisionRatio > 0 && Number.isFinite(precisionRatio)
    ? `1:${precisionRatio.toLocaleString()}`
    : '—'
  const thresholdDisplay = `1:${threshold.toLocaleString()}`

  const gradeConfig: Record<string, { color: string; bg: string; label: string }> = {
    excellent: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', label: 'Excellent' },
    good: { color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30', label: 'Good' },
    acceptable: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', label: 'Acceptable' },
    poor: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', label: 'Poor' },
  }
  const cfg = gradeConfig[grade] || gradeConfig.poor

  return (
    <div className="card p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 7h6M9 12h6M9 17h6M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" />
          </svg>
          <span className="text-sm font-semibold text-[var(--text-primary)]">Bowditch Adjustment Summary</span>
        </div>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>
          {cfg.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="p-2.5 rounded-lg bg-[var(--bg-tertiary)]/50">
          <span className="text-[9px] text-gray-500 uppercase tracking-wider">Precision Ratio</span>
          <div className={`text-sm font-mono font-semibold mt-0.5 ${isAcceptable ? 'text-emerald-400' : 'text-red-400'}`}>
            {ratioDisplay}
          </div>
          <div className="text-[9px] text-gray-600 mt-0.5">
            Threshold: {thresholdDisplay}
          </div>
        </div>
        <div className="p-2.5 rounded-lg bg-[var(--bg-tertiary)]/50">
          <span className="text-[9px] text-gray-500 uppercase tracking-wider">Linear Error</span>
          <div className="text-sm font-mono text-gray-300 mt-0.5">
            {linearError.toFixed(4)} m
          </div>
          <div className="text-[9px] text-gray-600 mt-0.5">
            dE: {adjusted.closingErrorE.toFixed(4)} | dN: {adjusted.closingErrorN.toFixed(4)}
          </div>
        </div>
        <div className="p-2.5 rounded-lg bg-[var(--bg-tertiary)]/50">
          <span className="text-[9px] text-gray-500 uppercase tracking-wider">Total Distance</span>
          <div className="text-sm font-mono text-gray-300 mt-0.5">
            {totalDistance.toFixed(3)} m
          </div>
          <div className="text-[9px] text-gray-600 mt-0.5">
            {adjusted.legs.length} legs
          </div>
        </div>
      </div>

      {!isAcceptable && (
        <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-red-500/5 border border-red-500/20">
          <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-[11px] text-red-400/80">
            Precision is below the statutory threshold ({thresholdDisplay} for {surveyClassLabel} surveys per Survey Act Cap 299 / Survey Regulations 1994).
            Check observations for errors before submitting.
          </p>
        </div>
      )}

      {isAcceptable && (
        <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
          <svg className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-[11px] text-emerald-400/80">
            Within statutory tolerance. Bowditch adjustment applied — coordinates distributed across the traverse.
          </p>
        </div>
      )}
    </div>
  )
}

export default function DigitalFieldBookPage() {
  const { t } = useLanguage()
  const dbClient = useMemo(() => createClient(), [])
  const isMobile = useIsMobile()

  // ── AUDIT FIX (2026-07-05): Wire notifications ──
  const { notify } = useNotifications()

  const [online, setOnline] = useState(true)
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false)

  const [type, setType] = useState<FieldbookType>('leveling')
  const [projectId, setProjectId] = useState('')
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    const pid = new URLSearchParams(window.location.search).get('project')
    if (pid) setProjectId(pid)
  }, [])

  useEffect(() => {
    setOnline(isOnline())
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    const cleanup = setupOnlineListener(handleOnline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      cleanup()
    }
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
    { id: crypto.randomUUID(), station: '', bs: '', is: '', fs: '', remarks: '' },
  ])

  const [travMode, setTravMode] = useState<'open' | 'closed' | 'link'>('closed')
  const [startStation, setStartStation] = useState('A')
  const [startE, setStartE] = useState('')
  const [startN, setStartN] = useState('')
  const [closeE, setCloseE] = useState('')
  const [closeN, setCloseN] = useState('')
  const [travRows, setTravRows] = useState<TravRow[]>([
    { id: crypto.randomUUID(), station: '', bearing: '', hclDeg: '', hclMin: '', hclSec: '', hcrDeg: '', hcrMin: '', hcrSec: '', slopeDist: '', vaDeg: '', vaMin: '', vaSec: '', ih: '1.5', th: '1.5', remarks: '' },
  ])

  const initialControlSetupId = useRef<string>(crypto.randomUUID()).current
  const [controlSetups, setControlSetups] = useState<ControlSetup[]>([
    {
      id: initialControlSetupId,
      station: { name: '', e: '', n: '', z: '' },
      rows: [{ id: crypto.randomUUID(), pointId: '', instrumentHeight: '', targetHeight: '', bearing: '', verticalAngle: '', slopeDistance: '', remarks: '' }],
    },
  ])
  const [activeControlSetupId, setActiveControlSetupId] = useState<string>(initialControlSetupId)

  const [planGenerating, setPlanGenerating] = useState(false)
  const [planStep, setPlanStep] = useState('')
  const [planResult, setPlanResult] = useState<{ success: boolean; downloadUrl?: string; error?: string } | null>(null)

  const handleDevelopFullPlan = async () => {
    if (!projectId) {
      alert('Please select a project first')
      return
    }
    
    setPlanGenerating(true)
    setPlanStep('Initializing...')
    setPlanResult(null)
    
    try {
      setPlanStep('Loading project data...')
      const response = await fetch('/api/plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          options: {
            adjustmentMethod: 'bowditch',
            includeVolumes: true,
            includeSettingOut: true,
          }
        })
      })
      
      const data = (await response.json()) as { error?: string; downloadUrl?: string }
      
      if (!response.ok) {
        throw new Error(data.error || 'Generation failed')
      }
      
      setPlanStep('Packaging results...')
      setPlanResult({ success: true, downloadUrl: data.downloadUrl })
    } catch (err: unknown) {
      setPlanResult({ success: false, error: err instanceof Error ? (err as Error).message : String(err) })
    } finally {
      setPlanGenerating(false)
      setPlanStep('')
    }
  }

  const activeControlSetup = useMemo(() => {
    return controlSetups.find((s) => s.id === activeControlSetupId) ?? controlSetups[0]
  }, [controlSetups, activeControlSetupId])

  const controlStation = useMemo(() => 
    activeControlSetup?.station ?? { name: '', e: '', n: '', z: '' }
  , [activeControlSetup])

  const controlRows = useMemo(() => 
    activeControlSetup?.rows ?? []
  , [activeControlSetup])
  const setControlStation = (next: { name: string; e: string; n: string; z: string } | ((p: { name: string; e: string; n: string; z: string }) => { name: string; e: string; n: string; z: string })) => {
    setControlSetups((prev) =>
      prev.map((s) => {
        if (s.id !== activeControlSetupId) return s
        const station = typeof next === 'function' ? next(s.station) : next
        return { ...s, station }
      })
    )
  }
  const setControlRows = (next: ControlRow[] | ((p: ControlRow[]) => ControlRow[])) => {
    setControlSetups((prev) =>
      prev.map((s) => {
        if (s.id !== activeControlSetupId) return s
        const rows = typeof next === 'function' ? next(s.rows) : next
        return { ...s, rows }
      })
    )
  }

  const panelRef = useRef<HTMLDivElement>(null)
  const [savedFieldbooks, setSavedFieldbooks] = useState<SavedFieldbook[]>([])

  useEffect(() => {
    let isMounted = true
    ;(async () => {
      try {
        const session = await dbClient.auth.getSession()
        const sessUser = (session.data.session as Record<string, unknown> | null)?.user
        if (!sessUser) return
        const { data, error } = (await dbClient.from('projects').select('id, name').order('created_at', { ascending: false })) as { data: { id: string; name: string }[] | null; error: unknown }
        if (!error && data && isMounted) setProjects(data)
      } catch {}
    })()
    return () => {
      isMounted = false
    }
  }, [dbClient])

  useEffect(() => {
    let isMounted = true
    ;(async () => {
      try {
        const offline = await getOfflineFieldbooks(projectId, type)
        if (isMounted) setSavedFieldbooks(offline)
      } catch {}

      if (!projectId || !isOnline()) return
      try {
        const { data, error } = (await dbClient
          .from('fieldbooks')
          .select('id, type, name, data, updated_at, created_at')
          .eq('project_id', projectId)
          .eq('type', type)
          .order('updated_at', { ascending: false })) as { data: SavedFieldbook[] | null; error: unknown }
        if (!error && data && isMounted) {
          setSavedFieldbooks((prev) => {
            const byId = new Map(prev.map((x) => [x.id, x]))
            for (const row of data as unknown as SavedFieldbook[]) byId.set(row.id, row)
            return Array.from(byId.values()).sort((a, b) => String(b.updated_at ?? b.created_at ?? '').localeCompare(String(a.updated_at ?? a.created_at ?? '')))
          })
        }
      } catch {}
    })()
    return () => {
      isMounted = false
    }
  }, [projectId, type, dbClient])

  useEffect(() => {
    setupOnlineListener(async () => {
      try {
        const r = await syncPendingOperations(dbClient)
        setSyncStatus(r)
      } catch {}
    })
  }, [dbClient])

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
      const v = parseFieldAngle(r.verticalAngle)
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

  const currentComputed = type === 'leveling' ? levelingComputed : type === 'traverse' ? traverseComputed : controlComputed

  // ── AUDIT FIX (2026-07-05): Auto-save + QC notifications (wired AFTER state) ──
  // Content-based snapshot: include the actual editable state (not just row
  // counts) so edits *inside* a row trigger auto-save, not only add/remove.
  const autoSaveData = useMemo(() => ({
    type, name, projectId,
    openingRL, closingRL, distanceKm, levelMethod, levelRows,
    travMode, startStation, startE, startN, closeE, closeN, travRows,
    controlSetups,
  }), [type, name, projectId, openingRL, closingRL, distanceKm, levelMethod, levelRows, travMode, startStation, startE, startN, closeE, closeN, travRows, controlSetups])

  useAutoSave({
    data: autoSaveData,
    onSave: async () => {
      if (projectId && (travRows.length > 0 || levelRows.length > 0 || controlRows.length > 0)) {
        await handleSave()
        notify({ title: 'Auto-saved', body: 'Field book data saved automatically.', type: 'auto_save' })
      }
    },
    interval: 30000,
    enabled: !!projectId,
  })

  // Fire notification when QC fails — don't wait for surveyor to scroll
  useEffect(() => {
    if (type === 'traverse' && traverseComputed?.ok) {
      const adjusted = traverseComputed.adjusted
      if (adjusted?.linearError != null && adjusted.linearError > 0.05) {
        notify({
          title: 'QC Alert: Traverse Misclosure Exceeded',
          body: `Linear misclosure is ${adjusted.linearError.toFixed(3)}m. Check bearings and distances for errors.`,
          type: 'qc_fail',
        })
      }
      if (adjusted?.precisionRatio != null && adjusted.precisionRatio < 5000 && adjusted.precisionRatio > 0) {
        notify({
          title: 'QC Alert: Precision Below Standard',
          body: `Precision ratio is 1:${adjusted.precisionRatio}. Cadastral surveys require minimum 1:5000 per Cap. 299.`,
          type: 'qc_fail',
        })
      }
    }
  }, [traverseComputed, type, notify])

  function currentDataPayload() {
    if (type === 'leveling') return { method: levelMethod, openingRL, closingRL, distanceKm, rows: levelRows }
    if (type === 'traverse') return { mode: travMode, startStation, startE, startN, closeE, closeN, rows: travRows }
    return { activeSetupId: activeControlSetupId, setups: controlSetups }
  }

  function resetForType(next: FieldbookType) {
    setType(next)
    setFieldbookId(null)
    setName('')
    setSaveStatus({ kind: 'idle' })
    setSyncStatus(null)
  }

  function loadFieldbook(entry: SavedFieldbook) {
    setFieldbookId(entry.id)
    setName(entry.name || '')
    const data: Record<string, unknown> = entry.data || {}

    // Hydrate a station object from unknown saved data, with per-field defaults.
    const controlStationFrom = (val: unknown) => {
      const s = (val ?? {}) as { name?: string; e?: string; n?: string; z?: string }
      return { name: String(s.name ?? 'STN'), e: String(s.e ?? ''), n: String(s.n ?? ''), z: String(s.z ?? '') }
    }

    if (entry.type === 'leveling') {
      setLevelMethod(data.method === 'height_of_collimation' ? 'height_of_collimation' : 'rise_and_fall')
      setOpeningRL(String(data.openingRL ?? openingRL))
      setClosingRL(data.closingRL !== undefined && data.closingRL !== null ? String(data.closingRL) : '')
      setDistanceKm(String(data.distanceKm ?? distanceKm))
      const rowsSource = Array.isArray(data.rows) ? (data.rows as LevelRow[]) : levelRows
      setLevelRows(rowsSource.map((r) => ({ ...r, id: r.id || crypto.randomUUID() })))
    } else if (entry.type === 'traverse') {
      const mode = data.mode === 'open' ? 'open' : data.mode === 'link' ? 'link' : 'closed'
      setTravMode(mode)
      setStartStation(String(data.startStation ?? startStation))
      setStartE(String(data.startE ?? startE))
      setStartN(String(data.startN ?? startN))
      setCloseE(String(data.closeE ?? ''))
      setCloseN(String(data.closeN ?? ''))
      const rowsSource = Array.isArray(data.rows) ? (data.rows as TravRow[]) : travRows
      setTravRows(rowsSource.map((r) => ({ ...r, id: r.id || crypto.randomUUID() })))
    } else if (entry.type === 'control') {
      const setupsRaw = Array.isArray(data.setups) ? (data.setups as ControlSetup[]) : null
      if (setupsRaw && setupsRaw.length > 0) {
        const setups: ControlSetup[] = setupsRaw.map((s) => ({
          id: String(s.id || crypto.randomUUID()),
          station: controlStationFrom(s.station),
          rows: (s.rows ?? []).map((r) => ({ ...r, id: r.id || crypto.randomUUID() })),
        }))
        setControlSetups(setups)
        const preferred = String(data.activeSetupId ?? setups[0].id)
        setActiveControlSetupId(setups.some((x) => x.id === preferred) ? preferred : setups[0].id)
      } else {
        // Backward compatibility: older payloads stored a single station + rows.
        const id = crypto.randomUUID()
        const rowsSource = Array.isArray(data.rows) ? (data.rows as ControlRow[]) : []
        setControlSetups([
          {
            id,
            station: controlStationFrom(data.station),
            rows: rowsSource.map((r) => ({ ...r, id: r.id || crypto.randomUUID() })),
          },
        ])
        setActiveControlSetupId(id)
      }
    }

    panelRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSyncNow() {
    setSyncStatus(null)
    try {
      const r = await syncPendingOperations(dbClient)
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

    // ── AUDIT FIX (2026-07-05): Run cross-checks BEFORE saving ──
    // These are the independent verification methods that catch
    // computation errors before data is committed to the DB.
    // If a cross-check fails, we still save (data isn't lost) but
    // we fire a notification so the surveyor knows there's an issue.
    if (type === 'traverse' && traverseComputed?.ok) {
      const adjusted = traverseComputed.adjusted
      if (adjusted && adjusted.legs && adjusted.legs.length >= 3) {
        // Extract adjusted coordinates from legs for cross-checking
        const points = adjusted.legs.map((leg: { adjEasting?: number; adjNorthing?: number }) => ({
          easting: leg.adjEasting || 0,
          northing: leg.adjNorthing || 0,
        }))

        // Run area cross-check (Shoelace vs. triangulation)
        const areaCheck = crossCheckArea(points)
        if (!areaCheck.passed) {
          notify({
            title: 'QC Warning: Area Cross-Check Failed',
            body: areaCheck.message,
            type: 'qc_fail',
          })
        }

        // Run closure cross-check (traverse sums vs. coordinate round-trip)
        if (points.length >= 2) {
          const start = points[0]
          const end = points[points.length - 1]
          const closureCheck = crossCheckClosure(
            start.easting, start.northing,
            end.easting, end.northing,
            adjusted.linearError || 0, 0,
            0.001
          )
          if (!closureCheck.passed) {
            notify({
              title: 'QC Warning: Closure Cross-Check Failed',
              body: closureCheck.message,
              type: 'qc_fail',
            })
          }
        }
      }
    }

    const session = await dbClient.auth.getSession()
    const sessData = session.data.session as Record<string, unknown> | null
    const userId = sessData?.user ? (sessData.user as Record<string, unknown>).id : undefined
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
        const { error } = await dbClient.from('fieldbooks').upsert({ ...record, updated_at: undefined }).select('id')
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
    } catch (e: unknown) {
      setSaveStatus({ kind: 'error', message: e instanceof Error ? (e as Error).message : 'Save failed.' })
    }
  }

  function exportJSON() {
    const payload = { id: fieldbookId, type, name: name.trim() || `${type.toUpperCase()} Field Book`, projectId, createdAt: new Date().toISOString(), data: currentDataPayload() }
    downloadBlob(`metardu-fieldbook-${type}.json`, new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
  }

   async function exportCSV() {
     let rows: Array<Record<string, string>> = []
     if (type === 'leveling') {
       rows = levelRows.map((r) => ({ Station: r.station, BS: r.bs, IS: r.is, FS: r.fs, Remarks: r.remarks }))
     } else if (type === 'traverse') {
       rows = travRows.map((r) => ({ Station: r.station, Bearing: r.bearing, SlopeDist: r.slopeDist, Remarks: r.remarks }))
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
     }

     const Papa = (await import('papaparse')).default
     downloadBlob(`metardu-fieldbook-${type}.csv`, new Blob([Papa.unparse(rows)], { type: 'text/csv' }))
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

        const lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
        y = (typeof lastY === 'number' ? lastY : y) + 8
        if (y > 270) {
          doc.addPage()
          y = 20
        }
      }
    }

    downloadBlob(`metardu-fieldbook-${type}.pdf`, doc.output('blob'))
  }

  // ─── Build a "rows" array compatible with MobileFieldbookShell ─────────
  // Each row is a string-keyed record so the mobile cards can render any
  // survey type with a single component.
  const mobileRows: Array<{ id: string; [key: string]: string }> = (() => {
    if (type === 'leveling') {
      return levelRows.map((r) => ({
        id: r.id,
        station: r.station,
        bs: r.bs,
        is: r.is,
        fs: r.fs,
        remarks: r.remarks,
      }))
    }
    if (type === 'traverse') {
      return travRows.map((r) => ({
        id: r.id,
        station: r.station,
        bearing: r.bearing,
        slopeDist: r.slopeDist,
        vaDeg: `${r.vaDeg}°${r.vaMin}'${r.vaSec}"`,
        ih: r.ih,
        th: r.th,
        remarks: r.remarks,
      }))
    }
    if (type === 'control') {
      return controlRows.map((r) => ({
        id: r.id,
        pointId: r.pointId,
        bearing: r.bearing,
        verticalAngle: r.verticalAngle,
        slopeDistance: r.slopeDistance,
        instrumentHeight: r.instrumentHeight,
        targetHeight: r.targetHeight,
        remarks: r.remarks,
      }))
    }
    return []
  })()

  /** Add a row produced by the mobile universal form to the active survey state. */
  function handleMobileAddRow(row: Record<string, string>, photos: CapturedBeaconPhoto[] = []) {
    const id = crypto.randomUUID()
    // Build a compact photo annotation appended to remarks so the surveyor
    // has an at-a-glance evidence trail. EXIF GPS coordinates are included
    // when available — this is critical for cadastral legal defence.
    const photoAnnotation = photos.length > 0
      ? photos.map((p, i) => {
          const gps = p.exif ? ` @${p.exif.latitude.toFixed(5)},${p.exif.longitude.toFixed(5)}` : ''
          const cap = p.caption ? ` "${p.caption}"` : ''
          return `[photo${i + 1}${gps}${cap}]`
        }).join(' ')
      : ''

    const enrichedRemarks = photoAnnotation
      ? `${row.remarks ?? ''}${row.remarks ? ' ' : ''}${photoAnnotation}`.trim()
      : (row.remarks ?? '')

    if (type === 'leveling') {
      setLevelRows((p) => [...p, {
        id,
        station: row.station ?? '',
        bs: row.bs ?? '',
        is: row.is ?? '',
        fs: row.fs ?? '',
        remarks: enrichedRemarks,
      }])
    } else if (type === 'traverse') {
      setTravRows((p) => [...p, {
        id,
        station: row.station ?? '',
        bearing: row.bearing ?? '',
        hclDeg: '', hclMin: '', hclSec: '',
        hcrDeg: '', hcrMin: '', hcrSec: '',
        slopeDist: row.slopeDist ?? '',
        vaDeg: row.vaDeg ?? '', vaMin: '', vaSec: '',
        ih: row.ih ?? '1.5', th: row.th ?? '1.5',
        remarks: enrichedRemarks,
      }])
    } else if (type === 'control') {
      setControlRows((p) => [...p, {
        id,
        pointId: row.pointId ?? '',
        instrumentHeight: row.instrumentHeight ?? '1.5',
        targetHeight: row.targetHeight ?? '1.5',
        bearing: row.bearing ?? '',
        verticalAngle: row.verticalAngle ?? '90',
        slopeDistance: row.slopeDistance ?? '',
        remarks: enrichedRemarks,
      }])
    }
    // Auto-save so the surveyor doesn't lose data if app is killed
    handleSave()
  }

  function handleMobileRemoveRow(id: string) {
    if (type === 'leveling') setLevelRows((p) => p.filter((r) => r.id !== id))
    else if (type === 'traverse') setTravRows((p) => p.filter((r) => r.id !== id))
    else if (type === 'control') setControlRows((p) => p.filter((r) => r.id !== id))
  }

  // ─── Handle measurement capture from MobileMeasurementCapture ─────
  function _handleMeasurementCapture(m: CapturedMeasurement) {
    if (m.type === 'gps') {
      if (type === 'control') {
        setControlRows((p) => [...p, {
          id: m.id, pointId: m.station || 'GPS', instrumentHeight: '1.5', targetHeight: '0',
          bearing: '', verticalAngle: '', slopeDistance: '',
          remarks: `GPS: ${m.lat?.toFixed(6)}, ${m.lng?.toFixed(6)} ±${m.accuracy?.toFixed(1)}m` + (m.remarks ? ` | ${m.remarks}` : ''),
        }])
      } else if (type === 'traverse') {
        setTravRows((p) => [...p, {
          id: m.id, station: m.station || 'GPS', bearing: '',
          hclDeg: '', hclMin: '', hclSec: '', hcrDeg: '', hcrMin: '', hcrSec: '',
          slopeDist: '', vaDeg: '', vaMin: '', vaSec: '', ih: '1.5', th: '0',
          remarks: `GPS: ${m.lat?.toFixed(6)}, ${m.lng?.toFixed(6)} ±${m.accuracy?.toFixed(1)}m`,
        }])
      }
    } else if (m.type === 'bearing-distance') {
      if (type === 'traverse') {
        const bearingStr = m.bearing != null ? bearingToString(m.bearing) : ''
        setTravRows((p) => [...p, {
          id: m.id, station: m.station || '', bearing: bearingStr,
          hclDeg: '', hclMin: '', hclSec: '', hcrDeg: '', hcrMin: '', hcrSec: '',
          slopeDist: m.distance?.toFixed(3) || '', vaDeg: '', vaMin: '', vaSec: '',
          ih: '1.5', th: '1.5', remarks: m.remarks || `→ ${m.target}`,
        }])
      } else if (type === 'control') {
        setControlRows((p) => [...p, {
          id: m.id, pointId: m.target || '', instrumentHeight: '1.5', targetHeight: '1.5',
          bearing: m.bearing?.toFixed(6) || '', verticalAngle: '',
          slopeDistance: m.distance?.toFixed(3) || '', remarks: m.remarks || '',
        }])
      }
    } else if (m.type === 'angle') {
      if (type === 'traverse') {
        const fl = m.faceLeft || 0
        const fr = m.faceRight || 0
        const deg = Math.floor(fl)
        const minFull = (fl - deg) * 60
        const min = Math.floor(minFull)
        const sec = (minFull - min) * 60
        const rDeg = Math.floor(fr)
        const rMinFull = (fr - rDeg) * 60
        const rMin = Math.floor(rMinFull)
        const rSec = (rMinFull - rMin) * 60
        setTravRows((p) => [...p, {
          id: m.id, station: m.station || '', bearing: '',
          hclDeg: String(deg), hclMin: String(min), hclSec: sec.toFixed(1),
          hcrDeg: String(rDeg), hcrMin: String(rMin), hcrSec: rSec.toFixed(1),
          slopeDist: '', vaDeg: '', vaMin: '', vaSec: '', ih: '1.5', th: '1.5',
          remarks: m.remarks || `Mean: ${m.meanAngle?.toFixed(6)}° → ${m.target}`,
        }])
      }
    } else if (m.type === 'offset') {
      if (type === 'control' || type === 'traverse') {
        setControlRows((p) => [...p, {
          id: m.id, pointId: m.target || 'Offset', instrumentHeight: '0', targetHeight: '0',
          bearing: '', verticalAngle: '', slopeDistance: '',
          remarks: `Offset: E=${m.offsetE}, N=${m.offsetN}` + (m.remarks ? ` | ${m.remarks}` : ''),
        }])
      }
    }
    handleSave()
  }

  // ─── Mobile rendering: card-based shell with universal quick-add ─────
  /**
   * Pull the latest reading from a connected total station / GNSS via
   * the Web Serial API. Returns a partial row keyed by the same field
   * names used in UniversalMobileObservationForm.
   *
   * The full instrument connection lifecycle is managed by the
   * InstrumentConnectionPanel on /field. To avoid duplicating that
   * state machine here, this shim:
   *   1. Verifies the Web Serial API is available.
   *   2. Looks for a globally-exposed last-reading (the panel sets
   *      `window.__metarduLastInstrumentReading` when streaming).
   *   3. Translates the reading to the active survey type's fields.
   *   4. If no reading is available, surfaces a clear CTA to open
   *      /field and connect an instrument.
   */
  async function pullInstrumentReading(): Promise<Partial<Record<string, string>>> {
    try {
      if (typeof navigator === 'undefined' || !('serial' in navigator)) {
        alert('Web Serial API is not supported in this browser. Use Chrome or Edge on desktop / Android.')
        return {}
      }

      // The InstrumentConnectionPanel exposes the latest reading via a
      // window global so other components can pull without remounting
      // the connection.  See useInstrumentConnection.ts → onData.
      const lastReading = (window as unknown as {
        __metarduLastInstrumentReading?: {
          easting?: number | null
          northing?: number | null
          elevation?: number | null
          pointName?: string
          timestamp?: string
        }
      }).__metarduLastInstrumentReading

      if (!lastReading) {
        const go = confirm('No instrument reading available. Open the Field page to connect a total station / GNSS?')
        if (go) window.location.href = '/field'
        return {}
      }

      // Translate the streamed point into the active survey type's fields
      if (type === 'traverse' || type === 'control') {
        const e = lastReading.easting ?? 0
        const n = lastReading.northing ?? 0
        return {
          slopeDist: String(Math.sqrt(e * e + n * n)),
          bearing: String((Math.atan2(e, n) * 180 / Math.PI + 360) % 360),
          pointId: lastReading.pointName ?? '',
        }
      }
      return {}
    } catch (err) {
      logger.error('pullInstrumentReading failed:', { error: err })
      return {}
    }
  }

  if (isMobile) {
    return (
      <>
        <div className="pb-44">
          <MobileFieldbookShell
            surveyType={type}
            onSurveyTypeChange={(t) => resetForType(t as FieldbookType)}
            rows={mobileRows}
            onAddRow={handleMobileAddRow}
            onRemoveRow={handleMobileRemoveRow}
            online={online}
            lastSaved={saveStatus.kind === 'saved' ? saveStatus.when : null}
            unsyncedCount={savedFieldbooks.filter((fb) => !fb.updated_at).length}
            onSync={handleSyncNow}
            stationName={type === 'control' ? controlStation.name : undefined}
            onPullInstrumentReading={pullInstrumentReading}
            onViewAuditLog={() => setAuditDrawerOpen(true)}
            computed={currentComputed}
            openingRL={openingRL}
            setOpeningRL={setOpeningRL}
            closingRL={closingRL}
            setClosingRL={setClosingRL}
            distanceKm={distanceKm}
            setDistanceKm={setDistanceKm}
            levelMethod={levelMethod}
            setLevelMethod={setLevelMethod}
            travMode={travMode}
            setTravMode={setTravMode}
            startStation={startStation}
            setStartStation={setStartStation}
            startE={startE}
            setStartE={setStartE}
            startN={startN}
            setStartN={setStartN}
            closeE={closeE}
            setCloseE={setCloseE}
            closeN={closeN}
            setCloseN={setCloseN}
            controlSetups={controlSetups}
            setControlSetups={setControlSetups}
            activeControlSetupId={activeControlSetupId}
            setActiveControlSetupId={setActiveControlSetupId}
            controlStation={controlStation}
            setControlStation={setControlStation}
          />
        </div>
        {/* AUDIT FIX (2026-07-05): Replaced MobileMeasurementCapture with
            InstrumentStreamBar — provides zero-manual-entry data collection
            via total station (Web Serial) and GNSS rover (Web Bluetooth).
            The old MobileMeasurementCapture was manual-only. The new bar
            auto-detects the best mode based on survey type + browser support.
            AUDIT FIX (2026-07-10): wrapped in ErrorBoundary so a stale chunk
            (chunk 2723 etc.) doesn't take down the whole field book page —
            the surveyor can still manually enter readings while we recover. */}
        <ErrorBoundary
          fallback={
            <div className="mx-3 my-4 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs">
              <p className="text-amber-300 font-semibold mb-1">Instrument connection unavailable</p>
              <p className="text-amber-200/70 mb-2">A deferred chunk failed to load — your draft is safe. Reload to reconnect the total station / GNSS rover.</p>
              <button onClick={() => window.location.reload()} className="px-3 py-1.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30">
                Reload
              </button>
            </div>
          }
        >
        <InstrumentStreamBar
          surveyType={type as StreamSurveyType}
          onReading={(reading: StreamedReading) => {
            // Route the streamed reading into the appropriate field book rows
            if (type === 'traverse') {
              const bearingStr = reading.bearing != null ? bearingToString(reading.bearing) : ''
              setTravRows((p) => [...p, {
                id: crypto.randomUUID(),
                station: reading.station || '',
                bearing: bearingStr,
                hclDeg: '', hclMin: '', hclSec: '',
                hcrDeg: '', hcrMin: '', hcrSec: '',
                slopeDist: reading.distance?.toFixed(3) || '',
                vaDeg: '', vaMin: '', vaSec: '',
                ih: reading.instrumentHeight?.toFixed(3) || '1.500',
                th: reading.targetHeight?.toFixed(3) || '1.500',
                remarks: '',
              }])
            } else if (type === 'control') {
              setControlRows((p) => [...p, {
                id: crypto.randomUUID(),
                pointId: reading.station || '',
                bearing: reading.bearing?.toString() || '',
                verticalAngle: reading.verticalAngle?.toString() || '',
                slopeDistance: reading.distance?.toFixed(3) || '',
                instrumentHeight: reading.instrumentHeight?.toFixed(3) || '1.500',
                targetHeight: reading.targetHeight?.toFixed(3) || '1.500',
                remarks: '',
              }])
            } else if (type === 'leveling') {
              // For leveling, GNSS/total station readings add a level entry
              setLevelRows((p) => [...p, {
                id: crypto.randomUUID(),
                station: reading.station || '',
                bs: '',
                is: '',
                fs: '',
                remarks: reading.elevation ? `RL: ${reading.elevation.toFixed(3)}` : '',
              }])
            }
          }}
          stationName={type === 'control' ? controlStation.name : startStation}
          instrumentHeight={1.5}
          targetHeight={1.5}
        />
        </ErrorBoundary>
        <FieldbookAuditDrawer
          open={auditDrawerOpen}
          onClose={() => setAuditDrawerOpen(false)}
          projectId={projectId || undefined}
        />
      </>
    )
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
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left sidebar — organized into collapsible sections */}
        <div className="lg:col-span-3 space-y-3" ref={panelRef}>
          {/* Project & Save — always visible */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">Project</span>
              {saveStatus.kind === 'saved' && (
                <span className="text-[9px] text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  {new Date(saveStatus.when).toLocaleTimeString()}
                </span>
              )}
            </div>
            <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">{t('projects.selectProject')}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input aria-label="Field book name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('field.fieldBookNamePlaceholder')} />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleSave} className="btn btn-primary" disabled={saveStatus.kind === 'saving'}>
                {saveStatus.kind === 'saving' ? t('common.saving') : t('common.save')}
              </button>
              <button onClick={() => { setFieldbookId(null); setName(''); setSaveStatus({ kind: 'idle' }) }} className="btn btn-secondary">
                {t('common.new')}
              </button>
            </div>
            {saveStatus.kind === 'error' && <p className="text-xs text-red-400">{saveStatus.message}</p>}
            {syncStatus && (
              <p className={`text-xs ${syncStatus.failed ? 'text-yellow-400' : 'text-green-400'}`}>
                Sync: {syncStatus.synced} synced, {syncStatus.failed} failed
              </p>
            )}
          </div>

          {/* Quick actions — export, plan, sync */}
          <div className="card p-3 space-y-2">
            <button onClick={handleDevelopFullPlan} disabled={planGenerating || !projectId}
              className="w-full btn bg-green-600 hover:bg-green-700 text-white border-green-600 disabled:opacity-50 text-sm">
              {planGenerating ? planStep || 'Generating...' : 'Develop Full Plan'}
            </button>
            {planResult?.success && (
              <a href={planResult.downloadUrl} target="_blank" rel="noopener noreferrer" className="block text-xs text-green-400 underline text-center">
                Download Plan Package
              </a>
            )}
            <div className="grid grid-cols-3 gap-1.5">
              <button onClick={exportPDF} className="btn btn-secondary text-xs py-2">PDF</button>
              <button onClick={exportCSV} className="btn btn-secondary text-xs py-2">CSV</button>
              <button onClick={exportJSON} className="btn btn-secondary text-xs py-2">JSON</button>
            </div>
          </div>

          {/* AUDIT FIX (2026-07-05): Real-Time QC Panel — live closure monitor */}
          <div className="card p-4">
            <RealTimeQCPanel
              observations={travRows.map((r, i) => ({
                fromStation: r.station || `ST${i}`,
                toStation: travRows[i + 1]?.station || `ST${i + 1}`,
                bearing: r.bearing ? parseFloat(r.bearing) : undefined,
                distance: r.slopeDist ? parseFloat(r.slopeDist) : undefined,
              }))}
              surveyClass="urban"
              compact
            />
          </div>

          {/* Saved fieldbooks — collapsible */}
          <details className="card p-3" open>
            <summary className="cursor-pointer text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center justify-between">
              <span>{t('field.savedFieldbooks')}</span>
              <span className="text-[10px] text-[var(--text-muted)] normal-case">{isOnline() ? t('common.online') : t('common.offline')}</span>
            </summary>
            <div className="mt-2 space-y-1.5 max-h-[30vh] overflow-auto pr-1">
              {savedFieldbooks.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] py-2 text-center">No saved fieldbooks</p>
              ) : (
                savedFieldbooks.map((fb) => (
                  <button key={fb.id} onClick={() => loadFieldbook(fb)}
                    className={`w-full text-left px-2.5 py-1.5 rounded border text-xs transition-colors ${
                      fieldbookId === fb.id ? 'border-amber-500/50 bg-amber-500/10 text-amber-300' : 'border-[var(--border-color)] hover:border-amber-500/20 text-[var(--text-secondary)]'
                    }`}>
                    <div className="truncate font-medium">{fb.name || fb.id}</div>
                    <div className="text-[9px] text-[var(--text-muted)]">{fb.updated_at ?? fb.created_at ? new Date(fb.updated_at ?? fb.created_at as string).toLocaleString() : ''}</div>
                  </button>
                ))
              )}
            </div>
          </details>

          {/* GNSS & NTRIP — collapsible to save space */}
          <details className="card p-3">
            <summary className="cursor-pointer text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
              GNSS Rover & NTRIP
            </summary>
            <div className="mt-3 space-y-3">
              <ErrorBoundary
                fallback={
                  <p className="text-xs text-amber-300/70">
                    Connection module unavailable — reload to reconnect instrument.
                  </p>
                }
              >
                <GNSSRoverConnection />
                <NTRIPClientPanel />
              </ErrorBoundary>
            </div>
          </details>

          {/* GNSS Quality — collapsible */}
          <details className="card p-3">
            <summary className="cursor-pointer text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
              GNSS Quality Report
            </summary>
            <div className="mt-3">
              <ErrorBoundary
                fallback={
                  <p className="text-xs text-amber-300/70">
                    Quality module unavailable — reload to view stats.
                  </p>
                }
              >
                <GNSSQualityReport />
              </ErrorBoundary>
            </div>
          </details>
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
          </div>

          {!currentComputed.ok && (() => {
            // UX: suppress the red "Calculation Errors" banner on initial empty
            // render. The user hasn't entered any data yet, so the empty-field
            // errors are noise — the engine won't actually fail until the user
            // tries to Save or Compute without filling required fields.
            // Only surface the banner when the user has entered at least one row
            // (or a start coordinate for traverse) so they know *why* it failed.
            const hasUserInput =
              (type === 'leveling' && levelRows.some((r) => r.station.trim() || r.bs.trim() || r.is.trim() || r.fs.trim())) ||
              (type === 'traverse' && (travRows.length > 1 || travRows.some((r) => r.station.trim()) || !!startE.trim() || !!startN.trim())) ||
              (type === 'control' && controlRows.some((r) => r.pointId.trim() || r.bearing.trim() || r.slopeDistance.trim()))
            if (!hasUserInput) return null
            return (
              <div className="p-3 bg-red-900/15 border border-red-700 rounded text-sm text-red-300">
                {currentComputed.errors.map((e: string, i: number) => (
                  <div key={`item-${i}`}>{e}</div>
                ))}
              </div>
            )
          })()}

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
              levelRows={levelRows}
              setLevelRows={setLevelRows}
              computed={levelingComputed}
            />
          )}

          {type === 'traverse' && (
            <>
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
                travRows={travRows}
                setTravRows={setTravRows}
                computed={traverseComputed}
              />

              {/* Instant Closure Feedback — updates in real-time as surveyor types */}
              <InstantClosureFeedback
                rows={travRows}
                startE={startE}
                startN={startN}
                closeE={closeE}
                closeN={closeN}
                mode={travMode}
                surveyType={'cadastral'}
                t={t}
              />

              {/* Bowditch Adjustment Summary — shows precision stats and statutory compliance */}
              {traverseComputed.ok && traverseComputed.mode !== 'open' && (
                <BowditchSummary adjusted={traverseComputed.adjusted} />
              )}
            </>
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
                setStation={setControlStation}
                rows={controlRows}
                setRows={setControlRows}
                computed={controlComputed}
              />
            </div>
          )}


        </div>
      </div>
    </div>
  )
 }
