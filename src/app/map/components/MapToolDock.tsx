'use client'
/**
 * MapToolDock — Floating tool dock for the METARDU map
 *
 * Redesigned around the cadastral survey workflow:
 *   1. Recon    — Navigate & locate (coord search, fit, GPS, bookmarks)
 *   2. Capture  — Draw & measure (draw tools, measure, bearing annotations)
 *   3. Compute  — COGO computation (radiation, intersection, resection, traverse, parcel)
 *   4. Set Out  — Stakeout & field (GPS stakeout, GPS track, setting-out export)
 *   5. Layers   — Map layers (basemap, scheme, offline, opacity)
 *   6. Export   — Save & share (project save, format export, print, clear)
 *
 * Design:
 *   - Slim translucent icon bar (glass morphism, pill buttons)
 *   - Active category glow accent
 *   - Frosted glass drawer panels (slide-in from left / bottom on mobile)
 *   - SurveyWorkflowBadge showing current stage
 *   - METARDU watermark bottom-right
 *   - Keyboard shortcut hints in panels
 */

import React, { memo, useState, useCallback, useEffect } from 'react'
import {
  Binoculars, Crosshair, Calculator, Target,
  Layers, Download,
  X, Menu,
  MapPin, PenTool, Hexagon, Circle,
  Undo2, Redo2, Trash2, Edit3,
  Navigation, Search, Bookmark,
  Ruler, Compass, Satellite, Globe, Mountain, Moon,
  FileOutput, Printer, FileText,
  Eye, MapPinned,
  // AUDIT FIX (2026-07-05): Added for inline advanced digitizing tools
  // (previously in the floating DigitizingToolbar — now merged here).
  Scissors, GitMerge, RefreshCw, Magnet, Info,
} from 'lucide-react'
import { useMapContext } from '@/app/map/MapReactContext'
import { CogoInfoPanel } from '@/app/map/components/CogoInfoPanel'
import { CogoToolsPanel } from '@/app/map/components/CogoToolsPanel'
import { BookmarkPanel } from '@/app/map/components/BookmarkPanel'
import { GpsTrackPanel } from '@/app/map/components/GpsTrackPanel'
import { StakeoutPanel } from '@/components/map/StakeoutPanel'
import { TopologyGuardrail } from '@/components/survey/TopologyGuardrail'
import type { SurveyPoint } from '@/lib/map/turfHelpers'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DockCategory = 'recon' | 'capture' | 'compute' | 'setout' | 'layers' | 'export' | null

interface CategoryDef {
  id: DockCategory
  icon: React.ComponentType<{ className?: string }>
  label: string
  shortcut: string
}

const CATEGORIES: CategoryDef[] = [
  { id: 'recon',   icon: Binoculars,  label: 'Recon',   shortcut: '1' },
  { id: 'capture', icon: Crosshair,   label: 'Capture', shortcut: '2' },
  { id: 'compute', icon: Calculator,  label: 'Compute', shortcut: '3' },
  { id: 'setout',  icon: Target,      label: 'Set Out', shortcut: '4' },
  { id: 'layers',  icon: Layers,      label: 'Layers',  shortcut: '5' },
  { id: 'export',  icon: Download,    label: 'Export',  shortcut: '6' },
]

// Map from category id to a display color for the glow accent
const CATEGORY_ACCENT: Record<string, string> = {
  recon:   '#3B82F6', // blue
  capture: '#D17B47', // orange (brand)
  compute: '#8B5CF6', // purple
  setout:  '#10B981', // emerald
  layers:  '#6366F1', // indigo
  export:  '#F59E0B', // amber
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between px-1 pt-3 pb-2 first:pt-1">
      <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-muted)] font-semibold">
        {children}
      </span>
      {hint && (
        <kbd className="px-1 py-0.5 rounded bg-[var(--bg-card)]/[0.04] border border-[var(--border-color)]/[0.08] text-[8px] text-[var(--text-muted)] font-mono">
          {hint}
        </kbd>
      )}
    </div>
  )
}

function ToolBtn({ label, icon, isActive, onClick, shortcut }: {
  label: string
  icon: React.ReactNode
  isActive: boolean
  onClick: () => void
  shortcut?: string
}) {
  return (
    <button
      onClick={onClick}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={`
        flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200
        w-[52px] h-[52px] shrink-0 relative
        ${isActive
          ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)] shadow-[0_0_12px_rgba(209, 123, 71,0.15)]'
          : 'bg-[var(--bg-card)]/[0.02] border border-[var(--border-color)]/[0.06] text-[var(--text-secondary)] hover:bg-[var(--bg-card)]/[0.04] hover:text-[var(--text-secondary)]'}
      `}
    >
      <span className="w-5 h-5">{icon}</span>
      <span className="text-[10px] leading-tight font-medium">{label}</span>
      {shortcut && (
        <span className="absolute top-0.5 right-1 text-[7px] text-[var(--text-muted)] font-mono opacity-50">
          {shortcut}
        </span>
      )}
    </button>
  )
}

