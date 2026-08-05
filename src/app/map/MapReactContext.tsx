'use client'
/**
 * MapReactContext — React Context for the METARDU map page
 *
 * Eliminates prop drilling: MapClient provides the context,
 * and any child component (MapToolbar, MapOverlays, MapStatusBar, etc.)
 * can consume what it needs via useMapContext().
 *
 * Previously, MapToolbar alone received 40+ props. Now it reads from context.
 */

import React, { createContext, useContext } from 'react'
import type { BasemapMode, DrawMode, MeasureMode } from '@/hooks/useMapTypes'
import type { StakeoutState } from '@/lib/map/stakeout'
import type { PaperSize, Orientation, PrintOptions } from '@/hooks/usePrint'

// ─── Context Value Type ──────────────────────────────────────────────────

// Geographic bounding box shared by offline-map extent and getMapExtent()
// so the two can't drift apart.
export interface MapExtent {
  minLat: number
  minLon: number
  maxLat: number
  maxLon: number
}

export interface MapContextValue {
  // ── Map refs ──
  mapInstance: React.MutableRefObject<import('ol/Map').default | null>
  popupRef: React.MutableRefObject<HTMLDivElement | null>

  // ── UI state ──
  mapReady: boolean
  initError: string
  projectCount: number
  basemap: BasemapMode
  drawMode: DrawMode
  measureMode: MeasureMode
  editMode: boolean
  mouseCoord: { lon: number; lat: number; e: number; n: number } | null
  gpsTracking: boolean
  gpsPos: { lon: number; lat: number; accuracy: number } | null
  featureCount: number
  importMsg: string
  panelOpen: boolean
  dragHint: boolean
  selectedFeature: import('ol/Feature').default | null
  featureName: string
  measureResult: string
  layerOpacity: number
  stakeoutTarget: { e: number; n: number } | null
  stakeoutActive: boolean
  stakeoutState: StakeoutState | null
  audioMuted: boolean
  saveMsg: string
  offlineDialogOpen: boolean
  showAnnotations: boolean
  projectSearch: string
  isMobile: boolean

  // ── Scheme layer state ──
  schemeLoading: boolean
  schemeError: string
  schemeLoaded: boolean
  schemeParcelCount: number
  schemeBlockCount: number
  schemeBeaconCount: number
  showSchemeParcels: boolean
  showSchemeBlocks: boolean
  showSchemeBeacons: boolean
  hasTraverse: boolean
  traverseParcelPreviewActive: boolean
  hasProjectId: boolean

  // ── Vertex editing state (Tier 1) ──
  vertexEditingEnabled: boolean
  snapEnabled: boolean
  snapTolerance: number
  vertexEditState: {
    vertexCount: number
    hoveredVertex: { easting: number; northing: number; index: number } | null
    lastEditedVertex: { easting: number; northing: number; index: number } | null
  }
  vertexEditingVertices: Array<{ easting: number; northing: number }>

  // ── GPS in EPSG:21037 (for StakeoutPanel) ──
  gpsPos21037: { easting: number; northing: number; accuracy: number } | null

  // ── Projection state (Tier 2) ──
  activeProjection: string

  // ── Print state (Tier 1) ──
  showSheetLayout: boolean
  isPrinting: boolean
  paperSize: PaperSize
  orientation: Orientation
  setPaperSize: React.Dispatch<React.SetStateAction<PaperSize>>
  setOrientation: React.Dispatch<React.SetStateAction<Orientation>>

  // ── Offline map state ──
  offlineMapExtent: MapExtent | null

  // ── Init retry action ──
  retryInit: () => void

  // ── Scheme project ID ──
  schemeProjectId: string | null

  // ── Feature flags ──
  hasFeature: (feature: string) => boolean

  // ── History ──
  canUndo: boolean
  canRedo: boolean

