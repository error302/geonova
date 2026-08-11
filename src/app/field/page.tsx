'use client';

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/api-client/client'
import dynamic from 'next/dynamic'
// ponytail: lazy-load instrument connection panel (heavy component with Web Serial API)
const InstrumentConnectionPanel = dynamic(() => import('@/components/InstrumentConnectionPanel').then(m => ({ default: m.InstrumentConnectionPanel })), {
  ssr: false,
  loading: () => <div className='text-xs text-gray-500'>Loading instrument panel...</div>,
})
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import {
  MapPin,
  RefreshCw,
  Scale,
  Radio,
  X,
  Plus,
  CheckCircle2,
  Upload,
  LucideIcon,
} from 'lucide-react'
import { FieldBookMobile } from '@/components/fieldbook/FieldBookMobile'
import { ToleranceBadge } from '@/components/survey/ToleranceBadge'
import { checkTolerance, type ToleranceCheckResult, type SurveyType } from '@/lib/survey/liveToleranceChecker'
import type { RawObservation } from '@/lib/computations/traverseEngine'
import { logger } from '@/lib/logger'

type Tab = 'points' | 'traverse' | 'leveling' | 'radiation' | 'offline' | 'map'
type SyncStatus = 'synced' | 'pending' | 'offline'

const STORAGE_KEY = 'metardu_pending_observations'

interface FieldProject { id: string; name: string; survey_type?: string }
interface FieldPoint { id?: string; name: string; easting: number; northing: number; is_control?: boolean }
interface BatchResult { name: string; easting: number | string; northing: number | string; elevation?: number | null; is_control?: boolean }
interface FieldTraverseLeg { id: string; fromStation: string; toStation: string; distance: number; bearing: { deg: number; min: number; sec: number } }
interface LevelReading { id: string; station: string; bs?: number; is?: number; fs?: number }
interface RadiationPoint { id: string; pointName: string; bearing: { deg: string; min: string; sec: string }; distance: number }

