'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

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

  const [pointName, setPointName] = useState('')
  const [pointEasting, setPointEasting] = useState('')
  const [pointNorthing, setPointNorthing] = useState('')
  const [pointElevation, setPointElevation] = useState('')
  const [isControl, setIsControl] = useState(false)
  const [pointSaved, setPointSaved] = useState(false)

  const [traverseStation, setTraverseStation] = useState('')
  const [traverseDistance, setTraverseDistance] = useState('')
  const [traverseBearingDeg, setTraverseBearingDeg] = useState('')
  const [traverseBearingMin, setTraverseBearingMin] = useState('')
  const [traverseBearingSec, setTraverseBearingSec] = useState('')
  const [traverseLegs, setTraverseLegs] = useState<TraverseLeg[]>([])
  const [traverseTotal, setTraverseTotal] = useState(0)

  const [levelingStation, setLevelingStation] = useState('')
  const [levelingReadings, setLevelingReadings] = useState<LevelingReading[]>([])
  const [levelingHI, setLevelingHI] = useState<number | null>(null)
  const [levelingFirstRL, setLevelingFirstRL] = useState<number | null>(null)
  const [levelingArithmeticCheck, setLevelingArithmeticCheck] = useState<{ passed: boolean; diff: number } | null>(null)
  const [pendingReading, setPendingReading] = useState<{ type: 'BS' | 'IS' | 'FS'; value: string } | null>(null)

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
    loadPendingObservations()
    loadLastPointInfo()
    fetchProjects()
  }, [])

  const checkOnlineStatus = () => {
    setSyncStatus(navigator.onLine ? 'synced' : 'offline')
    window.addEventListener('online', () => setSyncStatus('pending'))
    window.addEventListener('offline', () => setSyncStatus('offline'))
  }

  const loadPendingObservations = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const pending: PendingObservation[] = JSON.parse(stored)
        if (pending.length > 0) setSyncStatus('pending')
      }
    } catch (e) {
      console.error('Error loading pending observations:', e)
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

  const savePendingObservation = (type: Tab, data: any) => {
    try {
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

  const renderTabButton = (tab: Tab, icon: string, label: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex-1 py-3 px-2 text-xs font-medium transition-colors flex flex-col items-center gap-1 ${
        activeTab === tab 
          ? 'text-[#E8841A]' 
          : 'text-gray-500 hover:text-gray-300'
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span>{label}</span>
    </button>
  )

  const renderInput = (value: string, onChange: (v: string) => void, placeholder: string, keyboard?: string) => (
    <input
      type={keyboard || 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-4 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 text-lg focus:border-[#E8841A] focus:outline-none min-h-[56px]"
    />
  )

  const renderNumberInput = (value: string, onChange: (v: string) => void, placeholder: string) => (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-4 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 text-lg focus:border-[#E8841A] focus:outline-none min-h-[56px]"
    />
  )

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-100">Field Mode</h1>
          <div className="flex items-center gap-3">
            <select
              value={selectedProject}
              onChange={(e) => {
                setSelectedProject(e.target.value)
                fetchProjectPoints(e.target.value)
              }}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={syncToSupabase}
              className={`px-3 py-2 rounded text-sm font-medium ${
                syncStatus === 'synced' ? 'bg-green-900 text-green-400' :
                syncStatus === 'pending' ? 'bg-yellow-900 text-yellow-400' :
                'bg-gray-800 text-gray-500'
              }`}
            >
              {syncStatus === 'synced' ? '✓ Synced' :
               syncStatus === 'pending' ? '⬆ Pending' :
               '○ Offline'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-24">
        {activeTab === 'points' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Point Name</label>
              {renderNumberInput(pointName, setPointName, 'P1')}
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Easting (m)</label>
              {renderNumberInput(pointEasting, setPointEasting, '500000.0000')}
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Northing (m)</label>
              {renderNumberInput(pointNorthing, setPointNorthing, '4500000.0000')}
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Elevation (m) - Optional</label>
              {renderNumberInput(pointElevation, setPointElevation, '0.000')}
            </div>

            <div className="flex items-center justify-between py-4">
              <span className="text-gray-300">Control Point</span>
              <button
                onClick={() => setIsControl(!isControl)}
                className={`w-14 h-8 rounded-full transition-colors ${
                  isControl ? 'bg-[#E8841A]' : 'bg-gray-700'
                }`}
              >
                <div className={`w-6 h-6 bg-white rounded-full transition-transform ${
                  isControl ? 'translate-x-7' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <button
              onClick={handleSavePoint}
              disabled={pointSaved}
              className={`w-full py-5 rounded-lg text-lg font-semibold transition-colors ${
                pointSaved 
                  ? 'bg-green-600 text-white' 
                  : 'bg-[#E8841A] hover:bg-[#d67715] text-black'
              }`}
            >
              {pointSaved ? '✓ Saved!' : 'SAVE POINT'}
            </button>

            {lastPoints.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm text-gray-400 mb-3">Last 3 Saved Points</h3>
                <div className="space-y-2">
                  {lastPoints.map((p, i) => (
                    <div key={i} className="bg-gray-900 rounded-lg p-3 flex justify-between items-center">
                      <div>
                        <span className="font-mono text-gray-100">{p.name}</span>
                        {p.is_control && <span className="ml-2 text-xs text-[#E8841A]">CONTROL</span>}
                      </div>
                      <div className="text-xs text-gray-500">
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
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">To Station</label>
              {renderInput(traverseStation, setTraverseStation, 'Station B')}
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Distance (m)</label>
              {renderNumberInput(traverseDistance, setTraverseDistance, '100.00')}
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Bearing</label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <input
                    type="number"
                    value={traverseBearingDeg}
                    onChange={(e) => setTraverseBearingDeg(e.target.value)}
                    placeholder="000"
                    className="w-full px-3 py-4 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 text-center text-lg focus:border-[#E8841A] focus:outline-none"
                  />
                  <div className="text-center text-xs text-gray-500 mt-1">DEG</div>
                </div>
                <div>
                  <input
                    type="number"
                    value={traverseBearingMin}
                    onChange={(e) => setTraverseBearingMin(e.target.value)}
                    placeholder="00"
                    className="w-full px-3 py-4 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 text-center text-lg focus:border-[#E8841A] focus:outline-none"
                  />
                  <div className="text-center text-xs text-gray-500 mt-1">MIN</div>
                </div>
                <div>
                  <input
                    type="number"
                    value={traverseBearingSec}
                    onChange={(e) => setTraverseBearingSec(e.target.value)}
                    placeholder="00.000"
                    className="w-full px-3 py-4 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 text-center text-lg focus:border-[#E8841A] focus:outline-none"
                  />
                  <div className="text-center text-xs text-gray-500 mt-1">SEC</div>
                </div>
              </div>
            </div>

            <button
              onClick={handleAddTraverseLeg}
              className="w-full py-4 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-200 font-medium"
            >
              + Add Leg
            </button>

            {traverseLegs.length > 0 && (
              <div className="mt-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm text-gray-400">Traverse Legs</h3>
                  <span className="text-[#E8841A] font-mono">Total: {traverseTotal.toFixed(2)} m</span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {traverseLegs.map((leg, i) => (
                    <div key={leg.id} className="bg-gray-900 rounded-lg p-3 flex justify-between items-center">
                      <div className="text-sm">
                        <span className="text-gray-400">{leg.fromStation}</span>
                        <span className="text-gray-600 mx-2">→</span>
                        <span className="text-gray-100">{leg.toStation}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-gray-100">{leg.distance.toFixed(2)} m</div>
                        <div className="text-xs text-gray-500">
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
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Station</label>
              {renderInput(levelingStation, setLevelingStation, 'TP1')}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setPendingReading({ type: 'BS', value: '' })}
                className={`py-4 rounded-lg font-medium ${
                  pendingReading?.type === 'BS' 
                    ? 'bg-[#E8841A] text-black' 
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                BS
              </button>
              <button
                onClick={() => setPendingReading({ type: 'IS', value: '' })}
                className={`py-4 rounded-lg font-medium ${
                  pendingReading?.type === 'IS' 
                    ? 'bg-[#E8841A] text-black' 
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                IS
              </button>
              <button
                onClick={() => setPendingReading({ type: 'FS', value: '' })}
                className={`py-4 rounded-lg font-medium ${
                  pendingReading?.type === 'FS' 
                    ? 'bg-[#E8841A] text-black' 
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                FS
              </button>
            </div>

            {pendingReading && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Enter {pendingReading.type} reading (m)
                </label>
                <input
                  type="number"
                  value={pendingReading.value}
                  onChange={(e) => setPendingReading({ ...pendingReading, value: e.target.value })}
                  placeholder="0.000"
                  className="w-full px-4 py-4 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 text-lg focus:border-[#E8841A] focus:outline-none"
                />
                <button
                  onClick={handleAddLevelingReading}
                  className="w-full mt-2 py-3 bg-[#E8841A] hover:bg-[#d67715] rounded-lg text-black font-medium"
                >
                  Add Reading
                </button>
              </div>
            )}

            {levelingReadings.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm text-gray-400 mb-3">Leveling Observations</h3>
                <div className="bg-gray-900 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="px-3 py-2 text-left text-gray-500">Station</th>
                        <th className="px-3 py-2 text-right text-gray-500">BS</th>
                        <th className="px-3 py-2 text-right text-gray-500">IS</th>
                        <th className="px-3 py-2 text-right text-gray-500">FS</th>
                        <th className="px-3 py-2 text-right text-gray-500">HI</th>
                        <th className="px-3 py-2 text-right text-gray-500">RL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {levelingReadings.map((r, i) => (
                        <tr key={r.id} className="border-b border-gray-800/50">
                          <td className="px-3 py-2 text-gray-100">{r.station}</td>
                          <td className="px-3 py-2 text-right font-mono text-gray-300">{r.bs?.toFixed(3) || '—'}</td>
                          <td className="px-3 py-2 text-right font-mono text-gray-300">{r.is?.toFixed(3) || '—'}</td>
                          <td className="px-3 py-2 text-right font-mono text-gray-300">{r.fs?.toFixed(3) || '—'}</td>
                          <td className="px-3 py-2 text-right font-mono text-gray-300">
                            {i === 0 && levelingHI ? levelingHI.toFixed(3) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-gray-300">
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
              <div className={`mt-4 p-4 rounded-lg ${
                levelingArithmeticCheck.passed 
                  ? 'bg-green-900/30 border border-green-700' 
                  : 'bg-red-900/30 border border-red-700'
              }`}>
                <div className="text-sm font-medium">
                  {levelingArithmeticCheck.passed ? '✓' : '✗'} Arithmetic Check
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Difference: {Math.abs(levelingArithmeticCheck.diff).toFixed(4)} m
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'radiation' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Instrument Station</label>
              <select
                value={radiationStation}
                onChange={(e) => setRadiationStation(e.target.value)}
                className="w-full px-4 py-4 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 text-lg focus:border-[#E8841A] focus:outline-none"
              >
                <option value="">Select station...</option>
                {projectPoints.map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Instrument Height (m)</label>
              {renderNumberInput(radiationInstHeight, setRadiationInstHeight, '1.500')}
            </div>

            <div className="border-t border-gray-800 pt-4 mt-6">
              <h3 className="text-sm text-gray-400 mb-3">New Observation</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Point Name</label>
                  {renderInput(newRadPointName, setNewRadPointName, 'P1')}
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Bearing</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      value={newRadBearingDeg}
                      onChange={(e) => setNewRadBearingDeg(e.target.value)}
                      placeholder="000"
                      className="px-3 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 text-center focus:border-[#E8841A] focus:outline-none"
                    />
                    <input
                      type="number"
                      value={newRadBearingMin}
                      onChange={(e) => setNewRadBearingMin(e.target.value)}
                      placeholder="00"
                      className="px-3 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 text-center focus:border-[#E8841A] focus:outline-none"
                    />
                    <input
                      type="number"
                      value={newRadBearingSec}
                      onChange={(e) => setNewRadBearingSec(e.target.value)}
                      placeholder="00.0"
                      className="px-3 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 text-center focus:border-[#E8841A] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Distance (m)</label>
                  {renderNumberInput(newRadDistance, setNewRadDistance, '50.00')}
                </div>

                <button
                  onClick={handleAddRadiationPoint}
                  className="w-full py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-200 font-medium"
                >
                  + Add Point
                </button>
              </div>
            </div>

            {radiationPoints.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm text-gray-400 mb-3">Observed Points ({radiationPoints.length})</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {radiationPoints.map(p => (
                    <div key={p.id} className="bg-gray-900 rounded-lg p-3 flex justify-between items-center">
                      <span className="font-mono text-gray-100">{p.pointName}</span>
                      <div className="text-right text-xs text-gray-500">
                        <div>{p.bearing.deg}°{p.bearing.min}'{p.bearing.sec.toFixed(1)}"</div>
                        <div>{p.distance.toFixed(2)} m</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex safe-area-bottom">
        {renderTabButton('points', '📍', 'Points')}
        {renderTabButton('traverse', '📐', 'Traverse')}
        {renderTabButton('leveling', '📏', 'Leveling')}
        {renderTabButton('radiation', '📡', 'Radiation')}
      </div>
    </div>
  )
}