function ActionBtn({ label, icon, isActive, onClick, danger, shortcut, disabled }: {
  label: string
  icon: React.ReactNode
  isActive: boolean
  onClick: () => void
  danger?: boolean
  shortcut?: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={`
        flex items-center gap-2.5 w-full px-3 py-2 rounded-lg transition-all duration-200 text-xs font-medium
        ${disabled
          ? 'opacity-30 cursor-not-allowed text-[var(--text-muted)] border border-transparent'
          : danger && isActive
            ? 'bg-[var(--error)]/10 border border-red-500/30 text-[var(--error)]'
            : isActive
              ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)]/[0.04] hover:text-[var(--text-secondary)] border border-transparent'}
      `}
    >
      <span className="w-4 h-4 shrink-0">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {shortcut && !disabled && (
        <kbd className="px-1 py-0.5 rounded bg-[var(--bg-card)]/[0.04] border border-[var(--border-color)]/[0.08] text-[8px] text-[var(--text-muted)] font-mono">
          {shortcut}
        </kbd>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// SurveyWorkflowBadge — Shows current workflow stage near top of map
// ---------------------------------------------------------------------------

const SurveyWorkflowBadge = memo(function SurveyWorkflowBadge({
  stage,
}: {
  stage: DockCategory
}) {
  if (!stage) return null

  const accent = CATEGORY_ACCENT[stage] ?? '#D17B47'
  const label = CATEGORIES.find(c => c.id === stage)?.label ?? ''

  return (
    <div
      className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
      role="status"
      aria-label={`Workflow stage: ${label}`}
      // T1.5g: top-center badge — managed by MapOverlaySlot in MapClient (order=2)
    >
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-xl border border-[var(--border-color)]/[0.08] bg-[var(--bg-secondary)]/70"
        style={{ boxShadow: `0 0 16px ${accent}20` }}
      >
        <div
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ backgroundColor: accent }}
        />
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-secondary)]">
          {label}
        </span>
      </div>
    </div>
  )
})

// ---------------------------------------------------------------------------
// METARDU Watermark — Bottom-right corner of map
// ---------------------------------------------------------------------------

const MetarduWatermark = memo(function MetarduWatermark() {
  return (
    <div
      className="absolute bottom-2 right-3 z-10 pointer-events-none select-none"
      aria-hidden="true"
    >
      <span className="text-[10px] font-bold tracking-[0.25em] text-[var(--text-primary)]/[0.06] uppercase">
        METARDU
      </span>
    </div>
  )
})

// ---------------------------------------------------------------------------
// Panel: Recon (Navigate & Locate)
// ---------------------------------------------------------------------------

const ReconPanel = memo(function ReconPanel() {
  const {
    handleCoordSearch, fitToKenya, fitToDrawn,
    gpsTracking, toggleGPS, featureCount,
  } = useMapContext()
  const [searchInput, setSearchInput] = useState('')

  const handleSearch = useCallback(async () => {
    if (!searchInput.trim()) return
    await handleCoordSearch(searchInput)
    setSearchInput('')
  }, [searchInput, handleCoordSearch])

  return (
    <div className="space-y-1">
      <SectionLabel hint="⌘F">Coordinate Search</SectionLabel>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
          aria-label="Coord, beacon, or parcel…"
          className="w-full h-8 bg-[var(--bg-card)]/[0.04] border border-[var(--border-color)]/[0.06] rounded-lg pl-8 pr-3 text-[11px] text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:border-[#3B82F6]/40 transition-colors"
        />
      </div>

      <SectionLabel hint="⌘⇧F">Fit View</SectionLabel>
      <ActionBtn label="Fit to Kenya" icon={<Globe className="w-4 h-4" />} isActive={false} onClick={fitToKenya} shortcut="⌘⇧K" />
      <ActionBtn label="Fit to Project" icon={<MapPinned className="w-4 h-4" />} isActive={false} onClick={fitToDrawn} shortcut="⌘⇧P" disabled={featureCount === 0} />

      <SectionLabel hint="G">GPS</SectionLabel>
      <ActionBtn
        label={gpsTracking ? 'GPS Active' : 'Enable GPS'}
        icon={<Navigation className="w-4 h-4" />}
        isActive={gpsTracking}
        onClick={toggleGPS}
        shortcut="G"
      />

      <SectionLabel hint="B">Bookmarks</SectionLabel>
      <BookmarkPanel />
    </div>
  )
})

// ---------------------------------------------------------------------------
// Panel: Capture (Draw & Measure)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helper: Extract polygon vertices from an OL feature
// ---------------------------------------------------------------------------

function extractPolygonVertices(feature: any): SurveyPoint[] {
  if (!feature) return []
  try {
    const geom = feature.getGeometry?.()
    if (!geom) return []
    const type = geom.getType?.()
    if (type === 'Polygon') {
      const coords = geom.getCoordinates?.()
      const ring = coords?.[0] || []
      // Drop the closing point if it duplicates the first
      const vertices = ring.slice(0, -1).map((c: number[]) => ({
        easting: c[0],
        northing: c[1],
      }))
      return vertices
    }
    if (type === 'LineString') {
      const coords = geom.getCoordinates?.() || []
      return coords.map((c: number[]) => ({ easting: c[0], northing: c[1] }))
    }
  } catch {}
  return []
}

