/**
 * METARDU useSubdivision Hook
 *
 * React hook for managing subdivision state and map interactions.
 * Follows the patterns established in useMeasurement.ts.
 *
 * Provides:
 * - State management for subdivision method, parameters, and results
 * - Map layer management (add/remove subdivision overlay)
 * - Split line drawing interaction
 * - DXF export trigger
 */

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type Map from 'ol/Map'
import type { SubdivisionMethod, SubdivisionParams, SubdivisionResult, SplitLine, RoadReserveInfo } from '@/types/subdivision'
import type { Point2D } from '@/lib/engine/types'
import { subdivide, createRoadReserve } from '@/lib/engine/subdivision'
import { downloadSubdivisionDXF } from '@/lib/export/subdivisionDXF'
import { logger } from '@/lib/logger'
import { createSubdivisionLayer, createSplitLineLayer, createRoadReservePreviewLayer } from '@/lib/map/subdivisionLayer'

export interface UseSubdivisionOptions {
  /** Parent parcel vertices (EPSG:21037) */
  parentVertices: Point2D[]
  /** OpenLayers map instance */
  map: Map | null
  /** Project name for DXF export */
  projectName?: string
}

export function useSubdivision({
  parentVertices,
  map,
  projectName = 'METARDU_Subdivision',
}: UseSubdivisionOptions) {
  // ─── State ────────────────────────────────────────────────────────────
  const [method, setMethod] = useState<SubdivisionMethod | null>(null)
  const [params, setParams] = useState<SubdivisionParams>({})
  const [result, setResult] = useState<SubdivisionResult | null>(null)
  const [splitLine, setSplitLine] = useState<SplitLine | null>(null)
  const [isDrawingSplitLine, setIsDrawingSplitLine] = useState(false)
  const [isComputing, setIsComputing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ─── Road reserve state ──────────────────────────────────────────────
  const [roadReserveEnabled, setRoadReserveEnabled] = useState(false)
  const [roadReserveWidth, setRoadReserveWidth] = useState(12)
  const [roadReserveEdges, setRoadReserveEdges] = useState<number[]>([])
  const [roadReserveAuto, setRoadReserveAuto] = useState(true)
  const [roadReservePreview, setRoadReservePreview] = useState<RoadReserveInfo | null>(null)

  // ─── Refs for map layers ──────────────────────────────────────────────
  const subdivisionLayerRef = useRef<import('ol/layer/Vector').default | null>(null)
  const splitLineLayerRef = useRef<import('ol/layer/Vector').default | null>(null)
  const roadReserveLayerRef = useRef<import('ol/layer/Vector').default | null>(null)
  const drawInteractionRef = useRef<import('ol/interaction/Draw').default | null>(null)
  const clickHandlerRef = useRef<((evt: import('ol/MapBrowserEvent').default) => void) | null>(null)
  const splitLinePointsRef = useRef<Point2D[]>([])

  // ─── Stable refs for cleanup callbacks ────────────────────────────────
  const mapRef = useRef<Map | null>(null)
  const removeSubdivisionLayerRef = useRef<() => void>(() => {})
  const removeSplitLineLayerRef = useRef<() => void>(() => {})
  const removeRoadReserveLayerRef = useRef<() => void>(() => {})
  const removeDrawInteractionRef = useRef<() => void>(() => {})
  const addSubdivisionLayerRef = useRef<(r: SubdivisionResult) => void>(() => {})
  const addSplitLineLayerRef = useRef<(l: SplitLine) => void>(() => {})
  const addRoadReserveLayerRef = useRef<(r: RoadReserveInfo) => void>(() => {})

  // Keep map ref in sync
  useEffect(() => { mapRef.current = map }, [map])

  // Keep stable cleanup/add refs
  useEffect(() => {
    removeSubdivisionLayerRef.current = removeSubdivisionLayer
    removeSplitLineLayerRef.current = removeSplitLineLayer
    removeRoadReserveLayerRef.current = removeRoadReserveLayer
    removeDrawInteractionRef.current = removeDrawInteraction
    addSubdivisionLayerRef.current = addSubdivisionLayer
    addSplitLineLayerRef.current = addSplitLineLayer
    addRoadReserveLayerRef.current = addRoadReserveLayer
  })

  // ─── Clean up layers on unmount ──────────────────────────────────────
  useEffect(() => {
    return () => {
      removeSubdivisionLayerRef.current()
      removeSplitLineLayerRef.current()
      removeRoadReserveLayerRef.current()
      removeDrawInteractionRef.current()
    }
  }, [])

  // ─── Method selection ────────────────────────────────────────────────

  const selectMethod = useCallback((newMethod: SubdivisionMethod) => {
    setMethod(newMethod)
    setResult(null)
    setError(null)
    removeSubdivisionLayerRef.current()

    // If switching away from single-split, remove split line stuff
    if (newMethod !== 'single-split') {
      setSplitLine(null)
      removeSplitLineLayerRef.current()
      removeDrawInteractionRef.current()
      setIsDrawingSplitLine(false)
      splitLinePointsRef.current = []
    }
  }, [])

  // ─── Parameters ───────────────────────────────────────────────────────

  const updateParams = useCallback((newParams: Partial<SubdivisionParams>) => {
    setParams(prev => ({ ...prev, ...newParams }))
  }, [])

  // ─── Execute subdivision ──────────────────────────────────────────────

  const execute = useCallback(() => {
    if (!method) {
      setError('Select a subdivision method first.')
      return
    }

    if (parentVertices.length < 3) {
      setError('Parent parcel must have at least 3 vertices.')
      return
    }

    // Validate params per method
    if (method === 'single-split' && !splitLine) {
      setError('Draw a split line on the map first.')
      return
    }
    if (method === 'grid' && (!params.rows || !params.cols)) {
      setError('Specify rows and columns for grid subdivision.')
      return
    }
    if (method === 'radial' && (!params.numLots || params.numLots < 2)) {
      setError('Specify at least 2 lots for radial subdivision.')
      return
    }
    if (method === 'area' && (!params.targetArea || params.targetArea <= 0)) {
      setError('Specify a valid target area.')
      return
    }

    setIsComputing(true)
    setError(null)

    try {
      const fullParams: SubdivisionParams = { ...params }
      if (method === 'single-split') {
        fullParams.splitLine = splitLine!
      }

      // Apply road reserve if enabled
      if (roadReserveEnabled && roadReserveWidth > 0) {
        fullParams.roadReserveWidth = roadReserveWidth
        fullParams.roadReserveEdges = roadReserveAuto ? [] : roadReserveEdges
      }

      const subResult = subdivide(parentVertices, method, fullParams)
      setResult(subResult)

      // Remove road reserve preview layer
      removeRoadReserveLayerRef.current()
      setRoadReservePreview(null)

      // Add subdivision layer to map
      addSubdivisionLayerRef.current(subResult)
    } catch (err: unknown) {
      setError((err as Error).message || 'Subdivision computation failed.')
      setResult(null)
    } finally {
      setIsComputing(false)
    }
  }, [method, params, splitLine, parentVertices, roadReserveEnabled, roadReserveWidth, roadReserveEdges, roadReserveAuto])

  // ─── Clear everything ────────────────────────────────────────────────

  const clear = useCallback(() => {
    setMethod(null)
    setParams({})
    setResult(null)
    setSplitLine(null)
    setError(null)
    setIsDrawingSplitLine(false)
    splitLinePointsRef.current = []
    setRoadReserveEnabled(false)
    setRoadReserveWidth(12)
    setRoadReserveEdges([])
    setRoadReserveAuto(true)
    setRoadReservePreview(null)
    removeSubdivisionLayerRef.current()
    removeSplitLineLayerRef.current()
    removeRoadReserveLayerRef.current()
    removeDrawInteractionRef.current()
  }, [])

  // ─── Split line drawing ──────────────────────────────────────────────

  const startSplitLineDrawing = useCallback(() => {
    if (!map) return
    setIsDrawingSplitLine(true)
    splitLinePointsRef.current = []
    setSplitLine(null)
    removeSplitLineLayerRef.current()
    setError(null)
  }, [map])

  // Handle clicks for split line drawing
  useEffect(() => {
    if (!map || !isDrawingSplitLine) return

    const handleClick = async (evt: import('ol/MapBrowserEvent').default) => {
      const [x, y] = evt.coordinate as [number, number]

      // Convert from EPSG:3857 to EPSG:21037
      const { to21037 } = await import('@/lib/map/projection')
      const [e, n] = await to21037(x, y)

      const point: Point2D = { easting: e, northing: n }
      splitLinePointsRef.current = [...splitLinePointsRef.current, point]

      if (splitLinePointsRef.current.length === 1) {
        return
      }

      if (splitLinePointsRef.current.length === 2) {
        const newSplitLine: SplitLine = {
          startPoint: splitLinePointsRef.current[0],
          endPoint: splitLinePointsRef.current[1],
        }
        setSplitLine(newSplitLine)
        setIsDrawingSplitLine(false)
        addSplitLineLayerRef.current(newSplitLine)
      }
    }

    clickHandlerRef.current = handleClick
    map.on('click', handleClick)

    return () => {
      if (clickHandlerRef.current) {
        map.un('click', clickHandlerRef.current)
        clickHandlerRef.current = null
      }
    }
  }, [map, isDrawingSplitLine])

  // ─── DXF export ──────────────────────────────────────────────────────

  const exportDXF = useCallback(() => {
    if (!result) return
    downloadSubdivisionDXF(result, projectName)
  }, [result, projectName])

  // ─── Map layer management (using stable refs to avoid dep warnings) ────

  const removeSubdivisionLayer = useCallback(() => {
    if (mapRef.current && subdivisionLayerRef.current) {
      mapRef.current.removeLayer(subdivisionLayerRef.current)
      subdivisionLayerRef.current = null
    }
  }, [])

  const addSubdivisionLayer = useCallback(async (subResult: SubdivisionResult) => {
    if (!map) return
    removeSubdivisionLayerRef.current()

    try {
      const layer = await createSubdivisionLayer(subResult)
      map.addLayer(layer)
      subdivisionLayerRef.current = layer
    } catch (err) {
      logger.error('Failed to create subdivision layer:', { error: err })
    }
  }, [map])

  const removeSplitLineLayer = useCallback(() => {
    if (mapRef.current && splitLineLayerRef.current) {
      mapRef.current.removeLayer(splitLineLayerRef.current)
      splitLineLayerRef.current = null
    }
  }, [])

  const removeDrawInteraction = useCallback(() => {
    if (mapRef.current && drawInteractionRef.current) {
      mapRef.current.removeInteraction(drawInteractionRef.current)
      drawInteractionRef.current = null
    }
  }, [])

  const addSplitLineLayer = useCallback(async (sLine: SplitLine) => {
    if (!map) return
    removeSplitLineLayerRef.current()

    try {
      const layer = await createSplitLineLayer(sLine)
      if (layer) {
        map.addLayer(layer)
        splitLineLayerRef.current = layer
      }
    } catch (err) {
      logger.error('Failed to create split line layer:', { error: err })
    }
  }, [map])

  const removeRoadReserveLayer = useCallback(() => {
    if (mapRef.current && roadReserveLayerRef.current) {
      mapRef.current.removeLayer(roadReserveLayerRef.current)
      roadReserveLayerRef.current = null
    }
  }, [])

  const addRoadReserveLayer = useCallback(async (rrInfo: RoadReserveInfo) => {
    if (!map) return
    removeRoadReserveLayerRef.current()

    try {
      const layer = await createRoadReservePreviewLayer(rrInfo)
      if (layer) {
        map.addLayer(layer)
        roadReserveLayerRef.current = layer
      }
    } catch (err) {
      logger.error('Failed to create road reserve layer:', { error: err })
    }
  }, [map])

  // ─── Center point picking (for radial) ───────────────────────────────

  const pickCenterPointHandlerRef = useRef<((evt: import('ol/MapBrowserEvent').default) => void) | null>(null)

  // Clean up pickCenterPoint handler on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current && pickCenterPointHandlerRef.current) {
        mapRef.current.un('click', pickCenterPointHandlerRef.current)
        pickCenterPointHandlerRef.current = null
      }
    }
  }, [])

  const pickCenterPoint = useCallback(() => {
    if (!map) return

    // Clean up previous handler if any
    if (pickCenterPointHandlerRef.current) {
      map.un('click', pickCenterPointHandlerRef.current)
    }

    const handleMapClick = async (evt: import('ol/MapBrowserEvent').default) => {
      const [x, y] = evt.coordinate as [number, number]
      const { to21037 } = await import('@/lib/map/projection')
      const [e, n] = await to21037(x, y)

      const center: Point2D = { easting: e, northing: n }
      updateParams({ center })

      if (pickCenterPointHandlerRef.current) {
        map.un('click', pickCenterPointHandlerRef.current)
        pickCenterPointHandlerRef.current = null
      }
    }

    pickCenterPointHandlerRef.current = handleMapClick
    map.on('click', handleMapClick)
  }, [map, updateParams])

  // ─── Road reserve preview ───────────────────────────────────────────

  const previewRoadReserve = useCallback(() => {
    if (parentVertices.length < 3 || roadReserveWidth <= 0) return

    try {
      const edges = roadReserveAuto ? [] : roadReserveEdges
      const rr = createRoadReserve(parentVertices, roadReserveWidth, edges)

      if (rr.roadPolygon.length >= 3) {
        // Compute area
        let area = 0
        const pts = rr.roadPolygon
        const n = pts.length
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n
          area += pts[i].easting * pts[j].northing
          area -= pts[j].easting * pts[i].northing
        }
        const areaHaVal = Math.abs(area / 2) / 10000

        const info: RoadReserveInfo = {
          roadPolygon: rr.roadPolygon,
          width: roadReserveWidth,
          clippedEdges: rr.clippedEdges,
          areaHa: areaHaVal,
        }

        setRoadReservePreview(info)
        addRoadReserveLayerRef.current(info)
      } else {
        setRoadReservePreview(null)
        removeRoadReserveLayerRef.current()
      }
    } catch (err) {
      logger.error('Road reserve preview failed:', { error: err })
    }
  }, [parentVertices, roadReserveWidth, roadReserveAuto, roadReserveEdges])

  const clearRoadReservePreview = useCallback(() => {
    setRoadReservePreview(null)
    removeRoadReserveLayerRef.current()
  }, [])

  const toggleRoadReserveEdge = useCallback((edgeIdx: number) => {
    setRoadReserveEdges(prev => {
      if (prev.includes(edgeIdx)) {
        return prev.filter(e => e !== edgeIdx)
      }
      return [...prev, edgeIdx].sort((a, b) => a - b)
    })
  }, [])

  // ─── Return ──────────────────────────────────────────────────────────

  return {
    // State
    method,
    params,
    result,
    splitLine,
    isDrawingSplitLine,
    isComputing,
    error,

    // Road reserve state
    roadReserveEnabled,
    roadReserveWidth,
    roadReserveEdges,
    roadReserveAuto,
    roadReservePreview,

    // Actions
    selectMethod,
    updateParams,
    execute,
    clear,
    startSplitLineDrawing,
    pickCenterPoint,
    exportDXF,
    setSplitLine,

    // Road reserve actions
    setRoadReserveEnabled,
    setRoadReserveWidth,
    setRoadReserveAuto,
    previewRoadReserve,
    clearRoadReservePreview,
    toggleRoadReserveEdge,
  }
}
