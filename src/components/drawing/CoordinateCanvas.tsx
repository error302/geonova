'use client';

import { useEffect, useRef } from 'react'
import Konva from 'konva'

export interface CanvasPoint {
  id: string
  name: string
  easting: number
  northing: number
  type: 'beacon' | 'control' | 'spot_height' | 'setting_out'
}

export interface CanvasLine {
  from: string
  to: string
  style?: 'solid' | 'dashed'
}

export interface CanvasLeg {
  from: string
  to: string
  bearing: number
  distance: number
  midX: number
  midY: number
}

export interface CoordinateCanvasProps {
  points: CanvasPoint[]
  lines?: CanvasLine[]
  width?: number
  height?: number
  showNorthArrow?: boolean
  showScaleBar?: boolean
  showGrid?: boolean
  showAreaAnnotation?: boolean
  areaAnnotation?: string
  legs?: CanvasLeg[]
  onPointClick?: (point: CanvasPoint) => void
}

interface Transform {
  scale: number
  originE: number
  originN: number
}

function computeTransform(
  points: CanvasPoint[],
  canvasWidth: number,
  canvasHeight: number,
  padding = 60
): Transform {
  if (points.length === 0) {
    return { scale: 1, originE: 0, originN: 0 }
  }

  // Optimization: use a for loop instead of spread operators to prevent V8 "Maximum call stack size exceeded" errors
  let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.easting < minE) minE = p.easting;
    if (p.easting > maxE) maxE = p.easting;
    if (p.northing < minN) minN = p.northing;
    if (p.northing > maxN) maxN = p.northing;
  }

  const rangeE = maxE - minE || 1
  const rangeN = maxN - minN || 1

  const availW = canvasWidth - padding * 2
  const availH = canvasHeight - padding * 2

  const scale = Math.min(availW / rangeE, availH / rangeN)

  const originE = minE - (availW / scale - rangeE) / 2 - padding / scale
  const originN = maxN + (availH / scale - rangeN) / 2 + padding / scale

  return { scale, originE, originN }
}

function worldToCanvas(
  e: number,
  n: number,
  t: Transform,
  canvasHeight: number
): { x: number; y: number } {
  return {
    x: (e - t.originE) * t.scale,
    y: canvasHeight - (n - t.originN) * t.scale
  }
}