// ---------------------------------------------------------------------------
// Panel: Capture (Draw + Measure + Edit)
// ---------------------------------------------------------------------------

const CapturePanel = memo(function CapturePanel() {
  const ctx = useMapContext()

  // Extract vertices from the selected feature for topology checking
  const polygonVertices: SurveyPoint[] = extractPolygonVertices(ctx.selectedFeature)

  return (
    <div className="space-y-1">
      <SectionLabel hint="D">Draw</SectionLabel>
      <div className="grid grid-cols-4 gap-1.5">
        <ToolBtn label="Point" icon={<MapPin className="w-5 h-5" />} isActive={ctx.drawMode === 'Point'} onClick={() => ctx.toggleDraw('Point')} shortcut="1" />
        <ToolBtn label="Line" icon={<PenTool className="w-5 h-5" />} isActive={ctx.drawMode === 'LineString'} onClick={() => ctx.toggleDraw('LineString')} shortcut="2" />
        <ToolBtn label="Polygon" icon={<Hexagon className="w-5 h-5" />} isActive={ctx.drawMode === 'Polygon'} onClick={() => ctx.toggleDraw('Polygon')} shortcut="3" />
        <ToolBtn label="Circle" icon={<Circle className="w-5 h-5" />} isActive={ctx.drawMode === 'Circle'} onClick={() => ctx.toggleDraw('Circle')} shortcut="4" />
      </div>

      <SectionLabel hint="M">Measure</SectionLabel>
      <div className="grid grid-cols-2 gap-1.5">
        <ToolBtn label="Distance" icon={<Ruler className="w-5 h-5" />} isActive={ctx.measureMode === 'distance'} onClick={() => ctx.toggleMeasure(ctx.measureMode === 'distance' ? 'none' : 'distance')} shortcut="M D" />
        <ToolBtn label="Area" icon={<Hexagon className="w-5 h-5" />} isActive={ctx.measureMode === 'area'} onClick={() => ctx.toggleMeasure(ctx.measureMode === 'area' ? 'none' : 'area')} shortcut="M A" />
      </div>
      {ctx.measureResult && (
        <div className="mt-2 p-2.5 rounded-lg bg-[var(--bg-card)]/[0.02] border border-[var(--border-color)]/[0.06]">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.15em] font-semibold">Result</span>
          <p className="text-sm text-[var(--text-primary)] font-mono mt-1">{ctx.measureResult}</p>
        </div>
      )}

      <SectionLabel hint="A">Annotations</SectionLabel>
      <ActionBtn
        label={ctx.showAnnotations ? 'Annotations On' : 'Bearing Annotations'}
        icon={<Eye className="w-4 h-4" />}
        isActive={ctx.showAnnotations}
        onClick={ctx.toggleAnnotations}
        shortcut="A"
      />

      <SectionLabel hint="E">Edit</SectionLabel>
      <ActionBtn label="Modify Vertices" icon={<Edit3 className="w-4 h-4" />} isActive={ctx.editMode} onClick={ctx.toggleEdit} shortcut="V" />
      <div className="flex gap-1.5">
        <button onClick={ctx.undo} disabled={!ctx.canUndo} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-[var(--border-color)]/[0.06] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)]/[0.04] hover:text-[var(--text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
          <Undo2 className="w-3.5 h-3.5" /> Undo
        </button>
        <button onClick={ctx.redo} disabled={!ctx.canRedo} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-[var(--border-color)]/[0.06] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)]/[0.04] hover:text-[var(--text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
          <Redo2 className="w-3.5 h-3.5" /> Redo
        </button>
      </div>
      <ActionBtn label="Delete Selected" icon={<Trash2 className="w-4 h-4" />} isActive={false} onClick={ctx.deleteSelected} danger shortcut="Del" />

      {/* ── Advanced Editing (Split / Merge / Reshape / Rotate / Offset) ── */}
      {/* T0.6 FIX (2026-07-09): The floating DigitizingToolbar.tsx has been
          deleted (it was dead code — zero importers). This inline panel in
          MapToolDock is now the single source of truth for these tools. */}
      <SectionLabel hint="X">Advanced</SectionLabel>
      <div className="grid grid-cols-5 gap-1">
        <ToolBtn
          label="Split"
          icon={<Scissors className="w-4 h-4" />}
          isActive={ctx.activeDigitizingTool === 'split'}
          onClick={() => ctx.setActiveDigitizingTool(ctx.activeDigitizingTool === 'split' ? null : 'split')}
          shortcut="S"
        />
        <ToolBtn
          label="Merge"
          icon={<GitMerge className="w-4 h-4" />}
          isActive={ctx.activeDigitizingTool === 'merge'}
          onClick={() => ctx.setActiveDigitizingTool(ctx.activeDigitizingTool === 'merge' ? null : 'merge')}
          shortcut="M"
        />
        <ToolBtn
          label="Reshape"
          icon={<RefreshCw className="w-4 h-4" />}
          isActive={ctx.activeDigitizingTool === 'reshape'}
          onClick={() => ctx.setActiveDigitizingTool(ctx.activeDigitizingTool === 'reshape' ? null : 'reshape')}
          shortcut="R"
        />
        <ToolBtn
          label="Rotate"
          icon={<RefreshCw className="w-4 h-4" />}
          isActive={ctx.activeDigitizingTool === 'rotate'}
          onClick={() => ctx.setActiveDigitizingTool(ctx.activeDigitizingTool === 'rotate' ? null : 'rotate')}
          shortcut="O"
        />
        <ToolBtn
          label="Offset"
          icon={<Ruler className="w-4 h-4" />}
          isActive={ctx.activeDigitizingTool === 'offset'}
          onClick={() => ctx.setActiveDigitizingTool(ctx.activeDigitizingTool === 'offset' ? null : 'offset')}
          shortcut="F"
        />
      </div>

      {/* Offset distance slider + Apply button — only visible when Offset is active.
          T0.3 FIX (2026-07-09): Added the Apply button. Previously dragging the
          slider re-triggered the effect and stacked duplicate offsets. Now the
          slider only updates the parameter; the user clicks Apply to execute. */}
      {ctx.activeDigitizingTool === 'offset' && (
        <div className="mt-2 p-2.5 rounded-lg bg-[var(--bg-card)]/[0.02] border border-[var(--border-color)]/[0.06] space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-[var(--text-muted)] uppercase">Distance:</span>
            <input
              aria-label="Offset distance"
              type="range"
              min="-50"
              max="50"
              step="1"
              value={ctx.offsetDistance}
              onChange={e => ctx.setOffsetDistance(parseFloat(e.target.value))}
              className="flex-1"
            />
            <span className="font-mono text-[10px] text-[var(--text-primary)] w-10 text-right">{ctx.offsetDistance}m</span>
          </div>
          <button
            onClick={ctx.applyOneShotTool}
            className="w-full py-1.5 rounded-lg bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[10px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/25 transition-colors"
          >
            Create Offset
          </button>
        </div>
      )}

      {/* T0.2 FIX (2026-07-09): Rotate angle slider + Apply button.
          Was hardcoded to 15° — now the user can pick any angle -180° to 360°
          and the value actually flows through to rotatePolygon().
          The Apply button lets the user rotate the same polygon multiple times
          (previously the tool auto-deactivated after one rotation). */}
      {ctx.activeDigitizingTool === 'rotate' && (
        <div className="mt-2 p-2.5 rounded-lg bg-[var(--bg-card)]/[0.02] border border-[var(--border-color)]/[0.06] space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-[var(--text-muted)] uppercase">Angle:</span>
            <input
              aria-label="Rotation angle"
              type="range"
              min="-180"
              max="360"
              step="1"
              value={ctx.rotateAngle}
              onChange={e => ctx.setRotateAngle(parseFloat(e.target.value))}
              className="flex-1"
            />
            <span className="font-mono text-[10px] text-[var(--text-primary)] w-10 text-right">{ctx.rotateAngle}°</span>
          </div>
          <button
            onClick={ctx.applyOneShotTool}
            className="w-full py-1.5 rounded-lg bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[10px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/25 transition-colors"
          >
            Apply Rotation
          </button>
        </div>
      )}

      {/* Merge Apply button — T0.1 FIX (2026-07-09): Merge now operates on the
          user's Shift+click multi-selection (not every polygon in the source). */}
      {ctx.activeDigitizingTool === 'merge' && (
        <div className="mt-2 p-2.5 rounded-lg bg-[var(--bg-card)]/[0.02] border border-[var(--border-color)]/[0.06]">
          <button
            onClick={ctx.applyOneShotTool}
            className="w-full py-1.5 rounded-lg bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[10px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/25 transition-colors"
          >
            Merge Selected Polygons
          </button>
        </div>
      )}

      {/* Active tool instruction banner — T0.7 FIX (2026-07-09): all messages
          now honestly describe what the tool does and what the user must do. */}
      {ctx.activeDigitizingTool && ctx.activeDigitizingTool !== 'draw' && (
        <div className="mt-2 p-2.5 rounded-lg bg-[var(--accent)]/[0.06] border border-[var(--accent)]/20 flex items-start gap-2">
          <Info className="w-3 h-3 text-[var(--accent)] shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-mono text-[9px] text-[var(--accent)] uppercase tracking-[0.08em]">
              {ctx.activeDigitizingTool}
              <span className="text-[var(--text-muted)] ml-2 normal-case tracking-normal">[{ctx.currentUtmEpsg}]</span>
            </span>
            <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
              {ctx.activeDigitizingTool === 'split' && 'Draw a line across the polygon to split it into two. The line must cross the polygon at 2 points. If multiple polygons are present, Shift+click the one you want split first.'}
              {ctx.activeDigitizingTool === 'merge' && 'Shift+click 2 or more adjacent polygons on the map (they must share an edge), then click "Merge Selected Polygons". Non-adjacent polygons cannot be merged.'}
              {ctx.activeDigitizingTool === 'reshape' && 'Draw a new line across the polygon boundary. The boundary between the two intersection points will be replaced with your new line. Shift+click the target polygon first if multiple are present.'}
              {ctx.activeDigitizingTool === 'rotate' && 'Click a polygon on the map to select it. Adjust the angle slider (negative = counterclockwise), then click "Apply Rotation". You can apply repeatedly to rotate further.'}
              {ctx.activeDigitizingTool === 'offset' && 'Click a feature on the map to select it. Adjust the distance slider (negative = inward for polygons), then click "Create Offset". A new offset feature is added; the original is unchanged.'}
            </p>
          </div>
        </div>
      )}

      {/* Snapping toggle */}
      <ActionBtn
        label={ctx.snappingEnabled ? 'Snapping On' : 'Snapping Off'}
        icon={<Magnet className="w-4 h-4" />}
        isActive={ctx.snappingEnabled}
        onClick={() => {
          ctx.setSnappingEnabled(!ctx.snappingEnabled)
          ctx.setShowSnappingOptions(!ctx.snappingEnabled)
        }}
        shortcut="N"
      />

      {ctx.selectedFeature && (
        <div className="mt-2 p-2.5 rounded-lg bg-[var(--bg-card)]/[0.02] border border-[var(--border-color)]/[0.06] space-y-2">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.15em] font-semibold">Feature</span>
          <input
            type="text"
            value={ctx.featureName}
            onChange={(e) => ctx.updateFeatureName(e.target.value)}
            aria-label="Feature name…"
            className="w-full h-7 bg-[var(--bg-card)]/[0.04] border border-[var(--border-color)]/[0.06] rounded-md px-2 text-[11px] text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:border-[var(--accent)]/30 transition-colors"
          />
        </div>
      )}

      {/* Topology Guardrail — real-time overlap/sliver/encroachment detection */}
      {polygonVertices.length >= 3 && (
        <>
          <SectionLabel hint="T">Topology Check</SectionLabel>
          <TopologyGuardrail vertices={polygonVertices} compact />
        </>
      )}
    </div>
  )
})

