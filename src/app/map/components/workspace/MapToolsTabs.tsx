'use client'

import React, { memo, useState } from 'react'
import {
  MapPin, PenTool, Hexagon, Circle, Ruler, Target, Navigation,
  Undo2, Redo2, Trash2, Eye, Download, Save, Printer, Layers,
  Database, RefreshCw, Scissors, GitMerge, Maximize, MousePointer2,
  Settings, Check, Sliders, ChevronDown, Sparkles, Upload,
} from 'lucide-react'
import { useMapContext } from '@/app/map/MapReactContext'
import { CogoInfoPanel } from '@/app/map/components/CogoInfoPanel'
import { CogoToolsPanel } from '@/app/map/components/CogoToolsPanel'
import { BookmarkPanel } from '@/app/map/components/BookmarkPanel'
import { GpsTrackPanel } from '@/app/map/components/GpsTrackPanel'
import { StakeoutPanel } from '@/components/map/StakeoutPanel'
import { TopologyGuardrail } from '@/components/survey/TopologyGuardrail'
import { SURVEY_WORKFLOWS, type SurveyWorkflow } from './types'

function SectionHeader({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between px-1 pt-3 pb-1 first:pt-1">
      <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)] font-bold">
        {label}
      </span>
      {hint && (
        <span className="text-[9px] text-[var(--text-muted)] font-mono">
          {hint}
        </span>
      )}
    </div>
  )
}

