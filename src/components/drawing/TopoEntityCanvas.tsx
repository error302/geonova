'use client';

/**
 * TopoEntityCanvas — renders a shared DrawingEntity[] (from buildTopoEntities)
 * to Konva. This guarantees the on-screen preview is identical to the DXF/PDF
 * exports, because both consume the same entity list.
 */
import { useEffect, useMemo, useRef } from 'react'
import Konva from 'konva'
import type { DrawingEntity, DrawingLayerInfo, Extents } from '@/lib/drawing/topoEntities'

interface TopoEntityCanvasProps {
  entities: DrawingEntity[]
  layers: DrawingLayerInfo[]
  extents: Extents
  width?: number
  height?: number
  /** Layer names to hide. */
  hiddenLayers?: Set<string>
  emptyMessage?: string
}

export function TopoEntityCanvas({
  entities,
  layers,
  extents,
  width = 900,
  height = 560,
  hiddenLayers,
  emptyMessage = 'Import points to see the drawing preview',
}: TopoEntityCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const layerColorMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of layers) m.set(l.name, l.colorHex)
    return m
  }, [layers])

  useEffect(() => {
    if (!containerRef.current) return
    containerRef.current.querySelector('.konva-container')?.remove()

    const stage = new Konva.Stage({ container: containerRef.current, width, height })
    const layer = new Konva.Layer()
    stage.add(layer)

    const worldW = extents.maxX - extents.minX || 1
    const worldH = extents.maxY - extents.minY || 1
    const padding = 24
    const scale = Math.min((width - padding * 2) / worldW, (height - padding * 2) / worldH)

    // Centre the drawing in the canvas
    const offX = (width - worldW * scale) / 2
    const offY = (height - worldH * scale) / 2

    const toX = (e: number) => offX + (e - extents.minX) * scale
    const toY = (n: number) => height - (offY + (n - extents.minY) * scale)

    if (entities.length === 0) {
      layer.add(new Konva.Text({
        x: width / 2 - 120, y: height / 2,
        text: emptyMessage, fontSize: 14, fill: '#71717a',
      }))
      layer.draw()
      return () => { stage.destroy() }
    }

    // Text heights are in world units → convert to px, clamp for legibility
    const textScale = scale

    for (const e of entities) {
      if (hiddenLayers?.has(e.layer)) continue
      const color = layerColorMap.get(e.layer) ?? '#d4d4d8'

      switch (e.kind) {
        case 'line':
          layer.add(new Konva.Line({
            points: [toX(e.x1), toY(e.y1), toX(e.x2), toY(e.y2)],
            stroke: color, strokeWidth: e.layer === 'GRID' ? 0.6 : 1, listening: false,
          }))
          break
        case 'polyline': {
          const flat: number[] = []
          for (const [en, nn] of e.pts) flat.push(toX(en), toY(nn))
          layer.add(new Konva.Line({
            points: flat,
            stroke: color, strokeWidth: 1.1,
            closed: !!e.closed, listening: false,
          }))
          break
        }
        case 'point':
          layer.add(new Konva.Circle({ x: toX(e.e), y: toY(e.n), radius: 1.6, fill: color, listening: false }))
          break
        case 'text': {
          const fs = Math.max(6, Math.min(12, e.height * textScale))
          layer.add(new Konva.Text({
            x: toX(e.e), y: toY(e.n),
            text: e.text, fontSize: fs, fill: color, listening: false,
          }))
          break
        }
      }
    }

    layer.draw()
    return () => stage.destroy()
  }, [entities, layers, extents, layerColorMap, hiddenLayers, width, height, emptyMessage])

  return (
    <div
      ref={containerRef}
      className="rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800"
      style={{ width: '100%', height }}
    />
  )
}

export default TopoEntityCanvas
