'use client'
/**
 * METARDU Global Map Page — Premium OpenLayers Interface
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │  ARCHITECTURE: Split into sub-components for maintainability │
 * │                                                              │
 * │  MapClient.tsx    → Orchestrator (state + wiring)           │
 * │  ├─ hooks/useMapInit.ts        → Map initialization         │
 * │  ├─ hooks/useMapBasemaps.ts    → Basemap layer management   │
 * │  ├─ hooks/useMapState.ts       → View persistence           │
 * │  ├─ hooks/useMapInteractions.ts → Draw/Measure/GPS/Export   │
 * │  ├─ components/MapToolbar.tsx   → Left sidebar (context)    │
 * │  ├─ components/MapOverlays.tsx  → Zoom/GPS/Stakeout (ctx)   │
 * │  ├─ components/MapStatusBar.tsx → Bottom coord bar (ctx)    │
 * │  ├─ components/MapLoadingOverlay.tsx → Loading/Error (ctx)  │
 * │  ├─ components/MapNotifications.tsx  → Toast (context)      │
 * │  ├─ components/MapCoordSearch.tsx   → Coord search (ctx)    │
 * │  ├─ components/CogoInfoPanel.tsx    → COGO traverse (ctx)   │
 * │  ├─ components/CogoToolsPanel.tsx   → COGO compute (ctx)    │
 * │  ├─ components/RotationControl.tsx  → North arrow reset     │
 * │  ├─ components/MapPrintButton.tsx   → Print button (ctx)    │
 * │  ├─ LayerControl (reusable, props)  → Grid/XYZ/WMS/Opacity │
 * │  ├─ VertexEditToolbar (ctx version) → Vertex editing + snap │
 * │  ├─ ProjectionSwitcher (context)    → CRS switching         │
 * │  ├─ StakeoutPanel (context)         → GPS stakeout HUD      │
 * │  ├─ SchemeLayerPanel (context)      → Scheme layer controls │
 * │  ├─ OfflineTileDownloader (context) → Offline tile dialog   │
 * │  ├─ SheetLayout (dynamic)           → Print layout overlay  │
 * │  └─ MapReactContext                 → Zero-prop data bus    │
 * │                                                              │
 * │  Performance optimizations:                                  │
 * │  - All sub-components wrapped in React.memo                 │
 * │  - useMemo for stable object references                     │
 * │  - useCallback for all interaction handlers                 │
 * │  - 100ms mouse position throttle                            │
 * │  - Dynamic imports for all OpenLayers modules               │
 * │  - Tile cache size 2048 for all basemaps                    │
 * │  - Map state persistence every 10s (not per move)           │
 * │  - Safety timeout: force ready after 5s                     │
 * └──────────────────────────────────────────────────────────────┘
 *
 * Features:
 *  - Draw interaction (Point, Line, Polygon, Circle)
 *  - Modify interaction (vertex editing)
 *  - Select interaction + Popup overlays
 *  - Undo / Redo history (via useMapHistory hook)
 *  - Measurement (Distance & Area with bearing)
 *  - GeoJSON / KML / WKT import & export (DXF/LandXML export only — no import)
 *  - Drag & Drop file import
 *  - MousePosition (live EPSG:21037 coords)
 *  - Geolocation (GPS tracking)
 *  - GPS Stakeout mode (Pro+)
 *  - Cluster source for project markers
 *  - Multiple basemaps (OSM, Satellite, Dark, Terrain)
 *  - Bearing/distance annotations on drawn features
 *  - Save drawn features to project
 *  - Offline tile download (Pro+)
 *  - URL param ?projectId=xxx deep linking
 *  - Keyboard shortcuts (Ctrl+Z/Y, Del, Esc)
 *  - Map state persistence (localStorage)
 *  - Coordinate search (lat/lon, UTM, DMS)
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { logger } from '@/lib/logger'
import { useMapHistory } from '@/hooks/useMapHistory'
import type { MapContext } from '@/hooks/useMapTypes'
import MapErrorBoundary from '@/app/map/MapErrorBoundary'
import MapGlobalStyles from '@/app/map/MapGlobalStyles'
import type { BasemapMode, DrawMode, MeasureMode } from '@/app/map/mapTypes'
import { useIsMobile } from '@/hooks/use-mobile'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useSubscription } from '@/lib/subscription/subscriptionContext'
import { createSchemeLayers, zoomToSchemeExtent } from '@/lib/map/schemeLayer'
import { createProjectPointsLayer } from '@/lib/map/projectPointsLayer'
import { SchemeLayerPanel } from '@/app/map/components/SchemeLayerPanel'
import type { StakeoutState } from '@/lib/map/stakeout'
import type { MapCleanupRefs } from '@/lib/map/olTypes'
import type { PlanGeometry } from '@/lib/engine/planGeometry'
import {
  createTraversePolygonPreview,
  removeTraversePolygonPreview,
  createParcelFromTraverse,
} from '@/lib/map/traverseToParcel'

// ── Sub-components (lazy where appropriate) ──
import { MapOverlays } from '@/app/map/components/MapOverlays'
import { MapStatusBar } from '@/app/map/components/MapStatusBar'
import { MapLoadingOverlay } from '@/app/map/components/MapLoadingOverlay'
import { MapNotifications } from '@/app/map/components/MapNotifications'
import { RotationControl } from '@/app/map/components/RotationControl'
import { NorthArrowOverlay } from '@/app/map/components/NorthArrowOverlay'
import { MapOverlayProvider } from '@/app/map/components/MapOverlayManager'
import { MapPrintButton } from '@/app/map/components/MapPrintButton'
import { MapCoordSearch } from '@/app/map/components/MapCoordSearch'
import { KeyboardShortcutsHelp } from '@/app/map/components/KeyboardShortcutsHelp'
import { MapToolDock } from '@/app/map/components/MapToolDock'
import { MapInteractionToggle } from '@/app/map/components/MapInteractionToggle'
import { OfflineDownloadButton } from '@/app/map/components/OfflineDownloadButton'
import { IdentifyPanel, type IdentifiedFeature } from '@/app/map/components/IdentifyPanel'
import { SnappingOptions } from '@/app/map/components/SnappingOptions'
import { StakeoutRadar } from '@/components/survey/StakeoutRadar'
import { OsmBuildingsLayer } from '@/app/map/components/OsmBuildingsLayer'
import { VertexEditToolbarContext as VertexEditToolbar } from '@/components/map/VertexEditToolbar'
import { ProjectionSwitcher } from '@/components/map/ProjectionSwitcher'
import { switchMapView } from '@/lib/map/nativeProjectionView'

// ── Hooks ──
import { useMapBasemaps } from '@/app/map/hooks/useMapBasemaps'
import { useMapInit } from '@/app/map/hooks/useMapInit'
import { useMapState } from '@/app/map/hooks/useMapState'
import { useMapInteractions } from '@/app/map/hooks/useMapInteractions'
import { useVertexEditing } from '@/hooks/useVertexEditing'
import { usePrint, type PrintOptions } from '@/hooks/usePrint'
import type { MapExtent } from './MapReactContext'
import { MapProvider, type MapContextValue } from '@/app/map/MapReactContext'
import { Target } from 'lucide-react'

// ── Dynamic imports for heavy components ──
const OfflineTileDownloader = dynamic(
  () => import('@/components/map/OfflineTileDownloader').then(m => ({ default: m.OfflineTileDownloader })),
  { ssr: false }
)

const SheetLayout = dynamic(
  () => import('@/components/map/SheetLayout'),
  { ssr: false, loading: () => null }
)

/* ══════════════════════════════════════════════════════════════════════
 *  POPUP RENDERER
 *  Renders feature popup as raw DOM (OL moves the overlay element out
 *  of React's tree, so we can't use React components here).
 * ══════════════════════════════════════════════════════════════════════ */
