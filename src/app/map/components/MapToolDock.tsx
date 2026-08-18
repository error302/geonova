'use client'
/**
 * MapToolDock — redesigned around a non-overlapping stacked-panel layout.
 *
 * Desktop layout:
 *   ┌────┬─────────────────────────────┐
 *   │icon│  ┌──────────────────────┐   │
 *   │ +  │  │  Recon (open)        │   │
 *   │ SUM│  └──────────────────────┘   │
 *   │ ◎  │  ┌──────────────────────┐   │
 *   │ ⊞  │  │  Compute (open)      │   │
 *   │ ↓  │  └──────────────────────┘   │
 *   └────┘─────────────────────────────┘
 *
 *  - Multiple panels can be open simultaneously (they stack top-to-bottom)
 *  - Panels never overlap — each is a separate card in a flex column
 *  - Each panel has its own max-height + internal scroll
 *  - Active-tool indicator dots on icon rail buttons
 *  - Project badge in each panel header links to /project/[id]
 */

import React, { memo, useState, useCallback, useEffect, useRef } from 'react'
import {
  Binoculars, Crosshair, Calculator, Target,
  Layers, Download,
  X,
  MapPin, PenTool, Hexagon, Circle,
  Undo2, Redo2, Trash2, Edit3,
  Navigation, Search,
  Ruler, Satellite, Globe, Mountain, Moon,
  FileOutput, Printer,
  Eye, MapPinned,
  Scissors, GitMerge, RefreshCw, Magnet, Info,
  FolderOpen, Link2,
} from 'lucide-react'
import { useMapContext } from '@/app/map/MapReactContext'
import { CogoInfoPanel } from '@/app/map/components/CogoInfoPanel'
import { CogoToolsPanel } from '@/app/map/components/CogoToolsPanel'
import { BookmarkPanel } from '@/app/map/components/BookmarkPanel'
import { GpsTrackPanel } from '@/app/map/components/GpsTrackPanel'
import { StakeoutPanel } from '@/components/map/StakeoutPanel'
import { TopologyGuardrail } from '@/components/survey/TopologyGuardrail'
import { useSearchParams } from 'next/navigation'
import type { SurveyPoint } from '@/lib/map/turfHelpers'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DockCategory = 'recon' | 'capture' | 'compute' | 'setout' | 'layers' | 'export'

interface CategoryDef {
  id: DockCategory
  icon: React.ComponentType<{ className?: string }>
  label: string
  shortcut: string
  accent: string
}

const CATEGORIES: CategoryDef[] = [
  { id: 'recon',   icon: Binoculars,  label: 'Recon',   shortcut: '1', accent: '#3B82F6' },
  { id: 'capture', icon: Crosshair,   label: 'Capture', shortcut: '2', accent: '#D17B47' },
  { id: 'compute', icon: Calculator,  label: 'Compute', shortcut: '3', accent: '#8B5CF6' },
  { id: 'setout',  icon: Target,      label: 'Set Out', shortcut: '4', accent: '#10B981' },
  { id: 'layers',  icon: Layers,      label: 'Layers',  shortcut: '5', accent: '#6366F1' },
  { id: 'export',  icon: Download,    label: 'Export',  shortcut: '6', accent: '#F59E0B' },
]

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

function SectionLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between px-1 pt-3 pb-1.5 first:pt-1">
      <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-muted)] font-semibold">
        {children}
      </span>
      {hint && (
        <kbd className="px-1 py-0.5 rounded bg-white/[0.03] border border-white/[0.06] text-[8px] text-[var(--text-muted)] font-mono">
          {hint}
        </kbd>
      )}
    </div>
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
        flex items-center gap-2.5 w-full px-3 py-2 rounded-lg transition-all duration-150 text-xs font-medium
        ${disabled
          ? 'opacity-30 cursor-not-allowed text-[var(--text-muted)] border border-transparent'
          : danger && isActive
            ? 'bg-red-500/10 border border-red-500/30 text-red-400'
            : isActive
              ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)]'
              : 'text-[var(--text-secondary)] hover:bg-white/[0.04] hover:text-[var(--text-primary)] border border-transparent'}
      `}
    >
      <span className="w-4 h-4 shrink-0">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {shortcut && !disabled && (
        <kbd className="px-1 py-0.5 rounded bg-white/[0.03] border border-white/[0.06] text-[8px] text-[var(--text-muted)] font-mono">
          {shortcut}
        </kbd>
      )}
    </button>
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
        flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-150
        w-[50px] h-[50px] shrink-0 relative
        ${isActive
          ? 'bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)]'
          : 'bg-white/[0.02] border border-white/[0.05] text-[var(--text-secondary)] hover:bg-white/[0.05] hover:text-[var(--text-primary)]'}
      `}
    >
      <span className="w-5 h-5">{icon}</span>
      <span className="text-[9px] leading-tight font-medium">{label}</span>
      {shortcut && (
        <span className="absolute top-0.5 right-1 text-[7px] text-[var(--text-muted)] font-mono opacity-40">
          {shortcut}
        </span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Project badge — shows linked project in panel header
// ---------------------------------------------------------------------------

function ProjectBadge() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')
  if (!projectId) return null
  return (
    <a
      href={`/project/${projectId}`}
      className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[9px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors no-underline"
      title="Go to linked project"
    >
      <Link2 className="w-2.5 h-2.5" />
      Project
    </a>
  )
}

// ---------------------------------------------------------------------------
// DockPanel — reusable wrapper for each panel card
// ---------------------------------------------------------------------------

interface DockPanelProps {
  label: string
  accent: string
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

const DockPanel = memo(function DockPanel({ label, accent, isOpen, onClose, children }: DockPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  if (!isOpen) return null

  return (
    <div
      ref={panelRef}
      className="w-[270px] flex flex-col rounded-2xl overflow-hidden
        bg-[var(--bg-secondary)]/90 backdrop-blur-2xl
        border border-white/[0.06]
        shadow-[0_8px_32px_rgba(0,0,0,0.45)]
        animate-[slideInLeft_0.18s_ease-out]"
      style={{ boxShadow: `0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04), 0 0 20px ${accent}0a` }}
      role="region"
      aria-label={`${label} tools`}
    >
      {/* Header */}
      <div
        className="h-9 flex items-center justify-between px-3 shrink-0 border-b border-white/[0.05]"
        style={{ borderTop: `2px solid ${accent}` }}
      >
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
          <span className="text-[11px] font-semibold text-[var(--text-primary)] tracking-wide">{label}</span>
          <ProjectBadge />
        </div>
        <button
          onClick={onClose}
          className="w-5 h-5 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.06] transition-colors"
          aria-label={`Close ${label} panel`}
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Body — each panel scrolls internally */}
      <div className="overflow-y-auto px-3 py-2 custom-scrollbar" style={{ maxHeight: '360px' }}>
        {children}
      </div>
    </div>
  )
})

// ---------------------------------------------------------------------------
// Helper: polygon vertices from OL feature
// ---------------------------------------------------------------------------

function extractPolygonVertices(feature: import('ol/Feature').default | null): SurveyPoint[] {
  if (!feature) return []
  try {
    const geom = feature.getGeometry()
    if (!geom) return []
    const type = geom.getType()
    if (type === 'Polygon') {
      const ring = (geom as import('ol/geom/Polygon').default).getCoordinates()[0] || []
      return ring.slice(0, -1).map((c: number[]) => ({ easting: c[0], northing: c[1] }))
    }
    if (type === 'LineString') {
      const coords = (geom as import('ol/geom/LineString').default).getCoordinates()
      return coords.map((c: number[]) => ({ easting: c[0], northing: c[1] }))
    }
  } catch {}
  return []
}

// ---------------------------------------------------------------------------
// Panel content components
// ---------------------------------------------------------------------------

const ReconContent = memo(function ReconContent() {
  const { handleCoordSearch, fitToKenya, fitToDrawn, gpsTracking, toggleGPS, featureCount } = useMapContext()
  const [searchInput, setSearchInput] = useState('')

  const handleSearch = useCallback(async () => {
    if (!searchInput.trim()) return
    await handleCoordSearch(searchInput)
    setSearchInput('')
  }, [searchInput, handleCoordSearch])

  return (
    <div className="space-y-0.5">
      <SectionLabel hint="⌘F">Search</SectionLabel>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
          aria-label="Coord, beacon, or parcel"
          placeholder="Coord, beacon, or parcel…"
          className="w-full h-8 bg-white/[0.03] border border-white/[0.07] rounded-lg pl-8 pr-3 text-[11px] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#3B82F6]/50 transition-colors"
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

const CaptureContent = memo(function CaptureContent() {
  const ctx = useMapContext()
  const polygonVertices: SurveyPoint[] = extractPolygonVertices(ctx.selectedFeature)

  return (
    <div className="space-y-0.5">
      <SectionLabel hint="D">Draw</SectionLabel>
      <div className="grid grid-cols-4 gap-1.5">
        <ToolBtn label="Point"   icon={<MapPin className="w-5 h-5" />}  isActive={ctx.drawMode === 'Point'}      onClick={() => ctx.toggleDraw('Point')}      shortcut="1" />
        <ToolBtn label="Line"    icon={<PenTool className="w-5 h-5" />} isActive={ctx.drawMode === 'LineString'} onClick={() => ctx.toggleDraw('LineString')} shortcut="2" />
        <ToolBtn label="Polygon" icon={<Hexagon className="w-5 h-5" />} isActive={ctx.drawMode === 'Polygon'}    onClick={() => ctx.toggleDraw('Polygon')}    shortcut="3" />
        <ToolBtn label="Circle"  icon={<Circle className="w-5 h-5" />}  isActive={ctx.drawMode === 'Circle'}     onClick={() => ctx.toggleDraw('Circle')}     shortcut="4" />
      </div>

      <SectionLabel hint="M">Measure</SectionLabel>
      <div className="grid grid-cols-2 gap-1.5">
        <ToolBtn label="Distance" icon={<Ruler className="w-5 h-5" />}  isActive={ctx.measureMode === 'distance'} onClick={() => ctx.toggleMeasure(ctx.measureMode === 'distance' ? 'none' : 'distance')} shortcut="MD" />
        <ToolBtn label="Area"     icon={<Hexagon className="w-5 h-5" />} isActive={ctx.measureMode === 'area'}     onClick={() => ctx.toggleMeasure(ctx.measureMode === 'area' ? 'none' : 'area')}         shortcut="MA" />
      </div>
      {ctx.measureResult && (
        <div className="mt-1 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06]">
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
        <button onClick={ctx.undo} disabled={!ctx.canUndo} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-white/[0.06] text-xs font-medium text-[var(--text-secondary)] hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
          <Undo2 className="w-3.5 h-3.5" /> Undo
        </button>
        <button onClick={ctx.redo} disabled={!ctx.canRedo} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-white/[0.06] text-xs font-medium text-[var(--text-secondary)] hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
          <Redo2 className="w-3.5 h-3.5" /> Redo
        </button>
      </div>
      <ActionBtn label="Delete Selected" icon={<Trash2 className="w-4 h-4" />} isActive={false} onClick={ctx.deleteSelected} danger shortcut="Del" />

      <SectionLabel hint="X">Advanced</SectionLabel>
      <div className="grid grid-cols-5 gap-1">
        <ToolBtn label="Split"   icon={<Scissors className="w-4 h-4" />}  isActive={ctx.activeDigitizingTool === 'split'}   onClick={() => ctx.setActiveDigitizingTool(ctx.activeDigitizingTool === 'split'   ? null : 'split')}   shortcut="S" />
        <ToolBtn label="Merge"   icon={<GitMerge className="w-4 h-4" />}  isActive={ctx.activeDigitizingTool === 'merge'}   onClick={() => ctx.setActiveDigitizingTool(ctx.activeDigitizingTool === 'merge'   ? null : 'merge')}   shortcut="M" />
        <ToolBtn label="Reshape" icon={<RefreshCw className="w-4 h-4" />} isActive={ctx.activeDigitizingTool === 'reshape'} onClick={() => ctx.setActiveDigitizingTool(ctx.activeDigitizingTool === 'reshape' ? null : 'reshape')} shortcut="R" />
        <ToolBtn label="Rotate"  icon={<RefreshCw className="w-4 h-4" />} isActive={ctx.activeDigitizingTool === 'rotate'}  onClick={() => ctx.setActiveDigitizingTool(ctx.activeDigitizingTool === 'rotate'  ? null : 'rotate')}  shortcut="O" />
        <ToolBtn label="Offset"  icon={<Ruler className="w-4 h-4" />}     isActive={ctx.activeDigitizingTool === 'offset'}  onClick={() => ctx.setActiveDigitizingTool(ctx.activeDigitizingTool === 'offset'  ? null : 'offset')}  shortcut="F" />
      </div>

      {ctx.activeDigitizingTool === 'offset' && (
        <div className="mt-1 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-[var(--text-muted)] uppercase">Distance:</span>
            <input aria-label="Offset distance" type="range" min="-50" max="50" step="1" value={ctx.offsetDistance} onChange={e => ctx.setOffsetDistance(parseFloat(e.target.value))} className="flex-1" />
            <span className="font-mono text-[10px] text-[var(--text-primary)] w-10 text-right">{ctx.offsetDistance}m</span>
          </div>
          <button onClick={ctx.applyOneShotTool} className="w-full py-1.5 rounded-lg bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[10px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/25 transition-colors">
            Create Offset
          </button>
        </div>
      )}

      {ctx.activeDigitizingTool === 'rotate' && (
        <div className="mt-1 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-[var(--text-muted)] uppercase">Angle:</span>
            <input aria-label="Rotation angle" type="range" min="-180" max="360" step="1" value={ctx.rotateAngle} onChange={e => ctx.setRotateAngle(parseFloat(e.target.value))} className="flex-1" />
            <span className="font-mono text-[10px] text-[var(--text-primary)] w-10 text-right">{ctx.rotateAngle}°</span>
          </div>
          <button onClick={ctx.applyOneShotTool} className="w-full py-1.5 rounded-lg bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[10px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/25 transition-colors">
            Apply Rotation
          </button>
        </div>
      )}

      {ctx.activeDigitizingTool === 'merge' && (
        <div className="mt-1 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06]">
          <button onClick={ctx.applyOneShotTool} className="w-full py-1.5 rounded-lg bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[10px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/25 transition-colors">
            Merge Selected Polygons
          </button>
        </div>
      )}

      {ctx.activeDigitizingTool && ctx.activeDigitizingTool !== 'draw' && (
        <div className="mt-1 p-2.5 rounded-lg bg-[var(--accent)]/[0.06] border border-[var(--accent)]/20 flex items-start gap-2">
          <Info className="w-3 h-3 text-[var(--accent)] shrink-0 mt-0.5" />
          <p className="text-[10px] text-[var(--text-secondary)]">
            {ctx.activeDigitizingTool === 'split'   && 'Draw a line across the polygon to split it. The line must cross at 2 points.'}
            {ctx.activeDigitizingTool === 'merge'   && 'Shift+click 2+ adjacent polygons, then click Merge.'}
            {ctx.activeDigitizingTool === 'reshape' && 'Draw a new line across the polygon boundary to reshape it.'}
            {ctx.activeDigitizingTool === 'rotate'  && 'Click a polygon, adjust the angle slider, then Apply.'}
            {ctx.activeDigitizingTool === 'offset'  && 'Click a feature, adjust distance, then Create Offset.'}
          </p>
        </div>
      )}

      <ActionBtn
        label={ctx.snappingEnabled ? 'Snapping On' : 'Snapping Off'}
        icon={<Magnet className="w-4 h-4" />}
        isActive={ctx.snappingEnabled}
        onClick={() => { ctx.setSnappingEnabled(!ctx.snappingEnabled); ctx.setShowSnappingOptions(!ctx.snappingEnabled) }}
        shortcut="N"
      />

      {ctx.selectedFeature && (
        <div className="mt-1 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1.5">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.15em] font-semibold">Feature Name</span>
          <input
            type="text"
            value={ctx.featureName}
            onChange={(e) => ctx.updateFeatureName(e.target.value)}
            aria-label="Feature name"
            placeholder="Feature name…"
            className="w-full h-7 bg-white/[0.03] border border-white/[0.07] rounded-md px-2 text-[11px] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/40 transition-colors"
          />
        </div>
      )}

      {polygonVertices.length >= 3 && (
        <>
          <SectionLabel hint="T">Topology Check</SectionLabel>
          <TopologyGuardrail vertices={polygonVertices} compact />
        </>
      )}
    </div>
  )
})

const ComputeContent = memo(function ComputeContent() {
  const { hasTraverse, traverseParcelPreviewActive, createParcelFromTraverse, confirmTraverseParcel, cancelTraverseParcel } = useMapContext()

  return (
    <div className="space-y-0.5">
      <SectionLabel hint="C">COGO Computation</SectionLabel>
      <CogoToolsPanel />

      <SectionLabel hint="T">Traverse Readout</SectionLabel>
      <CogoInfoPanel />

      <SectionLabel hint="P">Traverse → Parcel</SectionLabel>
      {hasTraverse && !traverseParcelPreviewActive ? (
        <ActionBtn label="Create Parcel from Traverse" icon={<Hexagon className="w-4 h-4" />} isActive={false} onClick={createParcelFromTraverse} shortcut="P" />
      ) : traverseParcelPreviewActive ? (
        <div className="space-y-1.5">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400">
            Preview active — confirm or cancel to continue
          </div>
          <div className="flex gap-1.5">
            <button onClick={confirmTraverseParcel} className="flex-1 py-1.5 rounded-lg bg-green-500/20 border border-green-500/30 text-[10px] font-semibold text-green-400 hover:bg-green-500/30 transition-colors">Confirm</button>
            <button onClick={cancelTraverseParcel} className="flex-1 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-[10px] font-semibold text-red-400 hover:bg-red-500/30 transition-colors">Cancel</button>
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-[var(--text-muted)] px-1">Load a scheme with traverse data to create a parcel.</p>
      )}
    </div>
  )
})

const SetOutContent = memo(function SetOutContent() {
  const { gpsTracking, toggleGPS, stakeoutActive, toggleStakeout, exportFeatures } = useMapContext()

  return (
    <div className="space-y-0.5">
      <SectionLabel hint="S">GPS Stakeout</SectionLabel>
      <ActionBtn
        label={stakeoutActive ? 'Stakeout Active' : 'Start Stakeout'}
        icon={<Target className="w-4 h-4" />}
        isActive={stakeoutActive}
        onClick={toggleStakeout}
        shortcut="S"
      />
      <StakeoutPanel />

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
        label="Export Setting-Out (LandXML)"
        icon={<FileOutput className="w-4 h-4" />}
        isActive={false}
        onClick={() => exportFeatures('LandXML')}
        shortcut="⌘⇧E"
      />
    </div>
  )
})

const LayersContent = memo(function LayersContent() {
  const {
    basemap, toggleBasemap, setOfflineDialogOpen,
    layerOpacity, handleOpacityChange,
    showSchemeParcels, showSchemeBlocks, showSchemeBeacons,
    toggleSchemeParcelVisibility, toggleSchemeBlockVisibility, toggleSchemeBeaconVisibility,
    schemeLoaded, schemeParcelCount, schemeBlockCount, schemeBeaconCount,
    zoomToScheme, removeScheme, loadSchemeData, schemeLoading,
  } = useMapContext()

  return (
    <div className="space-y-0.5">
      <SectionLabel hint="⌘B">Basemap</SectionLabel>
      <div className="grid grid-cols-2 gap-1.5">
        <ToolBtn label="OSM"       icon={<Globe className="w-5 h-5" />}     isActive={basemap === 'osm'}       onClick={() => toggleBasemap('osm')} />
        <ToolBtn label="Satellite" icon={<Satellite className="w-5 h-5" />} isActive={basemap === 'satellite'} onClick={() => toggleBasemap('satellite')} />
        <ToolBtn label="Dark"      icon={<Moon className="w-5 h-5" />}      isActive={basemap === 'dark'}      onClick={() => toggleBasemap('dark')} />
        <ToolBtn label="Terrain"   icon={<Mountain className="w-5 h-5" />}  isActive={basemap === 'terrain'}   onClick={() => toggleBasemap('terrain')} />
      </div>

      <SectionLabel>Basemap Opacity</SectionLabel>
      <div className="flex items-center gap-2 px-1">
        <input
          type="range" min={0} max={1} step={0.05}
          value={layerOpacity}
          onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
          className="flex-1 h-1 accent-[#D17B47] cursor-pointer"
          aria-label="Layer opacity"
        />
        <span className="text-[10px] text-[var(--text-muted)] font-mono w-8 text-right">{Math.round(layerOpacity * 100)}%</span>
      </div>

      <SectionLabel hint="⌘L">Scheme Layers</SectionLabel>
      {!schemeLoaded ? (
        <ActionBtn label={schemeLoading ? 'Loading…' : 'Load Scheme Data'} icon={<Layers className="w-4 h-4" />} isActive={schemeLoading} onClick={loadSchemeData} />
      ) : (
        <div className="space-y-1">
          <ActionBtn label={`Parcels (${schemeParcelCount})`}  icon={<Hexagon className="w-4 h-4" />} isActive={showSchemeParcels} onClick={toggleSchemeParcelVisibility} />
          <ActionBtn label={`Blocks (${schemeBlockCount})`}    icon={<Layers className="w-4 h-4" />}  isActive={showSchemeBlocks}  onClick={toggleSchemeBlockVisibility} />
          <ActionBtn label={`Beacons (${schemeBeaconCount})`}  icon={<MapPin className="w-4 h-4" />}  isActive={showSchemeBeacons} onClick={toggleSchemeBeaconVisibility} />
          <div className="flex gap-1.5 mt-1">
            <button onClick={zoomToScheme} className="flex-1 py-1.5 rounded-lg border border-white/[0.06] text-[10px] text-[var(--text-secondary)] hover:bg-white/[0.04] transition-all">Zoom to Scheme</button>
            <button onClick={removeScheme} className="flex-1 py-1.5 rounded-lg border border-red-500/20 text-[10px] text-red-400 hover:bg-red-500/10 transition-all">Remove</button>
          </div>
        </div>
      )}

      <SectionLabel hint="⌘O">Offline</SectionLabel>
      <ActionBtn label="Download Tiles" icon={<Download className="w-4 h-4" />} isActive={false} onClick={() => setOfflineDialogOpen(true)} shortcut="⌘O" />
    </div>
  )
})

const ExportContent = memo(function ExportContent() {
  const { saveToProject, exportFeatures, clearDrawn, featureCount, printMap, isPrinting } = useMapContext()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')

  return (
    <div className="space-y-0.5">
      <SectionLabel hint="⌘S">Save to Project</SectionLabel>
      {projectId ? (
        <ActionBtn label="Save to Project" icon={<FolderOpen className="w-4 h-4" />} isActive={false} onClick={saveToProject} shortcut="⌘S" />
      ) : (
        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400">
          Open from a project to enable saving. <a href="/dashboard" className="underline text-[var(--accent)]">Go to dashboard →</a>
        </div>
      )}

      <SectionLabel hint="⌘E">Export Format</SectionLabel>
      <div className="grid grid-cols-3 gap-1 mt-1">
        {(['GeoJSON','KML','DXF','WKT'] as const).map(fmt => (
          <button key={fmt} onClick={() => exportFeatures(fmt)} className="px-2 py-1.5 rounded-lg border border-white/[0.06] text-[10px] font-medium text-[var(--text-secondary)] hover:bg-white/[0.04] hover:text-[var(--text-primary)] transition-all">{fmt}</button>
        ))}
        <button onClick={() => exportFeatures('LandXML')} className="col-span-2 px-2 py-1.5 rounded-lg border border-white/[0.06] text-[10px] font-medium text-[var(--text-secondary)] hover:bg-white/[0.04] hover:text-[var(--text-primary)] transition-all">LandXML</button>
      </div>

      <SectionLabel hint="⌘P">Print / PDF</SectionLabel>
      <ActionBtn label={isPrinting ? 'Generating…' : 'Print / PDF'} icon={<Printer className="w-4 h-4" />} isActive={isPrinting} onClick={() => printMap()} shortcut="⌘P" />

      {featureCount > 0 && (
        <>
          <SectionLabel>Clear</SectionLabel>
          <ActionBtn label={`Clear All (${featureCount})`} icon={<Trash2 className="w-4 h-4" />} isActive={false} onClick={clearDrawn} danger shortcut="⌘⇧⌫" />
        </>
      )}
    </div>
  )
})

// ---------------------------------------------------------------------------
// METARDU Watermark
// ---------------------------------------------------------------------------

const MetarduWatermark = memo(function MetarduWatermark() {
  return (
    <div className="absolute bottom-2 right-3 z-10 pointer-events-none select-none" aria-hidden>
      <span className="text-[10px] font-bold tracking-[0.25em] text-[var(--text-primary)]/[0.06] uppercase">METARDU</span>
    </div>
  )
})

// ---------------------------------------------------------------------------
// Workflow badge — top-center of map
// ---------------------------------------------------------------------------

const SurveyWorkflowBadge = memo(function SurveyWorkflowBadge({ openPanels }: { openPanels: Set<DockCategory> }) {
  if (openPanels.size === 0) return null
  const cats = CATEGORIES.filter(c => openPanels.has(c.id))
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex items-center gap-2">
      {cats.map(c => (
        <div
          key={c.id}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-xl border border-white/[0.08] bg-[var(--bg-secondary)]/70"
          style={{ boxShadow: `0 0 12px ${c.accent}20` }}
        >
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: c.accent }} />
          <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--text-secondary)]">{c.label}</span>
        </div>
      ))}
    </div>
  )
})

// ---------------------------------------------------------------------------
// Main: MapToolDock
// ---------------------------------------------------------------------------

export const MapToolDock = memo(function MapToolDock() {
  const [openPanels, setOpenPanels] = useState<Set<DockCategory>>(new Set())
  const [dockVisible, setDockVisible] = useState(false)

  const {
    drawMode, editMode, measureMode, gpsTracking, stakeoutActive,
    hasTraverse, showAnnotations, isMobile,
  } = useMapContext()

  const togglePanel = useCallback((cat: DockCategory) => {
    setOpenPanels(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }, [])

  const closePanel = useCallback((cat: DockCategory) => {
    setOpenPanels(prev => {
      const next = new Set(prev)
      next.delete(cat)
      return next
    })
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const keyMap: Record<string, DockCategory> = {
      '1': 'recon', '2': 'capture', '3': 'compute',
      '4': 'setout', '5': 'layers', '6': 'export',
    }
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const cat = keyMap[e.key]
      if (cat) { e.preventDefault(); togglePanel(cat) }
      if (e.key === 'Escape' && openPanels.size > 0) setOpenPanels(new Set())
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [togglePanel, openPanels])

  const isActive = (cat: DockCategory) => {
    if (openPanels.has(cat)) return true
    switch (cat) {
      case 'recon':   return gpsTracking
      case 'capture': return drawMode !== 'none' || editMode || measureMode !== 'none' || showAnnotations
      case 'compute': return hasTraverse
      case 'setout':  return stakeoutActive
      default:        return false
    }
  }

  const renderPanelContent = (cat: DockCategory) => {
    switch (cat) {
      case 'recon':   return <ReconContent />
      case 'capture': return <CaptureContent />
      case 'compute': return <ComputeContent />
      case 'setout':  return <SetOutContent />
      case 'layers':  return <LayersContent />
      case 'export':  return <ExportContent />
    }
  }

  // ── Mobile ──
  if (isMobile) {
    return (
      <>
        <SurveyWorkflowBadge openPanels={openPanels} />
        <MetarduWatermark />

        {/* Active panel — bottom sheet, only one at a time on mobile */}
        {openPanels.size > 0 && (() => {
          const cat = [...openPanels][openPanels.size - 1]
          const catDef = CATEGORIES.find(c => c.id === cat) ?? CATEGORIES[0]
          return (
            <div
              className="fixed inset-x-0 bottom-0 z-40 bg-[var(--bg-secondary)]/95 backdrop-blur-2xl border-t border-white/[0.08] rounded-t-2xl shadow-[0_-8px_40px_rgba(0,0,0,0.5)] transition-transform duration-300"
              style={{ maxHeight: '70vh' }}
            >
              <div className="flex justify-center pt-2 pb-1">
                <div className="w-8 h-1 rounded-full bg-white/[0.12]" />
              </div>
              <div className="flex items-center justify-between px-4 pb-2 border-b border-white/[0.06]"
                style={{ borderTop: `2px solid ${catDef.accent}` }}>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: catDef.accent }} />
                  <span className="text-xs text-[var(--text-secondary)] font-semibold">{catDef.label}</span>
                  <ProjectBadge />
                </div>
                <button onClick={() => closePanel(cat)} className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.06]" aria-label="Close panel">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="overflow-y-auto px-3 pb-4 max-h-[55vh] custom-scrollbar">
                {renderPanelContent(cat)}
              </div>
            </div>
          )
        })()}

        {/* Bottom horizontal dock bar */}
        <div className="fixed bottom-0 inset-x-0 z-50 flex items-center justify-center gap-1 px-2 py-2 bg-[var(--bg-secondary)]/90 backdrop-blur-2xl border-t border-white/[0.06]">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon
            const open = openPanels.has(cat.id)
            const active = isActive(cat.id)
            return (
              <button key={cat.id} onClick={() => togglePanel(cat.id)} aria-label={cat.label}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-200 w-12 h-12 shrink-0 relative
                  ${open ? 'bg-white/[0.08] border border-white/[0.12] text-[var(--text-primary)]'
                    : active ? 'text-[var(--text-primary)]/70'
                    : 'text-[var(--text-muted)]'}`}
                style={open ? { boxShadow: `0 0 12px ${cat.accent}30` } : undefined}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[8px] leading-tight font-medium">{cat.label}</span>
                {open && <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full" style={{ backgroundColor: cat.accent }} />}
              </button>
            )
          })}
        </div>
      </>
    )
  }

  // ── Desktop ──
  return (
    <>
      <SurveyWorkflowBadge openPanels={openPanels} />
      <MetarduWatermark />

      {/* Toggle hamburger */}
      <button
        onClick={() => { setDockVisible(v => !v); if (dockVisible) setOpenPanels(new Set()) }}
        className="absolute top-3 left-3 z-30 w-10 h-10 flex items-center justify-center rounded-full bg-[var(--bg-secondary)]/60 backdrop-blur-xl border border-white/[0.08] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]/80 transition-all"
        title={dockVisible ? 'Hide tools (Esc)' : 'Show tools (press 1-6)'}
        aria-label={dockVisible ? 'Hide map tools' : 'Show map tools'}
      >
        {dockVisible
          ? <X className="w-4 h-4" />
          : <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><rect x="2" y="3" width="12" height="1.5" rx="0.75"/><rect x="2" y="7.25" width="12" height="1.5" rx="0.75"/><rect x="2" y="11.5" width="12" height="1.5" rx="0.75"/></svg>
        }
      </button>

      {dockVisible && (
        /* Outer row: icon rail + panel stack side by side */
        <div className="absolute top-3 left-3 z-20 flex flex-row items-start gap-2 mt-12">

          {/* ── Icon rail ── */}
          <div className="flex flex-col gap-1.5">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon
              const open = openPanels.has(cat.id)
              const active = isActive(cat.id)
              return (
                <button
                  key={cat.id}
                  onClick={() => togglePanel(cat.id)}
                  title={`${cat.label} (${cat.shortcut})`}
                  aria-label={cat.label}
                  aria-pressed={open}
                  className={`
                    relative w-10 h-10 min-w-[40px] min-h-[40px]
                    flex items-center justify-center rounded-xl transition-all duration-200
                    backdrop-blur-xl
                    ${open
                      ? 'bg-[var(--bg-secondary)]/80 border border-white/[0.12] text-[var(--text-primary)]'
                      : active
                        ? 'bg-[var(--bg-secondary)]/60 border border-white/[0.08] text-[var(--text-primary)]/70 hover:bg-[var(--bg-secondary)]/80'
                        : 'bg-[var(--bg-secondary)]/40 border border-white/[0.05] text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]/60 hover:text-[var(--text-secondary)]'}
                  `}
                  style={open ? { boxShadow: `0 0 14px ${cat.accent}35, inset 0 0 8px ${cat.accent}12`, borderColor: `${cat.accent}40` } : undefined}
                >
                  <Icon className="w-4 h-4" />
                  {/* Active-state dot */}
                  {active && !open && (
                    <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.accent }} />
                  )}
                  {/* Open indicator bar on right edge */}
                  {open && (
                    <div className="absolute right-0 top-2 bottom-2 w-0.5 rounded-full" style={{ backgroundColor: cat.accent }} />
                  )}
                </button>
              )
            })}
          </div>

          {/* ── Panel stack — panels render in category order, stacked vertically ── */}
          {openPanels.size > 0 && (
            <div className="flex flex-col gap-2" style={{ maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
              {CATEGORIES.filter(cat => openPanels.has(cat.id)).map(cat => (
                <DockPanel
                  key={cat.id}
                  label={cat.label}
                  accent={cat.accent}
                  isOpen={openPanels.has(cat.id)}
                  onClose={() => closePanel(cat.id)}
                >
                  {renderPanelContent(cat.id)}
                </DockPanel>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
})