export function CoordinateCanvas({
  points,
  lines = [],
  width = 800,
  height = 600,
  showNorthArrow = true,
  showScaleBar = true,
  showGrid = false,
  showAreaAnnotation = false,
  areaAnnotation,
  legs = [],
  onPointClick
}: CoordinateCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const existing = containerRef.current.querySelector('.konva-container')
    if (existing) existing.remove()

    const stage = new Konva.Stage({
      container: containerRef.current,
      width,
      height
    })

    const layer = new Konva.Layer()
    stage.add(layer)

    if (points.length === 0) {
      const text = new Konva.Text({
        x: width / 2 - 80,
        y: height / 2,
        text: 'No survey points yet',
        fontSize: 14,
        fill: '#666'
      })
      layer.add(text)
      layer.draw()
      return () => stage.destroy()
    }

    const t = computeTransform(points, width, height)
    const pointMap = new Map(points.map(p => [p.id, p]))

    if (showGrid) {
      const gridGroup = new Konva.Group()
      const gridInterval = 100

      // Optimization: use a for loop instead of spread operators to prevent V8 "Maximum call stack size exceeded" errors
      let pMinE = Infinity, pMaxE = -Infinity, pMinN = Infinity, pMaxN = -Infinity;
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (p.easting < pMinE) pMinE = p.easting;
        if (p.easting > pMaxE) pMaxE = p.easting;
        if (p.northing < pMinN) pMinN = p.northing;
        if (p.northing > pMaxN) pMaxN = p.northing;
      }

      const minE = pMinE - 200
      const maxE = pMaxE + 200
      const minN = pMinN - 200
      const maxN = pMaxN + 200

      for (let e = Math.ceil(minE / gridInterval) * gridInterval; e <= maxE; e += gridInterval) {
        const start = worldToCanvas(e, minN, t, height)
        const end = worldToCanvas(e, maxN, t, height)
        gridGroup.add(new Konva.Line({
          points: [start.x, start.y, end.x, end.y],
          stroke: '#333',
          strokeWidth: 0.5,
          dash: [4, 4]
        }))
      }

      for (let n = Math.ceil(minN / gridInterval) * gridInterval; n <= maxN; n += gridInterval) {
        const start = worldToCanvas(minE, n, t, height)
        const end = worldToCanvas(maxE, n, t, height)
        gridGroup.add(new Konva.Line({
          points: [start.x, start.y, end.x, end.y],
          stroke: '#333',
          strokeWidth: 0.5,
          dash: [4, 4]
        }))
      }
      layer.add(gridGroup)
    }

    lines.forEach(line => {
      const from = pointMap.get(line.from)
      const to = pointMap.get(line.to)
      if (!from || !to) return

      const fromCanvas = worldToCanvas(from.easting, from.northing, t, height)
      const toCanvas = worldToCanvas(to.easting, to.northing, t, height)

      const midX = (fromCanvas.x + toCanvas.x) / 2
      const midY = (fromCanvas.y + toCanvas.y) / 2

      layer.add(new Konva.Line({
        points: [fromCanvas.x, fromCanvas.y, toCanvas.x, toCanvas.y],
        stroke: '#e8a020',
        strokeWidth: 1.5,
        dash: line.style === 'dashed' ? [8, 4] : undefined
      }))

      const dE = to.easting - from.easting
      const dN = to.northing - from.northing
      const dist = Math.sqrt(dE * dE + dN * dN)

      const angle = Math.atan2(toCanvas.y - fromCanvas.y, toCanvas.x - fromCanvas.x)
      const angleDeg = angle * (180 / Math.PI)

      layer.add(new Konva.Text({
        x: midX,
        y: midY - 10,
        text: `${dist.toFixed(3)}m`,
        fontSize: 10,
        fill: '#aaa',
        rotation: angleDeg > 90 || angleDeg < -90 ? angleDeg + 180 : angleDeg
      }))
    })

    points.forEach(pt => {
      const { x, y } = worldToCanvas(pt.easting, pt.northing, t, height)
      const r = 5

      const symbolColor: Record<string, string> = {
        beacon: '#e8a020',
        control: '#4a9eff',
        spot_height: '#66cc66',
        setting_out: '#cc66ff'
      }

      const circle = new Konva.Circle({
        x, y, radius: r,
        stroke: symbolColor[pt.type] || '#e8a020',
        strokeWidth: 1.5,
        fill: 'transparent'
      })

      const crossH = new Konva.Line({
        points: [x - r, y, x + r, y],
        stroke: symbolColor[pt.type] || '#e8a020',
        strokeWidth: 1
      })
      const crossV = new Konva.Line({
        points: [x, y - r, x, y + r],
        stroke: symbolColor[pt.type] || '#e8a020',
        strokeWidth: 1
      })

      const label = new Konva.Text({
        x: x + r + 3,
        y: y - 6,
        text: pt.name,
        fontSize: 11,
        fill: '#fff',
        fontStyle: 'bold'
      })

      const hitCircle = new Konva.Circle({
        x, y, radius: 12,
        fill: 'transparent'
      })
      hitCircle.on('click tap', () => onPointClick?.(pt))
      hitCircle.on('mouseenter', () => {
        stage.container().style.cursor = 'pointer'
      })
      hitCircle.on('mouseleave', () => {
        stage.container().style.cursor = 'default'
      })

      layer.add(circle, crossH, crossV, label, hitCircle)
    })

    if (showNorthArrow) {
      const naX = width - 40
      const naY = 50
      layer.add(new Konva.Arrow({
        points: [naX, naY + 25, naX, naY],
        pointerLength: 8,
        pointerWidth: 6,
        fill: '#fff',
        stroke: '#fff',
        strokeWidth: 1.5
      }))
      layer.add(new Konva.Text({
        x: naX - 4,
        y: naY - 16,
        text: 'N',
        fontSize: 13,
        fill: '#fff',
        fontStyle: 'bold'
      }))
    }

    if (showScaleBar) {
      const sbX = 20
      const sbY = height - 30
      const targetPixels = 80
      const worldLength = targetPixels / t.scale
      const roundLength = Math.pow(10, Math.round(Math.log10(worldLength)))
      const barPixels = roundLength * t.scale

      layer.add(new Konva.Line({
        points: [sbX, sbY, sbX + barPixels, sbY],
        stroke: '#fff',
        strokeWidth: 2
      }))
      layer.add(new Konva.Line({
        points: [sbX, sbY - 4, sbX, sbY + 4],
        stroke: '#fff', strokeWidth: 2
      }))
      layer.add(new Konva.Line({
        points: [sbX + barPixels, sbY - 4, sbX + barPixels, sbY + 4],
        stroke: '#fff', strokeWidth: 2
      }))
      layer.add(new Konva.Text({
        x: sbX,
        y: sbY + 6,
        text: roundLength >= 1000 ? `${roundLength / 1000}km` : `${roundLength}m`,
        fontSize: 10,
        fill: '#aaa'
      }))
    }

    if (showAreaAnnotation && areaAnnotation && points.length >= 3) {
      const centX = points.reduce((s, p) => s + p.easting, 0) / points.length
      const centY = points.reduce((s, p) => s + p.northing, 0) / points.length
      const cX = (centX - t.originE) * t.scale + height / 2
      const cY = height / 2 - (centY - t.originN) * t.scale
      layer.add(new Konva.Text({
        x: cX - 40,
        y: cY - 8,
        text: areaAnnotation,
        fontSize: 12,
        fill: '#fff',
        fontStyle: 'bold'
      }))
    }

    if (legs && legs.length > 0) {
      legs.forEach(leg => {
        const textX = (leg.midX - t.originE) * t.scale + height / 2
        const textY = height / 2 - (leg.midY - t.originN) * t.scale
        const bearingStr = (() => {
          const d = Math.floor(leg.bearing)
          const m = Math.floor((leg.bearing - d) * 60)
          const s = Math.round(((leg.bearing - d) * 60 - m) * 60)
          return `${String(d).padStart(3, '0')}°${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}"`
        })()
        const distStr = leg.distance.toFixed(3)
        layer.add(new Konva.Text({
          x: textX - 30,
          y: textY + 14,
          text: bearingStr,
          fontSize: 8,
          fill: '#4f4'
        }))
        layer.add(new Konva.Text({
          x: textX - 25,
          y: textY + 4,
          text: distStr + 'm',
          fontSize: 8,
          fill: '#4f4'
        }))
      })
    }

    layer.draw()

    return () => {
      stage.destroy()
    }
  }, [points, lines, width, height, showNorthArrow, showScaleBar, showGrid, showAreaAnnotation, areaAnnotation, legs, onPointClick])

  return (
    <div
      ref={containerRef}
      className="rounded-lg overflow-hidden bg-[#111]"
      style={{ width, height }}
    />
  )
}
