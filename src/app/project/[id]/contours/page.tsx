'use client'
import { useState, useEffect, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { generateContours, SpotHeight, ContourLine } from '@/lib/engine/contours'

type EngineMode = 'python' | 'typescript' | null

interface ContourSegment { elevation: number; segments: number[][][] }

export default function ContoursPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const supabase = createClient()

  const [points, setPoints] = useState<SpotHeight[]>([])
  const [contours, setContours] = useState<ContourLine[]>([])
  const [interval, setInterval] = useState(1)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [engineMode, setEngineMode] = useState<EngineMode>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadPoints() {
      const { data } = await supabase
        .from('survey_points')
        .select('name, easting, northing, elevation')
        .eq('project_id', projectId)
        .order('name')
      if (data) {
        setPoints(data.map(p => ({
          name: p.name,
          easting: p.easting,
          northing: p.northing,
          elevation: p.elevation || 0
        })))
      }
      setLoading(false)
    }
    loadPoints()
  }, [projectId])

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)

    // Try Python engine first (Delaunay triangulation — much better quality)
    try {
      const res = await fetch('/api/compute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'contours',
          payload: {
            points: points.map(p => ({ x: p.easting, y: p.northing, z: p.elevation })),
            interval,
            base_elevation: Math.min(...points.map(p => p.elevation)),
          }
        })
      })

      const data = await res.json()

      if (res.ok && data.contours && !data.fallback) {
        // Convert Python response format → ContourLine[]
        const converted: ContourLine[] = (data.contours as ContourSegment[]).flatMap(c =>
          c.segments.map(seg => ({
            elevation: c.elevation,
            points: seg.map(pt => ({
              easting: pt[0],
              northing: pt[1],
              elevation: c.elevation,
            }))
          }))
        )
        setContours(converted)
        setEngineMode('python')
        setGenerating(false)
        return
      }
    } catch {
      // Python engine unavailable — fall through to TS fallback
    }

    // TypeScript fallback
    const generated = generateContours(points, interval)
    setContours(generated)
    setEngineMode('typescript')
    setGenerating(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-amber-500">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Loading points…
        </div>
      </div>
    )
  }

  if (points.length < 3) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] py-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-4">Contour Map</h1>
          <div className="bg-[var(--bg-secondary)] border border-red-500/30 rounded-xl p-8">
            <p className="text-red-400 mb-2">Need at least 3 points with elevations to generate contours.</p>
            <p className="text-gray-500 text-sm">Current points with elevation: {points.length}</p>
          </div>
        </div>
      </div>
    )
  }

  const elevations = points.map(p => p.elevation)
  const minElev = Math.min(...elevations)
  const maxElev = Math.max(...elevations)

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-2">
          <h1 className="text-3xl font-bold text-white">Contour Map</h1>
          {engineMode && (
            <span className={`text-xs px-2 py-1 rounded font-medium ${
              engineMode === 'python'
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
            }`}>
              {engineMode === 'python' ? '⬡ Python engine' : '⬡ TS fallback'}
            </span>
          )}
        </div>
        <p className="text-gray-400 mb-8">Generate contours from spot heights using Delaunay triangulation</p>

        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[#222] p-6 mb-8">
          <div className="flex items-center gap-4 mb-6 flex-wrap">
            <label className="text-gray-400 text-sm">Contour interval</label>
            <select
              value={interval}
              onChange={e => setInterval(Number(e.target.value))}
              className="input w-32"
            >
              <option value={0.25}>0.25 m</option>
              <option value={0.5}>0.5 m</option>
              <option value={1}>1 m</option>
              <option value={2}>2 m</option>
              <option value={5}>5 m</option>
              <option value={10}>10 m</option>
            </select>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="btn btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Generating…
                </>
              ) : 'Generate Contours'}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {[
              { label: 'Points', value: points.length },
              { label: 'Min elevation', value: `${minElev.toFixed(2)} m` },
              { label: 'Max elevation', value: `${maxElev.toFixed(2)} m` },
              { label: 'Contour lines', value: contours.length },
            ].map(item => (
              <div key={item.label} className="bg-[var(--bg-primary)] p-3 rounded-lg border border-[#1e1e1e]">
                <p className="text-gray-500 text-xs mb-1">{item.label}</p>
                <p className="text-[var(--text-primary)] font-semibold font-mono">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
            {error}
          </div>
        )}

        {contours.length > 0 && (
          <div className="bg-[var(--bg-secondary)] rounded-xl border border-[#222] p-6">
            <ContourMap points={points} contours={contours} />
          </div>
        )}
      </div>
    </div>
  )
}

