'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { geographicToUTM } from '@/lib/engine/coordinates'
import { generateSurveyReport } from '@/lib/reports/generateReport'
import AddPointModal from '@/components/AddPointModal'
import CSVUploadModal from '@/components/CSVUploadModal'
import TraverseModal from '@/components/TraverseModal'
import ParcelAreaModal from '@/components/ParcelAreaModal'
import StakeoutMode from '@/components/StakeoutMode'

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
    
    generateSurveyReport({
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
        elevation: p.elevation || 0,
        is_control: p.is_control
      })),
      traverse: traverseResult || undefined,
      area: areaResult || undefined
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
            onClick={() => setShowStakeout(true)}
            disabled={points.length === 0}
            className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-sm transition-colors disabled:opacity-50"
          >
            🎯 Stakeout All Points
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
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300"></th>
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
                          <button
                            onClick={() => handleCopyCoords(point)}
                            className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                          >
                            {copiedId === point.id ? 'Copied!' : 'Copy'}
                          </button>
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
            onComplete={() => {}}
          />
        </div>
      )}
    </div>
  )
}
