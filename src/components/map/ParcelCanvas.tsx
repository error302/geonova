'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import Konva from 'konva'
import { shoelaceArea } from '@/lib/engine/area'
import { formatBearingDegMinSec, bearingFromDelta, distance } from '@/lib/reports/surveyPlan/geometry'

export interface ParcelVertex {
  id: string
  label: string
  easting: number
  northing: number
}

export type DrawingMode = 'draw' | 'edit' | 'select'

export interface ParcelCanvasProps {
  width?: number
  height?: number
  /** Initial parcels (pre-defined boundaries to show as reference) */
  existingParcels?: Array<{
    id: string
    vertices: ParcelVertex[]
    fill?: string
    stroke?: string
  }>
  /** Currently selected parcel being edited */
  activeParcel?: ParcelVertex[]
  /** Drawing mode */
  mode?: DrawingMode
  /** CRS origin for coordinate display */
  originEasting?: number
  originNorthing?: number
  /** Called when the user finishes drawing (closes polygon or clicks Done) */
  onParcelComplete?: (vertices: ParcelVertex[]) => void
  /** Called on every vertex add */
  onVerticesChange?: (vertices: ParcelVertex[]) => void
  /** Whether to show live area while drawing */
  showLiveArea?: boolean
  /** Whether to show bearing/distance labels on legs */
  showLegAnnotations?: boolean
  className?: string
}

interface CanvasTransform {
  scale: number
  originE: number
  originN: number
}

function computeTransform(
  vertices: ParcelVertex[],
  canvasWidth: number,
  canvasHeight: number,
  padding = 60
): CanvasTransform {
  if (vertices.length === 0) {
    return { scale: 1, originE: 0, originN: 0 }
  }

  const eastings = vertices.map(v => v.easting)
  const northings = vertices.map(v => v.northing)

  const minE = Math.min(...eastings)
  const maxE = Math.max(...eastings)
  const minN = Math.min(...northings)
  const maxN = Math.max(...northings)

  const rangeE = maxE - minE || 1
  const rangeN = maxN - minN || 1

  const availW = canvasWidth - padding * 2
  const availH = canvasHeight - padding * 2

  const scale = Math.min(availW / rangeE, availH / rangeN, 50)

  const originE = minE - (availW / scale - rangeE) / 2 - padding / scale
  const originN = maxN + (availH / scale - rangeN) / 2 + padding / scale

  return { scale, originE, originN }
}

function w2c(
  e: number,
  n: number,
  t: CanvasTransform,
  canvasHeight: number
): { x: number; y: number } {
  return {
    x: (e - t.originE) * t.scale,
    y: canvasHeight - (n - t.originN) * t.scale,
  }
}

const BEACON_RADIUS = 6
const BEACON_COLOR = '#E63946'
const VERTEX_RADIUS = 5
const VERTEX_COLOR = '#1B3A5C'
const EDGE_COLOR = '#1B3A5C'
const PREVIEW_EDGE_COLOR = '#6BA3D6'
const AREA_BOX_COLOR = '#F0F4F8'
const AREA_TEXT_COLOR = '#1B3A5C'

function formatArea(sqM: number): string {
  if (sqM >= 10000) return `${(sqM / 10000).toFixed(4)} Ha`
  if (sqM >= 1) return `${sqM.toFixed(2)} m²`
  return `${(sqM * 10000).toFixed(4)} m²`
}

