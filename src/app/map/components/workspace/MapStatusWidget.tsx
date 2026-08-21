'use client'

import React, { memo } from 'react'
import { useMapContext } from '@/app/map/MapReactContext'
import { Z_INDEX } from '@/lib/map/workspaceLayout'

export const MapStatusWidget = memo(function MapStatusWidget() {
  const { mouseCoord, dragHint, activeProjection, currentUtmEpsg, mapInstance } = useMapContext()

  // Calculate approximate scale bar value based on zoom
  const zoom = mapInstance.current?.getView()?.getZoom() ?? 15
  const scaleMeters = Math.max(10, Math.round(1000 / Math.pow(2, zoom - 10)))

  return (
    <div
      className="absolute bottom-4 left-4 flex flex-col gap-1 pointer-events-none"
      style={{ zIndex: Z_INDEX.mapControls }}
    >
      {/* Geodetic Coordinates Readout */}
      <div className="h-8 bg-[var(--bg-primary)]/90 backdrop-blur-xl border border-[var(--border-color)] rounded-xl flex items-center px-3 gap-2.5 shadow-xl max-w-[85vw] sm:max-w-md pointer-events-auto">
        <span className="px-1.5 py-0.5 rounded bg-[#D17B47]/15 text-[#D17B47] text-[9.5px] font-mono font-bold">
          {currentUtmEpsg || 'UTM 37S'}
        </span>

        {mouseCoord ? (
          <div className="flex items-center gap-2 text-[11px] font-mono whitespace-nowrap overflow-x-auto">
            <span className="text-[var(--text-muted)] text-[10px]">E:</span>
            <span className="font-semibold text-[var(--text-primary)]">{mouseCoord.e.toFixed(3)}</span>
            <span className="text-[var(--text-muted)] text-[10px]">N:</span>
            <span className="font-semibold text-[var(--text-primary)]">{mouseCoord.n.toFixed(3)}</span>
          </div>
        ) : (
          <span className="text-[10px] text-[var(--text-muted)] font-mono">
            Hover cursor over map
          </span>
        )}

        <div className="w-px h-3.5 bg-[var(--border-color)]" />

        {/* Dynamic Scale Bar */}
        <div className="hidden sm:flex items-center gap-1.5 text-[9px] font-mono text-[var(--text-muted)] shrink-0">
          <span>0</span>
          <div className="w-12 h-1 bg-[var(--border-color)] relative rounded-full overflow-hidden">
            <div className="w-1/2 h-full bg-[#D17B47]/80" />
          </div>
          <span>{scaleMeters}m</span>
        </div>

        <span className="text-[9px] text-[var(--text-muted)] font-mono border-l border-[var(--border-color)] pl-2 shrink-0">
          {activeProjection}
        </span>
      </div>

      {dragHint && (
        <div className="text-[10px] font-medium text-[var(--text-secondary)] bg-[var(--bg-primary)]/80 px-3 py-1 rounded-full backdrop-blur-md border border-[var(--border-color)]/60 w-fit pointer-events-auto">
          Drop GeoJSON, KML, or WKT files to import
        </div>
      )}
    </div>
  )
})
