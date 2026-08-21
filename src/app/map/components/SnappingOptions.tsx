'use client'

/**
 * SnappingOptions — Configurable snapping for precise digitizing
 *
 * QGIS-inspired snapping configuration:
 * - Snap to: vertices, edges, intersections
 * - Tolerance: adjustable in meters
 * - Enabled/disabled per layer
 * - Snap mode: vertex, segment, vertex+segment
 */

import { useState, useCallback } from 'react'
import { Magnet, Settings2, X } from 'lucide-react'

type SnapMode = 'vertex' | 'segment' | 'vertex_segment'
type SnapType = 'osm' | 'parcels' | 'beacons' | 'grid' | 'all'

interface SnappingOptionsProps {
  open: boolean
  onClose: () => void
  enabled: boolean
  onToggleEnabled: () => void
  mode?: SnapMode
  onModeChange?: (mode: SnapMode) => void
  tolerance?: number
  onToleranceChange?: (tolerance: number) => void
  snapTypes?: Set<SnapType>
  onSnapTypeToggle?: (type: SnapType) => void
}

const SNAP_TYPE_LABELS: Record<SnapType, string> = {
  osm: 'Basemap features',
  parcels: 'Parcels',
  beacons: 'Beacons',
  grid: 'Grid intersections',
  all: 'All layers',
}

export function SnappingOptions({
  open,
  onClose,
  enabled,
  onToggleEnabled,
  mode = 'vertex_segment',
  onModeChange,
  tolerance = 0.1,
  onToleranceChange,
  snapTypes = new Set(['parcels', 'beacons']),
  onSnapTypeToggle,
}: SnappingOptionsProps) {
  const [localMode, setLocalMode] = useState(mode)
  const [localTolerance, setLocalTolerance] = useState(tolerance)
  const [localSnapTypes, setLocalSnapTypes] = useState(snapTypes)

  const handleModeChange = useCallback((newMode: SnapMode) => {
    setLocalMode(newMode)
    onModeChange?.(newMode)
  }, [onModeChange])

  const handleToleranceChange = useCallback((newTolerance: number) => {
    setLocalTolerance(newTolerance)
    onToleranceChange?.(newTolerance)
  }, [onToleranceChange])

  const handleSnapTypeToggle = useCallback((type: SnapType) => {
    setLocalSnapTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      onSnapTypeToggle?.(type)
      return next
    })
  }, [onSnapTypeToggle])

  if (!open) return null

  return (
    <div className="absolute top-[340px] right-3 z-30 w-72 bg-[color-mix(in_srgb,var(--bg-secondary)_95%,transparent)] backdrop-blur-2xl border border-[var(--border-color)]/[0.08] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-right-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]/[0.06]">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${enabled ? 'bg-[color-mix(in_srgb,var(--success)_10%,transparent)]' : 'bg-[color-mix(in_srgb,var(--bg-tertiary)_10%,transparent)]'}`}>
            <Magnet className={`w-4 h-4 ${enabled ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}`} />
          </div>
          <div>
            <span className="text-sm font-semibold text-[var(--text-primary)]">Snapping</span>
            <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">
              {enabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]/[0.06]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Enable toggle */}
        <button
          onClick={onToggleEnabled}
          className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
            enabled
              ? 'bg-[color-mix(in_srgb,var(--success)_5%,transparent)] border-emerald-500/30'
              : 'bg-[var(--bg-card)]/[0.02] border-[var(--border-color)]/[0.06]'
          }`}
        >
          <span className="text-xs text-[var(--text-primary)]">Enable Snapping</span>
          <div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${enabled ? 'bg-[var(--success)]' : 'bg-gray-700'}`}>
            <div className={`w-4 h-4 rounded-full bg-[var(--bg-card)] transition-transform ${enabled ? 'translate-x-4' : ''}`} />
          </div>
        </button>

        {/* Snap mode */}
        <div>
          <div className="block text-[9px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Snap Mode</div>
          <div className="grid grid-cols-3 gap-1">
            {(['vertex', 'segment', 'vertex_segment'] as SnapMode[]).map(m => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                disabled={!enabled}
                className={`px-2 py-1.5 rounded-lg text-[9px] font-medium transition-colors disabled:opacity-30 ${
                  localMode === m
                    ? 'bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] text-[var(--accent)]'
                    : 'bg-[var(--bg-card)]/[0.02] border border-[var(--border-color)]/[0.06] text-[var(--text-secondary)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {m === 'vertex' ? 'Vertex' : m === 'segment' ? 'Segment' : 'Both'}
              </button>
            ))}
          </div>
        </div>

        {/* Tolerance */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="snap-tolerance" className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">Tolerance</label>
            <span className="text-[10px] text-[var(--text-secondary)] font-mono">{localTolerance.toFixed(2)} m</span>
          </div>
          <input id="snap-tolerance"
            type="range"
            min="0.01"
            max="5"
            step="0.01"
            value={localTolerance}
            onChange={e => handleToleranceChange(parseFloat(e.target.value))}
            disabled={!enabled}
            className="w-full h-1.5 accent-[#D17B47] cursor-pointer disabled:opacity-30"
          />
          <div className="flex items-center justify-between mt-0.5 text-[8px] text-[var(--text-muted)]">
            <span>1cm</span>
            <span>1m</span>
            <span>5m</span>
          </div>
        </div>

        {/* Snap to layers */}
        <div>
          <div className="block text-[9px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Snap To</div>
          <div className="space-y-1">
            {(['parcels', 'beacons', 'grid', 'osm'] as SnapType[]).map(type => (
              <label
                key={type}
                className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-colors ${
                  enabled ? 'hover:bg-[var(--bg-card)]/[0.04]' : 'opacity-50'
                }`}
              >
                <input aria-label="Snap type"
                  type="checkbox"
                  checked={localSnapTypes.has(type)}
                  onChange={() => handleSnapTypeToggle(type)}
                  disabled={!enabled}
                  className="w-3.5 h-3.5 rounded border-[var(--border-hover)] accent-[#D17B47]"
                />
                <span className="text-[11px] text-[var(--text-secondary)]">{SNAP_TYPE_LABELS[type]}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="flex items-start gap-1.5 p-2 rounded-lg bg-blue-500/5 border border-blue-500/10">
          <Settings2 className="w-3 h-3 text-[var(--primary-blue)] shrink-0 mt-0.5" />
          <p className="text-[9px] text-[color-mix(in_srgb,var(--primary-blue)_70%,transparent)] leading-relaxed">
            Snapping ensures precise digitizing by aligning new features to existing vertices and edges.
            Lower tolerance = more precise but harder to snap. Higher tolerance = easier but less precise.
          </p>
        </div>
      </div>
    </div>
  )
}
