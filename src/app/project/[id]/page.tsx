'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { geographicToUTM } from '@/lib/engine/coordinates'
import { generateSurveyReport, generateSurveyPlan } from '@/lib/reports/generateReport'
import { downloadLandXML } from '@/lib/export/generateLandXML'
import { exportProject, importProject } from '@/lib/export/exportProject'
import { downloadGeoJSON } from '@/lib/export/generateGeoJSON'
import { coordinateAreaSolution } from '@/lib/engine/solution/wrappers/area'
import { bowditchAdjustmentSolutionFromResult } from '@/lib/engine/solution/wrappers/traverse'
import { coordinateArea } from '@/lib/engine/area'
import AddPointModal from '@/components/AddPointModal'
import CSVUploadModal from '@/components/CSVUploadModal'
import TraverseModal from '@/components/TraverseModal'
import ParcelAreaModal from '@/components/ParcelAreaModal'
import StakeoutMode from '@/components/StakeoutMode'
import NearbyBeaconsModal from '@/components/NearbyBeaconsModal'
import ParcelBuilderModal from '@/components/ParcelBuilderModal'

const ProjectMap = dynamic(() => import('@/components/ProjectMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[500px] bg-gray-900/30 rounded-lg flex items-center justify-center">
      <p className="text-gray-500">Loading map...</p>
    </div>
  )
})

interface PageProps {
  params: { id: string }
}

interface Project {
  id: string
  name: string
  location: string | null
  utm_zone: number
  hemisphere: 'N' | 'S'
  created_at: string
  survey_type?: string
  client_name?: string | null
  surveyor_name?: string | null
}

interface Point {
  id: string
  name: string
  easting: number
  northing: number
  elevation: number | null
  is_control: boolean
  control_order?: string
  locked?: boolean
}

type MapMode = 'idle' | 'distance' | 'area' | 'traverse'

type Parcel = {
  id: string
  name: string | null
  boundary_points: Array<{ name?: string; easting: number; northing: number }>
  created_at?: string
}

