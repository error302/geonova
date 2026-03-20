'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { 
  MapPinIcon, 
  ArrowPathIcon, 
  ScaleIcon, 
  RadioIcon,
  XMarkIcon,
  PlusIcon
} from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid'

type Tab = 'points' | 'traverse' | 'leveling' | 'radiation'
type SyncStatus = 'synced' | 'pending' | 'offline'

const STORAGE_KEY = 'geonova_pending_observations'

export default function FieldPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [msg, setMsg] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('traverse')
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline')
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  
  // Points state
  const [points, setPoints] = useState<any[]>([])
  const [showBatch, setShowBatch] = useState(false)
  const [batchCSV, setBatchCSV] = useState('')
  const [batchParseResults, setBatchParseResults] = useState<any[]>([])
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
  const [tLegs, setTLegs] = useState<any[]>([])
  const [tTotal, setTTotal] = useState(0)

  // Leveling state
  const [lStation, setLStation] = useState('')
  const [lReading, setLReading] = useState('')
  const [lType, setLType] = useState<'BS' | 'IS' | 'FS'>('BS')
  const [lReadings, setLReadings] = useState<any[]>([])

  // Radiation state
  const [rStation, setRStation] = useState('')
  const [rInstH, setRInstH] = useState('1.500')
  const [rPoints, setRPoints] = useState<any[]>([])
  const [rNewName, setRNewName] = useState('')
  const [rBearingDeg, setRBearingDeg] = useState('')
  const [rBearingMin, setRBearingMin] = useState('')
  const [rBearingSec, setRBearingSec] = useState('')
  const [rDist, setRDist] = useState('')

  const supabase = createClient()

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        localStorage.setItem('auth:redirect', '/field')
        router.push('/login')
        return
      }
      setUser(user)
      setLoading(false)
      fetchProjects(user.id)
      fetchProjectPoints(selectedProject)
    }
    checkAuth()
  }, [router, supabase, selectedProject])

  useEffect(() => {
    if (!user) return
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null)
        router.push('/login')
      } else {
        setUser(session.user)
      }
    })
    return () => subscription.unsubscribe()
  }, [user, supabase, router])

  const fetchProjects = async (userId: string) => {
    const { data } = await supabase
      .from('projects')
      .select('id, name')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (data) setProjects(data)
  }

  const fetchProjectPoints = async (projectId: string) => {
    if (!projectId) return
    const { data } = await supabase
      .from('survey_points')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    if (data) setPoints(data)
  }

  // Point batch parser
  const parseBatchCSV = () => {
    const lines = batchCSV.trim().split('\n')
    const results: any[] = []
    const errors: string[] = []
    let lineNum = 0

    for (const line of lines) {
      lineNum++
      const parts = line.split(',').map(p => p.trim())
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
      await supabase.from('survey_points').insert(
        batchParseResults.map(p => ({ ...p, project_id: selectedProject }))
      )
      setBatchCSV('')
      setBatchParseResults([])
      setBatchErrors([])
      setShowBatch(false)
      fetchProjectPoints(selectedProject)
      setMsg(`✓ Saved ${batchParseResults.length} points successfully`)
    } catch (e: any) {
      setMsg('Error: ' + e.message)
    }
  }

  // Single point save
  const savePoint = async () => {
    if (!pName || !pE || !pN || !selectedProject) return

    try {
      await supabase.from('survey_points').insert({
        name: pName,
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
      console.error(e)
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

  const renderTabButton = (tab: Tab, Icon: any, label: string) => (
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
            <h1 className="text-sm font-bold text-white">{t('field.fieldMode')}</h1>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-2 py-1 text-xs text-[var(--text-primary)] w-36"
            >
              <option value="">Select Project</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            {syncStatus === 'synced' && <CheckCircleSolidIcon className="w-4 h-4 text-green-400" />}
            {syncStatus === 'pending' && <ArrowPathIcon className="w-4 h-4 text-yellow-400 animate-spin" />}
            {syncStatus === 'offline' && <XMarkIcon className="w-4 h-4 text-[var(--text-muted)]" />}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-3 pb-20">
        <div className="mb-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)]/20 p-3">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Workflow</div>
          <div className="text-sm text-[var(--text-primary)] mt-1">Field Mode = quick capture (phone/tablet). Field Book = textbook tables + checks + exports.</div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => router.push('/fieldbook')}
              className="text-[10px] bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] px-2 py-1.5 rounded"
            >
              Open Field Book
            </button>
            <button
              onClick={() => router.push('/guide')}
              className="text-[10px] bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] px-2 py-1.5 rounded"
            >
              Field Guides
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
                {showBatch ? t('common.close') : <><PlusIcon className="w-3 h-3" /> {t('field.batchCSV')}</>}
              </button>
            </div>

            {/* Batch CSV input */}
            {showBatch && (
              <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded p-3 space-y-2">
                <div>
                  <label className="text-[10px] text-[var(--text-muted)]">CSV: Name, Easting, Northing, Elevation (optional)</label>
                  <textarea
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
                    {batchErrors.map((e, i) => <div key={i}>{e}</div>)}
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
<label className="text-[10px] text-[var(--text-muted)] mb-1 block">{t('field.name')}</label>
              <input value={pName} onChange={e => setPName(e.target.value)} placeholder="P1" className={inputNumberClass} />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-muted)] mb-1 block">{t('common.easting')}</label>
              <input value={pE} onChange={e => setPE(e.target.value)} placeholder="500000" className={inputNumberClass} />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-muted)] mb-1 block">{t('common.northing')}</label>
              <input value={pN} onChange={e => setPN(e.target.value)} placeholder="4500000" className={inputNumberClass} />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-muted)] mb-1 block">{t('common.elevation')}</label>
              <input value={pZ} onChange={e => setPZ(e.target.value)} placeholder="0" className={inputNumberClass} />
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
                {points.slice(0, 5).map(p => (
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
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[var(--text-muted)] mb-1 block">{t('field.traverse')} →</label>
                <input value={tStation} onChange={e => setTStation(e.target.value)} placeholder="B" className={inputClass} />
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-muted)] mb-1 block">{t('field.distance')}</label>
                <input value={tDist} onChange={e => setTDist(e.target.value)} placeholder="100.00" className={inputNumberClass} />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-[var(--text-muted)] mb-1 block">{t('field.bearing')} (DMS)</label>
              <div className="grid grid-cols-3 gap-1.5">
                <input 
                  value={tDeg} 
                  onChange={e => setTDeg(e.target.value)} 
                  placeholder="000" 
                  className={`${inputClass} text-center text-sm`} 
                />
                <input 
                  value={tMin} 
                  onChange={e => setTMin(e.target.value)} 
                  placeholder="00" 
                  className={`${inputClass} text-center text-sm`} 
                />
                <input 
                  value={tSec} 
                  onChange={e => setTSec(e.target.value)} 
                  placeholder="00.0" 
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
              <label className="text-[10px] text-[var(--text-muted)] mb-1 block">Station</label>
              <input value={lStation} onChange={e => setLStation(e.target.value)} placeholder="TP1" className={inputClass} />
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {(['BS', 'IS', 'FS'] as const).map(type => (
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
                  placeholder="Reading"
                  className={inputNumberClass}
                />
                <button onClick={() => {
                  if (!lStation || !lReading) return
                  const existing = lReadings.find(r => r.station === lStation)
                  if (existing) {
                    setLReadings(lReadings.map(r => 
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
              <div className="bg-[var(--bg-secondary)]/50 rounded overflow-hidden text-[10px]">
                <table className="w-full">
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
              <label className="text-[10px] text-[var(--text-muted)] mb-1 block">Instrument Station</label>
              <select value={rStation} onChange={e => setRStation(e.target.value)} className={inputClass}>
                <option value="">Select...</option>
                {points.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-[var(--text-muted)] mb-1 block">Instrument Height (m)</label>
              <input value={rInstH} onChange={e => setRInstH(e.target.value)} placeholder="1.500" className={inputNumberClass} />
            </div>

            <div className="border-t border-[var(--border-color)] pt-3 mt-3">
              <label className="text-[10px] text-[var(--text-muted)] mb-1 block">Point Name</label>
              <input value={rNewName} onChange={e => setRNewName(e.target.value)} placeholder="P1" className={inputClass} />

              <label className="text-[10px] text-[var(--text-muted)] mb-1 block mt-2">Bearing</label>
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                <input value={rBearingDeg} onChange={e => setRBearingDeg(e.target.value)} placeholder="000" className={`${inputClass} text-center text-sm`} />
                <input value={rBearingMin} onChange={e => setRBearingMin(e.target.value)} placeholder="00" className={`${inputClass} text-center text-sm`} />
                <input value={rBearingSec} onChange={e => setRBearingSec(e.target.value)} placeholder="00.0" className={`${inputClass} text-center font-mono text-sm`} />
              </div>

              <label className="text-[10px] text-[var(--text-muted)] mb-1 block">Distance (m)</label>
              <input value={rDist} onChange={e => setRDist(e.target.value)} placeholder="50.00" className={inputNumberClass} />

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
                {rPoints.map(p => (
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
      </main>

      {/* Bottom Tabs */}
      <div className="fixed bottom-0 left-0 right-0 bg-[var(--bg-secondary)] border-t border-[var(--border-color)]">
        <div className="flex">
          {renderTabButton('points', MapPinIcon, 'Points')}
          {renderTabButton('traverse', ArrowPathIcon, 'Traverse')}
          {renderTabButton('leveling', ScaleIcon, 'Level')}
          {renderTabButton('radiation', RadioIcon, 'Rad')}
        </div>
      </div>
    </div>
  )
}
