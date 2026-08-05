'use client'
/**
 * MapSubContexts — Performance-optimized context slices
 *
 * Splits the monolithic MapReactContext into sub-contexts so components
 * only re-render when the slice they consume changes.
 *
 * Sub-contexts:
 *  - MapSchemeContext — Scheme layer state & actions
 *  - MapDrawContext   — Draw/edit/measure state & actions
 *  - MapPrintContext  — Print state & actions
 *
 * Each sub-context reads from the parent MapReactContext (no state duplication).
 * The main MapReactContext remains unchanged for backward compatibility.
 */

import React, { createContext, useContext } from 'react'
import { useMapContext } from '@/app/map/MapReactContext'
import type { DrawMode, MeasureMode } from '@/hooks/useMapTypes'
import type { PaperSize, Orientation, PrintOptions } from '@/hooks/usePrint'

// ─── Scheme Sub-Context ──────────────────────────────────────────────────

interface MapSchemeContextValue {
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
  schemeProjectId: string | null
  loadSchemeData: () => void
  toggleSchemeParcelVisibility: () => void
  toggleSchemeBlockVisibility: () => void
  toggleSchemeBeaconVisibility: () => void
  zoomToScheme: () => void
  removeScheme: () => void
  createParcelFromTraverse: () => void
  confirmTraverseParcel: () => void
  cancelTraverseParcel: () => void
}

const MapSchemeContext = createContext<MapSchemeContextValue | null>(null)

export function MapSchemeProvider({ children }: { children: React.ReactNode }) {
  const ctx = useMapContext()

  const value: MapSchemeContextValue = {
    schemeLoading: ctx.schemeLoading,
    schemeError: ctx.schemeError,
    schemeLoaded: ctx.schemeLoaded,
    schemeParcelCount: ctx.schemeParcelCount,
    schemeBlockCount: ctx.schemeBlockCount,
    schemeBeaconCount: ctx.schemeBeaconCount,
    showSchemeParcels: ctx.showSchemeParcels,
    showSchemeBlocks: ctx.showSchemeBlocks,
    showSchemeBeacons: ctx.showSchemeBeacons,
    hasTraverse: ctx.hasTraverse,
    traverseParcelPreviewActive: ctx.traverseParcelPreviewActive,
    hasProjectId: ctx.hasProjectId,
    schemeProjectId: ctx.schemeProjectId,
    loadSchemeData: ctx.loadSchemeData,
    toggleSchemeParcelVisibility: ctx.toggleSchemeParcelVisibility,
    toggleSchemeBlockVisibility: ctx.toggleSchemeBlockVisibility,
    toggleSchemeBeaconVisibility: ctx.toggleSchemeBeaconVisibility,
    zoomToScheme: ctx.zoomToScheme,
    removeScheme: ctx.removeScheme,
    createParcelFromTraverse: ctx.createParcelFromTraverse,
    confirmTraverseParcel: ctx.confirmTraverseParcel,
    cancelTraverseParcel: ctx.cancelTraverseParcel,
  }

  return (
    <MapSchemeContext.Provider value={value}>
      {children}
    </MapSchemeContext.Provider>
  )
}

export function useMapSchemeContext(): MapSchemeContextValue {
  const ctx = useContext(MapSchemeContext)
  if (!ctx) throw new Error('useMapSchemeContext must be used within a <MapSchemeProvider>')
  return ctx
}

// ─── Draw Sub-Context ────────────────────────────────────────────────────

interface MapDrawContextValue {
  drawMode: DrawMode
  editMode: boolean
  measureMode: MeasureMode
  featureCount: number
  selectedFeature: import('ol/Feature').default | null
  featureName: string
  measureResult: string
  layerOpacity: number
  showAnnotations: boolean
  toggleDraw: (mode: DrawMode) => void
  toggleEdit: () => void
  toggleMeasure: (mode: MeasureMode) => void
  toggleAnnotations: () => void
  deleteSelected: () => void
  undo: () => void
  redo: () => void
  updateFeatureName: (name: string) => void
  handleOpacityChange: (val: number) => void
  clearDrawn: () => void
  canUndo: boolean
  canRedo: boolean
}

const MapDrawContext = createContext<MapDrawContextValue | null>(null)

export function MapDrawProvider({ children }: { children: React.ReactNode }) {
  const ctx = useMapContext()

  const value: MapDrawContextValue = {
    drawMode: ctx.drawMode,
    editMode: ctx.editMode,
    measureMode: ctx.measureMode,
    featureCount: ctx.featureCount,
    selectedFeature: ctx.selectedFeature,
    featureName: ctx.featureName,
    measureResult: ctx.measureResult,
    layerOpacity: ctx.layerOpacity,
    showAnnotations: ctx.showAnnotations,
    toggleDraw: ctx.toggleDraw,
    toggleEdit: ctx.toggleEdit,
    toggleMeasure: ctx.toggleMeasure,
    toggleAnnotations: ctx.toggleAnnotations,
    deleteSelected: ctx.deleteSelected,
    undo: ctx.undo,
    redo: ctx.redo,
    updateFeatureName: ctx.updateFeatureName,
    handleOpacityChange: ctx.handleOpacityChange,
    clearDrawn: ctx.clearDrawn,
    canUndo: ctx.canUndo,
    canRedo: ctx.canRedo,
  }

  return (
    <MapDrawContext.Provider value={value}>
      {children}
    </MapDrawContext.Provider>
  )
}

export function useMapDrawContext(): MapDrawContextValue {
  const ctx = useContext(MapDrawContext)
  if (!ctx) throw new Error('useMapDrawContext must be used within a <MapDrawProvider>')
  return ctx
}

// ─── Print Sub-Context ───────────────────────────────────────────────────

interface MapPrintContextValue {
  showSheetLayout: boolean
  isPrinting: boolean
  paperSize: PaperSize
  orientation: Orientation
  setPaperSize: React.Dispatch<React.SetStateAction<PaperSize>>
  setOrientation: React.Dispatch<React.SetStateAction<Orientation>>
  printMap: (overrides?: Partial<PrintOptions>) => Promise<void>
}

const MapPrintContext = createContext<MapPrintContextValue | null>(null)

export function MapPrintProvider({ children }: { children: React.ReactNode }) {
  const ctx = useMapContext()

  const value: MapPrintContextValue = {
    showSheetLayout: ctx.showSheetLayout,
    isPrinting: ctx.isPrinting,
    paperSize: ctx.paperSize,
    orientation: ctx.orientation,
    setPaperSize: ctx.setPaperSize,
    setOrientation: ctx.setOrientation,
    printMap: ctx.printMap,
  }

  return (
    <MapPrintContext.Provider value={value}>
      {children}
    </MapPrintContext.Provider>
  )
}

export function useMapPrintContext(): MapPrintContextValue {
  const ctx = useContext(MapPrintContext)
  if (!ctx) throw new Error('useMapPrintContext must be used within a <MapPrintProvider>')
  return ctx
}
