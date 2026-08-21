'use client'

import React, { memo, useState } from 'react'
import {
  MapPin, Plus, Navigation, Target, Save, Check, X,
} from 'lucide-react'
import { useMapContext } from '@/app/map/MapReactContext'

export const PointCollectionWorkflow = memo(function PointCollectionWorkflow({
  onClose,
}: {
  onClose: () => void
}) {
  const { toggleDraw, drawMode, mouseCoord, saveToProject, snappingEnabled, setSnappingEnabled } = useMapContext()

  const [pointCode, setPointCode] = useState('BCN')
  const [pointDesc, setPointDesc] = useState('')
  const [pointLayer, setPointLayer] = useState('Cadastral Boundary')
  const [manualEasting, setManualEasting] = useState('')
  const [manualNorthing, setManualNorthing] = useState('')
  const [mode, setMode] = useState<'map' | 'manual' | 'gnss'>('map')

  const handleStartCapture = () => {
    setMode('map')
    if (drawMode !== 'Point') {
      toggleDraw('Point')
    }
  }

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
            POINT COLLECTION WORKFLOW
          </h3>
        </div>
        <span className="text-[10px] text-[var(--text-muted)] font-mono">Step: Capture & Attribute</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Code & Description */}
        <div>
          <label className="text-[10px] uppercase font-bold text-[var(--text-muted)] block mb-1">
            Point Code & ID
          </label>
          <input
            type="text"
            value={pointCode}
            onChange={(e) => setPointCode(e.target.value)}
            placeholder="e.g. BCN_01"
            className="w-full h-8 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-2.5 text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:border-[#D17B47]"
          />
        </div>

        <div>
          <label className="text-[10px] uppercase font-bold text-[var(--text-muted)] block mb-1">
            Description / Remark
          </label>
          <input
            type="text"
            value={pointDesc}
            onChange={(e) => setPointDesc(e.target.value)}
            placeholder="e.g. Iron Pin in Concrete"
            className="w-full h-8 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#D17B47]"
          />
        </div>

        <div>
          <label className="text-[10px] uppercase font-bold text-[var(--text-muted)] block mb-1">
            Target Layer
          </label>
          <select
            value={pointLayer}
            onChange={(e) => setPointLayer(e.target.value)}
            className="w-full h-8 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#D17B47]"
          >
            <option value="Cadastral Boundary">Cadastral Boundary</option>
            <option value="Control Marks">Control Marks</option>
            <option value="Topographic Features">Topographic Features</option>
            <option value="Utilities">Utilities</option>
          </select>
        </div>
      </div>

      {/* Capture Modes & Preview */}
      <div className="p-3 rounded-xl bg-[var(--bg-primary)]/80 border border-[var(--border-color)] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handleStartCapture}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              mode === 'map' && drawMode === 'Point'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Click on Map Canvas</span>
          </button>

          <button
            onClick={() => setMode('manual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              mode === 'manual'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Enter Coordinates</span>
          </button>
        </div>

        {/* Live Coordinate Preview */}
        {mouseCoord && (
          <div className="text-[11px] font-mono text-[var(--text-secondary)] flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-[10px]">Preview:</span>
            <span>E {mouseCoord.e.toFixed(2)}</span>
            <span>N {mouseCoord.n.toFixed(2)}</span>
          </div>
        )}
      </div>

      {mode === 'manual' && (
        <div className="flex items-center gap-2 pt-1 animate-in fade-in duration-100">
          <input
            type="number"
            value={manualEasting}
            onChange={(e) => setManualEasting(e.target.value)}
            placeholder="Easting (m)"
            className="flex-1 h-8 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-2 text-xs font-mono"
          />
          <input
            type="number"
            value={manualNorthing}
            onChange={(e) => setManualNorthing(e.target.value)}
            placeholder="Northing (m)"
            className="flex-1 h-8 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-2 text-xs font-mono"
          />
          <button
            onClick={() => {
              saveToProject?.()
              onClose()
            }}
            className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600"
          >
            Record Point
          </button>
        </div>
      )}
    </div>
  )
})