// ---------------------------------------------------------------------------
// Panel: Compute (COGO)
// ---------------------------------------------------------------------------

const ComputePanel = memo(function ComputePanel() {
  const {
    hasTraverse, traverseParcelPreviewActive,
    createParcelFromTraverse, confirmTraverseParcel, cancelTraverseParcel,
  } = useMapContext()

  return (
    <div className="space-y-1">
      <SectionLabel hint="C">COGO Computation</SectionLabel>
      <CogoToolsPanel />

      <SectionLabel hint="T">Traverse Readout</SectionLabel>
      <CogoInfoPanel />

      <SectionLabel hint="P">Traverse → Parcel</SectionLabel>
      {hasTraverse && !traverseParcelPreviewActive ? (
        <ActionBtn
          label="Create Parcel from Traverse"
          icon={<Hexagon className="w-4 h-4" />}
          isActive={false}
          onClick={createParcelFromTraverse}
          shortcut="P"
        />
      ) : traverseParcelPreviewActive ? (
        <div className="space-y-1.5">
          <div className="p-2 rounded-lg bg-[var(--warning)]/10 border border-amber-500/20 text-[10px] text-[var(--warning)]">
            Preview active — confirm or cancel to continue
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={confirmTraverseParcel}
              className="flex-1 py-1.5 rounded-lg bg-[var(--success)]/20 border border-green-500/30 text-[10px] font-semibold text-[var(--success)] hover:bg-[var(--success)]/30 transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={cancelTraverseParcel}
              className="flex-1 py-1.5 rounded-lg bg-[var(--error)]/20 border border-red-500/30 text-[10px] font-semibold text-[var(--error)] hover:bg-[var(--error)]/30 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-[var(--text-muted)] px-1">
          Load a scheme with traverse data to create a parcel.
        </p>
      )}
    </div>
  )
})

