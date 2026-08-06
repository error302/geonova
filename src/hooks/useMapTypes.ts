/**
 * Shared types and MapContext for the modular MapClient hooks.
 *
 * All hooks receive a `MapContext` object so they can coordinate
 * interactions (e.g. toggling draw deactivates measure & edit).
 *
 * Note: Mode types (BasemapMode, DrawMode, MeasureMode) and PopupData
 * are the canonical definitions here. The duplicate definitions in
 * @/app/map/mapTypes.ts re-export from this file for backward compatibility.
 */

import { MutableRefObject, Dispatch, SetStateAction } from 'react'
import type Map from 'ol/Map'

// ─── Mode types ────────────────────────────────────────────────────────
export type BasemapMode = 'osm' | 'satellite' | 'dark' | 'terrain'
export type DrawMode = 'none' | 'Point' | 'LineString' | 'Polygon' | 'Circle'
export type MeasureMode = 'none' | 'distance' | 'area'

// ─── Data types ────────────────────────────────────────────────────────
export interface PopupData {
  coordinate: number[]
  projectName?: string
  stationName?: string
  easting?: string
  northing?: string
  geometryType?: string
  projectId?: string
}

export interface HistoryEntry {
  featuresJson: string
}

export interface MouseCoord {
  lon: number
  lat: number
  e: number
  n: number
}

export interface GpsPos {
  lon: number
  lat: number
  accuracy: number
}

// ─── MapContext ────────────────────────────────────────────────────────
/**
 * Shared context passed to every map hook so they can read refs,
 * call state setters, and coordinate deactivation of other modes.
 */
export interface MapContext {
  /** The OpenLayers Map instance ref */
  mapInstance: MutableRefObject<Map | null>

  // ── Source & layer refs ──
  // Typed with the same OL types MapClient declares (useRef<… | null>),
  // so no consumer can treat these as `any` anymore.
  drawSourceRef: MutableRefObject<import('ol/source/Vector').default | null>
  drawLayerRef: MutableRefObject<import('ol/layer/Vector').default | null>
  measureSourceRef: MutableRefObject<import('ol/source/Vector').default | null>
  measureLayerRef: MutableRefObject<import('ol/layer/Vector').default | null>

  // ── Interaction refs ──
  drawInteractionRef: MutableRefObject<import('ol/interaction').Interaction | null>
  selectInteractionRef: MutableRefObject<import('ol/interaction/Select').default | null>
  modifyInteractionRef: MutableRefObject<import('ol/interaction').Interaction | null>
  measureInteractionRef: MutableRefObject<import('ol/interaction').Interaction | null>

  // ── Popup ref ──
  popupRef: MutableRefObject<HTMLDivElement | null>

  // ── Cross-hook state setters ──
  setDrawMode: Dispatch<SetStateAction<DrawMode>>
  setEditMode: Dispatch<SetStateAction<boolean>>
  setMeasureMode: Dispatch<SetStateAction<MeasureMode>>
  setMeasureResult: Dispatch<SetStateAction<string>>
  setFeatureCount: Dispatch<SetStateAction<number>>
  setSelectedFeature: Dispatch<SetStateAction<import('ol/Feature').default | null>>
  setFeatureName: Dispatch<SetStateAction<string>>

  // ── History hook callback ──
  pushHistory: () => void
}