function renderPopup(popupElement: HTMLDivElement, data: {
  coordinate?: import('ol/coordinate').Coordinate
  projectName?: string
  stationName?: string
  geometryType?: string
  projectId?: string
}, hidePopup: () => void) {
  popupElement.replaceChildren()
  popupElement.className = ''

  const card = document.createElement('div')
  card.className = 'bg-[var(--bg-secondary)]/95 border border-[var(--accent)]/30 rounded-xl shadow-2xl backdrop-blur-xl p-4 min-w-[220px] max-w-[320px]'

  const header = document.createElement('div')
  header.className = 'flex items-start justify-between mb-2'

  const labelWrap = document.createElement('div')
  labelWrap.className = 'flex items-center gap-2'
  const dot = document.createElement('div')
  dot.className = 'w-1.5 h-1.5 rounded-full bg-[var(--accent)]'
  const label = document.createElement('span')
  label.className = 'text-[10px] text-[var(--text-muted)] uppercase tracking-[0.15em] font-semibold'
  label.textContent = data.geometryType || 'Feature'
  labelWrap.append(dot, label)

  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.className = 'text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-0.5'
  closeButton.textContent = 'x'
  closeButton.addEventListener('click', hidePopup)
  header.append(labelWrap, closeButton)
  card.append(header)

  if (data.projectName) {
    const project = document.createElement('div')
    project.className = 'mb-1'
    project.innerHTML = '<span class="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Project</span>'
    const value = document.createElement('p')
    value.className = 'text-sm font-semibold text-[var(--text-primary)]'
    value.textContent = data.projectName
    project.append(value)
    card.append(project)
  }

  if (data.stationName) {
    const station = document.createElement('div')
    station.className = 'mb-1'
    station.innerHTML = '<span class="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Station</span>'
    const value = document.createElement('p')
    value.className = 'text-sm text-[var(--accent)]'
    value.textContent = data.stationName
    station.append(value)
    card.append(station)
  }

  if (data.projectId) {
    const link = document.createElement('a')
    link.href = `/project/${data.projectId}`
    link.className = 'block mt-2 text-[11px] text-[var(--accent)] hover:underline font-medium'
    link.textContent = 'Go to Project \u2192'
    card.append(link)
  }

  popupElement.append(card)
}

/* ══════════════════════════════════════════════════════════════════════
 *  MAIN COMPONENT
 * ══════════════════════════════════════════════════════════════════════ */