// ---------------------------------------------------------------------------
// Panel: Set Out (Stakeout & Field)
// ---------------------------------------------------------------------------

const SetOutPanel = memo(function SetOutPanel() {
  const {
    gpsTracking, toggleGPS, stakeoutActive, toggleStakeout,
    exportFeatures,
  } = useMapContext()

  return (
    <div className="space-y-1">
      <SectionLabel hint="S">GPS Stakeout</SectionLabel>
      <ActionBtn
        label={stakeoutActive ? 'Stakeout Active' : 'Start Stakeout'}
        icon={<Target className="w-4 h-4" />}
        isActive={stakeoutActive}
        onClick={toggleStakeout}
        shortcut="S"
      />
      <StakeoutPanel />
      <p className="text-[10px] text-[var(--text-muted)] px-1 mt-2">
        Set a target coordinate and navigate using GPS.
      </p>

      <SectionLabel hint="G">GPS Track</SectionLabel>
      <ActionBtn
        label={gpsTracking ? 'GPS Active' : 'Enable GPS'}
        icon={<Navigation className="w-4 h-4" />}
        isActive={gpsTracking}
        onClick={toggleGPS}
        shortcut="G"
      />
      <GpsTrackPanel />

      <SectionLabel>Setting-Out Export</SectionLabel>
      <ActionBtn
        label="Export Setting-Out"
        icon={<FileOutput className="w-4 h-4" />}
        isActive={false}
        onClick={() => exportFeatures('LandXML')}
        shortcut="⌘⇧E"
      />
      <p className="text-[10px] text-[var(--text-muted)] px-1">
        Export setting-out data as LandXML for instrument upload.
      </p>
    </div>
  )
})

