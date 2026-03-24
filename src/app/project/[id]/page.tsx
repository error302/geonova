'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ErrorBoundary from '@/components/ErrorBoundary'
import { geographicToUTM } from '@/lib/engine/coordinates'
import { trackEvent } from '@/lib/analytics/events'
import { downloadLandXML } from '@/lib/export/generateLandXML'
import { exportProject, importProject } from '@/lib/export/exportProject'
import { downloadGeoJSON } from '@/lib/export/generateGeoJSON'
import { coordinateAreaSolution } from '@/lib/engine/solution/wrappers/area'
import { bowditchAdjustmentSolutionFromResult } from '@/lib/engine/solution/wrappers/traverse'
import { coordinateArea } from '@/lib/engine/area'
import type { Solution } from '@/lib/solution/schema'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import AddPointModal from '@/components/AddPointModal'
import CSVUploadModal from '@/components/CSVUploadModal'
import TraverseModal from '@/components/TraverseModal'
import ParcelAreaModal from '@/components/ParcelAreaModal'
import StakeoutMode from '@/components/StakeoutMode'
import NearbyBeaconsModal from '@/components/NearbyBeaconsModal'
import ParcelBuilderModal from '@/components/ParcelBuilderModal'
import WorkspaceShell from '@/components/organisms/WorkspaceShell'
import PythonEngineStatus from '@/components/PythonEngineStatus'
import SolutionRenderer from '@/components/SolutionRenderer'

