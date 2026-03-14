'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  MapPinIcon, 
  ArrowPathIcon, 
  ScaleIcon, 
  RadioIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolidIcon, ArrowPathIcon as SpinnerIcon } from '@heroicons/react/24/solid'
import { queueOperation, getPendingOperations, syncPendingOperations, isOnline, setupOnlineListener } from '@/lib/offline/syncQueue'

type Tab = 'points' | 'traverse' | 'leveling' | 'radiation'
type SyncStatus = 'synced' | 'pending' | 'offline'

interface PendingObservation {
  id: string
  type: Tab
  data: any
  timestamp: number
}

interface TraverseLeg {
  id: string
  fromStation: string
  toStation: string
  distance: number
  bearing: { deg: number; min: number; sec: number }
}

interface LevelingReading {
  id: string
  station: string
  bs?: number
  is?: number
  fs?: number
}

interface RadiationPoint {
  id: string
  pointName: string
  bearing: { deg: number; min: number; sec: number }
  distance: number
}

const STORAGE_KEY = 'geonova_pending_observations'
const LAST_POINT_KEY = 'geonova_last_point'

export default function FieldPage() {
  const [activeTab, setActiveTab] = useState<Tab>('points')
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline')
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [projectPoints, setProjectPoints] = useState<any[]>([])
  const supabase = createClient()

  const [lastPoints, setLastPoints] = useState<any[]>([])
  const [nextPointNum, setNextPointNum] = useState(1)
  const [pointSaved, setPointSaved] = useState(false)

  // Point form state
  const [pointName, setPointName] = useState('')
  const [pointEasting, setPointEasting] = useState('')
  const [pointNorthing, setPointNorthing] = useState('')
  const [pointElevation, setPointElevation] = useState('')
  const [isControl, setIsControl] = useState(false)

  // Traverse state
  const [traverseStation, setTraverseStation] = useState('')
  const [traverseDistance, setTraverseDistance] = useState('')
  const [traverseBearingDeg, setTraverseBearingDeg] = useState('')
  const [traverseBearingMin, setTraverseBearingMin] = useState('')
  const [traverseBearingSec, setTraverseBearingSec] = useState('')
  const [traverseLegs, setTraverseLegs] = useState<TraverseLeg[]>([])
  const [traverseTotal, setTraverseTotal] = useState(0)

  // Leveling state
  const [levelingStation, setLevelingStation] = useState('')
  const [levelingReadings, setLevelingReadings] = useState<LevelingReading[]>([])
  const [levelingHI, setLevelingHI] = useState<number | null>(null)
  const [levelingFirstRL, setLevelingFirstRL] = useState<number | null>(null)
  const [levelingArithmeticCheck, setLevelingArithmeticCheck] = useState<{ passed: boolean; diff: number } | null>(null)
  const [pendingReading, setPendingReading] = useState<{ type: 'BS' | 'IS' | 'FS'; value: string } | null>(null)

  // Radiation state
  const [radiationStation, setRadiationStation] = useState('')
  const [radiationInstHeight, setRadiationInstHeight] = useState('')
  const [radiationPoints, setRadiationPoints] = useState<RadiationPoint[]>([])
  const [newRadPointName, setNewRadPointName] = useState('')
  const [newRadBearingDeg, setNewRadBearingDeg] = useState('')
  const [newRadBearingMin, setNewRadBearingMin] = useState('')
  const [newRadBearingSec, setNewRadBearingSec] = useState('')
  const [newRadDistance, setNewRadDistance] = useState('')

  useEffect(() => {
    checkOnlineStatus()
    loadPendingFromIndexedDB()
    loadLastPointInfo()
    fetchProjects()
    
    setupOnlineListener(async () => {
      setSyncStatus('pending')
      const results = await syncPendingOperations(supabase)
      if (results.synced > 0) {
        setSyncStatus('synced')
      }
    })
  }, [])

  const checkOnlineStatus = async () => {
    const online = isOnline()
    setSyncStatus(online ? 'synced' : 'offline')
    
    if (online) {
      const pending = await getPendingOperations()
      if (pending.length > 0) {
        setSyncStatus('pending')
        const results = await syncPendingOperations(supabase)
        if (results.synced > 0) {
          setSyncStatus('synced')
        }
      }
    }
  }

  const loadPendingFromIndexedDB = async () => {
    try {
      const pending = await getPendingOperations()
      if (pending.length > 0) {
        setSyncStatus('pending')
      }
    } catch (e) {
      console.error('Error loading pending from IndexedDB:', e)
    }
  }

  const loadLastPointInfo = () => {
    try {
      const stored = localStorage.getItem(LAST_POINT_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        setLastPoints(data.lastPoints || [])
        setNextPointNum(data.nextPointNum || 1)
      }
    } catch (e) {
      console.error('Error loading last point info:', e)
    }
  }

  const saveLastPointInfo = (points: any[]) => {
    const newNext = points.length > 0 ? 
      Math.max(...points.map(p => {
        const num = parseInt(p.name.replace(/[^0-9]/g, ''))
        return isNaN(num) ? 0 : num
      })) + 1 : nextPointNum
    
    try {
      localStorage.setItem(LAST_POINT_KEY, JSON.stringify({
        lastPoints: points.slice(-3),
        nextPointNum: newNext
      }))
    } catch (e) {
      console.error('Error saving last point info:', e)
    }
  }

  const fetchProjects = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (data) {
      setProjects(data)
      if (data.length > 0) {
        setSelectedProject(data[0].id)
        fetchProjectPoints(data[0].id)
      }
    }
  }

  const fetchProjectPoints = async (projectId: string) => {
    const { data } = await supabase
      .from('survey_points')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (data) {
      setProjectPoints(data)
    }
  }

  const savePendingObservation = async (type: Tab, data: any) => {
    try {
      if (selectedProject) {
        await queueOperation({
          type: 'INSERT',
          table: 'survey_points',
          data: { project_id: selectedProject, ...data },
          timestamp: new Date().toISOString(),
          projectId: selectedProject
        })
      }
      
      const stored = localStorage.getItem(STORAGE_KEY)
      const pending: PendingObservation[] = stored ? JSON.parse(stored) : []
      
      pending.push({
        id: Date.now().toString(),
        type,
        data,
        timestamp: Date.now()
      })
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pending))
      setSyncStatus('pending')
    } catch (e) {
      console.error('Error saving pending observation:', e)
    }
  }

  const syncToSupabase = async () => {
    if (!selectedProject) {
      alert('Please select a project first')
      return
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const pending: PendingObservation[] = stored ? JSON.parse(stored) : []
      
      if (pending.length === 0) {
        alert('No pending observations to sync')
        return
      }

      for (const obs of pending) {
        if (obs.type === 'points' && obs.data) {
          await supabase.from('survey_points').insert({
            project_id: selectedProject,
            name: obs.data.name,
            easting: obs.data.easting,
            northing: obs.data.northing,
            elevation: obs.data.elevation || null,
            is_control: obs.data.is_control || false
          })
        }
      }

      localStorage.removeItem(STORAGE_KEY)
      setSyncStatus('synced')
      alert(`Synced ${pending.length} observation(s)`)
      fetchProjectPoints(selectedProject)
    } catch (e) {
      console.error('Error syncing:', e)
      alert('Error syncing observations')
    }
  }

  const handleSavePoint = async () => {
    if (!pointName || !pointEasting || !pointNorthing) {
      alert('Please fill in point name, easting, and northing')
      return
    }

    const point = {
      name: pointName,
      easting: parseFloat(pointEasting),
      northing: parseFloat(pointNorthing),
      elevation: pointElevation ? parseFloat(pointElevation) : null,
      is_control: isControl
    }

    const newLastPoints = [...lastPoints, { ...point, id: Date.now() }].slice(-3)
    setLastPoints(newLastPoints)
    saveLastPointInfo(newLastPoints)

    if (navigator.onLine && selectedProject) {
      try {
        await supabase.from('survey_points').insert({
          project_id: selectedProject,
          ...point
        })
        fetchProjectPoints(selectedProject)
      } catch (e) {
        savePendingObservation('points', point)
      }
    } else {
      savePendingObservation('points', point)
    }

    setPointSaved(true)
    setTimeout(() => {
      setPointSaved(false)
      setPointName(`P${nextPointNum}`)
      setNextPointNum(prev => prev + 1)
      setPointEasting('')
      setPointNorthing('')
      setPointElevation('')
      setIsControl(false)
    }, 1000)
  }

  const handleAddTraverseLeg = () => {
    if (!traverseStation || !traverseDistance || !traverseBearingDeg) {
      alert('Please fill in station, distance, and bearing')
      return
    }

    const newLeg: TraverseLeg = {
      id: Date.now().toString(),
      fromStation: traverseLegs.length > 0 ? traverseLegs[traverseLegs.length - 1].toStation : traverseStation,
      toStation: traverseStation,
      distance: parseFloat(traverseDistance),
      bearing: {
        deg: parseInt(traverseBearingDeg) || 0,
        min: parseInt(traverseBearingMin) || 0,
        sec: parseFloat(traverseBearingSec) || 0
      }
    }

    const newLegs = [...traverseLegs, newLeg]
    setTraverseLegs(newLegs)
    setTraverseTotal(prev => prev + newLeg.distance)

    setTraverseDistance('')
    setTraverseBearingDeg('')
    setTraverseBearingMin('')
    setTraverseBearingSec('')
  }

  const handleAddLevelingReading = () => {
    if (!levelingStation) {
      alert('Please enter station name')
      return
    }

    if (!pendingReading) {
      alert('Please tap BS, IS, or FS first')
      return
    }

    const existingIndex = levelingReadings.findIndex(r => r.station === levelingStation)
    
    if (existingIndex >= 0) {
      const newReadings = [...levelingReadings]
      if (pendingReading.type === 'BS') newReadings[existingIndex].bs = parseFloat(pendingReading.value)
      if (pendingReading.type === 'IS') newReadings[existingIndex].is = parseFloat(pendingReading.value)
      if (pendingReading.type === 'FS') newReadings[existingIndex].fs = parseFloat(pendingReading.value)
      setLevelingReadings(newReadings)
    } else {
      const newReading: LevelingReading = {
        id: Date.now().toString(),
        station: levelingStation,
        [pendingReading.type.toLowerCase()]: parseFloat(pendingReading.value)
      }
      setLevelingReadings([...levelingReadings, newReading])
    }

    computeLevelingResults()
    setPendingReading(null)
    setLevelingStation('')
  }

  const computeLevelingResults = () => {
    if (levelingReadings.length === 0) return

    let hi: number | null = null
    let rl: number | null = null

    const readings = [...levelingReadings].sort((a, b) => a.id.localeCompare(b.id))

    for (let i = 0; i < readings.length; i++) {
      const r = readings[i]
      
      if (r.bs !== undefined && hi === null && rl !== null) {
        hi = rl + r.bs
        setLevelingHI(hi)
      } else if (r.fs !== undefined && hi !== null) {
        rl = hi - r.fs;
        (r as any).rl = rl
        
        if (i === 0) {
          setLevelingFirstRL(rl)
        }
      } else if (r.bs !== undefined && hi === null) {
        rl = r.bs;
        (r as any).rl = rl
        setLevelingFirstRL(rl)
      }
    }

    if (levelingFirstRL !== null && readings.length >= 2) {
      const lastReading = readings[readings.length - 1]
      if ((lastReading as any).rl !== undefined) {
        const sumBS = readings.reduce((sum, r) => sum + (r.bs || 0), 0)
        const sumFS = readings.reduce((sum, r) => sum + (r.fs || 0), 0)
        const diff = sumBS - sumFS
        const lastRL = (lastReading as any).rl
        const expectedDiff = lastRL - levelingFirstRL
        
        setLevelingArithmeticCheck({
          passed: Math.abs(diff - expectedDiff) < 0.001,
          diff: diff - expectedDiff
        })
      }
    }
  }

  const handleAddRadiationPoint = () => {
    if (!newRadPointName || !newRadDistance || !newRadBearingDeg) {
      alert('Please fill in point name, bearing, and distance')
      return
    }

    const newPoint: RadiationPoint = {
      id: Date.now().toString(),
      pointName: newRadPointName,
      bearing: {
        deg: parseInt(newRadBearingDeg) || 0,
        min: parseInt(newRadBearingMin) || 0,
        sec: parseFloat(newRadBearingSec) || 0
      },
      distance: parseFloat(newRadDistance)
    }

    setRadiationPoints([...radiationPoints, newPoint])
    setNewRadPointName('')
    setNewRadBearingDeg('')
    setNewRadBearingMin('')
    setNewRadBearingSec('')
    setNewRadDistance('')
  }

  const renderTabButton = (tab: Tab, Icon: React.ComponentType<{ className?: string }>, label: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex-1 py-3 px-2 text-sm font-medium transition-all flex flex-col items-center gap-1.5 ${
        activeTab === tab 
          ? 'text-[#E8841A]' 
          : 'text-gray-500 hover:text-gray-300'
      }`}
    >
      <Icon className={`w-6 h-6 ${activeTab === tab ? 'stroke-2' : 'stroke-1.5'}`} />
      <span className="text-xs">{label}</span>
    </button>
  )

  const renderInput = (value: string, onChange: (v: string) => void, placeholder: string, keyboard?: string) => (
    <input
      type={keyboard || 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 text-base focus:border-[#E8841A] focus:outline-none focus:ring-1 focus:ring-[#E8841A] transition-all min-h-[48px]"
    />
  )

  const renderNumberInput = (value: string, onChange: (v: string) => void, placeholder: string) => (
    <input
      type="number"
      step="0.001"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 text-base focus:border-[#E8841A] focus:outline-none focus:ring-1 focus:ring-[#E8841A] transition-all min-h-[48px] font-mono"
    />
  )

  const renderSyncButton = () => {
    const baseClass = "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
    const statusClasses = {
      synced: `${baseClass} bg-green-900/30 text-green-400 border border-green-800`,
      pending: `${baseClass} bg-yellow-900/30 text-yellow-400 border border-yellow-800 animate-pulse`,
      offline: `${baseClass} bg-gray-800 text-gray-400 border border-gray-700`
    }
    
    const icons = {
      synced: <CheckCircleSolidIcon className="w-4 h-4" />,
      pending: <ArrowPathIcon className="w-4 h-4 animate-spin" />,
      offline: <XMarkIcon className="w-4 h-4" />
    }

    const labels = {
      synced: 'Synced',
      pending: 'Syncing...',
      offline: 'Offline'
    }

    return (
      <button onClick={syncToSupabase} className={statusClasses[syncStatus]}>
        {icons[syncStatus]}
        {labels[syncStatus]}
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      {/* Header */}
      <header className="bg-[#111118] border-b border-gray-800/50 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">Field Mode</h1>
            <span className="px-2 py-1 text-xs font-mono bg-gray-800 text-gray-400 rounded">v1.0</span>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedProject}
              onChange={(e) => {
                setSelectedProject(e.target.value)
                if (e.target.value) fetchProjectPoints(e.target.value)
              }}
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:border-[#E8841A] focus:outline-none focus:ring-1 focus:ring-[#E8841A] min-w-[160px]"
            >
              <option value="">Select Project</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {renderSyncButton()}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 pb-24">
        {activeTab === 'points' && (
          <div className="space-y-6">
            <div className="bg-[#111118] border border-gray-800/50 rounded-xl p-5 space-y-5">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <MapPinIcon className="w-5 h-5 text-[#E8841A]" />
                Record Point
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Point Name</label>
                  {renderInput(pointName, setPointName, 'P1')}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Easting (m)</label>
                    {renderNumberInput(pointEasting, setPointEasting, '500000.0000')}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Northing (m)</label>
                    {renderNumberInput(pointNorthing, setPointNorthing, '4500000.0000')}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Elevation (m) - Optional</label>
                  {renderNumberInput(pointElevation, setPointElevation, '0.000')}
                </div>

                <div className="flex items-center justify-between py-3 px-4 bg-gray-900/50 rounded-lg border border-gray-800">
                  <span className="text-sm font-medium text-gray-300">Control Point</span>
                  <button
                    onClick={() => setIsControl(!isControl)}
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      isControl ? 'bg-[#E8841A]' : 'bg-gray-700'
                    }`}
                    aria-pressed={isControl}
                  >
                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      isControl ? 'left-6' : 'left-1'
                    }`} />
                  </button>
                </div>

                <button
                  onClick={handleSavePoint}
                  disabled={pointSaved}
                  className={`w-full py-4 rounded-lg font-semibold text-base transition-all ${
                    pointSaved 
                      ? 'bg-green-600 text-white' 
                      : 'bg-[#E8841A] hover:bg-[#d67715] text-black active:scale-[0.98]'
                  }`}
                >
                  {pointSaved ? (
                    <span className="flex items-center justify-center gap-2">
                      <CheckCircleSolidIcon className="w-5 h-5" />
                      Saved!
                    </span>
                  ) : 'Save Point'}
                </button>
              </div>
            </div>

            {lastPoints.length > 0 && (
              <div className="bg-[#111118] border border-gray-800/50 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-medium text-gray-400">Recent Points</h3>
                <div className="space-y-2.5">
                  {lastPoints.map((p, i) => (
                    <div key={i} className="bg-gray-900/50 rounded-lg p-3 flex justify-between items-center border border-gray-800/30">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-gray-100">{p.name}</span>
                        {p.is_control && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-[#E8841A]/20 text-[#E8841A] rounded">CTRL</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        {p.easting.toFixed(2)}, {p.northing.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'traverse' && (
          <div className="space-y-6">
            <div className="bg-[#111118] border border-gray-800/50 rounded-xl p-5 space-y-5">
               <h2 className="text-base font-semibold text-white flex items-center gap-2">
                 <ArrowPathIcon className="w-5 h-5 text-[#E8841A]" />
                 Traverse Leg
               </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">To Station</label>
                  {renderInput(traverseStation, setTraverseStation, 'Station B')}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Distance (m)</label>
                  {renderNumberInput(traverseDistance, setTraverseDistance, '100.00')}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Bearing</label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <input
                        type="number"
                        min="0"
                        max="360"
                        value={traverseBearingDeg}
                        onChange={(e) => setTraverseBearingDeg(e.target.value)}
                        placeholder="000"
                        className="w-full px-3 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 text-center focus:border-[#E8841A] focus:outline-none focus:ring-1 focus:ring-[#E8841A]"
                      />
                      <div className="text-center text-xs text-gray-500">DEG</div>
                    </div>
                    <div className="space-y-1.5">
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={traverseBearingMin}
                        onChange={(e) => setTraverseBearingMin(e.target.value)}
                        placeholder="00"
                        className="w-full px-3 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 text-center focus:border-[#E8841A] focus:outline-none focus:ring-1 focus:ring-[#E8841A]"
                      />
                      <div className="text-center text-xs text-gray-500">MIN</div>
                    </div>
                    <div className="space-y-1.5">
                      <input
                        type="number"
                        min="0"
                        max="59.999"
                        step="0.001"
                        value={traverseBearingSec}
                        onChange={(e) => setTraverseBearingSec(e.target.value)}
                        placeholder="00.000"
                        className="w-full px-3 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 text-center focus:border-[#E8841A] focus:outline-none focus:ring-1 focus:ring-[#E8841A] font-mono"
                      />
                      <div className="text-center text-xs text-gray-500">SEC</div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleAddTraverseLeg}
                  className="w-full py-3.5 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-lg text-gray-200 font-medium transition-all"
                >
                  + Add Leg
                </button>
              </div>
            </div>

            {traverseLegs.length > 0 && (
              <div className="bg-[#111118] border border-gray-800/50 rounded-xl p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-medium text-gray-400">Traverse Legs</h3>
                  <span className="text-[#E8841A] font-mono font-medium">
                    Total: {traverseTotal.toFixed(2)} m
                  </span>
                </div>
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {traverseLegs.map((leg, i) => (
                    <div key={leg.id} className="bg-gray-900/50 rounded-lg p-3 flex justify-between items-center border border-gray-800/30">
                      <div className="text-sm flex items-center gap-2">
                        <span className="text-gray-500 font-mono text-xs">#{i + 1}</span>
                        <span className="text-gray-400">{leg.fromStation}</span>
                        <span className="text-gray-600">→</span>
                        <span className="text-gray-100 font-medium">{leg.toStation}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-gray-100 text-sm">{leg.distance.toFixed(2)} m</div>
                        <div className="text-xs text-gray-500 font-mono">
                          {leg.bearing.deg}°{leg.bearing.min}'{leg.bearing.sec.toFixed(1)}"
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'leveling' && (
          <div className="space-y-6">
            <div className="bg-[#111118] border border-gray-800/50 rounded-xl p-5 space-y-5">
               <h2 className="text-base font-semibold text-white flex items-center gap-2">
                 <ScaleIcon className="w-5 h-5 text-[#E8841A]" />
                 Leveling
               </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Station</label>
                  {renderInput(levelingStation, setLevelingStation, 'TP1')}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setPendingReading({ type: 'BS', value: '' })}
                    className={`py-4 rounded-lg font-semibold transition-all ${
                      pendingReading?.type === 'BS' 
                        ? 'bg-[#E8841A] text-black shadow-lg shadow-[#E8841A]/25' 
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    BS
                  </button>
                  <button
                    onClick={() => setPendingReading({ type: 'IS', value: '' })}
                    className={`py-4 rounded-lg font-semibold transition-all ${
                      pendingReading?.type === 'IS' 
                        ? 'bg-[#E8841A] text-black shadow-lg shadow-[#E8841A]/25' 
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    IS
                  </button>
                  <button
                    onClick={() => setPendingReading({ type: 'FS', value: '' })}
                    className={`py-4 rounded-lg font-semibold transition-all ${
                      pendingReading?.type === 'FS' 
                        ? 'bg-[#E8841A] text-black shadow-lg shadow-[#E8841A]/25' 
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    FS
                  </button>
                </div>

                {pendingReading && (
                  <div className="space-y-3 p-4 bg-gray-900/50 rounded-lg border border-gray-800">
                    <label className="block text-sm font-medium text-gray-400">
                      Enter {pendingReading.type} reading (m)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={pendingReading.value}
                      onChange={(e) => setPendingReading({ ...pendingReading, value: e.target.value })}
                      placeholder="0.000"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 text-lg focus:border-[#E8841A] focus:outline-none focus:ring-1 focus:ring-[#E8841A] font-mono"
                      autoFocus
                    />
                    <button
                      onClick={handleAddLevelingReading}
                      className="w-full py-3 bg-[#E8841A] hover:bg-[#d67715] active:bg-[#c06612] rounded-lg text-black font-medium transition-all"
                    >
                      Add Reading
                    </button>
                  </div>
                )}
              </div>
            </div>

            {levelingReadings.length > 0 && (
              <div className="bg-[#111118] border border-gray-800/50 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-medium text-gray-400">Observations</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Station</th>
                        <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">BS</th>
                        <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">IS</th>
                        <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">FS</th>
                        <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">HI</th>
                        <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">RL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {levelingReadings.map((r, i) => (
                        <tr key={r.id} className="border-b border-gray-800/30 hover:bg-gray-900/30 transition-colors">
                          <td className="px-3 py-2.5 text-gray-100 font-medium">{r.station}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-300">
                            {r.bs !== undefined ? r.bs.toFixed(3) : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-300">
                            {r.is !== undefined ? r.is.toFixed(3) : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-300">
                            {r.fs !== undefined ? r.fs.toFixed(3) : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-300">
                            {i === 0 && levelingHI ? levelingHI.toFixed(3) : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-300">
                            {(r as any).rl?.toFixed(3) || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {levelingArithmeticCheck && (
              <div className={`p-4 rounded-xl border ${
                levelingArithmeticCheck.passed 
                  ? 'bg-green-900/20 border-green-800' 
                  : 'bg-red-900/20 border-red-800'
              }`}>
                <div className="flex items-center gap-2">
                  {levelingArithmeticCheck.passed ? (
                    <CheckCircleSolidIcon className="w-5 h-5 text-green-400" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-red-400 flex items-center justify-center">
                      <span className="text-red-400 text-xs">!</span>
                    </div>
                  )}
                  <span className={`font-medium ${levelingArithmeticCheck.passed ? 'text-green-400' : 'text-red-400'}`}>
                    Arithmetic Check {levelingArithmeticCheck.passed ? 'Passed' : 'Failed'}
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-1.5 font-mono">
                  Difference: {Math.abs(levelingArithmeticCheck.diff).toFixed(4)} m
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'radiation' && (
          <div className="space-y-6">
            <div className="bg-[#111118] border border-gray-800/50 rounded-xl p-5 space-y-5">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <RadioIcon className="w-5 h-5 text-[#E8841A]" />
                Radiation Setup
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Instrument Station</label>
                  <select
                    value={radiationStation}
                    onChange={(e) => setRadiationStation(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:border-[#E8841A] focus:outline-none focus:ring-1 focus:ring-[#E8841A]"
                  >
                    <option value="">Select station...</option>
                    {projectPoints.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Instrument Height (m)</label>
                  {renderNumberInput(radiationInstHeight, setRadiationInstHeight, '1.500')}
                </div>

                <div className="border-t border-gray-800 pt-5 mt-5">
                  <h3 className="text-sm font-medium text-gray-400 mb-4">New Observation</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-2">Point Name</label>
                      {renderInput(newRadPointName, setNewRadPointName, 'P1')}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-2">Bearing</label>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <input
                            type="number"
                            min="0"
                            max="360"
                            value={newRadBearingDeg}
                            onChange={(e) => setNewRadBearingDeg(e.target.value)}
                            placeholder="000"
                            className="w-full px-3 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 text-center focus:border-[#E8841A] focus:outline-none focus:ring-1 focus:ring-[#E8841A]"
                          />
                          <div className="text-center text-xs text-gray-500">DEG</div>
                        </div>
                        <div className="space-y-1.5">
                          <input
                            type="number"
                            min="0"
                            max="59"
                            value={newRadBearingMin}
                            onChange={(e) => setNewRadBearingMin(e.target.value)}
                            placeholder="00"
                            className="w-full px-3 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 text-center focus:border-[#E8841A] focus:outline-none focus:ring-1 focus:ring-[#E8841A]"
                          />
                          <div className="text-center text-xs text-gray-500">MIN</div>
                        </div>
                        <div className="space-y-1.5">
                          <input
                            type="number"
                            min="0"
                            max="59.999"
                            step="0.001"
                            value={newRadBearingSec}
                            onChange={(e) => setNewRadBearingSec(e.target.value)}
                            placeholder="00.0"
                            className="w-full px-3 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 text-center focus:border-[#E8841A] focus:outline-none focus:ring-1 focus:ring-[#E8841A] font-mono"
                          />
                          <div className="text-center text-xs text-gray-500">SEC</div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-2">Distance (m)</label>
                      {renderNumberInput(newRadDistance, setNewRadDistance, '50.00')}
                    </div>

                    <button
                      onClick={handleAddRadiationPoint}
                      className="w-full py-3 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-lg text-gray-200 font-medium transition-all"
                    >
                      + Add Point
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {radiationPoints.length > 0 && (
              <div className="bg-[#111118] border border-gray-800/50 rounded-xl p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-medium text-gray-400">Observed Points</h3>
                  <span className="text-xs font-mono text-gray-500 bg-gray-900 px-2 py-1 rounded">
                    {radiationPoints.length}
                  </span>
                </div>
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {radiationPoints.map(p => (
                    <div key={p.id} className="bg-gray-900/50 rounded-lg p-3 flex justify-between items-center border border-gray-800/30">
                      <span className="font-mono text-sm text-gray-100">{p.pointName}</span>
                      <div className="text-right text-xs text-gray-500 font-mono">
                        <div>{p.bearing.deg}°{p.bearing.min}'{p.bearing.sec.toFixed(1)}"</div>
                        <div className="text-gray-300">{p.distance.toFixed(2)} m</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#111118] border-t border-gray-800/50 safe-area-bottom">
        <div className="flex">
          {renderTabButton('points', MapPinIcon, 'Points')}
          {renderTabButton('traverse', ArrowPathIcon, 'Traverse')}
           {renderTabButton('leveling', ScaleIcon, 'Leveling')}
          {renderTabButton('radiation', RadioIcon, 'Radiation')}
        </div>
      </div>
    </div>
  )
}