export default function ParcelCanvas({
  width = 800,
  height = 600,
  existingParcels = [],
  activeParcel = [],
  mode = 'draw',
  originEasting = 0,
  originNorthing = 0,
  onParcelComplete,
  onVerticesChange,
  showLiveArea = true,
  showLegAnnotations = true,
  className = '',
}: ParcelCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage | null>(null)
  const layerRef = useRef<Konva.Layer | null>(null)

  const [vertices, setVertices] = useState<ParcelVertex[]>(activeParcel)
  const [hoveredVertex, setHoveredVertex] = useState<string | null>(null)
  const [selectedVertex, setSelectedVertex] = useState<string | null>(null)
  const [mouseWorld, setMouseWorld] = useState<{ e: number; n: number } | null>(null)

  const t = useMemo(
    () => computeTransform(vertices, width, height),
    [vertices, width, height]
  )

  const currentArea = useMemo(() => {
    if (vertices.length < 3) return 0
    return shoelaceArea(vertices.map(v => ({ easting: v.easting, northing: v.northing })))
  }, [vertices])

  const isClosed = vertices.length >= 3

  const legData = useMemo(() => {
    if (vertices.length < 2) return []
    const legs: Array<{
      from: ParcelVertex
      to: ParcelVertex
      bearing: string
      distance: number
      midX: number
      midY: number
    }> = []

    const pts = isClosed ? vertices : vertices
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      if (isClosed === false && i === pts.length - 1) break
      const bearing = bearingFromDelta(b.easting - a.easting, b.northing - a.northing)
      const dist = distance(a.easting, a.northing, b.easting, b.northing)
      const cA = w2c(a.easting, a.northing, t, height)
      const cB = w2c(b.easting, b.northing, t, height)
      legs.push({
        from: a,
        to: b,
        bearing: formatBearingDegMinSec(bearing),
        distance: dist,
        midX: (cA.x + cB.x) / 2,
        midY: (cA.y + cB.y) / 2,
      })
    }
    return legs
  }, [vertices, isClosed, t, height])

  const initStage = useCallback(() => {
    if (!containerRef.current) return

    const existing = containerRef.current.querySelector('.konva-container')
    if (existing) existing.remove()

    const stage = new Konva.Stage({
      container: containerRef.current,
      width,
      height,
    })
    stageRef.current = stage

    const layer = new Konva.Layer()
    stage.add(layer)
    layerRef.current = layer

    stage.on('mousemove', () => {
      const pos = stage.getPointerPosition()
      if (!pos) return
      const e = pos.x / t.scale + t.originE
      const n = (height - pos.y) / t.scale + t.originN
      setMouseWorld({ e, n })
    })

    stage.on('click', (e) => {
      if (mode !== 'draw') return

      const pos = stage.getPointerPosition()
      if (!pos) return

      const wE = pos.x / t.scale + t.originE
      const wN = (height - pos.y) / t.scale + t.originN

      const newVertex: ParcelVertex = {
        id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        label: `P${vertices.length + 1}`,
        easting: Math.round(wE * 1000) / 1000,
        northing: Math.round(wN * 1000) / 1000,
      }

      const next = [...vertices, newVertex]
      setVertices(next)
      onVerticesChange?.(next)
    })

    return () => stage.destroy()
  }, [width, height, mode, t, vertices, onVerticesChange])

  useEffect(() => {
    const destroy = initStage()
    return () => { destroy?.() }
  }, [initStage])

  const draw = useCallback(() => {
    const layer = layerRef.current
    const stage = stageRef.current
    if (!layer || !stage) return

    layer.destroyChildren()

    layer.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width,
        height,
        fill: '#FAFCFF',
      })
    )

    if (mode === 'draw' && mouseWorld) {
      const mc = w2c(mouseWorld.e, mouseWorld.n, t, height)
      layer.add(
        new Konva.Circle({
          x: mc.x,
          y: mc.y,
          radius: 4,
          fill: PREVIEW_EDGE_COLOR,
          opacity: 0.6,
          dash: [3, 3],
        })
      )
    }

    for (const parcel of existingParcels) {
      if (parcel.vertices.length < 2) continue
      const pts = parcel.vertices.map(v => w2c(v.easting, v.northing, t, height))
      const flatPts = pts.flatMap(p => [p.x, p.y])

      const poly = new Konva.Line({
        points: flatPts,
        fill: parcel.fill || '#e8f4fd',
        stroke: parcel.stroke || '#94c3d9',
        strokeWidth: 1.5,
        closed: true,
        opacity: 0.7,
      })
      layer.add(poly)
    }

    if (vertices.length >= 2) {
      const pts = vertices.map(v => w2c(v.easting, v.northing, t, height))
      const flatPts = pts.flatMap(p => [p.x, p.y])

      layer.add(
        new Konva.Line({
          points: flatPts,
          stroke: isClosed ? EDGE_COLOR : PREVIEW_EDGE_COLOR,
          strokeWidth: isClosed ? 2 : 1.5,
          dash: isClosed ? [] : [6, 3],
          closed: isClosed,
        })
      )
    }

    if (mode === 'draw' && vertices.length >= 1) {
      const pts = vertices.map(v => w2c(v.easting, v.northing, t, height))
      const flatPts = pts.flatMap(p => [p.x, p.y])

      const previewLine: number[] = []
      const last = pts[pts.length - 1]
      if (!isClosed && mouseWorld) {
        previewLine.push(last.x, last.y)
        const mp = w2c(mouseWorld.e, mouseWorld.n, t, height)
        previewLine.push(mp.x, mp.y)
      }

      if (previewLine.length >= 4) {
        layer.add(
          new Konva.Line({
            points: previewLine,
            stroke: PREVIEW_EDGE_COLOR,
            strokeWidth: 1,
            dash: [4, 4],
          })
        )
      }
    }

    if (showLegAnnotations && isClosed) {
      for (const leg of legData) {
        const labelText = `${leg.bearing}\n${leg.distance.toFixed(3)}m`
        const label = new Konva.Text({
          x: leg.midX,
          y: leg.midY - 12,
          text: labelText,
          fontSize: 9,
          fill: '#555',
          fontFamily: 'monospace',
          align: 'center',
        })
        label.offsetX(label.width() / 2)
        layer.add(label)
      }
    }

    if (isClosed && showLiveArea) {
      const pts = vertices.map(v => w2c(v.easting, v.northing, t, height))
      const xs = pts.map(p => p.x)
      const ys = pts.map(p => p.y)
      const cx = xs.reduce((a, b) => a + b, 0) / xs.length
      const cy = ys.reduce((a, b) => a + b, 0) / ys.length

      const areaText = formatArea(currentArea)
      const labelW = areaText.length * 7 + 16
      const labelH = 22

      layer.add(
        new Konva.Rect({
          x: cx - labelW / 2,
          y: cy - labelH / 2,
          width: labelW,
          height: labelH,
          fill: AREA_BOX_COLOR,
          stroke: AREA_TEXT_COLOR,
          strokeWidth: 1,
          cornerRadius: 3,
        })
      )
      const areaLabel = new Konva.Text({
        x: cx,
        y: cy,
        text: areaText,
        fontSize: 12,
        fill: AREA_TEXT_COLOR,
        fontFamily: 'Calibri, sans-serif',
        fontStyle: 'bold',
        align: 'center',
      })
      areaLabel.offsetX(areaLabel.width() / 2)
      areaLabel.offsetY(areaLabel.height() / 2)
      layer.add(areaLabel)
    }

    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i]
      const c = w2c(v.easting, v.northing, t, height)
      const isHov = hoveredVertex === v.id
      const isSel = selectedVertex === v.id

      const group = new Konva.Group({ x: c.x, y: c.y })

      if (isSel || isHov || mode === 'edit') {
        group.add(
          new Konva.Circle({
            x: 0,
            y: 0,
            radius: BEACON_RADIUS + (isHov || isSel ? 3 : 0),
            fill: isSel ? '#E63946' : BEACON_COLOR,
            stroke: isSel ? '#fff' : isHov ? '#1B3A5C' : 'transparent',
            strokeWidth: isSel ? 2 : 1,
          })
        )
      } else {
        group.add(
          new Konva.Circle({
            x: 0,
            y: 0,
            radius: VERTEX_RADIUS,
            fill: VERTEX_COLOR,
          })
        )
      }

      if (mode === 'edit') {
        group.add(
          new Konva.Text({
            x: BEACON_RADIUS + 4,
            y: -10,
            text: v.label,
            fontSize: 10,
            fill: '#333',
            fontFamily: 'monospace',
          })
        )
      }

      group.on('mouseenter', () => {
        setHoveredVertex(v.id)
        stage.container().style.cursor = 'pointer'
      })
      group.on('mouseleave', () => {
        setHoveredVertex(null)
        stage.container().style.cursor = 'default'
      })
      group.on('click', (evt) => {
        evt.cancelBubble = true
        if (mode === 'edit') {
          setSelectedVertex(selectedVertex === v.id ? null : v.id)
        }
      })

      if (mode === 'edit') {
        let dragStart = { e: 0, n: 0 }
        group.draggable(true)
        group.on('dragstart', () => {
          dragStart = { e: v.easting, n: v.northing }
        })
        group.on('dragmove', () => {
          const pos = group.position()
          const newE = pos.x / t.scale + t.originE
          const newN = (height - pos.y) / t.scale + t.originN
          const updated = vertices.map(vx =>
            vx.id === v.id
              ? { ...vx, easting: Math.round(newE * 1000) / 1000, northing: Math.round(newN * 1000) / 1000 }
              : vx
          )
          setVertices(updated)
          onVerticesChange?.(updated)
        })
        group.on('dragend', () => {
          const pos = group.position()
          const newE = pos.x / t.scale + t.originE
          const newN = (height - pos.y) / t.scale + t.originN
          const updated = vertices.map(vx =>
            vx.id === v.id
              ? { ...vx, easting: Math.round(newE * 1000) / 1000, northing: Math.round(newN * 1000) / 1000 }
              : vx
          )
          setVertices(updated)
          onVerticesChange?.(updated)
        })
      }

      layer.add(group)
    }

    layer.draw()
  }, [
    vertices, t, width, height, isClosed, currentArea, mode,
    hoveredVertex, selectedVertex, mouseWorld, existingParcels,
    showLegAnnotations, legData, showLiveArea, onVerticesChange,
  ])

  useEffect(() => {
    draw()
  }, [draw])

  const handleCloseParcel = () => {
    if (vertices.length >= 3) {
      onParcelComplete?.(vertices)
    }
  }

  const handleUndo = () => {
    const next = vertices.slice(0, -1)
    setVertices(next)
    onVerticesChange?.(next)
  }

  const handleClear = () => {
    setVertices([])
    onVerticesChange?.([])
  }

  const handleDeleteVertex = () => {
    if (!selectedVertex) return
    const next = vertices.filter(v => v.id !== selectedVertex)
    setVertices(next)
    setSelectedVertex(null)
    onVerticesChange?.(next)
  }

  return (
    <div className={className}>
      <div className="relative">
        <div ref={containerRef} className="w-full h-full" />

        {mouseWorld && mode === 'draw' && (
          <div
            className="absolute top-2 right-2 bg-white/90 border border-gray-200 rounded px-2 py-1 text-xs font-mono text-gray-700 pointer-events-none"
          >
            E{mouseWorld.e.toFixed(3)} N{mouseWorld.n.toFixed(3)}
          </div>
        )}

        <div className="absolute bottom-2 left-2 bg-white/90 border border-gray-200 rounded px-3 py-1.5 text-xs font-mono text-[#1B3A5C]">
          {mode === 'draw' && (
            <span>
              {vertices.length === 0
                ? 'Click to place first vertex'
                : vertices.length === 1
                ? 'Click to add more vertices'
                : `${vertices.length} vertices — ${isClosed ? 'Parcel closed' : 'Click to add or close'}`}
            </span>
          )}
          {mode === 'edit' && (
            <span>
              {selectedVertex ? `Selected: ${vertices.find(v => v.id === selectedVertex)?.label}` : 'Click a vertex to select, drag to move'}
            </span>
          )}
        </div>

        {isClosed && showLiveArea && (
          <div className="absolute top-2 left-2 bg-white border border-[#1B3A5C] rounded px-3 py-1.5 text-sm font-semibold text-[#1B3A5C]">
            Area: {formatArea(currentArea)}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mt-2">
        {mode === 'draw' && (
          <>
            <button
              onClick={handleUndo}
              disabled={vertices.length === 0}
              className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-40 rounded border border-gray-300 text-gray-700"
            >
              Undo
            </button>
            <button
              onClick={handleClear}
              disabled={vertices.length === 0}
              className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-40 rounded border border-gray-300 text-gray-700"
            >
              Clear
            </button>
            <button
              onClick={handleCloseParcel}
              disabled={vertices.length < 3}
              className="px-3 py-1.5 text-xs bg-[#1B3A5C] hover:bg-[#142d49] disabled:opacity-40 rounded text-white font-semibold"
            >
              Done — Close Parcel
            </button>
          </>
        )}
        {mode === 'edit' && (
          <>
            <button
              onClick={handleDeleteVertex}
              disabled={!selectedVertex}
              className="px-3 py-1.5 text-xs bg-red-50 hover:bg-red-100 disabled:opacity-40 rounded border border-red-200 text-red-700"
            >
              Delete Vertex
            </button>
            <button
              onClick={() => { setSelectedVertex(null); setVertices([]); onVerticesChange?.([]) }}
              className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 text-gray-700"
            >
              Clear
            </button>
            <button
              onClick={handleCloseParcel}
              disabled={vertices.length < 3}
              className="px-3 py-1.5 text-xs bg-[#1B3A5C] hover:bg-[#142d49] disabled:opacity-40 rounded text-white font-semibold"
            >
              Save Parcel
            </button>
          </>
        )}
      </div>
    </div>
  )
}