const ProjectMap = dynamic(() => import('@/components/ProjectMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[500px] bg-[var(--bg-secondary)]/30 rounded-lg flex items-center justify-center">
      <p className="text-[var(--text-muted)]">Loading map...</p>
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
  datum?: string | null
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

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2 px-1">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function SidebarDivider() {
  return <div className="border-t border-[var(--border-color)] my-3"></div>
}

export default function ProjectPage({ params }: PageProps) {
  const { t } = useLanguage()
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
  const [pointActionError, setPointActionError] = useState<string | null>(null)

  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)

  const getSupabase = () => {
    if (typeof window === 'undefined') return null
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }

  const [selectedPointId, setSelectedPointId] = useState<string | null>(null)
  const [bottomTab, setBottomTab] = useState<'fieldbook' | 'log'>('log')
  const [pointError, setPointError] = useState<string | null>(null)
  const [calcLog, setCalcLog] = useState<Solution[]>([])
  const [activeSolutionIndex, setActiveSolutionIndex] = useState(0)

  const pushSolution = (solution: Solution) => {
    setCalcLog((prev) => [solution, ...prev].slice(0, 12))
    setActiveSolutionIndex(0)
  }

  const selectedPoint = useMemo(() => points.find((p) => p.id === selectedPointId) ?? null, [points, selectedPointId])

  useEffect(() => {
    if (!selectedPointId) return
    if (!points.some((p) => p.id === selectedPointId)) setSelectedPointId(null)
  }, [points, selectedPointId])

  const normalizePoint = (p: any): Point => {
    const parseBool = (v: any) => v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true'
    return {
      id: String(p.id),
      name: String(p.name ?? ''),
      easting: Number(p.easting),
      northing: Number(p.northing),
      elevation: p.elevation === null || p.elevation === undefined ? null : Number(p.elevation),
      is_control: parseBool(p.is_control),
      control_order: p.control_order ?? undefined,
      locked: parseBool(p.locked) || undefined,
    }
  }

  const fetchData = async () => {
    const sb = getSupabase()
    if (!sb) return

    const { data: { session } } = await sb.auth.getSession()
    let user = session?.user ?? null

    if (!user) {
      const { data: { session: refreshed } } = await sb.auth.refreshSession()
      user = refreshed?.user ?? null
    }

    if (!user) {
      const next = encodeURIComponent(window.location.pathname)
      window.location.replace('/login?next=' + next)
      return
    }

    const { data: projectData } = await sb
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

    const { data: pointsData } = await sb
      .from('survey_points')
      .select('*')
      .eq('project_id', params.id)
      .order('created_at', { ascending: true })

    let fetchedPoints = (pointsData || []).map(normalizePoint)
    
    if (projectData.datum === 'ARC1960') {
      try {
        const { convertDatum } = await import('@/lib/compute/pythonService')
        const converted = await convertDatum(fetchedPoints, 'WGS84', 'ARC1960')
        fetchedPoints = fetchedPoints.map((p, i) => ({
          ...p,
          easting: converted[i]?.easting ?? p.easting,
          northing: converted[i]?.northing ?? p.northing,
        }))
      } catch (err) {
        console.error('Failed to convert datum on load', err)
      }
    }

    setPoints(fetchedPoints)
    setLoading(false)
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        const next = encodeURIComponent(window.location.pathname)
        window.location.replace('/login?next=' + next)
      }
    })
  }, [])

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
              return [...prev, normalizePoint(payload.new)]
            })
          }
          if (payload.eventType === 'UPDATE') {
            setPoints(prev => prev.map(p => 
              p.id === payload.new.id ? normalizePoint({ ...p, ...payload.new }) : p
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

    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user
      if (!user) return
      channel.track({
        user_id: user.id,
        email: user.email,
        online_at: new Date().toISOString(),
      })
    })

    return () => { 
      supabase.removeChannel(channel) 
    }
  }, [params.id])

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!point?.id) return
    if (point.locked) {
      setPointActionError(t('workspace.lockedCannotDelete'))
      return
    }

    const sb = getSupabase()
    if (!sb) return

    setPointActionError(null)
    let snapshot: Point[] | null = null
    setPoints((prev) => {
      snapshot = prev
      return prev.filter((p) => p.id !== point.id)
    })
    setAreaPoints((prev) => prev.filter((p: any) => p?.id !== point.id))
    if (selectedPointId === point.id) setSelectedPointId(null)

    try {
      setSyncStatus('pending')
      const { error } = await sb.from('survey_points').delete().eq('id', point.id)
      if (error) throw error
      setSyncStatus('synced')
    } catch (err: any) {
      console.error('Delete failed:', err)
      if (snapshot) setPoints(snapshot)
      setSyncStatus('synced')
      setPointActionError(err?.message ? `Failed to delete: ${err.message}` : 'Failed to delete point.')
    }
  }

  const handleEditPoint = (point: any) => {
    if (point.locked) {
      setPointError('This control point is locked and cannot be edited.')
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
    trackEvent('report_generated', { project_id: params.id })
    setShareUrl(null)
    
    const uploadToStorage = async (blob: Blob, filename: string) => {
      const sb = getSupabase()
      if (!sb) { setReportLoading(false); return }
      try {
        const fileExt = filename.split('.').pop()
        const fileName = `${params.id}/${Date.now()}.${fileExt}`
        
        const { error: uploadError } = await sb.storage
          .from('reports')
          .upload(fileName, blob, { contentType: 'application/pdf', upsert: true })
        
        if (uploadError) {
          console.error('Upload error:', uploadError)
          setReportLoading(false)
          return
        }
        
        const { data: urlData } = sb.storage
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

    (await import('@/lib/reports/generateReport')).generateSurveyReport({
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
        const sb = getSupabase()
        if (!sb) return
        const { data } = await sb
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
      try {
        const pts = created.boundary_points.map((p) => ({ easting: p.easting, northing: p.northing }))
        pushSolution(coordinateAreaSolution(pts).solution)
      } catch {}
      return
    }
    const sb = getSupabase()
    if (!sb) return
    try {
      const { data } = await sb
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
      const sb = getSupabase()
      if (!sb) { setReportLoading(false); return }
      try {
        const fileExt = filename.split('.').pop()
        const fileName = `${params.id}/${Date.now()}.${fileExt}`
        
        const { error: uploadError } = await sb.storage
          .from('reports')
          .upload(fileName, blob, { contentType: 'application/pdf', upsert: true })
        
        if (uploadError) {
          console.error('Upload error:', uploadError)
          setReportLoading(false)
          return
        }
        
        const { data: urlData } = sb.storage
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
    
    let parcelForPlan: { name: string; boundary_points: { name: string; easting: number; northing: number }[]; area_sqm: number; area_ha: number; area_acres: number; perimeter_m: number } | null = null
    if (parcelData && Array.isArray(parcelData.boundary_points) && parcelData.boundary_points.length >= 3) {
      const boundary = parcelData.boundary_points.map((p: any, idx: number) => ({
        name: (p.name ?? '').trim() || `P${idx + 1}`,
        easting: p.easting as number,
        northing: p.northing as number,
      }))
      const area = coordinateArea(boundary.map((p) => ({ easting: p.easting, northing: p.northing })))
      parcelForPlan = {
        name: parcelData.name ?? 'Parcel',
        boundary_points: boundary,
        area_sqm: area.areaSqm,
        area_ha: area.areaHa,
        area_acres: area.areaAcres,
        perimeter_m: area.perimeter,
      }
    }

    const { generateSurveyPlan } = await import('@/lib/reports/generateReport')
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

  const computeProjectArea = useCallback(() => {
    if (points.length < 3) return null
    try {
      return coordinateArea(points.map(p => ({ easting: p.easting, northing: p.northing })))
    } catch {
      return null
    }
  }, [points])

  const projectArea = useMemo(() => computeProjectArea(), [computeProjectArea])

  const getSurveyTypeBadge = () => {
    const type = project?.survey_type?.toLowerCase() || 'topographic'
    const label = type === 'topographic' ? 'TOPO' : type === 'boundary' ? 'BOUNDARY' : type === 'road' ? 'ROAD' : type === 'control' ? 'CONTROL' : type.toUpperCase()
    const badgeColor = (() => {
      if (type === 'road') return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      if (type === 'boundary') return 'bg-green-500/20 text-green-400 border-green-500/30'
      if (type === 'control') return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      if (type === 'topographic') return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    })()
    return { label, badgeColor }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (!project) return null

  const surveyTypeBadge = getSurveyTypeBadge()

  return (
    <ErrorBoundary>
    <>
      <PythonEngineStatus />
    <WorkspaceShell
        bottomTitle={bottomTab === 'log' ? 'Calculation Log' : 'Field Notes'}
        left={
          <div className="p-3 space-y-1">
            <SidebarSection title="DATA">
              <button
                onClick={() => {
                  setPrefillCoords({})
                  setShowAddPoint(true)
                }}
                className="w-full px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded text-sm transition-colors"
              >
                Add Point
              </button>
              <button
                onClick={() => setShowCSVUpload(true)}
                className="w-full px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded text-sm transition-colors"
              >
                Upload CSV
              </button>
              <button
                onClick={() => setShowTraverse(true)}
                className="w-full px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded text-sm transition-colors"
              >
                Run Traverse
              </button>
            </SidebarSection>

            <SidebarDivider />

            <SidebarSection title="MEASURE">
              <button
                onClick={() => {
                  setMapMode(mapMode === 'distance' ? 'idle' : 'distance')
                  setAreaPoints([])
                }}
                className={`w-full px-4 py-2 rounded text-sm transition-colors ${
                  mapMode === 'distance' 
                    ? 'bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold' 
                    : 'bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)]'
                }`}
                title="Press D to activate"
              >
                Distance Tool
              </button>
              <button
                onClick={() => {
                  setMapMode(mapMode === 'area' ? 'idle' : 'area')
                  setAreaPoints([])
                }}
                className={`w-full px-4 py-2 rounded text-sm transition-colors ${
                  mapMode === 'area' 
                    ? 'bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold' 
                    : 'bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)]'
                }`}
                title="Press A to activate"
              >
                Area Tool
              </button>
            </SidebarSection>

            <SidebarDivider />

            <SidebarSection title="GENERATE">
              <button
                onClick={handleGenerateSurveyPlan}
                disabled={reportLoading || points.length === 0}
                className="w-full px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded text-sm transition-colors disabled:opacity-50"
              >
                Generate Survey Plan
              </button>
              <button
                onClick={handleGenerateReport}
                disabled={reportLoading}
                className="w-full px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded text-sm transition-colors disabled:opacity-50"
              >
                Generate Report
              </button>
              <Link
                href={`/project/${params.id}/documents`}
                className="w-full px-4 py-2 bg-[var(--accent)]/10 border border-[var(--accent)]/30 hover:bg-[var(--accent)]/20 text-[var(--accent)] rounded text-sm transition-colors text-center block font-medium"
              >
                Document Package
              </Link>
            </SidebarSection>

            <SidebarDivider />

            <SidebarSection title="EXPORT">
              <button
                onClick={() => {
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
                }}
                disabled={points.length === 0}
                className="w-full px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded text-sm transition-colors disabled:opacity-50 text-left"
              >
                Export LandXML
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
                className="w-full px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded text-sm transition-colors disabled:opacity-50 text-left"
              >
                Export GeoJSON
              </button>
              <Link
                href="/tools/gis-export"
                className="w-full px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded text-sm transition-colors text-left block"
              >
                GIS Package (GeoJSON/KML)
              </Link>
              <Link
                href="/tools/civil-export"
                className="w-full px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded text-sm transition-colors text-left block"
              >
                Civil 3D Export
              </Link>
              <Link
                href="/tools/gcp-export"
                className="w-full px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded text-sm transition-colors text-left block"
              >
                GCP Export (Pix4D/DroneDeploy)
              </Link>
              <button
                onClick={async () => {
                  const sb = getSupabase()
                  if (sb) await exportProject(params.id, sb)
                }}
                disabled={points.length === 0}
                className="w-full px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded text-sm transition-colors disabled:opacity-50 text-left"
              >
                Export Project
              </button>
            </SidebarSection>

            <SidebarDivider />

            <SidebarSection title="TOOLS">
              <button
                onClick={() => setShowStakeout(true)}
                disabled={points.length === 0}
                className="w-full px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded text-sm transition-colors disabled:opacity-50"
              >
                Stakeout Mode
              </button>
              <button
                onClick={() => setShowNearbyBeacons(true)}
                className="w-full px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded text-sm transition-colors"
              >
                Nearby Beacons
              </button>
              <Link
                href={`/project/${params.id}/profiles`}
                className="w-full px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded text-sm transition-colors text-center block"
              >
                Profiles
              </Link>
              <button
                onClick={() => setShowParcelBuilder(true)}
                disabled={points.length < 3}
                className="w-full px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded text-sm transition-colors disabled:opacity-50"
              >
                Build Parcel
              </button>
            </SidebarSection>

            {shareUrl && (
              <div className="mt-4 p-2 bg-green-900/30 border border-green-700 rounded">
                <div className="text-xs text-green-400 mb-1">✓ Report uploaded</div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 px-2 py-1 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] font-mono"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(shareUrl)
                      navigator.clipboard.writeText(window.location.href).catch(() => {})
                    }}
                    className="px-2 py-1 text-xs bg-gray-700 hover:bg-[var(--border-hover)] text-white rounded"
                  >
                    {t('common.copy')}
                  </button>
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-1">Link expires in 7 days</div>
              </div>
            )}
            
            <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
              <div className="flex items-center gap-2 text-xs">
                <div className={`w-2 h-2 rounded-full ${
                  syncStatus === 'synced' ? 'bg-green-500' :
                  syncStatus === 'pending' ? 'bg-yellow-500 animate-pulse' :
                  'bg-red-500'
                }`} />
                <span className="text-[var(--text-secondary)]">
                  {syncStatus === 'synced' ? 'All changes saved' :
                   syncStatus === 'pending' ? 'Saving...' :
                   'Offline — changes queued'}
                </span>
              </div>
            </div>
          </div>
        }
        center={
          <div className="h-full flex flex-col min-h-0">
        <header className="px-3 py-3 md:px-6 md:py-4 border-b border-[var(--border-color)]">
          <div className="flex flex-col md:flex-row gap-1 md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-bold text-[var(--text-primary)] truncate max-w-[200px] md:max-w-none">
                {project.name}
              </h1>
              <span className={`badge text-[10px] border hidden sm:inline ${surveyTypeBadge.badgeColor}`}>
                {surveyTypeBadge.label} SURVEY
              </span>
            </div>
            <div className="flex items-center gap-2 md:gap-4 text-xs md:text-sm">
              <span className="hidden md:inline text-[var(--text-secondary)]">
                UTM Zone {project.utm_zone}{project.hemisphere}{project.location && ` — ${project.location}`}
              </span>
              <div className="flex items-center gap-1 md:gap-2">
                {onlineUsers.length > 0 ? (
                  <div className="flex items-center gap-1">
                    <div className="flex -space-x-2">
                      {onlineUsers.slice(0, 3).map((u, i) => (
                        <div
                          key={i}
                          className="w-6 h-6 rounded-full bg-blue-500 border-2 border-[var(--border-color)] flex items-center justify-center text-xs text-white"
                          title={u.email}
                        >
                          {u.email?.charAt(0).toUpperCase() || '?'}
                        </div>
                      ))}
                    </div>
                    <span className="hidden md:inline text-[var(--text-secondary)]">{viewerCount} online</span>
                  </div>
                ) : (
                  <span className="text-[var(--text-secondary)]">👥 {viewerCount}</span>
                )}
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-[var(--text-muted)]'}`}></div>
                <span className="text-[var(--text-muted)]">{isOnline ? 'Live' : 'Offline'}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 p-6">
          <div className="mb-6">
            <ProjectMap
              height="520px"
              points={points.map(p => ({
                id: p.id,
                name: p.name,
                easting: p.easting,
                northing: p.northing,
                elevation: p.elevation ?? undefined,
                is_control: p.is_control,
                control_order: p.control_order,
                locked: p.locked
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
              selectedPointId={selectedPointId}
              onSelectPoint={(p: any) => setSelectedPointId(p?.id ?? null)}
            />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{t('workspace.coordinates')}</h2>
            {pointActionError && (
              <div className="mb-3 rounded border border-red-900/40 bg-red-900/10 px-3 py-2 text-sm text-red-200">
                {pointActionError}
              </div>
            )}
            <div className="border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 rounded-lg overflow-hidden">
              <div className="md:hidden space-y-2 p-3">
                {points.length > 0 ? (
                  points.map((point) => (
                    <div
                      key={point.id}
                      onClick={() => setSelectedPointId(point.id)}
                      className={`bg-[var(--bg-secondary)] p-3 rounded border ${selectedPointId === point.id ? 'border-[var(--accent)]' : 'border-[var(--border-color)]'}`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-mono font-bold text-sm">{point.name}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEditPoint(point); }}
                            className="text-xs px-2 py-1 bg-[var(--bg-tertiary)] rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeletePoint(point); }}
                            disabled={!!point.locked}
                            className="text-xs px-2 py-1 bg-red-900/40 text-red-200 rounded disabled:opacity-50"
                          >
                            Del
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-xs font-mono text-[var(--text-secondary)]">
                        <span>E: {point.easting.toFixed(3)}</span>
                        <span>N: {point.northing.toFixed(3)}</span>
                        <span>RL: {point.elevation?.toFixed(3) ?? '—'}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-4 text-[var(--text-muted)] text-sm">{t('workspace.noPointsHint')}</p>
                )}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border-color)]">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-primary)]">{t('points.pointName')}</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-primary)]">{t('points.easting')}</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-primary)]">{t('points.northing')}</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-primary)]">{t('points.elevation')}</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-[var(--text-primary)]">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.length > 0 ? (
                      points.map((point) => (
                        <tr
                          key={point.id}
                          onClick={() => setSelectedPointId(point.id)}
                          className={`border-b border-[var(--border-color)]/50 ${selectedPointId === point.id ? 'bg-[var(--accent-subtle)]' : 'hover:bg-white/5'}`}
                        >
                          <td className="px-4 py-3 font-mono text-[var(--text-primary)]">
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
                          <td className="px-4 py-3 font-mono text-[var(--text-primary)]">{point.easting.toFixed(4)}</td>
                          <td className="px-4 py-3 font-mono text-[var(--text-primary)]">{point.northing.toFixed(4)}</td>
                          <td className="px-4 py-3 font-mono text-[var(--text-primary)]">{point.elevation?.toFixed(3) ?? '—'}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleCopyCoords(point)}
                                className="text-xs px-2 py-1 bg-gray-700 hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded transition-colors"
                              >
                                {copiedId === point.id ? t('common.copied') : t('common.copy')}
                              </button>
                              <button
                                onClick={() => handleEditPoint(point)}
                                className="text-xs px-2 py-1 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded transition-colors"
                              >
                                {t('common.edit')}
                              </button>
                              <button
                                onClick={() => handleDeletePoint(point)}
                                disabled={!!point.locked}
                                className="text-xs px-2 py-1 bg-red-900/40 hover:bg-red-900/60 text-red-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title={point.locked ? t('workspace.lockedCannotDelete') : t('workspace.deletePoint')}
                              >
                                {t('common.delete')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-muted)]">
                          {t('workspace.noPointsHint')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
          </div>
        }
        right={
          <div className="p-3 space-y-3">
            {selectedPoint ? (
              <div className="rounded border border-white/5 bg-[var(--bg-primary)]/20 p-3">
                <div className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2">POINT DETAILS</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-mono text-lg text-[var(--text-primary)]">{selectedPoint.name}</div>
                    <button onClick={() => setSelectedPointId(null)} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                      Clear
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded bg-[var(--bg-primary)]/30 border border-[var(--border-color)] p-2">
                      <div className="text-[var(--text-muted)]">Easting</div>
                      <div className="font-mono text-[var(--text-primary)]">{selectedPoint.easting.toFixed(4)}</div>
                    </div>
                    <div className="rounded bg-[var(--bg-primary)]/30 border border-[var(--border-color)] p-2">
                      <div className="text-[var(--text-muted)]">Northing</div>
                      <div className="font-mono text-[var(--text-primary)]">{selectedPoint.northing.toFixed(4)}</div>
                    </div>
                    <div className="rounded bg-[var(--bg-primary)]/30 border border-[var(--border-color)] p-2">
                      <div className="text-[var(--text-muted)]">RL (Elev)</div>
                      <div className="font-mono text-[var(--text-primary)]">
                        {selectedPoint.elevation !== null ? selectedPoint.elevation.toFixed(3) : '-'}
                      </div>
                    </div>
                    <div className="rounded bg-[var(--bg-primary)]/30 border border-[var(--border-color)] p-2">
                      <div className="text-[var(--text-muted)]">Type</div>
                      <div className="text-[var(--text-primary)]">{selectedPoint.is_control ? 'Control' : 'Detail'}</div>
                    </div>
                  </div>
                  {selectedPoint.is_control && selectedPoint.control_order && (
                    <div className="text-xs">
                      <span className="text-[var(--text-muted)]">Order: </span>
                      <span className={selectedPoint.control_order === 'primary' ? 'text-red-400' : 
                        selectedPoint.control_order === 'secondary' ? 'text-orange-400' : 'text-yellow-400'}>
                        {selectedPoint.control_order.toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyCoords(selectedPoint)}
                      className="flex-1 px-3 py-2 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] text-sm"
                    >
                      {copiedId === selectedPoint.id ? t('common.copied') : t('common.copy')}
                    </button>
                    <button
                      onClick={() => handleEditPoint(selectedPoint)}
                      disabled={!!selectedPoint.locked}
                      className="flex-1 px-3 py-2 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] text-sm disabled:opacity-50"
                    >
                      {t('common.edit')}
                    </button>
                    <button
                      onClick={() => handleDeletePoint(selectedPoint)}
                      disabled={!!selectedPoint.locked}
                      className="flex-1 px-3 py-2 rounded bg-red-900/30 hover:bg-red-900/50 text-red-200 text-sm disabled:opacity-50"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded border border-white/5 bg-[var(--bg-primary)]/20 p-3">
                <div className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2">PROJECT INFO</div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Points:</span>
                    <span className="font-mono text-[var(--text-primary)]">{points.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Parcels:</span>
                    <span className="font-mono text-[var(--text-primary)]">{parcels.length}</span>
                  </div>
                  {projectArea && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Area:</span>
                        <span className="font-mono text-[var(--text-primary)]">{projectArea.areaSqm.toFixed(2)} m²</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Perimeter:</span>
                        <span className="font-mono text-[var(--text-primary)]">{projectArea.perimeter.toFixed(2)} m</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">UTM Zone:</span>
                    <span className="font-mono text-[var(--text-primary)]">{project.utm_zone}{project.hemisphere}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Datum:</span>
                    <span className="text-[var(--text-primary)]">{project.datum || 'ARC1960'}</span>
                  </div>
                </div>
                
                {traverseResult && (
                  <>
                    <div className="border-t border-[var(--border-color)] mt-3 pt-3">
                      <div className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2">TRAVERSE STATUS</div>
                      <div className="space-y-1.5 text-xs">
                        {traverseResult.closureError && (
                          <div className="flex justify-between">
                            <span className="text-[var(--text-muted)]">Closure Error:</span>
                            <span className="font-mono text-[var(--text-primary)]">{traverseResult.closureError.toFixed(4)} m</span>
                          </div>
                        )}
                        {traverseResult.accuracy && (
                          <div className="flex justify-between items-center">
                            <span className="text-[var(--text-muted)]">Accuracy:</span>
                            <span className="badge badge-success text-[10px]">First Order Class I</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
                
                <div className="border-t border-[var(--border-color)] mt-3 pt-3">
                  <div className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2">QUICK ACTIONS</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowTraverse(true)}
                      className="flex-1 px-3 py-2 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] text-xs"
                    >
                      Run Traverse
                    </button>
                    <button
                      onClick={handleGenerateSurveyPlan}
                      disabled={points.length === 0}
                      className="flex-1 px-3 py-2 rounded bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black text-xs font-semibold disabled:opacity-50"
                    >
                      Generate Plan
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="rounded border border-white/5 bg-[var(--bg-primary)]/20 p-3 text-sm text-[var(--text-primary)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">Map mode</span>
                <span className="font-mono">{mapMode}</span>
              </div>
            </div>
          </div>
        }
        bottom={
          <div className="h-full">
            <div className="sticky top-0 z-10 bg-[var(--bg-secondary)] border-b border-white/5 px-3 py-2 flex items-center gap-2">
              <button
                onClick={() => setBottomTab('log')}
                className={`px-3 py-1.5 rounded text-sm ${
                  bottomTab === 'log'
                    ? 'bg-[var(--accent)] text-black font-semibold'
                    : 'bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)]'
                }`}
              >
                Calculation Log
              </button>
              <button
                onClick={() => setBottomTab('fieldbook')}
                className={`px-3 py-1.5 rounded text-sm ${
                  bottomTab === 'fieldbook'
                    ? 'bg-[var(--accent)] text-black font-semibold'
                    : 'bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)]'
                }`}
              >
                Field Notes
              </button>
            </div>

            {bottomTab === 'fieldbook' ? (
              <div className="p-3 space-y-2 text-sm text-[var(--text-primary)]">
                <div className="text-[var(--text-secondary)]">
                  Field Notes stores structured observations (leveling, traverse, control) in textbook-style tables and keeps an audit trail.
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/fieldbook?project=${params.id}`}
                    className="px-4 py-2 rounded bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold"
                  >
                    Open Field Book
                  </Link>
                  <Link href="/field" className="px-4 py-2 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)]">
                    Open Field Mode
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-3 grid grid-cols-1 lg:grid-cols-[16rem_1fr] gap-3">
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">Recent</div>
                  {calcLog.length ? (
                    calcLog.map((s, i) => (
                      <button
                        key={`${s.title ?? 'solution'}-${i}`}
                        onClick={() => setActiveSolutionIndex(i)}
                        className={`w-full text-left px-3 py-2 rounded border ${
                          i === activeSolutionIndex
                            ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
                            : 'border-[var(--border-color)] bg-[var(--bg-primary)]/20 hover:bg-white/5'
                        }`}
                      >
                        <div className="text-sm text-[var(--text-primary)] truncate">{s.title ?? 'Solution'}</div>
                        <div className="text-xs text-[var(--text-muted)] truncate">
                          {s.result?.[0]?.label ? `${s.result[0].label}: ${s.result[0].value}` : `${s.result?.length ?? 0} result(s)`}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-sm text-[var(--text-muted)]">Run a traverse, compute an area, or build a parcel to see solutions here.</div>
                  )}
                </div>

                <div className="min-h-0">
                  {calcLog[activeSolutionIndex] ? (
                    <SolutionRenderer solution={calcLog[activeSolutionIndex]} />
                  ) : (
                    <div className="rounded border border-[var(--border-color)] bg-[var(--bg-primary)]/20 p-4 text-sm text-[var(--text-muted)]">No solution selected.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        }
      />

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--bg-secondary)] border-t border-[var(--border-color)] px-4 py-2 flex justify-around z-50">
        <button
          onClick={() => setShowAddPoint(true)}
          className="text-xs px-3 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] rounded text-[var(--text-primary)]"
        >
          + Point
        </button>
        <button
          onClick={() => setShowTraverse(true)}
          className="text-xs px-3 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] rounded text-[var(--text-primary)]"
        >
          Traverse
        </button>
        <button
          onClick={handleGenerateSurveyPlan}
          className="text-xs px-3 py-2 bg-[var(--accent)] hover:opacity-90 rounded text-black font-medium"
        >
          Generate Plan
        </button>
      </div>

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
        onTraverseResult={(r: any) => {
          setTraverseResult(r)
          try {
            pushSolution(bowditchAdjustmentSolutionFromResult(r))
          } catch {}
        }}
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
          elevation: p.elevation ?? undefined,
          is_control: p.is_control
        }))}
        onAreaResult={(r: any) => {
          setAreaResult(r)
          try {
            const pts = areaPoints.map((p) => ({ easting: p.easting, northing: p.northing }))
            pushSolution(coordinateAreaSolution(pts).solution)
          } catch {}
        }}
      />

      {showStakeout && (
        <div className="fixed inset-0 z-50 bg-[var(--bg-primary)]">
          <div className="absolute top-4 right-4 z-50">
            <button
              onClick={() => setShowStakeout(false)}
              className="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded-lg"
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
              elevation: p.elevation ?? undefined
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
    </>
    </ErrorBoundary>
  )
}