export default function MapClient() {
  const isMobile = useIsMobile()
  const searchParams = useSearchParams()
  const { hasFeature } = useSubscription()

  // ── Map refs ──
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<import('ol/Map').default | null>(null)
  const popupRef = useRef<HTMLDivElement | null>(null)
  const mouseCoordThrottleRef = useRef(0)

  // ── OL layer/interaction refs ──
  const drawSourceRef = useRef<import('ol/source/Vector').default | null>(null)
  const drawLayerRef = useRef<import('ol/layer/Vector').default | null>(null)
  const drawInteractionRef = useRef<import('ol/interaction').Interaction | null>(null)
  const selectInteractionRef = useRef<import('ol/interaction/Select').default | null>(null)
  const modifyInteractionRef = useRef<import('ol/interaction').Interaction | null>(null)
  const measureInteractionRef = useRef<import('ol/interaction').Interaction | null>(null)
  const measureSourceRef = useRef<import('ol/source/Vector').default | null>(null)
  const measureLayerRef = useRef<import('ol/layer/Vector').default | null>(null)
  const annotationLayerRef = useRef<import('ol/layer/Vector').default | null>(null)

  // ── GPS toggle ref (allows interactions hook to call the real toggleGPS) ──
  const toggleGPSRef = useRef<() => void>(() => {})

  // ── Map cleanup refs (replaces _cleanup hack on map object) ──
  const cleanupRef = useRef<MapCleanupRefs | null>(null)

  // ── Project ID from URL params (declared early — used by useMapInteractions) ──
  const schemeProjectId = searchParams.get('projectId')

  // ── UI state ──
  const [mapReady, setMapReady] = useState(false)
  const [initError, setInitError] = useState('')
  const [projectCount, setProjectCount] = useState(0)
  const [basemap, setBasemap] = useState<BasemapMode>('osm')
  const [drawMode, setDrawMode] = useState<DrawMode>('none')
  const [measureMode, setMeasureMode] = useState<MeasureMode>('none')
  const [editMode, setEditMode] = useState(false)
  const [mouseCoord, setMouseCoord] = useState<{ lon: number; lat: number; e: number; n: number } | null>(null)
  const [gpsTracking, setGpsTracking] = useState(false)
  const [gpsPos, setGpsPos] = useState<{ lon: number; lat: number; accuracy: number } | null>(null)
  const [gpsPos21037, setGpsPos21037] = useState<{ easting: number; northing: number; accuracy: number } | null>(null)
  const [featureCount, setFeatureCount] = useState(0)
  const [importMsg, setImportMsg] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const [dragHint, setDragHint] = useState(true)
  const [selectedFeature, setSelectedFeature] = useState<import('ol/Feature').default | null>(null)
  const [featureName, setFeatureName] = useState('')
  const [measureResult, setMeasureResult] = useState('')
  const [layerOpacity, setLayerOpacity] = useState(100)
  const [stakeoutTarget, setStakeoutTarget] = useState<{ e: number; n: number } | null>(null)
  const [stakeoutActive, setStakeoutActive] = useState(false)
  const [stakeoutState, setStakeoutState] = useState<StakeoutState | null>(null)
  const [audioMuted, setAudioMuted] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [offlineDialogOpen, setOfflineDialogOpen] = useState(false)
  const [showAnnotations, setShowAnnotations] = useState(false)
  const [projectSearch, setProjectSearch] = useState('')

  // ── Scheme layer state ──
  const [schemeLoading, setSchemeLoading] = useState(false)
  const [schemeError, setSchemeError] = useState('')
  const [schemeLoaded, setSchemeLoaded] = useState(false)
  const [schemeParcelCount, setSchemeParcelCount] = useState(0)
  const [schemeBlockCount, setSchemeBlockCount] = useState(0)
  const [schemeBeaconCount, setSchemeBeaconCount] = useState(0)
  const [showSchemeParcels, setShowSchemeParcels] = useState(true)
  const [showSchemeBlocks, setShowSchemeBlocks] = useState(true)
  const [showSchemeBeacons, setShowSchemeBeacons] = useState(true)
  const schemeCleanupRef = useRef<(() => void) | null>(null)
  const schemeLayersRef = useRef<{ parcelLayer: import('ol/layer/Vector').default | null; blockLayer: import('ol/layer/Vector').default | null; beaconLayer: import('ol/layer/Vector').default | null; extent: number[] | null } | null>(null)

  // ── Project survey points state (the #1 map gap — show your field data) ──
  const [projectPointsCount, setProjectPointsCount] = useState(0)
  const [projectPointsLoading, setProjectPointsLoading] = useState(false)
  const [showProjectPoints, setShowProjectPoints] = useState(true)
  const projectPointsCleanupRef = useRef<(() => void) | null>(null)
  const projectPointsLayerRef = useRef<import('ol/layer/Vector').default | null>(null)

  // ── Traverse-to-parcel state ──
  const [traverseParcelPreviewActive, setTraverseParcelPreviewActive] = useState(false)
  const [hasTraverse, setHasTraverse] = useState(false)
  const traversePreviewLayerRef = useRef<import('ol/layer/Vector').default | null>(null)

  // ── Vertex editing state (Tier 1: VertexEditToolbar) ──
  const [vertexEditingEnabled, setVertexEditingEnabled] = useState(false)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [snapTolerance, setSnapTolerance] = useState(10)
  const [vertexEditingVertices, setVertexEditingVertices] = useState<Array<{ easting: number; northing: number }>>([])

  // ── Print/PDF state (Tier 1: usePrint + SheetLayout) ──
  const [showSheetLayout, setShowSheetLayout] = useState(false)
  // Derived at print time from the largest drawn polygon so the sheet's scale,
  // area and perimeter reflect the actual survey (not the "As Noted" fallback).
  const [printPlanGeometry, setPrintPlanGeometry] = useState<PlanGeometry | null>(null)

  // ── Identify Panel state ──
  const [identifiedFeature, setIdentifiedFeature] = useState<IdentifiedFeature | null>(null)

  // ── Digitizing Tools state ──
  const [activeDigitizingTool, setActiveDigitizingTool] = useState<'draw' | 'split' | 'merge' | 'reshape' | 'rotate' | 'offset' | null>(null)
  const [offsetDistance, setOffsetDistance] = useState(5)
  const [rotateAngle, setRotateAngle] = useState(15)
  const [snappingEnabled, setSnappingEnabled] = useState(true)
  const [snappingMode, setSnappingMode] = useState<'vertex' | 'segment' | 'vertex_segment'>('vertex_segment')
  const [snappingTolerance, setSnappingTolerance] = useState(10)
  const [snappingTypes, setSnappingTypes] = useState<Set<'osm' | 'parcels' | 'beacons' | 'grid' | 'all'>>(new Set(['parcels', 'beacons']))
  const [showSnappingOptions, setShowSnappingOptions] = useState(false)

  // ── Stakeout Radar state ──
  const [showStakeoutRadar, setShowStakeoutRadar] = useState(false)
  const [stakeoutRadarTarget, setStakeoutRadarTarget] = useState<{ e: number; n: number } | null>(null)

  // ── OSM Buildings overlay toggle ──
  const [showOsmBuildings, setShowOsmBuildings] = useState(false)

  const {
    print: printMap,
    isPrinting,
    paperSize,
    setPaperSize,
    orientation,
    setOrientation,
  } = usePrint({ printTarget: 'metardu-global-map' })

  // ── Map extent for offline tile dialog (async resolve) ──
  const [offlineMapExtent, setOfflineMapExtent] = useState<MapExtent | null>(null)

  // ── Map projection (Tier 2: Projection switching) ──
  const [activeProjection, setActiveProjection] = useState<string>('EPSG:3857')

  // ── History hook ──
  const ctx: MapContext = useMemo(() => ({
    mapInstance,
    drawSourceRef,
    drawLayerRef,
    measureSourceRef,
    measureLayerRef,
    drawInteractionRef,
    selectInteractionRef,
    modifyInteractionRef,
    measureInteractionRef,
    popupRef,
    setDrawMode,
    setEditMode,
    setMeasureMode,
    setMeasureResult,
    setFeatureCount,
    setSelectedFeature,
    setFeatureName,
    pushHistory: () => {},
  }), [])

  const { pushHistory, undo, redo, canUndo, canRedo, clearHistory } = useMapHistory(ctx)

  // ── Basemaps hook ──
  const { createBasemaps, toggleBasemap: toggleBasemapHook } = useMapBasemaps()

  // ── Map initialization ──
  useMapInit({
    mapRef,
    setMapReady,
    setInitError,
    setProjectCount,
    setMouseCoord,
    setFeatureCount,
    setImportMsg,
    setSelectedFeature,
    setFeatureName,
    mouseCoordThrottleRef,
    searchParams,
    pushHistory,
    drawSourceRef,
    drawLayerRef,
    measureSourceRef,
    measureLayerRef,
    selectInteractionRef,
    mapInstance,
    cleanupRef,
    popupRef,
    createBasemaps,
    onPopupRender: renderPopup,
  })

  // ── Map state persistence ──
  useMapState(mapInstance, drawSourceRef, mapReady)

  // ── Interactions hook ──
  const currentUtmEpsg = useMemo(() => {
    if (activeProjection.startsWith('EPSG:21037')) return 'EPSG:21037'
    if (activeProjection.startsWith('EPSG:32737')) return 'EPSG:32737'
    return 'EPSG:21037'
  }, [activeProjection])

  const applyOneShotTool = useCallback(() => {
    // Placeholder — one-shot digitizing tools are triggered via activeDigitizingTool state
    if (activeDigitizingTool) setActiveDigitizingTool(null)
  }, [activeDigitizingTool])

  const interactions = useMapInteractions({
    mapInstance,
    drawSourceRef,
    drawLayerRef,
    drawInteractionRef,
    selectInteractionRef,
    modifyInteractionRef,
    measureInteractionRef,
    measureSourceRef,
    measureLayerRef,
    annotationLayerRef,
    cleanupRef,
    drawMode,
    editMode,
    measureMode,
    showAnnotations,
    gpsTracking,
    stakeoutActive,
    stakeoutTarget,
    gpsPos,
    gpsPos21037,
    currentUtmEpsg,
    projectId: schemeProjectId,
    onDrawEnd: (areaSqM, perimeterM, featureType) => {
      if (featureType === 'Polygon') {
        setSaveMsg(`Area: ${areaSqM.toFixed(1)} m² (${(areaSqM / 10000).toFixed(4)} ha) · Perimeter: ${perimeterM.toFixed(1)} m`)
      } else if (featureType === 'LineString') {
        setSaveMsg(`Length: ${perimeterM.toFixed(1)} m`)
      } else {
        setSaveMsg(`Point drawn`)
      }
      setTimeout(() => setSaveMsg(''), 5000)
    },
    onIdentify: (feature) => {
      setSelectedFeature(feature)
      const name = (feature?.get?.('pointName') || feature?.get?.('parcelNumber') || feature?.get?.('name')) as string | undefined
      if (name) setFeatureName(name)
    },
    hasFeature,
    setDrawMode,
    setEditMode,
    setMeasureMode,
    setMeasureResult,
    setFeatureCount,
    setSelectedFeature,
    setFeatureName,
    setGpsTracking,
    setGpsPos,
    setStakeoutTarget,
    setStakeoutActive,
    setStakeoutState,
    setShowAnnotations,
    setSaveMsg,
    pushHistory,
    clearHistory,
    popupRef,
    toggleGPS: () => toggleGPSRef.current(), // wired via ref to real toggleGPS
  })

  // ── Vertex editing hook (Tier 1) ──
  const { state: vertexEditState } = useVertexEditing({
    map: mapInstance.current,
    vertices: vertexEditingVertices,
    enabled: vertexEditingEnabled,
    onVerticesChange: setVertexEditingVertices,
    snapTolerance,
    snapEnabled,
  })

  // Wire GPS toggle (needs interactions reference)
  const toggleGPS = useCallback(() => {
    if (!mapInstance.current) return
    if (!cleanupRef.current?.geolocation) return

    if (gpsTracking) {
      cleanupRef.current.geolocation.setTracking(false)
      setGpsTracking(false)
      setStakeoutActive(false)
    } else {
      cleanupRef.current.geolocation.setTracking(true)
      setGpsTracking(true)
      const mi = mapInstance.current
      cleanupRef.current.geolocation.once('change:position', () => {
        const pos = cleanupRef.current?.geolocation?.getPosition()
        if (pos && mi) mi.getView().animate({ center: pos, zoom: 16, duration: 1000 })
      })
    }
  }, [gpsTracking])

  // Keep the ref up-to-date so the interactions hook can call the real function
  toggleGPSRef.current = toggleGPS

  // ── Basemap toggle wrapper ──
  const toggleBasemap = useCallback((mode: BasemapMode) => {
    toggleBasemapHook(mapInstance, mode, setBasemap)
  }, [toggleBasemapHook])

  // ── Projection switch handler (Tier 2) ──
  const handleProjectionSwitch = useCallback(async (targetProjection: string) => {
    if (!mapInstance.current) return
    try {
      if (targetProjection === 'EPSG:3857') {
        // Switch back to Web Mercator (default)
        const { default: View } = await import('ol/View')
        const { transform } = await import('ol/proj')
        const currentView = mapInstance.current.getView()
        const currentCenter = currentView.getCenter()
        const currentZoom = currentView.getZoom() ?? 14
        const newCenter = currentCenter
          ? transform(currentCenter, currentView.getProjection(), 'EPSG:3857') as [number, number]
          : undefined
        mapInstance.current.setView(new View({
          projection: 'EPSG:3857',
          center: newCenter ?? [3900000, -500000],
          zoom: currentZoom,
        }))
        setActiveProjection('EPSG:3857')
      } else {
        await switchMapView(mapInstance.current, targetProjection)
        setActiveProjection(targetProjection)
      }
    } catch (err) {
      logger.error('[MapClient] Projection switch failed:', { error: err })
      setSaveMsg('Failed to switch projection')
      setTimeout(() => setSaveMsg(''), 3000)
    }
  }, [])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't hijack keys while the user is typing in any editable control.
      // Covers inputs, textareas, native selects, and contenteditable hosts,
      // plus IME composition (e.g. Windows character composing) which can
      // briefly retarget events and cause accidental Delete mishits.
      const target = e.target as HTMLElement | null
      if (
        e.isComposing ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target && target.isContentEditable)
      ) {
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedFeature) {
          e.preventDefault()
          interactions.deleteSelected()
        }
      } else if (e.key === 'Escape') {
        if (drawMode !== 'none') interactions.toggleDraw('none')
        else if (editMode) interactions.toggleEdit()
        else if (measureMode !== 'none') interactions.toggleMeasure('none')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, selectedFeature, drawMode, editMode, measureMode, interactions])

  // ── Fade drag hint after 5s ──
  useEffect(() => {
    const timer = setTimeout(() => setDragHint(false), 5000)
    return () => clearTimeout(timer)
  }, [])

  // ── Safety timeout: force mapReady after 5s ──
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!mapReady) {
        logger.warn('[MapClient] Forcing mapReady=true after 5s timeout')
        setMapReady(true)
      }
    }, 5000)
    return () => clearTimeout(timeout)
  }, [mapReady])

  // ── Feature name update wrapper ──
  const handleUpdateFeatureName = useCallback((name: string) => {
    setFeatureName(name)
    interactions.updateFeatureName(name, selectedFeature)
  }, [interactions, selectedFeature])

  // ── Opacity change wrapper ──
  const handleOpacityChange = useCallback((val: number) => {
    interactions.handleOpacityChange(val, setLayerOpacity)
  }, [interactions])

  // ── Coord search wrapper ──
  const handleCoordSearch = useCallback(async (input: string) => {
    await interactions.handleCoordSearchLocal(input)
  }, [interactions])

  // ── Print handler: show sheet layout overlay then trigger browser print ──
  const handlePrintMap = useCallback(async (overrides?: Partial<PrintOptions>) => {
    // Force the SheetLayout chunk to load BEFORE we show + print. Without this,
    // the dynamic import races the 500ms delay and the first print can come out
    // blank (overlay not yet mounted) on slow connections.
    try { await import('@/components/map/SheetLayout') } catch {}
    // Derive plan geometry from the largest drawn polygon so the sheet shows a
    // real scale / area / perimeter instead of "As Noted". The state is
    // cleared first so the sheet can never mount with a previous run's value.
    setPrintPlanGeometry(null)
    try {
      const { derivePlanGeometryFromDrawSource } = await import('./utils/derivePlanGeometry')
      const geom = await derivePlanGeometryFromDrawSource(drawSourceRef.current, currentUtmEpsg)
      setPrintPlanGeometry(geom)
    } catch {
      setPrintPlanGeometry(null)
    }
    setShowSheetLayout(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    await printMap(overrides)

    // Fallback timer: clear sheet layout and plan geometry if afterprint never fires (iOS Safari / cancel path)
    setTimeout(() => {
      setShowSheetLayout(false)
      setPrintPlanGeometry(null)
    }, 10000)
  }, [printMap, currentUtmEpsg])

  // Hide the sheet-layout overlay when the print dialog closes. Also drop the
  // derived geometry so a future sheet-open can never render the previous
  // print's stale scale label — the sheet only ever shows a value derived in
  // the same tick it was opened.
  useEffect(() => {
    const onAfterPrint = () => {
      setShowSheetLayout(false)
      setPrintPlanGeometry(null)
    }
    window.addEventListener('afterprint', onAfterPrint)
    return () => window.removeEventListener('afterprint', onAfterPrint)
  }, [])

  // ── Offline dialog toggle (async: resolves map extent when opening) ──
  const handleToggleOfflineDialog = useCallback(async (open: boolean) => {
    setOfflineDialogOpen(open)
    if (open) {
      const extent = await interactions.getMapExtent()
      setOfflineMapExtent(extent)
    }
  }, [interactions])

  // ── Scheme layer: load scheme data ── (projectId declared at top of component)
  const loadSchemeData = useCallback(async () => {
    if (!schemeProjectId || !mapInstance.current || schemeLoading) return

    setSchemeLoading(true)
    setSchemeError('')

    try {
      // Clean up any existing scheme layers first
      if (schemeCleanupRef.current) {
        schemeCleanupRef.current()
        schemeCleanupRef.current = null
        schemeLayersRef.current = null
      }

      const result = await createSchemeLayers(schemeProjectId, mapInstance.current as unknown as import('@/lib/map/olTypes').OLMap, {
        autoZoom: true,
        showParcelLabels: true,
      })

      schemeCleanupRef.current = result.cleanup
      schemeLayersRef.current = {
        parcelLayer: result.parcelLayer,
        blockLayer: result.blockLayer,
        beaconLayer: result.beaconLayer,
        extent: result.extent,
      }

      // ── Add scheme parcel + beacon sources to the Snap interaction ──
      const snapInteraction = (mapInstance.current as unknown as { _snapInteraction?: import('ol/interaction/Snap').default } | null)?._snapInteraction
      if (snapInteraction) {
        const parcelSource = result.parcelLayer?.getSource?.()
        const beaconSource = result.beaconLayer?.getSource?.()
        if (parcelSource) {
          // Add additional Snap interaction for parcels
          const { default: Snap } = await import('ol/interaction/Snap')
          const parcelSnap = new Snap({ source: parcelSource })
          mapInstance.current.addInteraction(parcelSnap)
          ;(mapInstance.current as unknown as { _parcelSnap?: import('ol/interaction/Snap').default })._parcelSnap = parcelSnap
        }
        if (beaconSource) {
          const { default: Snap } = await import('ol/interaction/Snap')
          const beaconSnap = new Snap({ source: beaconSource })
          mapInstance.current.addInteraction(beaconSnap)
          ;(mapInstance.current as unknown as { _beaconSnap?: import('ol/interaction/Snap').default })._beaconSnap = beaconSnap
        }
      }

      setSchemeParcelCount(result.parcelCount)
      setSchemeBlockCount(result.blockCount)
      setSchemeBeaconCount(result.beaconCount)
      setSchemeLoaded(true)

      // ── Extract beacon vertices for vertex editing (Tier 2) ──
      // Read beacon coordinates from the beacon layer source (already in EPSG:21037)
      const beaconSource = result.beaconLayer.getSource()
      if (beaconSource) {
        const beaconFeatures = beaconSource.getFeatures()
        const beaconVertices = beaconFeatures
          .map((f: import('ol/Feature').default) => {
            const geom = f.getGeometry()
            if (!geom || geom.getType() !== 'Point') return null
            // Beacon coordinates are stored in EPSG:3857 (display projection)
            // We need to transform them back to EPSG:21037 for vertex editing
            return { easting: f.get('easting') as number, northing: f.get('northing') as number }
          })
          .filter((v: { easting: number; northing: number } | null): v is { easting: number; northing: number } =>
            v !== null && v.easting !== undefined && v.northing !== undefined
          )
        if (beaconVertices.length >= 3) {
          setVertexEditingVertices(beaconVertices)
        }
      }
    } catch (err) {
      logger.error('[MapClient] Failed to load scheme data:', { error: err })
      setSchemeError(err instanceof Error ? err.message : 'Failed to load scheme data')
      setSchemeLoaded(false)
    } finally {
      setSchemeLoading(false)
    }
  }, [schemeProjectId, schemeLoading])

  // ── Scheme layer: auto-load when projectId is available ──
  useEffect(() => {
    if (schemeProjectId && mapReady && !schemeLoaded && !schemeLoading && !schemeError) {
      loadSchemeData()
    }
  }, [schemeProjectId, mapReady, schemeLoaded, schemeLoading, schemeError, loadSchemeData])

  // ── Project survey points: load when projectId is available ──
  const loadProjectPoints = useCallback(async () => {
    if (!schemeProjectId || !mapInstance.current || projectPointsLoading) return

    setProjectPointsLoading(true)
    try {
      // Clean up existing points layer
      if (projectPointsCleanupRef.current) {
        projectPointsCleanupRef.current()
        projectPointsCleanupRef.current = null
        projectPointsLayerRef.current = null
      }

      const result = await createProjectPointsLayer(schemeProjectId, mapInstance.current)
      projectPointsCleanupRef.current = result.cleanup
      projectPointsLayerRef.current = result.pointsLayer
      setProjectPointsCount(result.pointCount)
    } catch (err) {
      logger.error('[MapClient] Failed to load project points:', { error: err })
      setProjectPointsCount(0)
    } finally {
      setProjectPointsLoading(false)
    }
  }, [schemeProjectId, projectPointsLoading])

  // Auto-load when projectId is available
  useEffect(() => {
    if (schemeProjectId && mapReady && !projectPointsLoading && projectPointsCount === 0) {
      loadProjectPoints()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemeProjectId, mapReady])

  // Toggle points layer visibility
  const _toggleProjectPointsVisibility = useCallback(() => {
    if (!projectPointsLayerRef.current) return
    const newVisible = !showProjectPoints
    projectPointsLayerRef.current.setVisible(newVisible)
    setShowProjectPoints(newVisible)
  }, [showProjectPoints])

  // ── Digitizing tool: create OL interactions for split/merge/reshape/rotate/offset ──
  const editingToolRef = useRef<import('ol/interaction').Interaction | null>(null) // current editing interaction

  useEffect(() => {
    if (!mapInstance.current || !mapReady) return

    // Clean up previous editing interaction
    if (editingToolRef.current) {
      try { mapInstance.current.removeInteraction(editingToolRef.current) } catch { /* */ }
      editingToolRef.current = null
    }

    if (!activeDigitizingTool || activeDigitizingTool === 'draw') return

    const map = mapInstance.current
    const drawSource = drawSourceRef.current

    ;(async () => {
      try {
        if (activeDigitizingTool === 'split' || activeDigitizingTool === 'reshape') {
          // Create a line draw interaction for splitting/reshaping
          const { default: Draw } = await import('ol/interaction/Draw')
          const { default: VectorSource } = await import('ol/source/Vector')
          const { default: Style } = await import('ol/style/Style')
          const { default: Stroke } = await import('ol/style/Stroke')
          const { default: Fill } = await import('ol/style/Fill')

          const tempSource = new VectorSource()
          const draw = new Draw({
            source: tempSource,
            type: 'LineString',
            style: new Style({
              fill: new Fill({ color: 'rgba(209, 123, 71, 0.2)' }),
              stroke: new Stroke({ color: '#D17B47', width: 2, lineDash: [8, 4] }),
            }),
          })

          draw.on('drawend', async (e: import('ol/interaction/Draw').DrawEvent) => {
            const lineFeature = e.feature
            const lineGeom = lineFeature.getGeometry()
            if (!lineGeom || !drawSource) return

            const lineCoords3857 = (lineGeom as import('ol/geom/LineString').default).getCoordinates()
            // Transform to UTM for geometry operations
            const proj = await import('ol/proj')
            const lineCoordsUTM = lineCoords3857.map((c: number[]) =>
              proj.transform(c, 'EPSG:3857', 'EPSG:21037'),
            )

            if (activeDigitizingTool === 'split') {
              // Find the first polygon in the draw source
              const polygons = drawSource.getFeatures().filter((f: import('ol/Feature').default) => {
                const g = f.getGeometry()
                return g && g.getType() === 'Polygon'
              })

              if (polygons.length === 0) {
                setSaveMsg('No polygon to split — draw a polygon first')
                setTimeout(() => setSaveMsg(''), 3000)
                return
              }

              const targetPolygon = polygons[0]
              const polyCoords3857 = (targetPolygon.getGeometry() as import('ol/geom/Polygon').default).getCoordinates()[0]
              const polyCoordsUTM = polyCoords3857.map((c: number[]) =>
                proj.transform(c, 'EPSG:3857', 'EPSG:21037'),
              )

              const { splitPolygonWithLine } = await import('@/lib/map/editingTools')
              const result = splitPolygonWithLine(polyCoordsUTM as [number, number][], lineCoordsUTM as [number, number][])

              if (!result) {
                setSaveMsg('Split failed — line must cross the polygon at two points')
                setTimeout(() => setSaveMsg(''), 4000)
                return
              }

              // Transform results back to 3857
              const p1_3857 = result.polygon1.map(([e, n]) => proj.transform([e, n], 'EPSG:21037', 'EPSG:3857'))
              const p2_3857 = result.polygon2.map(([e, n]) => proj.transform([e, n], 'EPSG:21037', 'EPSG:3857'))

              const { default: Feature } = await import('ol/Feature')
              const { default: Polygon } = await import('ol/geom/Polygon')

              // Remove original polygon, add two new ones
              drawSource.removeFeature(targetPolygon)
              drawSource.addFeature(new Feature({ geometry: new Polygon([p1_3857]), source: 'split' }))
              drawSource.addFeature(new Feature({ geometry: new Polygon([p2_3857]), source: 'split' }))

              setSaveMsg(`Split into 2 polygons (${result.area1.toFixed(1)}m² + ${result.area2.toFixed(1)}m²)`)
              setTimeout(() => setSaveMsg(''), 5000)
            } else if (activeDigitizingTool === 'reshape') {
              // Find the first polygon in the draw source to reshape
              const polygons = drawSource.getFeatures().filter((f: import('ol/Feature').default) => {
                const g = f.getGeometry()
                return g && g.getType() === 'Polygon'
              })

              if (polygons.length === 0) {
                setSaveMsg('No polygon to reshape — draw a polygon first')
                setTimeout(() => setSaveMsg(''), 3000)
                return
              }

              const targetPolygon = polygons[0]
              const polyCoords3857 = (targetPolygon.getGeometry() as import('ol/geom/Polygon').default).getCoordinates()[0]
              const polyCoordsUTM = polyCoords3857.map((c: number[]) =>
                proj.transform(c, 'EPSG:3857', 'EPSG:21037'),
              )

              const { reshapePolygon } = await import('@/lib/map/editingTools')
              const result = reshapePolygon(polyCoordsUTM as [number, number][], lineCoordsUTM as [number, number][])

              if (!result) {
                setSaveMsg('Reshape failed — line must intersect the polygon boundary')
                setTimeout(() => setSaveMsg(''), 4000)
                return
              }

              const reshaped3857 = result.map(([e, n]) => proj.transform([e, n], 'EPSG:21037', 'EPSG:3857'))

              const { default: Feature } = await import('ol/Feature')
              const { default: Polygon } = await import('ol/geom/Polygon')

              // Remove original, add reshaped polygon
              drawSource.removeFeature(targetPolygon)
              drawSource.addFeature(new Feature({ geometry: new Polygon([reshaped3857]), source: 'reshape' }))

              setSaveMsg('Polygon reshaped')
              setTimeout(() => setSaveMsg(''), 3000)
            }
          })

          map.addInteraction(draw)
          editingToolRef.current = draw
        }

        if (activeDigitizingTool === 'merge') {
          // Merge uses the selected features
          const { mergePolygons } = await import('@/lib/map/editingTools')
          const selectedFeatures = drawSource?.getFeatures().filter((f: import('ol/Feature').default) => {
            const g = f.getGeometry()
            return g && g.getType() === 'Polygon'
          }) || []

          if (selectedFeatures.length < 2) {
            setSaveMsg('Select 2+ polygons to merge (draw them first)')
            setTimeout(() => setSaveMsg(''), 3000)
            return
          }

          const proj = await import('ol/proj')
          const polyCoordsUTM = selectedFeatures.map((f: import('ol/Feature').default) => {
            const coords3857 = (f.getGeometry() as import('ol/geom/Polygon').default).getCoordinates()[0]
            return coords3857.map((c: number[]) => proj.transform(c, 'EPSG:3857', 'EPSG:21037'))
          })

          const merged = mergePolygons(polyCoordsUTM as [number, number][][])
          if (!merged) {
            setSaveMsg('Merge failed — polygons must be adjacent')
            setTimeout(() => setSaveMsg(''), 4000)
            return
          }

          const merged3857 = merged.map(([e, n]) => proj.transform([e, n], 'EPSG:21037', 'EPSG:3857'))

          const { default: Feature } = await import('ol/Feature')
          const { default: Polygon } = await import('ol/geom/Polygon')

          // Remove originals, add merged
          if (!drawSource) return
          selectedFeatures.forEach((f) => drawSource.removeFeature(f))
          drawSource.addFeature(new Feature({ geometry: new Polygon([merged3857]), source: 'merge' }))

          setSaveMsg(`Merged ${selectedFeatures.length} polygons into 1`)
          setTimeout(() => setSaveMsg(''), 4000)
          setActiveDigitizingTool(null)
        }

        if (activeDigitizingTool === 'rotate' && selectedFeature) {
          // Rotate the selected feature by 15° (simplified — full drag rotation is complex)
          const { rotatePolygon } = await import('@/lib/map/editingTools')
          const geom = selectedFeature.getGeometry?.()
          if (!geom || geom.getType() !== 'Polygon') {
            setSaveMsg('Select a polygon to rotate')
            setTimeout(() => setSaveMsg(''), 3000)
            return
          }

          const proj = await import('ol/proj')
          const coords3857 = (geom as import('ol/geom/Polygon').default).getCoordinates()[0]
          const coordsUTM = coords3857.map((c: number[]) => proj.transform(c, 'EPSG:3857', 'EPSG:21037'))

          const rotated = rotatePolygon(coordsUTM as [number, number][], 15)
          const rotated3857 = rotated.map(([e, n]) => proj.transform([e, n], 'EPSG:21037', 'EPSG:3857'))

          const { default: Polygon } = await import('ol/geom/Polygon')
          selectedFeature.setGeometry(new Polygon([rotated3857]))

          setSaveMsg('Rotated 15° clockwise')
          setTimeout(() => setSaveMsg(''), 3000)
        }

        if (activeDigitizingTool === 'offset' && selectedFeature) {
          const { createOffset } = await import('@/lib/map/editingTools')
          const geom = selectedFeature.getGeometry?.()
          if (!geom) {
            setSaveMsg('Select a feature to offset')
            setTimeout(() => setSaveMsg(''), 3000)
            return
          }

          const isPolygon = geom.getType() === 'Polygon'
          const coords3857 = isPolygon ? (geom as import('ol/geom/Polygon').default).getCoordinates()[0] : (geom as import('ol/geom/LineString').default).getCoordinates()
          const proj = await import('ol/proj')
          const coordsUTM = coords3857.map((c: number[]) => proj.transform(c, 'EPSG:3857', 'EPSG:21037'))

          const offset = createOffset(coordsUTM as [number, number][], offsetDistance, isPolygon)
          if (!offset) {
            setSaveMsg('Offset failed')
            setTimeout(() => setSaveMsg(''), 3000)
            return
          }

          const offset3857 = offset.map(([e, n]) => proj.transform([e, n], 'EPSG:21037', 'EPSG:3857'))

          const { default: Feature } = await import('ol/Feature')
          let newFeature: import('ol/Feature').default
          if (isPolygon) {
            const { default: Polygon } = await import('ol/geom/Polygon')
            newFeature = new Feature({
              geometry: new Polygon([offset3857]),
              source: 'offset',
              offsetDistance,
            })
          } else {
            const { default: LineString } = await import('ol/geom/LineString')
            newFeature = new Feature({
              geometry: new LineString(offset3857),
              source: 'offset',
              offsetDistance,
            })
          }
          drawSource?.addFeature(newFeature)

          setSaveMsg(`Offset created at ${offsetDistance}m`)
          setTimeout(() => setSaveMsg(''), 3000)
          setActiveDigitizingTool(null)
        }
      } catch (err) {
        logger.error('[DigitizingTool] Error:', { error: err })
      }
    })()

    const mapToClean = mapInstance.current
    const toolToClean = editingToolRef.current
    return () => {
      if (toolToClean && mapToClean) {
        try { mapToClean.removeInteraction(toolToClean) } catch { /* */ }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDigitizingTool, mapReady, selectedFeature, offsetDistance])

  // ── Scheme layer: toggle layer visibility ──
  const toggleSchemeParcelVisibility = useCallback(() => {
    if (!schemeLayersRef.current?.parcelLayer) return
    const newVisible = !showSchemeParcels
    schemeLayersRef.current.parcelLayer.setVisible(newVisible)
    setShowSchemeParcels(newVisible)
  }, [showSchemeParcels])

  const toggleSchemeBlockVisibility = useCallback(() => {
    if (!schemeLayersRef.current?.blockLayer) return
    const newVisible = !showSchemeBlocks
    schemeLayersRef.current.blockLayer.setVisible(newVisible)
    setShowSchemeBlocks(newVisible)
  }, [showSchemeBlocks])

  const toggleSchemeBeaconVisibility = useCallback(() => {
    if (!schemeLayersRef.current?.beaconLayer) return
    const newVisible = !showSchemeBeacons
    schemeLayersRef.current.beaconLayer.setVisible(newVisible)
    setShowSchemeBeacons(newVisible)
  }, [showSchemeBeacons])

  // ── Scheme layer: zoom to scheme extent ──
  const handleZoomToScheme = useCallback(() => {
    if (!mapInstance.current || !schemeLayersRef.current?.extent) return
    zoomToSchemeExtent(mapInstance.current as unknown as import('@/lib/map/olTypes').OLMap, schemeLayersRef.current.extent)
  }, [])

  // ── Scheme layer: remove all scheme layers ──
  const handleRemoveScheme = useCallback(() => {
    if (schemeCleanupRef.current) {
      schemeCleanupRef.current()
      schemeCleanupRef.current = null
    }
    schemeLayersRef.current = null
    setSchemeLoaded(false)
    setSchemeParcelCount(0)
    setSchemeBlockCount(0)
    setSchemeBeaconCount(0)
    setSchemeError('')
  }, [])

  // ── Scheme layer: cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (schemeCleanupRef.current) {
        schemeCleanupRef.current()
      }
    }
  }, [])

  // ── Traverse-to-parcel: check if traverse exists ──
  useEffect(() => {
    if (!schemeProjectId || !schemeLoaded) return
    // Check if there are computed traverses for this project
    const checkTraverse = async () => {
      try {
        const res = await fetch(`/api/scheme/traverse/summary?project_id=${schemeProjectId}`)
        if (res.ok) {
          const data = await res.json() as { data?: { hasTraverses?: boolean } }
          setHasTraverse(data.data?.hasTraverses ?? false)
        }
      } catch {
        // API not available — assume no traverse
        setHasTraverse(false)
      }
    }
    checkTraverse()
  }, [schemeProjectId, schemeLoaded])

  // ── Traverse-to-parcel: create preview ──
  const handleCreateParcelFromTraverse = useCallback(async () => {
    if (!schemeProjectId || !mapInstance.current) return

    try {
      // Fetch traverse data to get coordinates
      const res = await fetch(`/api/scheme/traverse/summary?project_id=${schemeProjectId}`)
      if (!res.ok) throw new Error('Failed to fetch traverse summary')
      const summaryData = await res.json() as { data?: { parcels?: Array<{ id: string | number }> } }

      // Get the first parcel with a traverse
      const parcelId = summaryData.data?.parcels?.[0]?.id
      if (!parcelId) throw new Error('No parcels with traverses found')

      // Fetch the actual traverse coordinates
      const traverseRes = await fetch(`/api/scheme/traverse?parcel_id=${parcelId}`)
      if (!traverseRes.ok) throw new Error('Failed to fetch traverse coordinates')
      const traverseData = await traverseRes.json() as { data?: { coordinates?: Array<{ easting: number; northing: number; station?: string }> } }

      const coordinates = traverseData.data?.coordinates
      if (!coordinates || coordinates.length < 3) {
        throw new Error('Traverse has fewer than 3 stations — cannot form a polygon')
      }

      const traversePoints = coordinates.map((c) => ({
        easting: c.easting,
        northing: c.northing,
        pointName: c.station || '',
      }))

      // Create the preview layer
      const { layer } = await createTraversePolygonPreview(traversePoints)
      mapInstance.current.addLayer(layer)
      traversePreviewLayerRef.current = layer

      // Zoom to the preview
      const source = layer.getSource()
      if (source) {
        const extent = source.getExtent()
        if (extent && extent[0] !== Infinity) {
          mapInstance.current.getView().fit(extent, { padding: [80, 80, 80, 80], duration: 600 })
        }
      }

      setTraverseParcelPreviewActive(true)
    } catch (err) {
      logger.error('[MapClient] Traverse preview failed:', { error: err })
      setSaveMsg(err instanceof Error ? err.message : 'Failed to preview traverse')
      setTimeout(() => setSaveMsg(''), 4000)
    }
  }, [schemeProjectId])

  // ── Traverse-to-parcel: confirm and save ──
  const handleConfirmTraverseParcel = useCallback(async () => {
    if (!schemeProjectId) return

    try {
      // Get the first parcel with a traverse
      const summaryRes = await fetch(`/api/scheme/traverse/summary?project_id=${schemeProjectId}`)
      const summaryData = await summaryRes.json() as { data?: { parcels?: Array<{ id: string | number }> } }
      const parcelId = summaryData.data?.parcels?.[0]?.id

      if (!parcelId) throw new Error('No parcel found for traverse')

      const result = await createParcelFromTraverse(schemeProjectId, String(parcelId))

      // Remove the preview layer
      removeTraversePolygonPreview(mapInstance.current, traversePreviewLayerRef.current)
      traversePreviewLayerRef.current = null
      setTraverseParcelPreviewActive(false)

      const areaHa = result.areaHa?.toFixed(4) ?? 'unknown'
      setSaveMsg(`Parcel boundary created: ${areaHa} ha`)
      setTimeout(() => setSaveMsg(''), 4000)
    } catch (err) {
      logger.error('[MapClient] Traverse confirm failed:', { error: err })
      setSaveMsg(err instanceof Error ? err.message : 'Failed to save parcel boundary')
      setTimeout(() => setSaveMsg(''), 4000)
    }
  }, [schemeProjectId])

  // ── Traverse-to-parcel: cancel and remove preview ──
  const handleCancelTraverseParcel = useCallback(() => {
    if (mapInstance.current && traversePreviewLayerRef.current) {
      removeTraversePolygonPreview(mapInstance.current, traversePreviewLayerRef.current)
      traversePreviewLayerRef.current = null
    }
    setTraverseParcelPreviewActive(false)
  }, [])

  // ── Geolocation position tracking ──
  useEffect(() => {
    if (!mapInstance.current) return
    if (!cleanupRef.current?.geolocation) return

    const geolocation = cleanupRef.current.geolocation

    const onPositionChange = async () => {
      const pos = geolocation.getPosition()
      if (!pos) return
      try {
        const { transform } = await import('ol/proj')
        const lonLat = transform(pos, 'EPSG:3857', 'EPSG:4326') as [number, number]
        setGpsPos({ lon: lonLat[0], lat: lonLat[1], accuracy: geolocation.getAccuracy() })
      } catch {
        // If transform fails, skip this update rather than corrupt state with wrong coords.
        // This can happen if the position is somehow not a valid coordinate.
      }
    }

    geolocation.on('change:position', onPositionChange)
    geolocation.on('change:error', () => {
      setGpsPos(null)
    })
    return () => {
      geolocation.un('change:position', onPositionChange)
      geolocation.un('change:error', () => {
        setGpsPos(null)
      })
    }
  }, [mapReady])

  // ── GPS position in EPSG:21037 (for StakeoutPanel) ──
  // This replaces the synchronous require('ol/proj') that breaks ESM.
  // We compute it asynchronously in an effect and store the result.
  // (gpsPos21037 state declared at top with other GPS state)

  useEffect(() => {
    if (!gpsPos) {
      setGpsPos21037(null)
      return
    }
    const currentGpsPos = gpsPos // capture for async closure
    let cancelled = false
    async function transformGpsPos() {
      try {
        const { transform } = await import('ol/proj')
        if (cancelled) return
        const [e, n] = transform([currentGpsPos.lon, currentGpsPos.lat], 'EPSG:4326', 'EPSG:21037') as [number, number]
        setGpsPos21037({ easting: e, northing: n, accuracy: currentGpsPos.accuracy })
      } catch {
        if (!cancelled) setGpsPos21037({ easting: 0, northing: 0, accuracy: currentGpsPos.accuracy })
      }
    }
    transformGpsPos()
    return () => { cancelled = true }
  }, [gpsPos])

  // ── Update stakeout overlay on each GPS position change ──
  useEffect(() => {
    if (stakeoutActive && gpsPos) {
      interactions.updateStakeoutOnGPS()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stakeoutActive, gpsPos])

  // ══════════════════════════════════════════════════════════════════
  //  CONTEXT VALUE (for MapReactContext — eliminates prop drilling)
  // ══════════════════════════════════════════════════════════════════
  const mapContextValue = useMemo<MapContextValue>(() => ({
    mapInstance,
    popupRef,
    mapReady,
    activeDigitizingTool,
    setActiveDigitizingTool,
    offsetDistance,
    setOffsetDistance,
    rotateAngle,
    setRotateAngle,
    snappingEnabled,
    setSnappingEnabled,
    showSnappingOptions,
    setShowSnappingOptions,
    initError,
    projectCount,
    basemap,
    drawMode,
    measureMode,
    editMode,
    mouseCoord,
    gpsTracking,
    gpsPos,
    featureCount,
    importMsg,
    panelOpen,
    dragHint,
    selectedFeature,
    featureName,
    measureResult,
    layerOpacity,
    stakeoutTarget,
    stakeoutActive,
    stakeoutState,
    audioMuted,
    saveMsg,
    offlineDialogOpen,
    showAnnotations,
    projectSearch,
    isMobile,
    schemeLoading,
    schemeError,
    schemeLoaded,
    schemeParcelCount,
    schemeBlockCount,
    schemeBeaconCount,
    showSchemeParcels,
    showSchemeBlocks,
    showSchemeBeacons,
    hasTraverse,
    traverseParcelPreviewActive,
    hasProjectId: !!schemeProjectId,
    vertexEditingEnabled,
    snapEnabled,
    snapTolerance,
    vertexEditState: vertexEditState,
    vertexEditingVertices,
    gpsPos21037,
    activeProjection,
    currentUtmEpsg,
    applyOneShotTool,
    showSheetLayout,
    isPrinting,
    paperSize,
    orientation,
    setPaperSize,
    setOrientation,
    offlineMapExtent,
    retryInit: () => { setInitError(''); setMapReady(false) },
    schemeProjectId,
    hasFeature,
    canUndo,
    canRedo,
    setPanelOpen,
    setProjectSearch,
    setAudioMuted,
    setOfflineDialogOpen,
    setVertexEditingEnabled,
    setSnapEnabled,
    setSnapTolerance,
    setShowSheetLayout,
    toggleDraw: interactions.toggleDraw,
    toggleEdit: interactions.toggleEdit,
    toggleMeasure: interactions.toggleMeasure,
    toggleAnnotations: interactions.toggleAnnotations,
    toggleBasemap,
    toggleGPS,
    toggleStakeout: interactions.toggleStakeout,
    deleteSelected: interactions.deleteSelected,
    undo,
    redo,
    fitToKenya: interactions.fitToKenya,
    fitToDrawn: interactions.fitToDrawn,
    saveToProject: interactions.saveToProject,
    exportFeatures: interactions.exportFeatures,
    clearDrawn: interactions.clearDrawn,
    updateFeatureName: handleUpdateFeatureName,
    handleOpacityChange,
    handleCoordSearch,
    stakeoutInfo: interactions.stakeoutInfo,
    deactivateStakeout: interactions.deactivateStakeout,
    getMapExtent: interactions.getMapExtent,
    loadSchemeData,
    toggleSchemeParcelVisibility,
    toggleSchemeBlockVisibility,
    toggleSchemeBeaconVisibility,
    zoomToScheme: handleZoomToScheme,
    removeScheme: handleRemoveScheme,
    createParcelFromTraverse: handleCreateParcelFromTraverse,
    confirmTraverseParcel: handleConfirmTraverseParcel,
    cancelTraverseParcel: handleCancelTraverseParcel,
    switchProjection: handleProjectionSwitch,
    printMap: handlePrintMap,
    toggleOfflineDialog: handleToggleOfflineDialog,
  }), [
    mapInstance, popupRef, mapReady, initError, projectCount, basemap, drawMode,
    activeDigitizingTool, offsetDistance, rotateAngle, snappingEnabled, showSnappingOptions,
    measureMode, editMode, mouseCoord, gpsTracking, gpsPos, featureCount, importMsg,
    panelOpen, dragHint, selectedFeature, featureName, measureResult, layerOpacity,
    stakeoutTarget, stakeoutActive, stakeoutState, audioMuted, saveMsg,
    offlineDialogOpen, showAnnotations, projectSearch, isMobile,
    schemeLoading, schemeError, schemeLoaded, schemeParcelCount, schemeBlockCount,
    schemeBeaconCount, showSchemeParcels, showSchemeBlocks, showSchemeBeacons,
    hasTraverse, traverseParcelPreviewActive, schemeProjectId,
    vertexEditingEnabled, snapEnabled, snapTolerance, vertexEditState, vertexEditingVertices,
    gpsPos21037,
    activeProjection, currentUtmEpsg, applyOneShotTool, showSheetLayout, isPrinting,
    paperSize, orientation, offlineMapExtent,
    hasFeature, canUndo, canRedo,
    setPanelOpen, setProjectSearch, setAudioMuted, setOfflineDialogOpen,
    setOrientation, setPaperSize,
    setVertexEditingEnabled, setSnapEnabled, setSnapTolerance, setShowSheetLayout,
    interactions, toggleBasemap, toggleGPS,
    handleUpdateFeatureName, handleOpacityChange, handleCoordSearch,
    loadSchemeData, toggleSchemeParcelVisibility, toggleSchemeBlockVisibility,
    toggleSchemeBeaconVisibility, handleZoomToScheme, handleRemoveScheme,
    handleCreateParcelFromTraverse, handleConfirmTraverseParcel,
    handleCancelTraverseParcel, handleProjectionSwitch, handlePrintMap,
    handleToggleOfflineDialog,
    undo, redo,
  ])

  // ══════════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════════
  return (
    <MapErrorBoundary>
      <MapProvider value={mapContextValue}>
      <MapOverlayProvider>
      <div
        id="metardu-global-map"
        className="h-[calc(100vh-4rem)] bg-[var(--bg-primary)] relative overflow-hidden"
        style={{ '--map-bottom-offset': isMobile ? '64px' : '0px' } as React.CSSProperties}
        role="application"
        aria-label="Survey map — use arrow keys to pan, plus/minus to zoom. Press question mark for keyboard shortcuts."
      >
        {/* Map container */}
        <div className="w-full h-full relative">
          <div ref={mapRef} className="w-full h-full" aria-label="Interactive survey map" />

          {/* ── Overlays (only when map is ready) ── */}
          {mapReady && (
            <>
              <MapOverlays />

              <MapCoordSearch />

              {/* ── Floating Tool Dock (consolidated left-edge dock) ── */}
              <MapToolDock />

              {/* ── Mobile Gesture Lock (bottom-left, above status bar) ── */}
              <MapInteractionToggle mapInstance={mapInstance} />

              {/* ── Snapping Options Panel (top-right, below zoom) ── */}
              <SnappingOptions
                open={showSnappingOptions}
                onClose={() => setShowSnappingOptions(false)}
                enabled={snappingEnabled}
                onToggleEnabled={() => setSnappingEnabled(!snappingEnabled)}
                mode={snappingMode}
                onModeChange={setSnappingMode}
                tolerance={snappingTolerance}
                onToleranceChange={setSnappingTolerance}
                snapTypes={snappingTypes}
                onSnapTypeToggle={(type) => {
                  const next = new Set(snappingTypes)
                  if (next.has(type)) next.delete(type)
                  else next.add(type)
                  setSnappingTypes(next)
                }}
              />

              {/* ── Identify Panel (right side, below layer controls) ── */}
              <IdentifyPanel
                feature={identifiedFeature}
                onClose={() => setIdentifiedFeature(null)}
                onZoomTo={(feature) => {
                  if (feature.centroidE && feature.centroidN) {
                    mapInstance.current?.getView().animate({
                      center: [feature.centroidE, feature.centroidN],
                      zoom: 18,
                      duration: 500,
                    })
                  }
                }}
              />

              {/* ── Stakeout Radar button (bottom-left, next to gesture lock) ── */}
              {!showStakeoutRadar && (
                <button
                  onClick={() => {
                    const view = mapInstance.current?.getView()
                    if (view) {
                      const center = view.getCenter()
                      if (center) {
                        setStakeoutRadarTarget({ e: center[0], n: center[1] })
                        setShowStakeoutRadar(true)
                      }
                    }
                  }}
                  className="absolute bottom-20 left-16 z-20 sm:left-3 flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--bg-secondary)]/70 backdrop-blur-xl border border-[var(--border-color)]/[0.06] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/30 transition-all shadow-lg"
                  title="Launch stakeout radar for beacon recovery"
                  aria-label="Stakeout radar"
                >
                  <Target className="w-5 h-5" />
                </button>
              )}

              {/* ── Stakeout Radar (full-screen when active) ── */}
              {showStakeoutRadar && stakeoutRadarTarget && (
                <StakeoutRadar
                  targetE={stakeoutRadarTarget.e}
                  targetN={stakeoutRadarTarget.n}
                  onClose={() => setShowStakeoutRadar(false)}
                />
              )}

              {/* ── Offline Download button (bottom-left, above radar) ── */}
              {/* ── Offline Tile Download Button (bottom-right) ── */}
              <OfflineDownloadButton />

              <MapStatusBar />

              <MapNotifications />

              {/* Scheme Layer Panel (right side, zero-prop) */}
              <SchemeLayerPanel />

              {/* ── Right side controls ── */}
              <div className="absolute top-14 right-3 z-20 sm:top-16 sm:right-4 flex flex-col gap-2 items-end">
                {/* Projection Switcher (zero-prop) */}
                <ProjectionSwitcher />

                {/* Rotation Control (north reset) */}
                <RotationControl />

                {/* OSM Buildings Toggle */}
                <button
                  onClick={() => setShowOsmBuildings(!showOsmBuildings)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all backdrop-blur-xl border ${
                    showOsmBuildings
                      ? 'bg-[var(--accent)]/15 border-[var(--accent)]/30 text-[var(--accent)]'
                      : 'bg-[var(--bg-secondary)]/60 border-[var(--border-color)]/[0.08] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]/80'
                  }`}
                  title="Toggle OpenStreetMap building footprints (requires Python worker + PBF file)"
                >
                  <span className="text-sm">🏗</span>
                  <span className="hidden sm:inline">OSM Buildings</span>
                </button>

                {/* Always-on North Arrow (rotates with map) */}
                <NorthArrowOverlay mapInstance={mapInstance} />
              </div>

              {/* OSM Buildings Overlay Layer */}
              {mapInstance.current && (
                <OsmBuildingsLayer map={mapInstance.current} visible={showOsmBuildings} />
              )}

              {/* ── Vertex Edit Toolbar (bottom-left, near map controls) ── */}
              <div className="absolute bottom-24 left-3 z-20">
                <VertexEditToolbar />
              </div>

              {/* ── Print button (bottom-right) ── */}
              <div className="absolute bottom-10 right-3 z-20 no-print print-hide flex items-center gap-2">
                <MapPrintButton />
              </div>

              {/* ── Sheet Layout Overlay (print-only — no manual toggle) ── */}
              {showSheetLayout && (
                <SheetLayout
                  show={showSheetLayout}
                  map={mapInstance.current}
                  planGeometry={printPlanGeometry}
                  projectName={schemeProjectId ? `Project ${schemeProjectId}` : 'Global Map'}
                />
              )}
            </>
          )}

          {/* Loading / Error overlay (zero-prop, reads from context) */}
          <MapLoadingOverlay />
        </div>

        {/* Keyboard shortcuts modal (global overlay) */}
        <KeyboardShortcutsHelp />

        {/* Global styles */}
        <MapGlobalStyles />

        {/* Offline tile downloader (re-enabled — backend now implemented) */}
        {mapReady && <OfflineTileDownloader />}
      </div>
      </MapOverlayProvider>
      </MapProvider>
    </MapErrorBoundary>
  )
}