export default function FieldPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [msg, setMsg] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('traverse')
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline')
  const [projects, setProjects] = useState<FieldProject[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ id: string } | null>(null)
  
  // Points state
  const [points, setPoints] = useState<FieldPoint[]>([])
  const [showBatch, setShowBatch] = useState(false)
  const [batchCSV, setBatchCSV] = useState('')
  const [batchParseResults, setBatchParseResults] = useState<BatchResult[]>([])
  const [batchErrors, setBatchErrors] = useState<string[]>([])

  // Single point form
  const [pName, setPName] = useState('')
  const [pE, setPE] = useState('')
  const [pN, setPN] = useState('')
  const [pZ, setPZ] = useState('')
  const [pCtrl, setPCtrl] = useState(false)

  // Traverse state
  const [tStation, setTStation] = useState('')
  const [tDist, setTDist] = useState('')
  const [tDeg, setTDeg] = useState('')
  const [tMin, setTMin] = useState('')
  const [tSec, setTSec] = useState('')
  const [tLegs, setTLegs] = useState<FieldTraverseLeg[]>([])
  const [tTotal, setTTotal] = useState(0)

  // Tolerance check state (Phase 1 — live field-side closure checking)
  const [toleranceResult, setToleranceResult] = useState<ToleranceCheckResult | null>(null)

  // Leveling state
  const [lStation, setLStation] = useState('')
  const [lReading, setLReading] = useState('')
  const [lType, setLType] = useState<'BS' | 'IS' | 'FS'>('BS')
  const [lReadings, setLReadings] = useState<LevelReading[]>([])

  // Radiation state
  const [rStation, setRStation] = useState('')
  const [rInstH, setRInstH] = useState('1.500')
  const [rPoints, setRPoints] = useState<RadiationPoint[]>([])
  const [rNewName, setRNewName] = useState('')
  const [rBearingDeg, setRBearingDeg] = useState('')
  const [rBearingMin, setRBearingMin] = useState('')
  const [rBearingSec, setRBearingSec] = useState('')
  const [rDist, setRDist] = useState('')

  // AUDIT FIX (H-007, 2026-07-27): useMemo prevents infinite loop.
  const dbClient = useMemo(() => createClient(), [])

  const fetchProjects = useCallback(async (userId: string) => {
    const { data } = await dbClient
      .from('projects')
      .select('id, name, survey_type')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (data) setProjects(data as unknown as FieldProject[])
  }, [dbClient])

  const fetchProjectPoints = useCallback(async (projectId: string) => {
    if (!projectId) return
    const { data } = await dbClient
      .from('survey_points')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    if (data) setPoints(data as unknown as FieldPoint[])
  }, [dbClient])

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const authRes = await dbClient.auth.getSession()
      const session = authRes.data?.session
      const user = (session as unknown as { user?: { id: string } } | null)?.user
      if (!user) {
        window.location.replace('/login?next=%2Ffield')
        return
      }
      setUser(user as { id: string })
      setLoading(false)
      fetchProjects((user as { id: string }).id)
      fetchProjectPoints(selectedProject)
    }
    checkAuth()
  }, [router, dbClient, selectedProject, fetchProjects, fetchProjectPoints])

  useEffect(() => {
    if (!user) return
    
    const subRes = dbClient.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null)
        window.location.replace('/login?next=%2Ffield')
      } else {
        setUser((session as Record<string, unknown>).user as { id: string } | null)
      }
    })
    return () => subRes.data.subscription.unsubscribe()
  }, [user, dbClient, router])

  // Point batch parser
  const parseBatchCSV = () => {
    const lines = batchCSV.trim().split('\n')
    const results: BatchResult[] = []
    const errors: string[] = []
    let lineNum = 0

    for (const line of lines) {
      lineNum++
      const parts = line.split(',').map((p) => p.trim())
      if (parts.length < 3) {
        errors.push(`Line ${lineNum}: Need at least 3 columns`)
        continue
      }

      const [name, easting, northing, elevation] = parts
      const e = parseFloat(easting)
      const n = parseFloat(northing)
      const z = elevation ? parseFloat(elevation) : null

      if (isNaN(e) || e < 100000 || e > 900000) {
        errors.push(`Line ${lineNum}: Invalid easting`)
        continue
      }
      if (isNaN(n) || n < 0) {
        errors.push(`Line ${lineNum}: Invalid northing`)
        continue
      }

      results.push({
        name: name.trim() || `PT${results.length + 1}`,
        easting: e,
        northing: n,
        elevation: z,
        is_control: false
      })
    }

    setBatchParseResults(results)
    setBatchErrors(errors)
  }

  const saveBatchPoints = async () => {
    if (!selectedProject || batchParseResults.length === 0) return

    try {
      // T1.5d FIX (2026-07-10): Map 'name' to 'point_name' (the actual DB column).
      // The local type uses 'name' for convenience, but the DB column is 'point_name'.
      await dbClient.from('survey_points').insert(
        batchParseResults.map((p) => ({
          project_id: selectedProject,
          point_name: p.name,  // T1.5d: was 'name' (column doesn't exist)
          easting: p.easting,
          northing: p.northing,
          elevation: p.elevation,
          is_control: p.is_control ?? false,
        }))
      )
      setBatchCSV('')
      setBatchParseResults([])
      setBatchErrors([])
      setShowBatch(false)
      fetchProjectPoints(selectedProject)
      setMsg(` Saved ${batchParseResults.length} points successfully`)
    } catch (e: unknown) {
      setMsg('Error: ' + (e instanceof Error ? (e as Error).message : String(e)))
    }
  }

  // Single point save
  const savePoint = async () => {
    if (!pName || !pE || !pN || !selectedProject) return

    try {
      await dbClient.from('survey_points').insert({
        point_name: pName,  // T1.5d FIX: was 'name' (column doesn't exist)
        easting: parseFloat(pE),
        northing: parseFloat(pN),
        elevation: pZ ? parseFloat(pZ) : null,
        is_control: pCtrl,
        project_id: selectedProject
      })
      setPName('')
      setPE('')
      setPN('')
      setPZ('')
      setPCtrl(false)
      fetchProjectPoints(selectedProject)
    } catch (e) {
      logger.error(e instanceof Error ? e.message : String(e))
    }
  }

  // Traverse
  const addTraverseLeg = () => {
    if (!tStation || !tDist || !tDeg) return
    const toStation = tStation
    const fromStation = tLegs.length > 0 ? tLegs[tLegs.length - 1].toStation : 'A'
    const bearing = {
      deg: parseInt(tDeg) || 0,
      min: parseInt(tMin) || 0,
      sec: parseFloat(tSec) || 0
    }

    setTLegs([...tLegs, {
      id: Date.now().toString(),
      fromStation,
      toStation,
      distance: parseFloat(tDist),
      bearing
    }])

    setTStation('')
    setTDist('')
    setTDeg('')
    setTMin('')
    setTSec('')
  }

  const traverseTotal = tLegs.reduce((sum, l) => sum + l.distance, 0)

  // Phase 1: Live tolerance check — recompute whenever traverse legs change
  useEffect(() => {
    if (tLegs.length < 3 || !selectedProject) {
      setToleranceResult(null)
      return
    }

    try {
      // Convert field page traverse legs to RawObservation format
      const observations: RawObservation[] = tLegs.map((leg) => ({
        station: leg.toStation,
        bs: leg.fromStation,
        fs: leg.toStation,
        hclDeg: String(leg.bearing.deg),
        hclMin: String(leg.bearing.min),
        hclSec: String(leg.bearing.sec),
        hcrDeg: String((leg.bearing.deg + 180) % 360),
        hcrMin: String(leg.bearing.min),
        hcrSec: String(leg.bearing.sec),
        slopeDist: String(leg.distance),
        vaDeg: '90', vaMin: '00', vaSec: '00',
        ih: '1.5', th: '1.5',
      }))

      // Get project survey type
      const project = projects.find(p => p.id === selectedProject)
      const surveyType = (project?.survey_type as string) || 'cadastral'

      // T1.5i FIX (2026-07-10): Use control points from the project for
      // opening/closing coordinates. Fall back to a loop traverse (same
      // opening = closing) if no control points are available — the closure
      // check still works, it just checks internal misclosure.
      const controlPoints = points.filter((p) => p.is_control)
      const openingPoint = controlPoints[0]
      const closingPoint = controlPoints[controlPoints.length - 1] || controlPoints[0]

      const openingE = openingPoint?.easting || 0
      const openingN = openingPoint?.northing || 0
      const closingE = closingPoint?.easting || openingE
      const closingN = closingPoint?.northing || openingN

      const result = checkTolerance({
        surveyType: surveyType as SurveyType,
        observations,
        openingEasting: openingE,
        openingNorthing: openingN,
        openingStation: tLegs[0]?.fromStation || 'A',
        closingEasting: closingE,
        closingNorthing: closingN,
        closingStation: tLegs[0]?.fromStation || 'A',
        backsightBearingDeg: tLegs[0]?.bearing?.deg || 0,
        backsightBearingMin: tLegs[0]?.bearing?.min || 0,
        backsightBearingSec: tLegs[0]?.bearing?.sec || 0,
      })
      setToleranceResult(result)
    } catch {
      // Tolerance check may fail if data is incomplete — that's OK
      setToleranceResult(null)
    }
  }, [tLegs, selectedProject, projects, points])

  const renderTabButton = (tab: Tab, Icon: LucideIcon, label: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex-1 py-2 text-xs font-medium flex flex-col items-center gap-1 ${
        activeTab === tab ? 'text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </button>
  )

  const renderOfflineTabButton = (tab: Tab, Icon: LucideIcon, label: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex-1 py-2 text-xs font-medium flex flex-col items-center gap-1 ${
        activeTab === tab ? 'text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[10px]">{label}</span>
    </button>
  )

  const inputClass = "w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
  const inputNumberClass = `${inputClass} font-mono text-right`

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--text-secondary)] text-sm">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold text-[var(--text-primary)]">{t('field.fieldMode')}</h1>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-2 py-1 text-xs text-[var(--text-primary)] w-36"
            >
              <option value="">Select Project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            {syncStatus === 'synced' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
            {syncStatus === 'pending' && <RefreshCw className="w-4 h-4 text-yellow-400 animate-spin" />}
            {syncStatus === 'offline' && <X className="w-4 h-4 text-[var(--text-muted)]" />}
          </div>
        </div>
      </header>
      {/* Instrument Connection Panel */}
      <div className="p-3 border-b border-[var(--border-color)]">
        <InstrumentConnectionPanel onImportPoints={(points) => {
          // Auto-add imported points to the field book
          setBatchParseResults(prev => [...prev, ...points.map(p => ({
            name: p.id || `P${Date.now()}`,
            easting: String(p.easting),
            northing: String(p.northing),
          }))])
        }} />
      </div>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-3 pb-20">
        <div className="mb-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)]/20 p-3">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Workflow</div>
          <div className="text-sm text-[var(--text-primary)] mt-1">Field Mode = quick capture (phone/tablet). Field Book = textbook tables + checks + exports.</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={() => router.push('/fieldbook')}
              className="text-[10px] bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] px-2 py-1.5 rounded"
            >
              Open Field Book
            </button>
            <button
              onClick={() => router.push('/field/gnss')}
              className="text-[10px] bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] px-2 py-1.5 rounded"
            >
              GNSS Receiver
            </button>
            <button
              onClick={() => router.push('/guide')}
              className="text-[10px] bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] px-2 py-1.5 rounded"
            >
              Field Guides
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className="text-[10px] bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black px-2 py-1.5 rounded"
            >
              GPS Map & Collection
            </button>
          </div>
        </div>

        {activeTab === 'points' && (
          <div className="space-y-3">
            {/* Quick batch entry button */}
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-semibold text-white uppercase tracking-wide">{t('field.points')}</h2>
              <button
                onClick={() => setShowBatch(!showBatch)}
                className="text-[10px] bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] px-2 py-1 rounded flex items-center gap-1"
              >
                {showBatch ? t('common.close') : <><Plus className="w-3 h-3" /> {t('field.batchCSV')}</>}
              </button>
            </div>

            {/* Batch CSV input */}
            {showBatch && (
              <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded p-3 space-y-2">
                <div>
                  <label htmlFor="field-batch-csv" className="text-[10px] text-[var(--text-muted)]">CSV: Name, Easting, Northing, Elevation (optional)</label>
                  <textarea
                    id="field-batch-csv"
                    value={batchCSV}
                    onChange={(e) => setBatchCSV(e.target.value)}
                    placeholder="PT1,500000,4500000,100&#10;PT2,500100,4500100,101"
                    className={`${inputClass} h-20 text-xs font-mono mt-1`}
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={parseBatchCSV} className="flex-1 text-[10px] bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] py-1.5 rounded">
                    {t('field.parse')}
                  </button>
                  <button onClick={saveBatchPoints} disabled={batchParseResults.length === 0} className="flex-1 text-[10px] bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black py-1.5 rounded disabled:opacity-50">
                    {t('common.save')} {batchParseResults.length}
                  </button>
                </div>
                {batchErrors.length > 0 && (
                  <div className="text-[10px] text-red-400">
                    {batchErrors.map((e, i) => <div key={`${e}-${i}`}>{e}</div>)}
                  </div>
                )}
                {batchParseResults.length > 0 && (
                  <div className="text-[10px] text-green-400">
                    Parsed {batchParseResults.length} ready
                  </div>
                )}
              </div>
            )}

            {/* Single point form */}
            <div className="grid grid-cols-2 gap-2">
              <div>
<label htmlFor="field-point-name" className="text-[10px] text-[var(--text-muted)] mb-1 block">{t('field.name')}</label>
              <input id="field-point-name" value={pName} onChange={e => setPName(e.target.value)} placeholder="P1" className={inputNumberClass} />
            </div>
            <div>
              <label htmlFor="field-point-easting" className="text-[10px] text-[var(--text-muted)] mb-1 block">{t('common.easting')}</label>
              <input id="field-point-easting" value={pE} onChange={e => setPE(e.target.value)} placeholder="500000" className={inputNumberClass} />
            </div>
            <div>
              <label htmlFor="field-point-northing" className="text-[10px] text-[var(--text-muted)] mb-1 block">{t('common.northing')}</label>
              <input id="field-point-northing" value={pN} onChange={e => setPN(e.target.value)} placeholder="4500000" className={inputNumberClass} />
            </div>
            <div>
              <label htmlFor="field-point-elevation" className="text-[10px] text-[var(--text-muted)] mb-1 block">{t('common.elevation')}</label>
              <input id="field-point-elevation" value={pZ} onChange={e => setPZ(e.target.value)} placeholder="0" className={inputNumberClass} />
            </div>
          </div>

          <div className="flex items-center justify-between py-2 px-3 bg-[var(--bg-secondary)]/50 rounded border border-[var(--border-color)]">
            <label className="text-[10px] text-[var(--text-secondary)]">{t('field.controlPoint')}</label>
              <button
                onClick={() => setPCtrl(!pCtrl)}
                className={`w-8 h-4 rounded-full relative ${pCtrl ? 'bg-[var(--accent)]' : 'bg-gray-600'}`}
              >
                <div className={`absolute top-0.5 w-3.5 h-3.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded transition-transform ${pCtrl ? 'left-4' : 'left-0.5'}`} />
              </button>
            </div>

            <button
              onClick={savePoint}
              disabled={!pName || !pE || !pN || !selectedProject}
              className="w-full py-2 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black text-xs font-semibold rounded disabled:opacity-50"
            >
              {t('field.savePoint')}
            </button>

            {points.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] text-[var(--text-muted)]">Recent:</div>
                {points.slice(0, 5).map((p) => (
                  <div key={p.id} className="bg-[var(--bg-secondary)]/50 rounded px-2 py-1.5 flex justify-between items-center text-[10px]">
                    <span className="text-[var(--text-primary)]">{p.name}</span>
                    <span className="text-[var(--text-muted)] font-mono">{p.easting.toFixed(0)}, {p.northing.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'traverse' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-semibold text-white uppercase tracking-wide">{t('field.traverse')}</h2>
              <span className="text-[10px] text-[var(--text-muted)]">{t('field.total')}: {traverseTotal.toFixed(2)} m</span>
            </div>

            {/* Phase 1: Live tolerance badge — shows green/red closure status */}
            {toleranceResult && (
              <div className="sticky top-0 z-10">
                <ToleranceBadge result={toleranceResult} compact />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="traverse-station" className="text-[10px] text-[var(--text-muted)] mb-1 block">{t('field.traverse')} →</label>
                <input id="traverse-station" value={tStation} onChange={e => setTStation(e.target.value)} placeholder="B" className={inputClass} />
              </div>
              <div>
                <label htmlFor="traverse-distance" className="text-[10px] text-[var(--text-muted)] mb-1 block">{t('field.distance')}</label>
                <input id="traverse-distance" value={tDist} onChange={e => setTDist(e.target.value)} placeholder="100.00" className={inputNumberClass} />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-[var(--text-muted)] mb-1 block">{t('field.bearing')} (DMS)</label>
              <div className="grid grid-cols-3 gap-1.5">
                <input 
                  value={tDeg} 
                  onChange={e => setTDeg(e.target.value)} 
                  aria-label="Bearing degrees" placeholder="000" 
                  className={`${inputClass} text-center text-sm`} 
                />
                <input 
                  value={tMin} 
                  onChange={e => setTMin(e.target.value)} 
                  aria-label="Bearing minutes" placeholder="00" 
                  className={`${inputClass} text-center text-sm`} 
                />
                <input 
                  value={tSec} 
                  onChange={e => setTSec(e.target.value)} 
                  aria-label="Bearing seconds" placeholder="00.0" 
                  className={`${inputClass} text-center font-mono text-sm`} 
                />
              </div>
            </div>

            <button onClick={addTraverseLeg} className="w-full py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] text-xs font-medium rounded">
              + {t('field.addLeg')}
            </button>

            {tLegs.length > 0 && (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {tLegs.map((leg, i) => (
                  <div key={leg.id} className="bg-[var(--bg-secondary)]/50 rounded px-2 py-1.5 flex justify-between items-center text-[10px]">
                    <span className="text-[var(--text-secondary)]">#{i + 1} {leg.fromStation} → {leg.toStation}</span>
                    <span className="text-[var(--text-primary)] font-mono">{leg.distance.toFixed(1)}m {leg.bearing.deg}°{leg.bearing.min}'{leg.bearing.sec.toFixed(0)}"</span>
                  </div>
                ))}
                <div className="text-[10px] text-[var(--accent)] text-right pt-1 border-t border-[var(--border-color)] font-mono">
                  TOTAL: {traverseTotal.toFixed(2)} m
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'leveling' && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-white uppercase tracking-wide">Leveling</h2>
            
            <div>
              <label htmlFor="level-station" className="text-[10px] text-[var(--text-muted)] mb-1 block">Station</label>
              <input id="level-station" value={lStation} onChange={e => setLStation(e.target.value)} placeholder="TP1" className={inputClass} />
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {(['BS', 'IS', 'FS'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setLType(type)}
                  className={`py-2 text-xs font-medium rounded ${
                    lType === type ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {lType && (
              <div className="space-y-2">
                <input
                  value={lReading}
                  onChange={e => setLReading(e.target.value)}
                  aria-label="Level staff reading" placeholder="Reading"
                  className={inputNumberClass}
                />
                <button onClick={() => {
                  if (!lStation || !lReading) return
                  const existing = lReadings.find((r) => r.station === lStation)
                  if (existing) {
                    setLReadings(lReadings.map((r) => 
                      r.id === existing.id ? { ...r, [lType.toLowerCase()]: parseFloat(lReading) } : r
                    ))
                  } else {
                    setLReadings([...lReadings, {
                      id: Date.now().toString(),
                      station: lStation,
                      [lType.toLowerCase()]: parseFloat(lReading)
                    }])
                  }
                  setLReading('')
                  setLStation('')
                }} className="w-full py-2 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black text-xs rounded">
                  Add {lType}
                </button>
              </div>
            )}

            {lReadings.length > 0 && (
              <div className="bg-[var(--bg-secondary)]/50 rounded overflow-x-auto text-[10px]">
                <table className="w-full min-w-[240px]">
                  <thead className="bg-[var(--bg-tertiary)]">
                    <tr>
                      <th className="px-2 py-1 text-left text-[var(--text-secondary)]">Stn</th>
                      <th className="px-2 py-1 text-right text-[var(--text-secondary)]">BS</th>
                      <th className="px-2 py-1 text-right text-[var(--text-secondary)]">IS</th>
                      <th className="px-2 py-1 text-right text-[var(--text-secondary)]">FS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lReadings.map((r, i) => (
                      <tr key={r.id} className="border-t border-[var(--border-color)]">
                        <td className="px-2 py-1 text-[var(--text-primary)]">{r.station}</td>
                        <td className="px-2 py-1 text-right font-mono text-[var(--text-primary)]">{r.bs?.toFixed(3) || ''}</td>
                        <td className="px-2 py-1 text-right font-mono text-[var(--text-primary)]">{r.is?.toFixed(3) || ''}</td>
                        <td className="px-2 py-1 text-right font-mono text-[var(--text-primary)]">{r.fs?.toFixed(3) || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'radiation' && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-white uppercase tracking-wide">Radiation</h2>
            
            <div>
              <label htmlFor="rad-station" className="text-[10px] text-[var(--text-muted)] mb-1 block">Instrument Station</label>
              <select id="rad-station" value={rStation} onChange={e => setRStation(e.target.value)} className={inputClass}>
                <option value="">Select...</option>
                {points.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="rad-inst-height" className="text-[10px] text-[var(--text-muted)] mb-1 block">Instrument Height (m)</label>
              <input id="rad-inst-height" value={rInstH} onChange={e => setRInstH(e.target.value)} placeholder="1.500" className={inputNumberClass} />
            </div>

            <div className="border-t border-[var(--border-color)] pt-3 mt-3">
              <label htmlFor="rad-point-name" className="text-[10px] text-[var(--text-muted)] mb-1 block">Point Name</label>
              <input id="rad-point-name" value={rNewName} onChange={e => setRNewName(e.target.value)} placeholder="P1" className={inputClass} />

              <div className="text-[10px] text-[var(--text-muted)] mb-1 block mt-2">Bearing</div>
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                <input value={rBearingDeg} onChange={e => setRBearingDeg(e.target.value)} aria-label="Bearing degrees" placeholder="000" className={`${inputClass} text-center text-sm`} />
                <input value={rBearingMin} onChange={e => setRBearingMin(e.target.value)} aria-label="Bearing minutes" placeholder="00" className={`${inputClass} text-center text-sm`} />
                <input value={rBearingSec} onChange={e => setRBearingSec(e.target.value)} aria-label="Bearing seconds" placeholder="00.0" className={`${inputClass} text-center font-mono text-sm`} />
              </div>

              <label htmlFor="rad-distance" className="text-[10px] text-[var(--text-muted)] mb-1 block">Distance (m)</label>
              <input id="rad-distance" value={rDist} onChange={e => setRDist(e.target.value)} placeholder="50.00" className={inputNumberClass} />

              <button
                onClick={() => {
                  if (!rNewName || !rDist || !rBearingDeg) return
                  setRPoints([...rPoints, {
                    id: Date.now().toString(),
                    pointName: rNewName,
                    bearing: { deg: rBearingDeg, min: rBearingMin, sec: rBearingSec },
                    distance: parseFloat(rDist)
                  }])
                  setRNewName('')
                  setRBearingDeg('')
                  setRBearingMin('')
                  setRBearingSec('')
                  setRDist('')
                }}
                className="w-full mt-2 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] text-xs rounded"
              >
                + Add Point
              </button>
            </div>

            {rPoints.length > 0 && (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {rPoints.map((p) => (
                  <div key={p.id} className="bg-[var(--bg-secondary)]/50 rounded px-2 py-1.5 flex justify-between items-center text-[10px]">
                    <span className="text-[var(--text-primary)]">{p.pointName}</span>
                    <span className="text-[var(--text-muted)] font-mono">
                      {p.bearing.deg}°{p.bearing.min}'{p.bearing.sec}"
                      <br />{p.distance.toFixed(1)}m
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'offline' && selectedProject && (
          <FieldBookMobile
            projectId={selectedProject}
            surveyType={projects.find(p => p.id === selectedProject)?.survey_type || 'General'}
            surveyorId={user?.id || ''}
          />
        )}

        {activeTab === 'offline' && !selectedProject && (
          <div className="flex flex-col items-center justify-center h-64 text-[var(--text-muted)]">
            <p className="text-sm">Select a project first to use offline field book</p>
          </div>
        )}

        {activeTab === 'map' && (
          <div className="space-y-3 h-full flex flex-col">
            <h2 className="text-xs font-semibold text-white uppercase tracking-wide">GPS Field Collection</h2>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => router.push('/field/map')} className="w-full py-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded text-xs font-bold text-center">Offline Maps</button>
              <button onClick={() => router.push('/field/collect')} className="w-full py-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded text-xs font-bold text-center">Collect Beacons</button>
              <button onClick={() => router.push('/field/walk')} className="w-full py-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded text-xs font-bold text-center">Walk Perimeter</button>
              <button onClick={() => router.push('/field/projects')} className="w-full py-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded text-xs font-bold text-center">Local Projects</button>
            </div>
            <div className="mt-4 p-4 rounded-xl bg-amber-900/30 border border-amber-700 text-amber-300 text-sm">
              <strong>Kenya Survey Regulations 1994:</strong> All GPS coordinates collected in the field must be verified against control beacons before submission. Field data is a draft — not a final survey.
            </div>
          </div>
        )}
      </main>

      {/* Bottom Tabs - hidden when MobileNav is present */}
      <div className="fixed bottom-0 left-0 right-0 bg-[var(--bg-secondary)] border-t border-[var(--border-color)] md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex">
          {renderTabButton('points', MapPin, 'Points')}
          {renderTabButton('traverse', RefreshCw, 'Traverse')}
          {renderTabButton('leveling', Scale, 'Level')}
          {renderTabButton('radiation', Radio, 'Rad')}
          {renderOfflineTabButton('offline', Upload, 'Offline')}
          {renderTabButton('map', MapPin, 'Map')}
        </div>
      </div>
    </div>
  )
}