function ActionBtn({
  label,
  icon,
  isActive,
  onClick,
  shortcut,
  disabled,
}: {
  label: string
  icon: React.ReactNode
  isActive?: boolean
  onClick: () => void
  shortcut?: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl text-xs font-medium transition-all ${
        isActive
          ? 'bg-[#D17B47]/15 border border-[#D17B47]/40 text-[#D17B47] shadow-sm'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] border border-transparent disabled:opacity-30'
      }`}
    >
      <span className="w-4 h-4 shrink-0 flex items-center justify-center">{icon}</span>
      <span className="flex-1 text-left truncate">{label}</span>
      {shortcut && (
        <kbd className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-[8.5px] text-[var(--text-muted)] font-mono">
          {shortcut}
        </kbd>
      )}
    </button>
  )
}

export const ToolsTab = memo(function ToolsTab({
  onSelectWorkflow,
}: {
  onSelectWorkflow: (w: SurveyWorkflow) => void
}) {
  const {
    drawMode, measureMode, editMode, showAnnotations, gpsTracking, stakeoutActive,
    toggleDraw, toggleMeasure, toggleEdit, toggleAnnotations, toggleGPS, toggleStakeout,
    deleteSelected, undo, redo, canUndo, canRedo, exportFeatures, saveToProject, printMap, isPrinting,
    snappingEnabled, setSnappingEnabled, measureResult, featureCount, clearDrawn,
    activeProjection, switchProjection, currentUtmEpsg, setOfflineDialogOpen,
    hasTraverse, traverseParcelPreviewActive, createParcelFromTraverse, confirmTraverseParcel, cancelTraverseParcel,
  } = useMapContext()

  const [snapTolerance, setSnapTolerance] = useState(15)
  const [unitMode, setUnitMode] = useState<'m' | 'ft' | 'ha'>('m')
  const [bearingFormat, setBearingFormat] = useState<'dms' | 'deg'>('dms')

  return (
    <div className="p-2 space-y-2">
      {/* ── 1. QUICK ACTIONS ── */}
      <div>
        <SectionHeader label="Quick Actions" />
        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
          <ActionBtn
            label="Add Point"
            icon={<MapPin className="w-4 h-4" />}
            isActive={drawMode === 'Point'}
            onClick={() => onSelectWorkflow('point_collection')}
            shortcut="P"
          />
          <ActionBtn
            label="Traverse"
            icon={<Hexagon className="w-4 h-4" />}
            isActive={hasTraverse}
            onClick={() => onSelectWorkflow('traverse')}
            shortcut="T"
          />
          <ActionBtn
            label="Stakeout"
            icon={<Target className="w-4 h-4" />}
            isActive={stakeoutActive}
            onClick={() => onSelectWorkflow('stakeout')}
            shortcut="S"
          />
          <ActionBtn
            label="Measure Dist"
            icon={<Ruler className="w-4 h-4" />}
            isActive={measureMode === 'distance'}
            onClick={() => onSelectWorkflow('measure_distance')}
            shortcut="M"
          />
          <ActionBtn
            label="Measure Area"
            icon={<Hexagon className="w-4 h-4" />}
            isActive={measureMode === 'area'}
            onClick={() => onSelectWorkflow('measure_area')}
            shortcut="A"
          />
          <ActionBtn
            label="Import Data"
            icon={<Upload className="w-4 h-4" />}
            onClick={() => onSelectWorkflow('import_review')}
            shortcut="I"
          />
        </div>
      </div>

      {/* ── 2. MORE TOOLS (Pan, Zoom, Identify, Clear, History) ── */}
      <div>
        <SectionHeader label="More Tools" />
        <div className="space-y-1">
          <ActionBtn
            label="Edit Vertices"
            icon={<PenTool className="w-4 h-4" />}
            isActive={editMode}
            onClick={() => onSelectWorkflow('vertex_editing')}
            shortcut="V"
          />
          <ActionBtn
            label="Bearing Annotations"
            icon={<Eye className="w-4 h-4" />}
            isActive={showAnnotations}
            onClick={toggleAnnotations}
            shortcut="B"
          />
          <div className="flex gap-1 pt-0.5">
            <button
              onClick={undo}
              disabled={!canUndo}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)]/60 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-25 transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" /> Undo
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)]/60 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-25 transition-colors"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="w-3.5 h-3.5" /> Redo
            </button>
          </div>
          {featureCount > 0 && (
            <ActionBtn
              label={`Clear Selection / Drawn (${featureCount})`}
              icon={<Trash2 className="w-4 h-4 text-red-400" />}
              onClick={clearDrawn}
            />
          )}
        </div>
      </div>

      {/* ── 3. SNAPPING CONTROLS ── */}
      <div>
        <SectionHeader label="Snapping & Precision" />
        <div className="p-2.5 rounded-xl bg-[var(--bg-secondary)]/70 border border-[var(--border-color)] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)] font-medium">Snap to Points / Edges</span>
            <button
              onClick={() => setSnappingEnabled(!snappingEnabled)}
              className={`w-9 h-5 rounded-full transition-colors relative ${
                snappingEnabled ? 'bg-[#D17B47]' : 'bg-white/[0.1]'
              }`}
            >
              <span
                className={`block w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                  snappingEnabled ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          {snappingEnabled && (
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                <span>Tolerance:</span>
                <span className="font-mono text-[var(--text-primary)]">{snapTolerance} px</span>
              </div>
              <input
                type="range"
                min="5"
                max="40"
                value={snapTolerance}
                onChange={(e) => setSnapTolerance(parseInt(e.target.value))}
                aria-label="Snap tolerance"
                className="w-full accent-[#D17B47]"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── 4. UNITS & DISPLAY ── */}
      <div>
        <SectionHeader label="Units & Display" />
        <div className="p-2.5 rounded-xl bg-[var(--bg-secondary)]/70 border border-[var(--border-color)] space-y-2">
          <div>
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Coordinate System</span>
            <div className="grid grid-cols-2 gap-1 mt-1">
              {[
                { id: 'EPSG:21037', label: 'Arc 1960 / 37S' },
                { id: 'EPSG:32737', label: 'WGS84 / 37S' },
                { id: 'EPSG:3857', label: 'Web Mercator' },
                { id: 'EPSG:4326', label: 'Lat / Lon (WGS84)' },
              ].map((crs) => (
                <button
                  key={crs.id}
                  onClick={() => switchProjection?.(crs.id)}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-mono transition-all text-left truncate ${
                    activeProjection === crs.id
                      ? 'bg-[#D17B47]/20 border border-[#D17B47]/40 text-[#D17B47] font-bold'
                      : 'border border-[var(--border-color)]/60 text-[var(--text-secondary)] hover:bg-white/[0.04]'
                  }`}
                >
                  {crs.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-[var(--border-color)]/40">
            <span className="text-[10px] text-[var(--text-muted)]">Bearing Format:</span>
            <div className="flex bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.06]">
              <button
                onClick={() => setBearingFormat('dms')}
                className={`px-2 py-0.5 rounded text-[9.5px] font-mono ${bearingFormat === 'dms' ? 'bg-[#D17B47] text-white font-bold' : 'text-[var(--text-muted)]'}`}
              >
                DD°MM'SS"
              </button>
              <button
                onClick={() => setBearingFormat('deg')}
                className={`px-2 py-0.5 rounded text-[9.5px] font-mono ${bearingFormat === 'deg' ? 'bg-[#D17B47] text-white font-bold' : 'text-[var(--text-muted)]'}`}
              >
                Dec Deg
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export const LayersTab = memo(function LayersTab() {
  const {
    basemap, toggleBasemap, layerOpacity, handleOpacityChange,
    schemeLoaded, schemeLoading, schemeParcelCount, schemeBlockCount, schemeBeaconCount,
    showSchemeParcels, showSchemeBlocks, showSchemeBeacons,
    toggleSchemeParcelVisibility, toggleSchemeBlockVisibility, toggleSchemeBeaconVisibility,
    zoomToScheme, removeScheme, loadSchemeData, setOfflineDialogOpen, hasProjectId,
  } = useMapContext()

  return (
    <div className="p-2 space-y-2">
      {/* ── BASE MAPS ── */}
      <div>
        <SectionHeader label="Base Maps" />
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { id: 'osm', label: 'OpenStreetMap' },
            { id: 'satellite', label: 'Satellite Imagery' },
            { id: 'terrain', label: 'Topographic Terrain' },
            { id: 'dark', label: 'Dark Canvas' },
          ].map((b) => (
            <button
              key={b.id}
              onClick={() => toggleBasemap(b.id as any)}
              className={`px-2.5 py-2 rounded-xl text-xs font-medium transition-all text-left ${
                basemap === b.id
                  ? 'bg-[#D17B47]/15 border border-[#D17B47]/40 text-[#D17B47] font-bold shadow-sm'
                  : 'bg-[var(--bg-secondary)]/70 border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 px-1 pt-2">
          <span className="text-[10px] text-[var(--text-muted)]">Opacity:</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={layerOpacity}
            onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
            className="flex-1 accent-[#D17B47]"
            aria-label="Basemap opacity"
          />
          <span className="text-[10px] text-[var(--text-muted)] font-mono w-8 text-right">
            {Math.round(layerOpacity * 100)}%
          </span>
        </div>
      </div>

      {/* ── SURVEY DATA LAYERS ── */}
      <div>
        <SectionHeader label="Survey Data" />
        <div className="space-y-1">
          <ActionBtn
            label={`Cadastral Scheme (${schemeLoaded ? schemeParcelCount : 'Not Loaded'})`}
            icon={<Hexagon className="w-4 h-4" />}
            isActive={showSchemeParcels}
            onClick={schemeLoaded ? toggleSchemeParcelVisibility : loadSchemeData}
          />
          <ActionBtn
            label={`Blocks (${schemeLoaded ? schemeBlockCount : 0})`}
            icon={<Layers className="w-4 h-4" />}
            isActive={showSchemeBlocks}
            onClick={toggleSchemeBlockVisibility}
            disabled={!schemeLoaded}
          />
          <ActionBtn
            label={`Beacons (${schemeLoaded ? schemeBeaconCount : 0})`}
            icon={<MapPin className="w-4 h-4" />}
            isActive={showSchemeBeacons}
            onClick={toggleSchemeBeaconVisibility}
            disabled={!schemeLoaded}
          />
        </div>
      </div>

      {/* ── REFERENCE & OFFLINE ── */}
      <div>
        <SectionHeader label="Reference & Caching" />
        <div className="space-y-1">
          <ActionBtn
            label="Download Offline Tiles"
            icon={<Download className="w-4 h-4" />}
            onClick={() => setOfflineDialogOpen(true)}
          />
          {schemeLoaded && (
            <div className="flex gap-1.5 pt-1">
              <button
                onClick={zoomToScheme}
                className="flex-1 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Zoom to Scheme
              </button>
              <button
                onClick={removeScheme}
                className="flex-1 py-1.5 rounded-lg border border-red-500/20 text-[10px] font-medium text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Unload
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

export const DataTab = memo(function DataTab() {
  const {
    featureCount, projectCount, clearDrawn, saveToProject, fitToDrawn,
    hasProjectId, schemeLoaded, exportFeatures, printMap, isPrinting,
  } = useMapContext()

  return (
    <div className="p-2 space-y-2">
      <div>
        <SectionHeader label="Drawn Features" />
        <div className="p-3 rounded-xl bg-[var(--bg-secondary)]/70 border border-[var(--border-color)] flex items-center justify-between">
          <div>
            <p className="text-xl font-bold text-[var(--text-primary)]">{featureCount}</p>
            <p className="text-[10px] text-[var(--text-muted)]">Active survey elements</p>
          </div>
          <div className="flex gap-1">
            <button
              onClick={fitToDrawn}
              title="Zoom to features"
              className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div>
        <SectionHeader label="Deliverables & Export" />
        <div className="grid grid-cols-2 gap-1.5">
          {(['GeoJSON', 'DXF', 'KML', 'WKT'] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => exportFeatures(fmt)}
              className="px-2.5 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)]/60 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[#D17B47]/40 transition-colors"
            >
              Export {fmt}
            </button>
          ))}
        </div>
        <div className="pt-2">
          <ActionBtn
            label={isPrinting ? 'Rendering Plan...' : 'Generate Deed / Survey Plan (PDF)'}
            icon={<Printer className="w-4 h-4" />}
            isActive={isPrinting}
            onClick={() => printMap()}
            shortcut="⌘P"
          />
        </div>
      </div>

      <div>
        <SectionHeader label="Bookmarks & Control Points" />
        <BookmarkPanel />
      </div>
    </div>
  )
})

export const WorkflowsTab = memo(function WorkflowsTab({
  onSelectWorkflow,
  activeWorkflow,
}: {
  onSelectWorkflow: (w: SurveyWorkflow) => void
  activeWorkflow: SurveyWorkflow
}) {
  return (
    <div className="p-2 space-y-1.5">
      <SectionHeader label="Survey Workflows" hint="Progressive Modes" />
      {SURVEY_WORKFLOWS.map((w) => (
        <button
          key={w.id}
          onClick={() => onSelectWorkflow(w.id)}
          className={`w-full text-left p-3 rounded-xl border transition-all ${
            activeWorkflow === w.id
              ? 'bg-[#D17B47]/10 border-[#D17B47]/50 shadow-md shadow-[#D17B47]/10'
              : 'bg-[var(--bg-secondary)]/70 border-[var(--border-color)] hover:border-[#D17B47]/30'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span
              className={`text-xs font-bold ${
                activeWorkflow === w.id ? 'text-[#D17B47]' : 'text-[var(--text-primary)]'
              }`}
            >
              {w.label}
            </span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-[9px] font-mono text-[var(--text-muted)]">
              {w.shortcut}
            </kbd>
          </div>
          <p className="text-[10.5px] text-[var(--text-muted)] leading-relaxed">
            {w.description}
          </p>
        </button>
      ))}
    </div>
  )
})