function ContourMap({ points, contours }: { points: SpotHeight[]; contours: ContourLine[] }) {
  const width = 700
  const height = 500
  const padding = 48

  const eastings = points.map(p => p.easting)
  const northings = points.map(p => p.northing)
  const elevations = points.map(p => p.elevation)

  const minE = Math.min(...eastings), maxE = Math.max(...eastings)
  const minN = Math.min(...northings), maxN = Math.max(...northings)
  const minElev = Math.min(...elevations), maxElev = Math.max(...elevations)

  const scaleE = (width - padding * 2) / (maxE - minE || 1)
  const scaleN = (height - padding * 2) / (maxN - minN || 1)
  const scale = Math.min(scaleE, scaleN)

  const toX = (e: number) => padding + (e - minE) * scale
  const toY = (n: number) => height - padding - (n - minN) * scale

  const elevColor = (elev: number): string => {
    const t = (elev - minElev) / (maxElev - minElev || 1)
    // Brown (low) → amber → green (high)
    const r = Math.round(139 - t * 39)
    const g = Math.round(90 + t * 110)
    const b = Math.round(43 - t * 43)
    return `rgb(${r},${g},${b})`
  }

  const majorInterval = (elev: number) => elev % 5 === 0

  const handleExportDXF = async () => {
    const res = await fetch('/api/compute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: 'export_dxf',
        payload: {
          projectName: 'Contour Export',
          points: points.map(p => ({ name: p.name, easting: p.easting, northing: p.northing })),
        }
      })
    })
    const data = await res.json()
    if (data.dxf) {
      const blob = new Blob([data.dxf], { type: 'text/plain' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = data.filename || 'contours.dxf'
      a.click()
    }
  }

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`}
        className="bg-[var(--bg-primary)] rounded-lg border border-[#1e1e1e]">

        {/* Grid lines */}
        {[...Array(5)].map((_, i) => {
          const y = padding + (i / 4) * (height - padding * 2)
          return <line key={i} x1={padding} y1={y} x2={width - padding} y2={y}
            stroke="#1e1e1e" strokeWidth={0.5}/>
        })}

        {/* Contour lines */}
        {contours.map((contour, i) => {
          const isMajor = contour.elevation % 5 === 0
          const pts = contour.points
          if (pts.length < 2) return null
          const d = pts.map((p, j) =>
            `${j === 0 ? 'M' : 'L'}${toX(p.easting).toFixed(1)},${toY(p.northing).toFixed(1)}`
          ).join(' ')
          return (
            <path key={i} d={d} fill="none"
              stroke={elevColor(contour.elevation)}
              strokeWidth={isMajor ? 1.2 : 0.6}
              opacity={isMajor ? 0.9 : 0.6}
            />
          )
        })}

        {/* Elevation labels on major contours */}
        {contours
          .filter(c => c.elevation % 5 === 0 && c.points.length > 0)
          .slice(0, 20)
          .map((contour, i) => {
            const p = contour.points[Math.floor(contour.points.length / 2)]
            if (!p) return null
            return (
              <text key={i} x={toX(p.easting)} y={toY(p.northing)}
                fill="rgba(255,255,255,0.7)" fontSize={8} textAnchor="middle"
                style={{ paintOrder: 'stroke', stroke: '#0a0a0f', strokeWidth: 3 }}>
                {contour.elevation}
              </text>
            )
          })}

        {/* Survey points */}
        {points.map(p => (
          <g key={p.name}>
            <circle cx={toX(p.easting)} cy={toY(p.northing)} r={3}
              fill={elevColor(p.elevation)} stroke="white" strokeWidth={0.8}/>
            <text x={toX(p.easting) + 5} y={toY(p.northing) - 5}
              fill="rgba(255,255,255,0.8)" fontSize={7}>
              {p.name}
            </text>
          </g>
        ))}

        {/* Legend */}
        <g transform={`translate(${width - 90}, 16)`}>
          <rect x={0} y={0} width={80} height={70} rx={6}
            fill="rgba(0,0,0,0.75)" stroke="#2a2a2a" strokeWidth={0.5}/>
          <text x={40} y={16} fill="rgba(255,255,255,0.7)" fontSize={8}
            textAnchor="middle" fontWeight="600">Elevation</text>
          {[maxElev, (minElev + maxElev) / 2, minElev].map((elev, i) => (
            <g key={i} transform={`translate(8, ${28 + i * 14})`}>
              <rect x={0} y={-6} width={12} height={8} rx={2} fill={elevColor(elev)}/>
              <text x={18} y={0} fill="rgba(255,255,255,0.6)" fontSize={7}>
                {elev.toFixed(1)} m
              </text>
            </g>
          ))}
        </g>
      </svg>

      <div className="mt-4 flex gap-3 flex-wrap">
        <button onClick={handleExportDXF}
          className="btn btn-primary text-sm">
          Export DXF
        </button>
        <button className="btn btn-secondary text-sm">
          Export PNG
        </button>
      </div>
    </div>
  )
}