// ---------------------------------------------------------------------------
// Panel: Layers
// ---------------------------------------------------------------------------

const LayersDockPanel = memo(function LayersDockPanel() {
  const {
    basemap, toggleBasemap, setOfflineDialogOpen,
    layerOpacity, handleOpacityChange,
    showSchemeParcels, showSchemeBlocks, showSchemeBeacons,
    toggleSchemeParcelVisibility, toggleSchemeBlockVisibility, toggleSchemeBeaconVisibility,
    schemeLoaded, schemeParcelCount, schemeBlockCount, schemeBeaconCount,
    zoomToScheme, removeScheme, loadSchemeData, schemeLoading,
  } = useMapContext()

  return (
    <div className="space-y-1">
      <SectionLabel hint="⌘B">Basemap</SectionLabel>
      <div className="grid grid-cols-2 gap-1.5">
        <ToolBtn label="OSM" icon={<Globe className="w-5 h-5" />} isActive={basemap === 'osm'} onClick={() => toggleBasemap('osm')} />
        <ToolBtn label="Satellite" icon={<Satellite className="w-5 h-5" />} isActive={basemap === 'satellite'} onClick={() => toggleBasemap('satellite')} />
        <ToolBtn label="Dark" icon={<Moon className="w-5 h-5" />} isActive={basemap === 'dark'} onClick={() => toggleBasemap('dark')} />
        <ToolBtn label="Terrain" icon={<Mountain className="w-5 h-5" />} isActive={basemap === 'terrain'} onClick={() => toggleBasemap('terrain')} />
      </div>

      <SectionLabel>Opacity</SectionLabel>
      <div className="flex items-center gap-2 px-1">
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={layerOpacity}
          onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
          className="flex-1 h-1 accent-[#D17B47] cursor-pointer"
          aria-label="Layer opacity"
        />
        <span className="text-[10px] text-[var(--text-muted)] font-mono w-8 text-right">
          {Math.round(layerOpacity * 100)}%
        </span>
      </div>

      <SectionLabel hint="⌘L">Scheme Layers</SectionLabel>
      {!schemeLoaded ? (
        <ActionBtn
          label={schemeLoading ? 'Loading…' : 'Load Scheme Data'}
          icon={<Layers className="w-4 h-4" />}
          isActive={schemeLoading}
          onClick={loadSchemeData}
        />
      ) : (
        <div className="space-y-1">
          <ActionBtn
            label={`Parcels (${schemeParcelCount})`}
            icon={<Hexagon className="w-4 h-4" />}
            isActive={showSchemeParcels}
            onClick={toggleSchemeParcelVisibility}
          />
          <ActionBtn
            label={`Blocks (${schemeBlockCount})`}
            icon={<Layers className="w-4 h-4" />}
            isActive={showSchemeBlocks}
            onClick={toggleSchemeBlockVisibility}
          />
          <ActionBtn
            label={`Beacons (${schemeBeaconCount})`}
            icon={<MapPin className="w-4 h-4" />}
            isActive={showSchemeBeacons}
            onClick={toggleSchemeBeaconVisibility}
          />
          <div className="flex gap-1.5 mt-1">
            <button
              onClick={zoomToScheme}
              className="flex-1 py-1.5 rounded-lg border border-[var(--border-color)]/[0.06] text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-card)]/[0.04] hover:text-[var(--text-secondary)] transition-all"
            >
              Zoom to Scheme
            </button>
            <button
              onClick={removeScheme}
              className="flex-1 py-1.5 rounded-lg border border-red-500/20 text-[10px] text-[var(--error)] hover:bg-[var(--error)]/10 transition-all"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      <SectionLabel hint="⌘O">Offline</SectionLabel>
      <ActionBtn label="Download Tiles" icon={<Download className="w-4 h-4" />} isActive={false} onClick={() => setOfflineDialogOpen(true)} shortcut="⌘O" />
    </div>
  )
})

// ---------------------------------------------------------------------------
// Panel: Export
// ---------------------------------------------------------------------------

const ExportPanel = memo(function ExportPanel() {
  const {
    saveToProject, exportFeatures, clearDrawn, featureCount,
    printMap, isPrinting,
  } = useMapContext()

  return (
    <div className="space-y-1">
      <SectionLabel hint="⌘S">Save</SectionLabel>
      <ActionBtn label="Save to Project" icon={<Download className="w-4 h-4" />} isActive={false} onClick={saveToProject} shortcut="⌘S" />

      <SectionLabel hint="⌘E">Export Format</SectionLabel>
      <div className="grid grid-cols-3 gap-1 mt-1">
        <button onClick={() => exportFeatures('GeoJSON')} className="px-2 py-1.5 rounded-lg border border-[var(--border-color)]/[0.06] text-[10px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)]/[0.04] hover:text-[var(--text-secondary)] transition-all">GeoJSON</button>
        <button onClick={() => exportFeatures('KML')} className="px-2 py-1.5 rounded-lg border border-[var(--border-color)]/[0.06] text-[10px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)]/[0.04] hover:text-[var(--text-secondary)] transition-all">KML</button>
        <button onClick={() => exportFeatures('DXF')} className="px-2 py-1.5 rounded-lg border border-[var(--border-color)]/[0.06] text-[10px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)]/[0.04] hover:text-[var(--text-secondary)] transition-all">DXF</button>
        <button onClick={() => exportFeatures('WKT')} className="px-2 py-1.5 rounded-lg border border-[var(--border-color)]/[0.06] text-[10px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)]/[0.04] hover:text-[var(--text-secondary)] transition-all">WKT</button>
        <button onClick={() => exportFeatures('LandXML')} className="col-span-2 px-2 py-1.5 rounded-lg border border-[var(--border-color)]/[0.06] text-[10px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)]/[0.04] hover:text-[var(--text-secondary)] transition-all">LandXML</button>
      </div>

      <SectionLabel hint="⌘P">Print / PDF</SectionLabel>
      <ActionBtn
        label={isPrinting ? 'Generating…' : 'Print / PDF'}
        icon={<Printer className="w-4 h-4" />}
        isActive={isPrinting}
        onClick={() => printMap()}
        shortcut="⌘P"
      />

      {featureCount > 0 && (
        <>
          <SectionLabel>Clear</SectionLabel>
          <ActionBtn
            label={`Clear All (${featureCount})`}
            icon={<Trash2 className="w-4 h-4" />}
            isActive={false}
            onClick={clearDrawn}
            danger
            shortcut="⌘⇧⌫"
          />
        </>
      )}
    </div>
  )
})

// ---------------------------------------------------------------------------
// Main: MapToolDock
// ---------------------------------------------------------------------------

export const MapToolDock = memo(function MapToolDock() {
  const [activeCategory, setActiveCategory] = useState<DockCategory>(null)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [dockVisible, setDockVisible] = useState(false) // AUDIT FIX: hidden by default, toggle to show
  const {
    drawMode, editMode, measureMode, gpsTracking, stakeoutActive,
    hasTraverse, showAnnotations, isMobile,
  } = useMapContext()

  const toggleCategory = useCallback((cat: DockCategory) => {
    setActiveCategory(prev => {
      if (prev === cat) {
        setDrawerVisible(false)
        return null
      }
      setDrawerVisible(true)
      return cat
    })
  }, [])

  const closeDrawer = useCallback(() => {
    setDrawerVisible(false)
    // Delay category reset for slide-out animation
    setTimeout(() => setActiveCategory(null), 200)
  }, [])

  // Keyboard shortcuts for category switching
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return

      const keyMap: Record<string, DockCategory> = {
        '1': 'recon',
        '2': 'capture',
        '3': 'compute',
        '4': 'setout',
        '5': 'layers',
        '6': 'export',
      }

      const cat = keyMap[e.key]
      if (cat) {
        e.preventDefault()
        toggleCategory(cat)
      }

      if (e.key === 'Escape' && activeCategory) {
        closeDrawer()
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [toggleCategory, closeDrawer, activeCategory])

  const isCategoryActive = (cat: DockCategory): boolean => {
    if (activeCategory === cat) return true
    switch (cat) {
      case 'recon': return gpsTracking
      case 'capture': return drawMode !== 'none' || editMode || measureMode !== 'none' || showAnnotations
      case 'compute': return hasTraverse
      case 'setout': return stakeoutActive
      case 'layers': return false
      case 'export': return false
      default: return false
    }
  }

  const renderPanel = () => {
    switch (activeCategory) {
      case 'recon': return <ReconPanel />
      case 'capture': return <CapturePanel />
      case 'compute': return <ComputePanel />
      case 'setout': return <SetOutPanel />
      case 'layers': return <LayersDockPanel />
      case 'export': return <ExportPanel />
      default: return null
    }
  }

  const activeAccent = activeCategory ? CATEGORY_ACCENT[activeCategory] : '#D17B47'

  // ── Mobile layout ──
  if (isMobile) {
    return (
      <>
        {/* Workflow badge */}
        <SurveyWorkflowBadge stage={activeCategory} />

        {/* METARDU watermark */}
        <MetarduWatermark />

        {/* Bottom sheet drawer */}
        {activeCategory && (
          <div
            className={`
              fixed inset-x-0 bottom-0 z-40
              bg-[var(--bg-secondary)]/95 backdrop-blur-2xl
              border-t border-[var(--border-color)]/[0.08]
              rounded-t-2xl
              shadow-[0_-8px_40px_rgba(0,0,0,0.5)]
              transition-transform duration-300 ease-out
              ${drawerVisible ? 'translate-y-0' : 'translate-y-full'}
            `}
            style={{ maxHeight: '70vh' }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-8 h-1 rounded-full bg-[var(--bg-card)]/[0.12]" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-2 border-b border-[var(--border-color)]/[0.06]">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: activeAccent }}
                />
                <span className="text-xs text-[var(--text-secondary)] font-semibold">
                  {CATEGORIES.find(c => c.id === activeCategory)?.label}
                </span>
              </div>
              <button
                onClick={closeDrawer}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]/[0.06] transition-colors"
                aria-label="Close panel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto px-3 pb-4 max-h-[55vh] custom-scrollbar">
              {renderPanel()}
            </div>
          </div>
        )}

        {/* Bottom horizontal dock bar */}
        <div className="fixed bottom-0 inset-x-0 z-50 flex items-center justify-center gap-1 px-2 py-2 bg-[var(--bg-secondary)]/90 backdrop-blur-2xl border-t border-[var(--border-color)]/[0.06]">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon
            const active = isCategoryActive(cat.id)
            const isOpen = activeCategory === cat.id
            const accent = CATEGORY_ACCENT[cat.id ?? ''] ?? '#D17B47'
            return (
              <button
                key={cat.id}
                onClick={() => toggleCategory(cat.id)}
                title={cat.label}
                aria-label={cat.label}
                className={`
                  flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-200
                  w-12 h-12 shrink-0 relative
                  ${isOpen
                    ? 'bg-[var(--bg-card)]/[0.08] border border-[var(--border-color)]/[0.12] text-[var(--text-primary)]'
                    : active
                      ? 'bg-[var(--bg-card)]/[0.04] text-[var(--text-primary)]/70'
                      : 'text-[var(--text-muted)] active:bg-[var(--bg-card)]/[0.04]'}
                `}
                style={isOpen ? { boxShadow: `0 0 12px ${accent}30` } : undefined}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[8px] leading-tight font-medium">{cat.label}</span>
                {isOpen && (
                  <div
                    className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full"
                    style={{ backgroundColor: accent }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </>
    )
  }

  // ── Desktop layout ──
  return (
    <>
      {/* Workflow badge */}
      <SurveyWorkflowBadge stage={activeCategory} />

      {/* METARDU watermark */}
      <MetarduWatermark />

      {/* Toggle button — shows/hides the tool dock */}
      <button
        onClick={() => {
          setDockVisible(!dockVisible)
          if (dockVisible) closeDrawer()
        }}
        className="absolute top-3 left-3 z-30 w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full bg-[var(--bg-secondary)]/60 backdrop-blur-xl border border-[var(--border-color)]/[0.08] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]/80 transition-all"
        title={dockVisible ? 'Hide tools (Esc)' : 'Show tools'}
        aria-label={dockVisible ? 'Hide map tools' : 'Show map tools'}
      >
        {dockVisible ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      {/* Floating icon bar (left edge) — only visible when toggled */}
      {dockVisible && (
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-1 mt-12">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon
          const active = isCategoryActive(cat.id)
          const isOpen = activeCategory === cat.id
          const accent = CATEGORY_ACCENT[cat.id ?? ''] ?? '#D17B47'
          return (
            <button
              key={cat.id}
              onClick={() => toggleCategory(cat.id)}
              title={`${cat.label} (${cat.shortcut})`}
              aria-label={cat.label}
              className={`
                w-10 h-10 lg:w-10 lg:h-10
                min-w-[48px] min-h-[48px] lg:min-w-[40px] lg:min-h-[40px]
                flex items-center justify-center rounded-full transition-all duration-200
                backdrop-blur-xl
                ${isOpen
                  ? `bg-[var(--bg-card)]/[0.10] border border-[var(--border-color)]/[0.15] text-[var(--text-primary)]`
                  : active
                    ? 'bg-[var(--bg-secondary)]/60 border border-[var(--border-color)]/[0.08] text-[var(--text-primary)]/70 hover:bg-[var(--bg-secondary)]/80'
                    : 'bg-[var(--bg-secondary)]/40 border border-[var(--border-color)]/[0.04] text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]/60 hover:text-[var(--text-secondary)]'}
              `}
              style={isOpen ? { boxShadow: `0 0 14px ${accent}30, inset 0 0 8px ${accent}10` } : undefined}
            >
              <Icon className="w-4 h-4" />
            </button>
          )
        })}
      </div>
      )}

      {/* Sliding drawer panel */}
      {activeCategory && (
        <div
          className={`
            absolute top-3 left-14 z-20
            w-[260px] sm:w-[280px]
            max-h-[calc(100%-80px)]
            bg-[var(--bg-secondary)]/90 backdrop-blur-2xl
            border border-[var(--border-color)]/[0.06]
            rounded-2xl
            shadow-[0_8px_40px_rgba(0,0,0,0.4)]
            flex flex-col overflow-hidden
            transition-all duration-200 ease-out
            ${drawerVisible
              ? 'opacity-100 translate-x-0'
              : 'opacity-0 -translate-x-3'}
          `}
          style={{ boxShadow: `0 8px 40px rgba(0,0,0,0.4), 0 0 20px ${activeAccent}08` }}
        >
          {/* Drawer header */}
          <div className="h-10 flex items-center justify-between px-4 shrink-0 border-b border-[var(--border-color)]/[0.06]">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: activeAccent }}
              />
              <span className="text-xs text-[var(--text-secondary)] font-semibold">
                {CATEGORIES.find(c => c.id === activeCategory)?.label}
              </span>
            </div>
            <button
              onClick={closeDrawer}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]/[0.06] transition-colors"
              aria-label="Close panel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Drawer body */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 custom-scrollbar">
            {renderPanel()}
          </div>
        </div>
      )}
    </>
  )
})
