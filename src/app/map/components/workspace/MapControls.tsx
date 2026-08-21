'use client'

import React, { memo } from 'react'
import {
  Compass, Plus, Minus, Navigation, Globe,
} from 'lucide-react'
import { useMapContext } from '@/app/map/MapReactContext'
import { Z_INDEX } from '@/lib/map/workspaceLayout'

export const MapControls = memo(function MapControls() {
  const { mapInstance, fitToKenya, toggleGPS, gpsTracking } = useMapContext()

  const handleResetNorth = () => {
    const view = mapInstance.current?.getView()
    view?.animate({ rotation: 0, duration: 250 })
  }

  const handleZoomIn = () => {
    const view = mapInstance.current?.getView()
    const zoom = view?.getZoom() ?? 0
    view?.animate({ zoom: zoom + 1, duration: 200 })
  }

  const handleZoomOut = () => {
    const view = mapInstance.current?.getView()
    const zoom = view?.getZoom() ?? 0
    view?.animate({ zoom: Math.max(5, zoom - 1), duration: 200 })
  }

  return (
    <div
      className="absolute bottom-4 right-4 flex flex-col gap-1.5 shadow-2xl items-center"
      style={{ zIndex: Z_INDEX.mapControls }}
      role="group"
      aria-label="Map navigation controls"
    >
      {/* Compass / Reset North */}
      <button
        onClick={handleResetNorth}
        title="Reset North Orientation (N)"
        aria-label="Reset North"
        className="w-9 h-9 rounded-xl bg-[var(--bg-primary)]/90 backdrop-blur-xl border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[#D17B47] hover:border-[#D17B47]/40 flex items-center justify-center transition-all shadow-md"
      >
        <Compass className="w-4.5 h-4.5" />
      </button>

      {/* Zoom In & Out Stack */}
      <div className="flex flex-col bg-[var(--bg-primary)]/90 backdrop-blur-xl border border-[var(--border-color)] rounded-xl overflow-hidden shadow-md">
        <button
          onClick={handleZoomIn}
          title="Zoom In (+)"
          aria-label="Zoom in"
          className="w-9 h-9 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.06] border-b border-[var(--border-color)]/60 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom Out (-)"
          aria-label="Zoom out"
          className="w-9 h-9 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.06] transition-colors"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>

      {/* Locate / GPS Center */}
      <button
        onClick={toggleGPS}
        title={gpsTracking ? 'GPS Active' : 'Locate My Position'}
        aria-label="Locate position"
        className={`w-9 h-9 rounded-xl backdrop-blur-xl border transition-all flex items-center justify-center shadow-md ${
          gpsTracking
            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
            : 'bg-[var(--bg-primary)]/90 border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[#D17B47]/40'
        }`}
      >
        <Navigation className={`w-4 h-4 ${gpsTracking ? 'animate-pulse' : ''}`} />
      </button>

      {/* Fit to Extent / Kenya */}
      <button
        onClick={fitToKenya}
        title="Fit Map to Extent / Kenya (F)"
        aria-label="Fit to extent"
        className="w-9 h-9 rounded-xl bg-[var(--bg-primary)]/90 backdrop-blur-xl border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[#D17B47]/40 flex items-center justify-center transition-all shadow-md"
      >
        <Globe className="w-4 h-4" />
      </button>
    </div>
  )
})
