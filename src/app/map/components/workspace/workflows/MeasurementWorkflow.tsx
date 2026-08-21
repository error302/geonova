'use client'

import React, { memo } from 'react'
import {
  Ruler, Hexagon, Trash2, Save,
} from 'lucide-react'
import { useMapContext } from '@/app/map/MapReactContext'

export const MeasurementWorkflow = memo(function MeasurementWorkflow({
  mode,
  onClose,
}: {
  mode: 'distance' | 'area'
  onClose: () => void
}) {
  const { measureResult, toggleMeasure, saveToProject, clearDrawn } = useMapContext()

  return (
    <div className="p-4 space-y-3 max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
            {mode === 'distance' ? 'GEODESIC DISTANCE MEASUREMENT' : 'POLYGON BOUNDARY AREA MEASUREMENT'}
          </h3>
        </div>
        <span className="text-[10px] text-[var(--text-muted)] font-mono">
          Click points on map · Double-click to close
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)]">
          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block mb-1">
            Measurement Result
          </span>
          <p className="text-lg font-bold font-mono text-[#D17B47]">
            {measureResult || '0.00 m'}
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] flex flex-col justify-center">
          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block mb-1">
            Instruction
          </span>
          <p className="text-xs text-[var(--text-secondary)]">
            {mode === 'distance'
              ? 'Click first vertex → Click consecutive stations → Double-click to complete line.'
              : 'Click boundary vertices in sequence → Double-click or close to first point.'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-[var(--border-color)]">
        <button
          onClick={() => {
            toggleMeasure('none')
            onClose()
          }}
          className="px-3 py-1.5 rounded-xl border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          Cancel Measurement
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={clearDrawn}
            className="px-3 py-1.5 rounded-xl border border-[var(--border-color)] text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
          <button
            onClick={() => {
              saveToProject?.()
              onClose()
            }}
            className="px-3.5 py-1.5 rounded-xl bg-[#D17B47] text-white text-xs font-semibold hover:bg-[#B35E2D] flex items-center gap-1.5 shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save as {mode === 'distance' ? 'Survey Line' : 'Parcel'}</span>
          </button>
        </div>
      </div>
    </div>
  )
})
