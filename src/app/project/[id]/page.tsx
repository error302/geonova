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
  } | null>(null)
  const [traverseResult, setTraverseResult] = useState<any>(null)
  const [areaResult, setAreaResult] = useState<any>(null)

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

  const handleDeletePoint = async (pointId: string) => {
    await supabase.from('survey_points').delete().eq('id', pointId)
    fetchData()
  }

  const handleEditPoint = (point: any) => {
    setEditPoint({
      id: point.id,
      name: point.name,
      easting: point.easting,
      northing: point.northing,
      elevation: point.elevation || 0,
      is_control: point.is_control || false
    })
    setShowAddPoint(true)
  }

  const handleCopyCoords = async (point: Point) => {
    const text = point.name + ', ' + point.easting + ', ' + point.northing + ', ' + (point.elevation || 0)
    await navigator.clipboard.writeText(text)
    setCopiedId(point.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const handleGenerateReport = () => {
    if (!project) return
    
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
    })
  }

  const handleAreaPointSelect = (point: any) => {
    if (areaPoints.length >= 3 && areaPoints[0].id === point.id) {
      // Closed polygon - calculate area
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
            className="w-full px-4 py-2 bg-[#E8841A] hover:bg-[#d67715] text-black font-semibold rounded text-sm transition-colors"
          >
            📄 Generate Report
          </button>
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
                is_control: p.is_control
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
                          {point.is_control && (
                            <span className="ml-2 text-xs text-red-400">(CP)</span>
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
    </div>
  )
}