export default function ProjectPage({ params }: PageProps) {
  const [project, setProject] = useState<Project | null>(null)
  const [points, setPoints] = useState<Point[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddPoint, setShowAddPoint] = useState(false)
  const [showCSVUpload, setShowCSVUpload] = useState(false)
  const [showTraverse, setShowTraverse] = useState(false)
  const [mapMode, setMapMode] = useState<MapMode>('idle')
  const [areaPoints, setAreaPoints] = useState<any[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [prefillCoords, setPrefillCoords] = useState<{ easting?: number; northing?: number }>({})
  const [editPoint, setEditPoint] = useState<{
    id: string
    name: string
    easting: number
    northing: number
    elevation: number
    is_control: boolean
    control_order?: string
    locked?: boolean
  } | null>(null)
  const [traverseResult, setTraverseResult] = useState<any>(null)
  const [areaResult, setAreaResult] = useState<any>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [showStakeout, setShowStakeout] = useState(false)
  const [showNearbyBeacons, setShowNearbyBeacons] = useState(false)
  const [showParcelBuilder, setShowParcelBuilder] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'offline'>('synced')
  const [viewerCount, setViewerCount] = useState(1)
  const [onlineUsers, setOnlineUsers] = useState<{ user_id: string; email?: string }[]>([])
  const [isOnline, setIsOnline] = useState(true)

  const supabase = createClient()

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: projectData } = await supabase
      .from('projects')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!projectData) {
      window.location.href = '/dashboard'
      return
    }

    setProject(projectData)

    const { data: pointsData } = await supabase
      .from('survey_points')
      .select('*')
      .eq('project_id', params.id)
      .order('created_at', { ascending: true })

    setPoints(pointsData || [])
    setLoading(false)
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        window.location.href = '/login'
      }
    })
  }, [])

  // Online/offline status
  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => { setIsOnline(false); setSyncStatus('offline') }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Real-time subscription for points
  useEffect(() => {
    const supabase = createClient()
    
    const channel = supabase
      .channel(`project-${params.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'survey_points',
          filter: `project_id=eq.${params.id}`
        },
        (payload) => {
          setSyncStatus('synced')
          if (payload.eventType === 'INSERT') {
            setPoints(prev => {
              if (prev.some(p => p.id === payload.new.id)) return prev
              return [...prev, payload.new as any]
            })
          }
          if (payload.eventType === 'UPDATE') {
            setPoints(prev => prev.map(p => 
              p.id === payload.new.id ? { ...p, ...payload.new } as any : p
            ))
          }
          if (payload.eventType === 'DELETE') {
            setPoints(prev => prev.filter(p => p.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => { 
      supabase.removeChannel(channel) 
    }
  }, [params.id])

  // Presence tracking for viewer count
  useEffect(() => {
    const supabase = createClient()
    
    const channel = supabase.channel(`presence-${params.id}`)
    
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState() as Record<string, { user_id: string; email?: string }[]>
      const users = Object.values(state).flat().filter(u => u?.user_id)
      setViewerCount(users.length || 1)
      setOnlineUsers(users)
    })

    channel.on('presence', { event: 'join' }, () => {
      const state = channel.presenceState() as Record<string, { user_id: string; email?: string }[]>
      const users = Object.values(state).flat().filter(u => u?.user_id)
      setViewerCount(users.length || 1)
      setOnlineUsers(users)
    })

    channel.on('presence', { event: 'leave' }, () => {
      const state = channel.presenceState() as Record<string, { user_id: string; email?: string }[]>
      const users = Object.values(state).flat().filter(u => u?.user_id)
      setViewerCount(users.length || 1)
      setOnlineUsers(users)
    })

    // Track presence with user info
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        channel.track({ 
          user_id: user.id, 
          email: user.email,
          online_at: new Date().toISOString() 
        })
      }
    })

    return () => { 
      supabase.removeChannel(channel) 
    }
  }, [params.id])

  useEffect(() => {
    fetchData()
  }, [params.id])

  const handleMapClick = (lat: number, lon: number) => {
    if (!project) return
    const utm = geographicToUTM(lat, lon, project.utm_zone)
    setPrefillCoords({
      easting: utm.easting,
      northing: utm.northing
    })
    setShowAddPoint(true)
  }

  const handlePointAdded = () => {
    fetchData()
  }

  const handleDeletePoint = async (point: any) => {
    if (point.locked) {
      alert('This control point is locked and cannot be deleted.')
      return
    }
    await supabase.from('survey_points').delete().eq('id', point.id)
    fetchData()
  }

  const handleEditPoint = (point: any) => {
    if (point.locked) {
      alert('This control point is locked and cannot be edited.')
      return
    }
    setEditPoint({
      id: point.id,
      name: point.name,
      easting: point.easting,
      northing: point.northing,
      elevation: point.elevation || 0,
      is_control: point.is_control || false,
      control_order: point.control_order,
      locked: point.locked || false
    })
    setShowAddPoint(true)
  }

  const handleCopyCoords = async (point: Point) => {
    const text = point.name + ', ' + point.easting + ', ' + point.northing + ', ' + (point.elevation || 0)
    await navigator.clipboard.writeText(text)
    setCopiedId(point.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const handleGenerateReport = async () => {
    if (!project) return
    
    setReportLoading(true)
    setShareUrl(null)
    
    const uploadToStorage = async (blob: Blob, filename: string) => {
      try {
        const fileExt = filename.split('.').pop()
        const fileName = `${params.id}/${Date.now()}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('reports')
          .upload(fileName, blob, { contentType: 'application/pdf', upsert: true })
        
        if (uploadError) {
          console.error('Upload error:', uploadError)
          setReportLoading(false)
          return
        }
        
        const { data: urlData } = supabase.storage
          .from('reports')
          .getPublicUrl(fileName)
        
        if (urlData) {
          setShareUrl(urlData.publicUrl)
        }
      } catch (err) {
        console.error('Error uploading report:', err)
      }
      setReportLoading(false)
    }
    
    const solutions = []
    if (traverseResult?.legs?.length) {
      try {
        solutions.push(bowditchAdjustmentSolutionFromResult(traverseResult))
      } catch {}
    }
    if (parcelData?.boundary_points && parcelData.boundary_points.length >= 3) {
      try {
        const pts = parcelData.boundary_points.map(p => ({ easting: p.easting, northing: p.northing }))
        solutions.push(coordinateAreaSolution(pts).solution)
      } catch {}
    }

    generateSurveyReport({
      project: {
        name: project.name,
        location: project.location || 'Not specified',
        utm_zone: project.utm_zone,
        hemisphere: project.hemisphere,
        created_at: project.created_at,
        survey_type: project.survey_type,
        client_name: project.client_name,
        surveyor_name: project.surveyor_name
      },
      points: points.map(p => ({
        name: p.name,
        easting: p.easting,
        northing: p.northing,
        elevation: p.elevation || 0,
        is_control: p.is_control
      })),
      traverse: traverseResult || undefined,
      area: areaResult || undefined,
      solutions
    }, uploadToStorage)
  }

  const [parcelData, setParcelData] = useState<Parcel | null>(null)
  const [parcels, setParcels] = useState<Parcel[]>([])
  const [draftParcelBoundary, setDraftParcelBoundary] = useState<Array<{ easting: number; northing: number }> | null>(null)

  useEffect(() => {
    if (project) {
      const fetchParcels = async () => {
        const { data } = await supabase
          .from('parcels')
          .select('id, name, boundary_points, created_at')
          .eq('project_id', params.id)
          .order('created_at', { ascending: false })
        const list = (data as any[] | null) ?? []
        setParcels(list as any)
        setParcelData((list[0] as any) ?? null)
      }
      fetchParcels()
    }
  }, [project, params.id])

  const handleParcelCreated = async (created?: Parcel) => {
    if (created) {
      setParcels(prev => [created, ...prev.filter(p => p.id !== created.id)])
      setParcelData(created)
      return
    }
    try {
      const { data } = await supabase
        .from('parcels')
        .select('id, name, boundary_points, created_at')
        .eq('project_id', params.id)
        .order('created_at', { ascending: false })
      const list = (data as any[] | null) ?? []
      setParcels(list as any)
      setParcelData((list[0] as any) ?? null)
    } catch {}
  }

  const handleGenerateSurveyPlan = async () => {
    if (!project) return
    
    setReportLoading(true)
    setShareUrl(null)
    
    const uploadToStorage = async (blob: Blob, filename: string) => {
      try {
        const fileExt = filename.split('.').pop()
        const fileName = `${params.id}/${Date.now()}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('reports')
          .upload(fileName, blob, { contentType: 'application/pdf', upsert: true })
        
        if (uploadError) {
          console.error('Upload error:', uploadError)
          setReportLoading(false)
          return
        }
        
        const { data: urlData } = supabase.storage
          .from('reports')
          .getPublicUrl(fileName)
        
        if (urlData) {
          setShareUrl(urlData.publicUrl)
        }
      } catch (err) {
        console.error('Error uploading report:', err)
      }
      setReportLoading(false)
    }
    
    const parcelForPlan = (() => {
      if (!parcelData || !Array.isArray(parcelData.boundary_points) || parcelData.boundary_points.length < 3) return null
      const boundary = parcelData.boundary_points.map((p, idx) => ({
        name: (p.name ?? '').trim() || `P${idx + 1}`,
        easting: p.easting,
        northing: p.northing,
      }))
      const area = coordinateArea(boundary.map((p) => ({ easting: p.easting, northing: p.northing })))
      return {
        name: parcelData.name ?? 'Parcel',
        boundary_points: boundary,
        area_sqm: area.areaSqm,
        area_ha: area.areaHa,
        area_acres: area.areaAcres,
        perimeter_m: area.perimeter,
      }
    })()

    generateSurveyPlan({
      project: {
        name: project.name,
        location: project.location || 'Not specified',
        utm_zone: project.utm_zone,
        hemisphere: project.hemisphere,
        created_at: project.created_at
      },
      points: points.map(p => ({
        name: p.name,
        easting: p.easting,
        northing: p.northing,
        elevation: p.elevation,
        is_control: p.is_control,
        control_order: p.control_order
      })),
      parcel: parcelForPlan,
      traverse: traverseResult ? {
        legs: traverseResult.legs.map((l: any) => ({
          fromName: l.fromName,
          toName: l.toName,
          distance: l.distance,
          bearing: l.adjustedBearing || l.rawBearing
        }))
      } : undefined
    }, uploadToStorage)
  }

  const handleAreaPointSelect = (point: any) => {
    if (areaPoints.length >= 3 && areaPoints[0].id === point.id) {
      return
    }
    if (!areaPoints.some(p => p.id === point.id)) {
      setAreaPoints([...areaPoints, point])
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#E8841A] border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (!project) return null

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <aside className="w-64 border-r border-gray-800 bg-gray-900/30 p-4">
        <div className="space-y-2">
          <button
            onClick={() => {
              setPrefillCoords({})
              setShowAddPoint(true)
            }}
            className="w-full px-4 py-2 bg-[#E8841A] hover:bg-[#d67715] text-black font-semibold rounded text-sm transition-colors"
          >
            Add Point
          </button>
          <button
            onClick={() => setShowCSVUpload(true)}
            className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-sm transition-colors"
          >
            Upload CSV
          </button>
          <button
            onClick={() => setShowTraverse(true)}
            className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-sm transition-colors"
          >
            Run Traverse
          </button>
          <button
            onClick={() => {
              setMapMode(mapMode === 'distance' ? 'idle' : 'distance')
              setAreaPoints([])
            }}
            className={`w-full px-4 py-2 rounded text-sm transition-colors ${
              mapMode === 'distance' 
                ? 'bg-[#E8841A] hover:bg-[#d67715] text-black font-semibold' 
                : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
            }`}
            title="Press D to activate"
          >
            {mapMode === 'distance' ? 'Distance Active' : 'Distance Tool'}
          </button>
          <button
            onClick={() => {
              setMapMode(mapMode === 'area' ? 'idle' : 'area')
              setAreaPoints([])
            }}
            className={`w-full px-4 py-2 rounded text-sm transition-colors ${
              mapMode === 'area' 
                ? 'bg-[#E8841A] hover:bg-[#d67715] text-black font-semibold' 
                : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
            }`}
            title="Press A to activate"
          >
            {mapMode === 'area' ? 'Area Active' : 'Compute Area'}
          </button>
          <button
            onClick={handleGenerateReport}
            disabled={reportLoading}
            className="w-full px-4 py-2 bg-[#E8841A] hover:bg-[#d67715] text-black font-semibold rounded text-sm transition-colors disabled:opacity-50"
          >
            {reportLoading ? 'Generating...' : '📄 Generate Report'}
          </button>
          <button
            onClick={handleGenerateSurveyPlan}
            disabled={reportLoading || points.length === 0}
            className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold rounded text-sm transition-colors disabled:opacity-50"
          >
            🗺️ Generate Survey Plan
          </button>
          <button
            onClick={() => {
              if (project) {
                downloadLandXML(
                  {
                    name: project.name,
                    location: project.location || '',
                    utm_zone: project.utm_zone,
                    hemisphere: project.hemisphere
                  },
                  points.map(p => ({
                    name: p.name,
                    easting: p.easting,
                    northing: p.northing,
                    elevation: p.elevation,
                    is_control: p.is_control
                  }))
                )
              }
            }}
            disabled={points.length === 0}
            className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-sm transition-colors disabled:opacity-50"
          >
            📥 Export LandXML
          </button>
          <button
            onClick={() => {
              downloadGeoJSON(
                points.map(p => ({
                  name: p.name,
                  easting: p.easting,
                  northing: p.northing,
                  elevation: p.elevation,
                  is_control: p.is_control
                })),
                project?.name || 'survey',
                project?.utm_zone,
                project?.hemisphere
              )
            }}
            disabled={points.length === 0}
            className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-sm transition-colors disabled:opacity-50"
          >
            🗺️ Export GeoJSON
          </button>
          <button
            onClick={async () => {
              await exportProject(params.id, supabase)
            }}
            disabled={points.length === 0}
            className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-sm transition-colors disabled:opacity-50"
          >
            💾 Export Project
          </button>
          <button
            onClick={() => setShowStakeout(true)}
            disabled={points.length === 0}
            className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-sm transition-colors disabled:opacity-50"
          >
            🎯 Stakeout All Points
          </button>
          <button
            onClick={() => setShowNearbyBeacons(true)}
            className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-sm transition-colors"
          >
            📍 Nearby Beacons
          </button>
          <Link
            href={`/project/${params.id}/profiles`}
            className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-sm transition-colors text-center block"
          >
            📐 Profiles
          </Link>
          <button
            onClick={() => setShowParcelBuilder(true)}
            disabled={points.length < 3}
            className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-sm transition-colors disabled:opacity-50"
          >
            🗺️ Build Parcel
          </button>
          {shareUrl && (
            <div className="mt-2 p-2 bg-green-900/30 border border-green-700 rounded">
              <div className="text-xs text-green-400 mb-1">✓ Report uploaded</div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-gray-300 font-mono"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl)
                    alert('Link copied!')
                  }}
                  className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded"
                >
                  Copy
                </button>
              </div>
              <div className="text-xs text-gray-500 mt-1">Link expires in 7 days</div>
            </div>
          )}
          
          {/* Sync status indicator */}
          <div className="mt-4 pt-4 border-t border-gray-800">
            <div className="flex items-center gap-2 text-xs">
              <div className={`w-2 h-2 rounded-full ${
                syncStatus === 'synced' ? 'bg-green-500' :
                syncStatus === 'pending' ? 'bg-yellow-500 animate-pulse' :
                'bg-red-500'
              }`} />
              <span className="text-gray-400">
                {syncStatus === 'synced' ? 'All changes saved' :
                 syncStatus === 'pending' ? 'Saving...' :
                 'Offline — changes queued'}
              </span>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="border-b border-gray-800 bg-gray-900/30 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-100">{project.name}</h1>
              <p className="text-sm text-gray-400">
                UTM Zone {project.utm_zone} {project.hemisphere}
                {project.location && ` — ${project.location}`}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Collaboration indicators */}
              <div className="flex items-center gap-2 text-sm">
                {onlineUsers.length > 0 ? (
                  <div className="flex items-center gap-1">
                    <div className="flex -space-x-2">
                      {onlineUsers.slice(0, 3).map((u, i) => (
                        <div 
                          key={i}
                          className="w-6 h-6 rounded-full bg-blue-500 border-2 border-gray-800 flex items-center justify-center text-xs text-white"
                          title={u.email}
                        >
                          {u.email?.charAt(0).toUpperCase() || '?'}
                        </div>
                      ))}
                    </div>
                    <span className="text-gray-400">{viewerCount} online</span>
                  </div>
                ) : (
                  <span className="text-gray-400">👥 {viewerCount} viewer{viewerCount !== 1 ? 's' : ''}</span>
                )}
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                <span className="text-gray-500 text-xs">{isOnline ? 'Live' : 'Offline'}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 p-6">
          <div className="mb-6">
            <ProjectMap
              points={points.map(p => ({
                id: p.id,
                name: p.name,
                easting: p.easting,
                northing: p.northing,
                elevation: p.elevation || undefined,
                is_control: p.is_control,
                control_order: (p as any).control_order,
                locked: (p as any).locked
              }))}
              parcels={parcels}
              draftParcelBoundary={draftParcelBoundary}
              utmZone={project.utm_zone}
              hemisphere={project.hemisphere}
              onMapClick={handleMapClick}
              mode={mapMode}
              onModeChange={setMapMode}
              areaPoints={areaPoints}
              onAreaPointsUpdate={setAreaPoints}
              onDeletePoint={handleDeletePoint}
              onEditPoint={handleEditPoint}
            />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Coordinates</h2>
            <div className="border border-gray-800 bg-gray-900/30 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Point Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Easting (m)</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Northing (m)</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Elevation (m)</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {points.length > 0 ? (
                    points.map((point) => (
                      <tr key={point.id} className="border-b border-gray-800/50">
                        <td className="px-4 py-3 font-mono text-gray-100">
                          {point.name}
                          {point.locked && <span className="ml-1">🔒</span>}
                          {point.is_control && (
                            <span className={`ml-2 text-xs ${
                              point.control_order === 'primary' ? 'text-red-400' :
                              point.control_order === 'secondary' ? 'text-orange-400' :
                              point.control_order === 'temporary' ? 'text-yellow-400' :
                              'text-red-400'
                            }`}>
                              ({point.control_order === 'temporary' ? 'TMP' : point.control_order === 'secondary' ? 'SEC' : 'PRI'})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-300">{point.easting.toFixed(4)}</td>
                        <td className="px-4 py-3 font-mono text-gray-300">{point.northing.toFixed(4)}</td>
                        <td className="px-4 py-3 font-mono text-gray-300">{point.elevation?.toFixed(3) ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleCopyCoords(point)}
                              className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                            >
                              {copiedId === point.id ? 'Copied!' : 'Copy'}
                            </button>
                            <button
                              onClick={() => handleEditPoint(point)}
                              className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete point "${point.name}"?`)) handleDeletePoint(point)
                              }}
                              disabled={!!point.locked}
                              className="text-xs px-2 py-1 bg-red-900/40 hover:bg-red-900/60 text-red-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title={point.locked ? 'Locked control points cannot be deleted' : 'Delete point'}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No points yet. Use "Add Point" or "Upload CSV" to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <AddPointModal
        isOpen={showAddPoint}
        onClose={() => {
          setShowAddPoint(false)
          setPrefillCoords({})
          setEditPoint(null)
        }}
        projectId={params.id}
        utmZone={project.utm_zone}
        hemisphere={project.hemisphere}
        prefillEasting={prefillCoords.easting}
        prefillNorthing={prefillCoords.northing}
        onPointAdded={() => {
          handlePointAdded()
          setEditPoint(null)
        }}
        editPointId={editPoint?.id}
        editPointName={editPoint?.name}
        editPointEasting={editPoint?.easting}
        editPointNorthing={editPoint?.northing}
        editPointElevation={editPoint?.elevation}
        editPointIsControl={editPoint?.is_control}
        editPointControlOrder={editPoint?.control_order}
        editPointLocked={editPoint?.locked}
      />

      <CSVUploadModal
        isOpen={showCSVUpload}
        onClose={() => setShowCSVUpload(false)}
        projectId={params.id}
        onUploadComplete={handlePointAdded}
      />

      <TraverseModal
        isOpen={showTraverse}
        onClose={() => setShowTraverse(false)}
        projectId={params.id}
        onTraverseComplete={handlePointAdded}
        onTraverseResult={setTraverseResult}
      />

      <ParcelAreaModal
        isOpen={mapMode === 'area' && areaPoints.length >= 3}
        onClose={() => {
          setMapMode('idle')
          setAreaPoints([])
        }}
        points={points.map(p => ({
          id: p.id,
          name: p.name,
          easting: p.easting,
          northing: p.northing,
          elevation: p.elevation || undefined,
          is_control: p.is_control
        }))}
        onAreaResult={setAreaResult}
      />

      {showStakeout && (
        <div className="fixed inset-0 z-50 bg-gray-950">
          <div className="absolute top-4 right-4 z-50">
            <button
              onClick={() => setShowStakeout(false)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg"
            >
              ✕ Close
            </button>
          </div>
          <StakeoutMode
            points={points.map(p => ({
              id: p.id,
              name: p.name,
              easting: p.easting,
              northing: p.northing,
              elevation: p.elevation || undefined
            }))}
            utmZone={project.utm_zone}
            hemisphere={project.hemisphere}
            onComplete={() => {}}
          />
        </div>
      )}

      {showNearbyBeacons && (
        <NearbyBeaconsModal
          projectEasting={points[0]?.easting || 500000}
          projectNorthing={points[0]?.northing || 4500000}
          projectId={params.id}
          onClose={() => setShowNearbyBeacons(false)}
        />
      )}

      {showParcelBuilder && (
        <ParcelBuilderModal
          projectId={params.id}
          points={points}
          onClose={() => {
            setShowParcelBuilder(false)
            setDraftParcelBoundary(null)
          }}
          onParcelCreated={handleParcelCreated}
          onDraftBoundaryChange={setDraftParcelBoundary}
        />
      )}
    </div>
  )
}
