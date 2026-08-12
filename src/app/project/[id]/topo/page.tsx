'use client';

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/api-client/client'
import { generateContours } from '@/lib/topo/contourGenerator'
import { runIDW as computeIDW } from '@/lib/topo/idwEngine'
import type { SpotHeight } from '@/components/drawing/TopoCanvas'
import type { ContourLine } from '@/lib/topo/contourGenerator'
import { logger } from '@/lib/logger'

const TopoCanvas = dynamic(() => import('@/components/drawing/TopoCanvas').then(m => ({ default: m.TopoCanvas })), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-gray-200 rounded h-64" />,
})

const INTERVAL_OPTIONS = [0.25, 0.5, 1, 2, 5, 10]
const RESOLUTION_OPTIONS = [0.5, 1, 2, 5]

export default function TopoPage() {
  const { id } = useParams()
  const [dbClient] = useState(() => createClient())

  const [spotHeights, setSpotHeights] = useState<SpotHeight[]>([])
  const [contours, setContours] = useState<ContourLine[]>([])
  const [interval, setIntervalValueValue] = useState(1)
  const [resolution, setResolution] = useState(1)
  const [status, setStatus] = useState<'idle' | 'loading' | 'computing' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [pointCount, setPointCount] = useState(0)

  const loadSpotHeights = useCallback(async () => {
    setStatus('loading')

    const { data, error } = await dbClient
      .from('survey_points')
      .select('*')
      .eq('project_id', id)
      .eq('point_type', 'spot_height')
            .not('elevation', 'is', null) as unknown as { data: Array<{ easting: number; northing: number; elevation: number; point_name?: string | null; name?: string | null }> | null; error: unknown }

    if (error || !data) {
      setStatus('error')
      return
    }

    const points: SpotHeight[] = (data as Array<{
      easting: number
      northing: number
      elevation: number
      point_name?: string | null
      name?: string | null
    }>).map((point) => ({
      e: point.easting,
      n: point.northing,
      z: point.elevation,
      label: point.point_name ?? point.name ?? '',
    }))

    setSpotHeights(points)
    setPointCount(points.length)
    setStatus('idle')
  }, [id, dbClient])

  useEffect(() => {
    void loadSpotHeights()
  }, [loadSpotHeights])

  function handleCompute() {
    if (spotHeights.length < 3) return

    setStatus('computing')
    setProgress(0)
    setContours([])

    setTimeout(() => {
      try {
        const points = spotHeights.map(p => ({ x: p.e, y: p.n, z: p.z }))

        const minE = Math.min(...points.map(p => p.x))
        const maxE = Math.max(...points.map(p => p.x))
        const minN = Math.min(...points.map(p => p.y))
        const maxN = Math.max(...points.map(p => p.y))
        const cols = Math.ceil((maxE - minE) / resolution) + 1
        const rows = Math.ceil((maxN - minN) / resolution) + 1

        setProgress(20)

        const idwGrid = computeIDW(points, { power: 2, resolution: Math.max(cols, rows) })

        setProgress(80)

        const lines = generateContours(
          {
            grid: idwGrid.grid,
            gridMinE: idwGrid.minX,
            gridMinN: idwGrid.minY,
            gridResolution: idwGrid.cellSize,
            cols: idwGrid.cols,
            rows: idwGrid.rows,
          },
          { interval, indexInterval: 5 }
        )
        setContours(lines)
        setProgress(100)
        setStatus('done')
      } catch (err) {
        logger.error('IDW error:', { error: err })
        setStatus('error')
      }
    }, 0)
  }

  async function exportDXF() {
    // ponytail: binary download bypasses typed client
    const response = await fetch('/api/topo/export/dxf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: id, contours, spotHeights }),
    })

    if (!response.ok) {
      return
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `topo_${id}.dxf`
    anchor.click()
  }

  async function exportGeoJSON() {
    const features = contours.flatMap((contour) =>
      contour.coordinates.map((ring) => ({
        type: 'Feature',
        properties: { elevation: contour.elevation, isIndex: contour.isIndex },
        geometry: { type: 'LineString', coordinates: ring.map(([e, n]) => [e, n]) },
      }))
    )

    const geojson = { type: 'FeatureCollection', features }
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `contours_${id}.geojson`
    anchor.click()
  }

  async function exportShapefile() {
    // ponytail: binary download bypasses typed client
    const response = await fetch('/api/topo/export/shapefile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: id, contours, spotHeights }),
    })

    if (!response.ok) {
      return
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `contours_${id}.zip`
    anchor.click()
  }

  return (
    <div className="space-y-6 p-4">
      <div>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold">Topographic Map</h2>
            <p className="text-sm text-[var(--text-muted)]">{pointCount} spot heights loaded</p>
          </div>
          <Link
            href={`/project/${id}`}
            prefetch={false}
            className="text-sm text-orange-400 hover:text-orange-300"
          >
            Back to workspace
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="text-xs text-[var(--text-muted)] block mb-1" htmlFor="contour-interval-m">Contour Interval (m)</label>
          <select id="contour-interval-m"
            value={interval}
            onChange={(event) => setIntervalValueValue(Number(event.target.value))}
            className="bg-[var(--bg-secondary)] border rounded px-3 py-1.5 text-sm"
          >
            {INTERVAL_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}m
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-[var(--text-muted)] block mb-1" htmlFor="grid-resolution-m">Grid Resolution (m)</label>
          <select
             id="grid-resolution-m" value={resolution}
            onChange={(event) => setResolution(Number(event.target.value))}
            className="bg-[var(--bg-secondary)] border rounded px-3 py-1.5 text-sm"
          >
            {RESOLUTION_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}m
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleCompute}
          disabled={spotHeights.length < 3 || status === 'computing'}
          className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-4 py-1.5 rounded text-sm font-medium"
        >
          {status === 'computing' ? `Computing... ${progress}%` : 'Generate Contours'}
        </button>

        {status === 'done' && (
          <span className="text-sm text-green-400">OK {contours.length} contour levels generated</span>
        )}
      </div>

      {status === 'computing' && (
        <div className="w-full bg-[var(--bg-secondary)] rounded-full h-1.5">
          <div
            className="bg-orange-500 h-1.5 rounded-full transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <TopoCanvas
        spotHeights={spotHeights}
        contours={contours}
        width={880}
        height={620}
        showLabels
        showSpotHeights
      />

      {status === 'done' && contours.length > 0 && (
        <div className="flex gap-3">
          <button
            onClick={exportDXF}
            className="border rounded px-4 py-2 text-sm hover:bg-[var(--bg-secondary)]"
          >
            Export DXF
          </button>
          <button
            onClick={exportGeoJSON}
            className="border rounded px-4 py-2 text-sm hover:bg-[var(--bg-secondary)]"
          >
            Export GeoJSON
          </button>
          <button
            onClick={exportShapefile}
            className="border rounded px-4 py-2 text-sm hover:bg-[var(--bg-secondary)]"
          >
            Export Shapefile
          </button>
        </div>
      )}
    </div>
  )
}
