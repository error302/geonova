'use client'

import React, { memo } from 'react'
import {
  PenTool, Move, Target, Undo2, Redo2, Save,
} from 'lucide-react'
import { useMapContext } from '@/app/map/MapReactContext'

export const VertexEditingWorkflow = memo(function VertexEditingWorkflow({
  onClose,
}: {
  onClose: () => void
}) {
  const {
    toggleEdit, snappingEnabled, setSnappingEnabled, undo, redo,
    canUndo, canRedo, saveToProject, selectedFeature,
  } = useMapContext()

  return (
    <div className="p-4 space-y-3 max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
            VERTEX EDITING & SNAPPING MODE
          </h3>
        </div>
        <span className="text-[10px] text-amber-400 font-mono font-bold">
          {selectedFeature ? 'FEATURE SELECTED · DRAG VERTICES' : 'CLICK FEATURE ON MAP TO EDIT'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">Snapping</span>
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              {snappingEnabled ? 'Active (Auto-snap to vertices)' : 'Disabled'}
            </span>
          </div>
          <button
            onClick={() => setSnappingEnabled(!snappingEnabled)}
            className={`p-2 rounded-lg border transition-colors ${
              snappingEnabled
                ? 'bg-[#D17B47]/20 border-[#D17B47]/40 text-[#D17B47]'
                : 'border-[var(--border-color)] text-[var(--text-muted)]'
            }`}
          >
            <Target className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">History</span>
            <span className="text-xs font-semibold text-[var(--text-primary)]">Edit States</span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={undo}
              disabled={!canUndo}
              className="p-1.5 rounded-lg border border-[var(--border-color)] disabled:opacity-25 hover:bg-white/[0.04]"
              title="Undo"
            >
              <Undo2 className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className="p-1.5 rounded-lg border border-[var(--border-color)] disabled:opacity-25 hover:bg-white/[0.04]"
              title="Redo"
            >
              <Redo2 className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">Operation</span>
            <span className="text-xs font-semibold text-[var(--text-primary)]">Save Adjustments</span>
          </div>
          <button
            onClick={() => {
              saveToProject?.()
              onClose()
            }}
            className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 flex items-center gap-1"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>
        </div>
      </div>
    </div>
  )
})
