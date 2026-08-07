'use client';

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { db } from '@/lib/db'
import type { CADDocument } from '@/components/cad-editor/CADEditor'

// ponytail: lazy-load the CAD editor (it's a heavy SVG interaction component)
const CADEditor = dynamic(() => import('@/components/cad-editor/CADEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-gray-900">
      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
    </div>
  ),
})

export default function CADEditorPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const [doc, setDoc] = useState<CADDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Load traverse data and build CAD document
  useEffect(() => {
    async function loadPlanData() {
      try {
        setLoading(true)

        // Fetch the adjusted traverse coordinates from the API
        const res = await fetch(`/api/project/${projectId}/fieldbook`)
        const result = (await res.json()) as {
          data?: {
            stations?: Array<{ id: string; name?: string; easting: number; northing: number }>
            observations?: Array<Record<string, unknown>>
            projectName?: string
            lrNumber?: string
            surveyor?: string
            regNo?: string
          }
        }

        if (!result.data?.stations || result.data.stations.length === 0) {
          setError('No traverse data found. Compute a traverse first.')
          return
        }

        const stations = result.data.stations
        const observations = result.data.observations || []

        // Convert UTM coordinates to SVG coordinates
        // ponytail: simple linear transform — find bounding box, scale to fit A3
        const W = 1122  // A3 landscape at 96 DPI
        const H = 794
        const PADDING = 100

        const eastings = stations.map((s: { easting: number }) => s.easting)
        const northings = stations.map((s: { northing: number }) => s.northing)
        const minE = Math.min(...eastings)
        const maxE = Math.max(...eastings)
        const minN = Math.min(...northings)
        const maxN = Math.max(...northings)

        const rangeE = maxE - minE || 1
        const rangeN = maxN - minN || 1
        const scale = Math.min((W - 2 * PADDING) / rangeE, (H - 2 * PADDING) / rangeN)

        const toX = (e: number) => PADDING + (e - minE) * scale
        // SVG Y axis is inverted (down = positive)
        const toY = (n: number) => H - PADDING - (n - minN) * scale

        // Build beacons
        const beacons: CADDocument['beacons'] = stations.map((s: { id: string; name?: string; easting: number; northing: number }, i: number) => ({
          id: s.id || `b${i}`,
          label: s.name || `P${i + 1}`,
          x: toX(s.easting),
          y: toY(s.northing),
          easting: s.easting,
          northing: s.northing,
          symbol: 'concrete_beacon',
          locked: false,
        }))

        // Build boundaries from observations (sequential traverse legs)
        const boundaries: CADDocument['boundaries'] = []
        for (let i = 0; i < stations.length - 1; i++) {
          const from = stations[i]
          const to = stations[i + 1]
          // Calculate bearing
          const dE = to.easting - from.easting
          const dN = to.northing - from.northing
          const bearing = (Math.atan2(dE, dN) * 180 / Math.PI + 360) % 360
          const dist = Math.sqrt(dE * dE + dN * dN)

          const deg = Math.floor(bearing)
          const minFloat = (bearing - deg) * 60
          const min = Math.floor(minFloat)
          const sec = ((minFloat - min) * 60).toFixed(0)

          boundaries.push({
            id: `bdy-${i}`,
            fromId: beacons[i].id,
            toId: beacons[i + 1].id,
            bearing: `${deg}°${String(min).padStart(2, '0')}'${String(sec).padStart(2, '0')}"`,
            distance: dist.toFixed(3),
            type: 'standard',
          })
        }

        const cadDoc: CADDocument = {
          beacons,
          boundaries,
          annotations: [],
          northArrow: {
            x: W - 120,
            y: 100,
            rotation: 0,
            type: 'grid',
            bearing: '0°00\'00"',
          },
          scaleBar: {
            x: 80,
            y: H - 60,
            scaleMeters: Math.round(rangeE / 5),
          },
          titleBlock: {
            projectName: result.data.projectName || 'Survey Plan',
            lrNumber: result.data.lrNumber || '',
            surveyor: result.data.surveyor || '',
            regNo: result.data.regNo || '',
            date: new Date().toLocaleDateString('en-GB'),
            scale: `1:${Math.round(rangeE / (W - 2 * PADDING) * 1000)}`,
            sheet: '1 of 1',
          },
          width: W,
          height: H,
        }

        setDoc(cadDoc)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load plan data')
      } finally {
        setLoading(false)
      }
    }

    loadPlanData()
  }, [projectId])

  const handleSave = useCallback((savedDoc: CADDocument) => {
    // ponytail: save the CAD document to the project's engineering_data or a new cad_documents table
    // For now, save to localStorage as MVP. Phase 2: persist to DB.
    localStorage.setItem(`cad-doc-${projectId}`, JSON.stringify(savedDoc))
  }, [projectId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-gray-400">
        <p className="mb-4">{error}</p>
        <button onClick={() => router.push(`/project/${projectId}`)} className="text-blue-400 hover:underline">
          ← Back to project
        </button>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-800 border-b border-gray-700">
        <button
          onClick={() => router.push(`/project/${projectId}`)}
          className="text-gray-400 hover:text-white flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-sm font-medium text-white">CAD Editor — Survey Plan</h1>
      </div>
      <div className="flex-1">
        {doc && <CADEditor initialDocument={doc} onSave={handleSave} />}
      </div>
    </div>
  )
}