  // ── Advanced digitizing tools (Split / Merge / Reshape / Rotate / Offset) ──
  // AUDIT FIX (2026-07-05): Previously these were local state in MapClient and
  // passed only to the floating DigitizingToolbar. Now exposed via context so
  // the CapturePanel inside MapToolDock can render them inline (cleaner UI,
  // removes the cluttered bottom-center floating bar).
  //
  // T0.8 FIX (2026-07-09): Internally, MapClient splits this into `activeDrawTool`
  // (split/reshape — needs an OL Draw interaction) and `activeOneShotTool`
  // (merge/rotate/offset — fires immediately on Apply). The context still
  // exposes a single `activeDigitizingTool` for backwards-compat with the UI.
  activeDigitizingTool: 'draw' | 'split' | 'merge' | 'reshape' | 'rotate' | 'offset' | null
  setActiveDigitizingTool: (tool: 'draw' | 'split' | 'merge' | 'reshape' | 'rotate' | 'offset' | null) => void
  offsetDistance: number
  setOffsetDistance: (d: number) => void
  // AUDIT FIX (2026-07-05): Rotate angle — was hardcoded to 15° with no
  // user control. Now exposed via context so the MapToolDock can show a
  // slider (0-360°) that lets the user pick the rotation angle.
  // T0.2 FIX (2026-07-09): The slider now ACTUALLY controls rotation —
  // the handler reads rotateAngle instead of a hardcoded 15.
  rotateAngle: number
  setRotateAngle: (a: number) => void
  // T0.3 + T0.8 FIX (2026-07-09): One-shot tools (Merge/Rotate/Offset) now
  // require an explicit Apply click. This prevents the Offset slider from
  // spawning a duplicate feature on every drag tick, and lets the user
  // rotate the same polygon multiple times without re-activating the tool.
  applyOneShotTool: () => void
  // T0.5 FIX (2026-07-09): The active UTM EPSG code (e.g. 'EPSG:21037') used
  // for geometry math. Derived from activeProjection. Panels can display this
  // so users know which CRS their digitizing operations are happening in.
  currentUtmEpsg: string
  snappingEnabled: boolean
  setSnappingEnabled: (v: boolean) => void
  showSnappingOptions: boolean
  setShowSnappingOptions: (v: boolean) => void

  // ── Setters ──
  setPanelOpen: (v: boolean) => void
  setProjectSearch: (v: string) => void
  setAudioMuted: React.Dispatch<React.SetStateAction<boolean>>
  setOfflineDialogOpen: React.Dispatch<React.SetStateAction<boolean>>
  setVertexEditingEnabled: React.Dispatch<React.SetStateAction<boolean>>
  setSnapEnabled: React.Dispatch<React.SetStateAction<boolean>>
  setSnapTolerance: React.Dispatch<React.SetStateAction<number>>
  setShowSheetLayout: React.Dispatch<React.SetStateAction<boolean>>

  // ── Actions ──
  toggleDraw: (mode: DrawMode) => void
  toggleEdit: () => void
  toggleMeasure: (mode: MeasureMode) => void
  toggleAnnotations: () => void
  toggleBasemap: (mode: BasemapMode) => void
  toggleGPS: () => void
  toggleStakeout: () => void
  deleteSelected: () => void
  undo: () => void
  redo: () => void
  fitToKenya: () => void
  fitToDrawn: () => void
  saveToProject: () => void
  exportFeatures: (format: 'GeoJSON' | 'KML' | 'WKT' | 'DXF' | 'LandXML') => void
  clearDrawn: () => void
  updateFeatureName: (name: string) => void
  handleOpacityChange: (val: number) => void
  handleCoordSearch: (input: string) => Promise<void>
  stakeoutInfo: () => { distance: number; bearing: number; dE: number; dN: number } | null
  deactivateStakeout: () => void
  getMapExtent: () => Promise<MapExtent | null>

  // ── Scheme actions ──
  loadSchemeData: () => void
  toggleSchemeParcelVisibility: () => void
  toggleSchemeBlockVisibility: () => void
  toggleSchemeBeaconVisibility: () => void
  zoomToScheme: () => void
  removeScheme: () => void
  createParcelFromTraverse: () => void
  confirmTraverseParcel: () => void
  cancelTraverseParcel: () => void

  // ── Projection actions (Tier 2) ──
  switchProjection: (projection: string) => void

  // ── Print actions (Tier 1) ──
  printMap: (overrides?: Partial<PrintOptions>) => Promise<void>

  // ── Offline tile actions ──
  toggleOfflineDialog: (open: boolean) => Promise<void>
}

// ─── Context Creation ────────────────────────────────────────────────────

const MapReactContext = createContext<MapContextValue | null>(null)

// ─── Provider Component ──────────────────────────────────────────────────

export function MapProvider({
  value,
  children,
}: {
  value: MapContextValue
  children: React.ReactNode
}) {
  return (
    <MapReactContext.Provider value={value}>
      {children}
    </MapReactContext.Provider>
  )
}

// ─── Consumer Hook ───────────────────────────────────────────────────────

/**
 * useMapContext — Access the map state and actions from any child component.
 *
 * Must be used within a <MapProvider>.
 *
 * @example
 * ```tsx
 * function MyMapWidget() {
 *   const { drawMode, featureCount, toggleDraw } = useMapContext()
 *   return <button onClick={() => toggleDraw('Point')}>Draw Point ({featureCount})</button>
 * }
 * ```
 */
export function useMapContext(): MapContextValue {
  const ctx = useContext(MapReactContext)
  if (!ctx) {
    throw new Error('useMapContext must be used within a <MapProvider>')
  }
  return ctx
}
