'use client'

import React, { memo } from 'react'
import {
  Hexagon, CheckCircle2, RotateCcw, Play, Save, ChevronRight,
} from 'lucide-react'
import { useMapContext } from '@/app/map/MapReactContext'

export const TraverseWorkflow = memo(function TraverseWorkflow({
  onClose,
}: {
  onClose: () => void
}) {
  const {
    hasTraverse, createParcelFromTraverse, traverseParcelPreviewActive,
    confirmTraverseParcel, cancelTraverseParcel,
  } = useMapContext()

  return (
    <div className="p-4 space-y-3 max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
            TRAVERSE WORKFLOW: BOWDITCH ADJUSTMENT
          </h3>
        </div>
        <span className="text-[10px] text-emerald-400 font-mono font-bold">
          {hasTraverse ? 'TRAVERSE ACTIVE (4 STATIONS)' : 'CLICK MAP TO ADD STATIONS'}
        </span>
      </div>

      {/* Geodetic Statistics Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)]">
          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">Perimeter</span>
          <span className="text-sm font-bold font-mono text-[var(--text-primary)]">420.50 m</span>
        </div>
        <div className="p-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)]">
          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">Calculated Area</span>
          <span className="text-sm font-bold font-mono text-[#D17B47]">1.0245 Ha</span>
        </div>
        <div className="p-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)]">
          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">Closure Error</span>
          <span className="text-sm font-bold font-mono text-emerald-400">0.012 m</span>
        </div>
        <div className="p-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)]">
          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">Relative Precision</span>
          <span className="text-sm font-bold font-mono text-[var(--text-primary)]">1 : 35,000</span>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <button
            onClick={createParcelFromTraverse}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Generate Cadastral Parcel</span>
          </button>
        </div>

        {traverseParcelPreviewActive && (
          <div className="flex items-center gap-2">
            <button
              onClick={confirmTraverseParcel}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30"
            >
              Confirm Parcel
            </button>
            <button
              onClick={cancelTraverseParcel}
              className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-semibold hover:bg-red-500/30"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
})
