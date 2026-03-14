'use client'
import { useState, useEffect, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { generateContours, SpotHeight, ContourLine } from '@/lib/engine/contours'

export default function ContoursPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const supabase = createClient()
  
  const [points, setPoints] = useState<SpotHeight[]>([])
  const [contours, setContours] = useState<ContourLine[]>([])
  const [interval, setInterval] = useState(1)
  const [loading, setLoading] = useState(true)

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
  }, [projectId, supabase])

  const handleGenerate = () => {
    const generated = generateContours(points, interval)
    setContours(generated)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-amber-500">Loading points...</div>
      </div>
    )
  }

  if (points.length < 3) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] py-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Contour Map</h1>
          <div className="bg-[#111] border border-red-500/50 rounded-xl p-8">
            <p className="text-red-400 mb-4">
              Need at least 3 points with elevations to generate contours.
            </p>
            <p className="text-gray-400">
              Current points: {points.length}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const elevations = points.map(p => p.elevation)
  const minElev = Math.min(...elevations)
  const maxElev = Math.max(...elevations)

  return (
    <div className="min-h-screen bg-[#0a0a0f] py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Contour Map</h1>
        <p className="text-gray-400 mb-8">Generate contours from spot heights</p>

        <div className="bg-[#111] rounded-xl border border-[#222] p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Contour Settings</h2>
          <div className="flex items-center gap-4 mb-6">
            <label className="text-gray-400">Interval:</label>
            <select
              value={interval}
              onChange={(e) => setInterval(Number(e.target.value))}
              className="bg-gray-900 border border-gray-700 rounded px-4 py-2 text-white"
            >
              <option value={0.5}>0.5 m</option>
              <option value={1}>1 m</option>
              <option value={2}>2 m</option>
              <option value={5}>5 m</option>
            </select>
            <button
              onClick={handleGenerate}
              className="px-6 py-2 bg-amber-500 text-black font-bold rounded hover:bg-amber-400"
            >
              Generate Contours
            </button>
          </div>

          <div className="grid grid-cols-4 gap-4 text-sm">
            <div className="bg-gray-900 p-3 rounded">
              <p className="text-gray-500">Points</p>
              <p className="text-white font-bold">{points.length}</p>
            </div>
            <div className="bg-gray-900 p-3 rounded">
              <p className="text-gray-500">Min Elevation</p>
              <p className="text-white font-bold">{minElev.toFixed(2)}m</p>
            </div>
            <div className="bg-gray-900 p-3 rounded">
              <p className="text-gray-500">Max Elevation</p>
              <p className="text-white font-bold">{maxElev.toFixed(2)}m</p>
            </div>
            <div className="bg-gray-900 p-3 rounded">
              <p className="text-gray-500">Contours</p>
              <p className="text-white font-bold">{contours.length}</p>
            </div>
          </div>
        </div>

        {contours.length > 0 && (
          <div className="bg-[#111] rounded-xl border border-[#222] p-6">
            <ContourMap points={points} contours={contours} />
          </div>
        )}
      </div>
    </div>
  )
}

function ContourMap({ 
  points, 
  contours 
}: { 
  points: SpotHeight[]
  contours: ContourLine[] 
}) {
  const width = 700
  const height = 500
  const padding = 40

  const eastings = points.map(p => p.easting)
  const northings = points.map(p => p.northing)
  const elevations = points.map(p => p.elevation)

  const minE = Math.min(...eastings)
  const maxE = Math.max(...eastings)
  const minN = Math.min(...northings)
  const maxN = Math.max(...northings)
  const minElev = Math.min(...elevations)
  const maxElev = Math.max(...elevations)

  const scaleE = (width - padding * 2) / (maxE - minE || 1)
  const scaleN = (height - padding * 2) / (maxN - minN || 1)
  const scale = Math.min(scaleE, scaleN)

  function toX(e: number) {
    return padding + (e - minE) * scale
  }
  function toY(n: number) {
    return height - padding - (n - minN) * scale
  }

  function elevationColor(elev: number): string {
    const t = (elev - minElev) / (maxElev - minElev || 1)
    const r = Math.round(0 + t * 200)
    const g = Math.round(100 + t * 100)
    const b = Math.round(50 - t * 50)
    return `rgb(${r},${g},${b})`
  }

  return (
    <div>
      <svg width={width} height={height}
        className="bg-gray-900 rounded border border-amber-500/30">

        {contours.map((contour, i) => {
          const segments = []
          for (let j = 0; j < contour.points.length - 1; j += 2) {
            const p1 = contour.points[j]
            const p2 = contour.points[j + 1]
            segments.push(
              <line
                key={`${i}-${j}`}
                x1={toX(p1.easting)} y1={toY(p1.northing)}
                x2={toX(p2.easting)} y2={toY(p2.northing)}
                stroke={elevationColor(contour.elevation)}
                strokeWidth={contour.elevation % 5 === 0 ? 1.5 : 0.8}
                opacity={0.8}
              />
            )
          }
          return segments
        })}

        {contours
          .filter(c => c.elevation % 5 === 0)
          .map((contour, i) => {
            if (!contour.points[0]) return null
            const p = contour.points[0]
            return (
              <text
                key={i}
                x={toX(p.easting)}
                y={toY(p.northing)}
                fill="white"
                fontSize={8}
                textAnchor="middle"
              >
                {contour.elevation}m
              </text>
            )
          })}

        {points.map(p => (
          <g key={p.name}>
            <circle
              cx={toX(p.easting)}
              cy={toY(p.northing)}
              r={3}
              fill={elevationColor(p.elevation)}
              stroke="white"
              strokeWidth={0.5}
            />
            <text
              x={toX(p.easting) + 4}
              y={toY(p.northing) - 4}
              fill="white"
              fontSize={7}
            >
              {p.name} ({p.elevation.toFixed(1)})
            </text>
          </g>
        ))}

        <g transform={`translate(${width - 80}, 20)`}>
          <rect x={0} y={0} width={70} height={60}
            fill="rgba(0,0,0,0.7)" rx={4}/>
          <text x={35} y={14} fill="white" fontSize={8}
            textAnchor="middle" fontWeight="bold">
            Elevation
          </text>
          <text x={35} y={26} fill={elevationColor(maxElev)}
            fontSize={7} textAnchor="middle">
            {maxElev.toFixed(1)}m
          </text>
          <text x={35} y={38} fill={elevationColor((minElev+maxElev)/2)}
            fontSize={7} textAnchor="middle">
            {((minElev+maxElev)/2).toFixed(1)}m
          </text>
          <text x={35} y={50} fill={elevationColor(minElev)}
            fontSize={7} textAnchor="middle">
            {minElev.toFixed(1)}m
          </text>
        </g>
      </svg>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <button className="py-2 bg-amber-500 text-black font-bold rounded hover:bg-amber-400">
          Export DXF
        </button>
        <button className="py-2 border border-amber-500 text-amber-500 font-bold rounded hover:bg-amber-500/10">
          Export PNG
        </button>
        <button className="py-2 border border-gray-600 text-gray-400 font-bold rounded hover:bg-gray-800">
          Export CSV
        </button>
      </div>
    </div>
  )
}
