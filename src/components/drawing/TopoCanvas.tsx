'use client';

import { useEffect, useRef } from 'react'
import Konva from 'konva'
import type { ContourLine } from '@/lib/topo/contourGenerator'
import type { CanvasPoint } from './CoordinateCanvas'

export interface SpotHeight {
  e: number
  n: number
  z: number
  label?: string
}

interface TopoCanvasProps {
  spotHeights: SpotHeight[]
  contours: ContourLine[]
  controlPoints?: CanvasPoint[]
  width?: number
  height?: number
  showLabels?: boolean
  showSpotHeights?: boolean
}

interface Transform {
  scale: number
  originE: number
  originN: number
}

function computeTopoTransform(
  points: { e: number; n: number }[],
  w: number,
  h: number,
  padding = 60
): Transform {
  if (points.length === 0) {
    return { scale: 1, originE: 0, originN: 0 }
  }

  // Optimization: use a for loop instead of spread operators to prevent V8 "Maximum call stack size exceeded" errors
  let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.e < minE) minE = p.e;
    if (p.e > maxE) maxE = p.e;
    if (p.n < minN) minN = p.n;
    if (p.n > maxN) maxN = p.n;
  }

  const rangeE = maxE - minE || 1
  const rangeN = maxN - minN || 1

  const scale = Math.min(
    (w - padding * 2) / rangeE,
    (h - padding * 2) / rangeN
  )

  const originE = minE - ((w - padding * 2) / scale - rangeE) / 2 - padding / scale
  const originN = maxN + ((h - padding * 2) / scale - rangeN) / 2 + padding / scale

  return { scale, originE, originN }
}

export function TopoCanvas({
  spotHeights,
  contours,
  controlPoints = [],
  width = 900,
  height = 650,
  showLabels = true,
  showSpotHeights = true
}: TopoCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    containerRef.current.querySelector('.konva-container')?.remove()

    const stage = new Konva.Stage({
      container: containerRef.current,
      width,
      height
    })

    const layer = new Konva.Layer()
    stage.add(layer)

    const allPoints = [
      ...spotHeights.map(p => ({ e: p.e, n: p.n })),
      ...controlPoints.map(p => ({ e: p.easting, n: p.northing }))
    ]

    if (allPoints.length === 0) {
      layer.add(new Konva.Text({
        x: width / 2 - 80,
        y: height / 2,
        text: 'No topographic data yet',
        fontSize: 14,
        fill: '#666'
      }))
      layer.draw()
      return () => stage.destroy()
    }

    const t = computeTopoTransform(allPoints, width, height)

    function toCanvas(e: number, n: number) {
      return {
        x: (e - t.originE) * t.scale,
        y: (t.originN - n) * t.scale
      }
    }

    // Optimization: use a for loop instead of spread operators to prevent V8 "Maximum call stack size exceeded" errors
    let minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < spotHeights.length; i++) {
      const z = spotHeights[i].z;
      if (!isNaN(z)) {
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }
    }
    // If no valid z values, default to 0
    if (minZ === Infinity) { minZ = 0; maxZ = 0; }

    function elevationColor(z: number): string {
      if (maxZ === minZ) return '#4a9eff'
      const tt = (z - minZ) / (maxZ - minZ)
      if (tt < 0.33) {
        const r = Math.round(tt * 3 * 255)
        return `rgb(${r},200,80)`
      } else if (tt < 0.66) {
        const f = (tt - 0.33) * 3
        return `rgb(255,${Math.round(200 - f * 100)},${Math.round(80 - f * 80)})`
      } else {
        const f = (tt - 0.66) * 3
        return `rgb(255,${Math.round(100 - f * 60)},0)`
      }
    }

    contours.forEach(contour => {
      contour.coordinates.forEach(ring => {
        if (ring.length < 2) return

        const flatPoints: number[] = []
        ring.forEach(([e, n]) => {
          const { x, y } = toCanvas(e, n)
          flatPoints.push(x, y)
        })

        layer.add(new Konva.Line({
          points: flatPoints,
          stroke: contour.isIndex ? '#e8a020' : '#555',
          strokeWidth: contour.isIndex ? 1.5 : 0.8,
          closed: true,
          listening: false
        }))

        if (showLabels && contour.isIndex && ring.length >= 4) {
          const mid = ring[Math.floor(ring.length / 4)]
          const { x, y } = toCanvas(mid[0], mid[1])
          layer.add(new Konva.Text({
            x: x - 12,
            y: y - 5,
            text: `${contour.elevation.toFixed(1)}`,
            fontSize: 9,
            fill: '#e8a020'
          }))
        }
      })
    })

    if (showSpotHeights) {
      spotHeights.forEach(pt => {
        const { x, y } = toCanvas(pt.e, pt.n)
        const color = elevationColor(pt.z)

        layer.add(new Konva.Circle({
          x, y,
          radius: 2.5,
          fill: color,
          listening: false
        }))

        if (showLabels) {
          layer.add(new Konva.Text({
            x: x + 4,
            y: y - 5,
            text: pt.z.toFixed(2),
            fontSize: 8,
            fill: '#aaa',
            listening: false
          }))
        }
      })
    }

    controlPoints.forEach(cp => {
      const { x, y } = toCanvas(cp.easting, cp.northing)
      const r = 6
      layer.add(new Konva.RegularPolygon({
        x, y,
        sides: 3,
        radius: r,
        fill: '#4a9eff',
        stroke: '#fff',
        strokeWidth: 1
      }))
      layer.add(new Konva.Text({
        x: x + r + 3,
        y: y - 6,
        text: cp.name,
        fontSize: 10,
        fill: '#4a9eff',
        fontStyle: 'bold'
      }))
    })

    layer.add(new Konva.Arrow({
      points: [width - 40, 60, width - 40, 35],
      pointerLength: 8,
      pointerWidth: 6,
      fill: '#fff',
      stroke: '#fff',
      strokeWidth: 1.5
    }))
    layer.add(new Konva.Text({
      x: width - 45,
      y: 22,
      text: 'N',
      fontSize: 13,
      fill: '#fff',
      fontStyle: 'bold'
    }))

    const legendX = 16
    const legendY = height - 80
    layer.add(new Konva.Text({
      x: legendX, y: legendY,
      text: 'ELEVATION',
      fontSize: 9,
      fill: '#aaa',
      fontStyle: 'bold'
    }))
    ;[
      { label: `${maxZ.toFixed(1)}m (High)`, color: 'rgb(255,40,0)' },
      { label: `${((maxZ + minZ) / 2).toFixed(1)}m (Mid)`, color: 'rgb(255,150,0)' },
      { label: `${minZ.toFixed(1)}m (Low)`, color: 'rgb(0,200,80)' },
    ].forEach(({ label, color }, i) => {
      layer.add(new Konva.Circle({
        x: legendX + 5,
        y: legendY + 16 + i * 14,
        radius: 4,
        fill: color
      }))
      layer.add(new Konva.Text({
        x: legendX + 14,
        y: legendY + 10 + i * 14,
        text: label,
        fontSize: 9,
        fill: '#aaa'
      }))
    })

    layer.draw()

    return () => { stage.destroy() }
  }, [spotHeights, contours, controlPoints, width, height, showLabels, showSpotHeights])

  return (
    <div
      ref={containerRef}
      className="rounded-lg overflow-hidden bg-[#111]"
      style={{ width, height }}
    />
  )
}
