'use client'

import { useRef, useState, useCallback } from 'react'
import type { HistoryEntry, MapContext, SerializedFeature, SerializedGeometry } from './useMapTypes'

/**
 * Manages undo/redo history for the draw source features.
 * Maintains a stack of serialized feature snapshots (max 50 entries).
 */
export function useMapHistory(ctx: MapContext) {
  const historyRef = useRef<HistoryEntry[]>([])
  const historyIndexRef = useRef(-1)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // ── Push current state to history ──
  const pushHistory = useCallback(() => {
    const drawSource = ctx.drawSourceRef.current
    if (!drawSource) return
    const json = JSON.stringify(
      drawSource.getFeatures().map((f) => {
        // OL v10 geometries have no toJSON() (verified on 10.8.0) — serialize
        // explicitly into the SerializedGeometry shape restoreEntry reads.
        const geom = f.getGeometry()
        let geometry: SerializedGeometry | null = null
        if (geom) {
          const type = geom.getType()
          if (type === 'Point') {
            geometry = { type, coordinates: (geom as import('ol/geom/Point').default).getCoordinates() }
          } else if (type === 'LineString') {
            geometry = { type, coordinates: (geom as import('ol/geom/LineString').default).getCoordinates() }
          } else if (type === 'Polygon') {
            geometry = { type, coordinates: (geom as import('ol/geom/Polygon').default).getCoordinates() }
          } else if (type === 'Circle') {
            const circle = geom as import('ol/geom/Circle').default
            geometry = { type, center: circle.getCenter(), radius: circle.getRadius() }
          }
        }
        return {
          geometry,
          properties: f.getProperties(),
        }
      })
    )
    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1)
    newHistory.push({ featuresJson: json })
    if (newHistory.length > 50) newHistory.shift()
    historyRef.current = newHistory
    historyIndexRef.current = newHistory.length - 1
    setCanUndo(historyIndexRef.current > 0)
    setCanRedo(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Restore features from a history entry ──
  const restoreEntry = useCallback(async (entry: HistoryEntry) => {
    // Guard: the draw source is lazily created during map init and can be
    // null before the map is ready — never deref it without a check.
    const drawSource = ctx.drawSourceRef.current
    if (!drawSource) return
    const features = JSON.parse(entry.featuresJson) as SerializedFeature[]
    drawSource.clear()
    for (const f of features) {
      if (f.geometry) {
        const { default: Feature } = await import('ol/Feature')
        const geomType = f.geometry.type
        let geom: import('ol/geom/Geometry').default | null = null
        if (geomType === 'Point') {
          const { default: Point } = await import('ol/geom/Point')
          geom = new Point(f.geometry.coordinates)
        } else if (geomType === 'LineString') {
          const { default: LineString } = await import('ol/geom/LineString')
          geom = new LineString(f.geometry.coordinates)
        } else if (geomType === 'Polygon') {
          const { default: Polygon } = await import('ol/geom/Polygon')
          geom = new Polygon(f.geometry.coordinates)
        } else if (geomType === 'Circle') {
          const { default: Circle } = await import('ol/geom/Circle')
          geom = new Circle(f.geometry.center, f.geometry.radius)
        }
        if (geom) {
          const feature = new Feature({ geometry: geom })
          if (f.properties) {
            Object.entries(f.properties).forEach(([k, v]) => {
              if (k !== 'geometry') feature.set(k, v)
            })
          }
          drawSource.addFeature(feature)
        }
      }
    }
    ctx.setFeatureCount(drawSource.getFeatures().length)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Undo ──
  const undo = useCallback(async () => {
    if (historyIndexRef.current <= 0 || !ctx.drawSourceRef.current) return
    historyIndexRef.current--
    const entry = historyRef.current[historyIndexRef.current]
    try {
      await restoreEntry(entry)
    } catch { /* ignore */ }
    setCanUndo(historyIndexRef.current > 0)
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Redo ──
  const redo = useCallback(async () => {
    if (historyIndexRef.current >= historyRef.current.length - 1 || !ctx.drawSourceRef.current) return
    historyIndexRef.current++
    const entry = historyRef.current[historyIndexRef.current]
    try {
      await restoreEntry(entry)
    } catch { /* ignore */ }
    setCanUndo(historyIndexRef.current > 0)
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Clear history (used by "Clear All") ──
  const clearHistory = useCallback(() => {
    historyRef.current = []
    historyIndexRef.current = -1
    setCanUndo(false)
    setCanRedo(false)
  }, [])

  return {
    pushHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
    historyRef,
    historyIndexRef,
  }
}
