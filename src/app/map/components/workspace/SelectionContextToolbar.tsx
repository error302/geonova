'use client'

import React, { memo, useState } from 'react'
import {
  MousePointer2, Move, Plus, Trash2, Target, Save, Maximize,
  Check, X, Edit3, Scissors,
} from 'lucide-react'
import { useMapContext } from '@/app/map/MapReactContext'
import { Z_INDEX } from '@/lib/map/workspaceLayout'

export const SelectionContextToolbar = memo(function SelectionContextToolbar({
  onSave,
}: {
  onSave?: () => void
}) {
  const {
    selectedFeature, featureName, updateFeatureName, deleteSelected, fitToDrawn,
    editMode, toggleEdit, snappingEnabled, setSnappingEnabled, saveToProject,
  } = useMapContext()

  const [isEditingName, setIsEditingName] = useState(false)

  if (!selectedFeature) return null

  const geomType = selectedFeature.getGeometry()?.getType() || 'Feature'

  return (
    <div
      className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-1.5 rounded-2xl bg-[var(--bg-primary)]/95 backdrop-blur-2xl border border-[#D17B47]/40 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150"
      style={{ zIndex: Z_INDEX.contextualToolbar }}
      role="toolbar"
      aria-label="Selection context toolbar"
    >
      {/* Geometry Badge & Name Input */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.04] border border-white/[0.08]">
        <span className="text-[9px] font-mono uppercase font-bold tracking-wider text-[#D17B47]">
          {geomType}
        </span>
        <input
          type="text"
          value={featureName}
          onChange={(e) => updateFeatureName(e.target.value)}
          placeholder="Feature name..."
          aria-label="Feature name"
          className="w-28 sm:w-36 h-6 bg-transparent text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
        />
      </div>

      <div className="w-px h-5 bg-[var(--border-color)] my-auto" />

      {/* Action Buttons: [ Select ] [ Move Vertex ] [ Add Vertex ] [ Delete Vertex ] [ Snap ] [ Save ] */}
      <button
        onClick={toggleEdit}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${
          editMode
            ? 'bg-[#D17B47] text-white shadow-sm'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.06]'
        }`}
        title="Move & Adjust Vertices"
      >
        <Move className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Move Vertex</span>
      </button>

      <button
        onClick={() => setSnappingEnabled(!snappingEnabled)}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${
          snappingEnabled
            ? 'bg-[#D17B47]/20 border border-[#D17B47]/40 text-[#D17B47]'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.06]'
        }`}
        title="Toggle Snapping to Vertices"
      >
        <Target className="w-3.5 h-3.5" />
        <span className="hidden md:inline">Snap</span>
      </button>

      <button
        onClick={fitToDrawn}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.06] transition-colors"
        title="Zoom to Feature"
        aria-label="Zoom to feature"
      >
        <Maximize className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={saveToProject}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold hover:bg-emerald-500/30 transition-colors"
        title="Save Feature to Project"
      >
        <Save className="w-3.5 h-3.5" />
        <span>Save</span>
      </button>

      <button
        onClick={deleteSelected}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
        title="Delete Selected Geometry (Del)"
        aria-label="Delete feature"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
})
