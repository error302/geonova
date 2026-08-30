'use client'
/**
 * MapStatusBar — Bottom coordinate bar overlay
 *
 * Now reads state from MapReactContext via useMapContext().
 * Shows live mouse coordinates in both Lon/Lat and EPSG:21037 (E/N).
 * Responsive: hides E/N on mobile, adjusts font sizes.
 */

import React, { memo, useState, useEffect } from 'react'
import { WifiOff } from 'lucide-react'
import { useMapContext } from '@/app/map/MapReactContext'

export const MapStatusBar = memo(function MapStatusBar() {
  const { mouseCoord, dragHint, isMobile, projectCount } = useMapContext()
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10" style={{ bottom: isMobile ? '64px' : '0px' }}>
      <div className="mx-2 mb-2 h-8 bg-[color-mix(in_srgb,var(--bg-secondary)_95%,transparent)] backdrop-blur-xl border border-[var(--border-color)]/[0.06] rounded-lg flex items-center justify-between px-2 md:px-3 overflow-x-auto">
        {/* Coordinates */}
        <div className="flex items-center gap-1.5 md:gap-3 min-w-0">
          {mouseCoord ? (
            <div className="flex items-center gap-1.5 md:gap-3 text-[10px] md:text-[11px] font-mono whitespace-nowrap">
              <span className="text-[var(--text-muted)]">Lon</span>
              <span className="text-[var(--text-secondary)] w-[60px] md:w-[76px] text-right">{mouseCoord.lon.toFixed(6)}</span>
              <span className="text-[var(--text-muted)]">Lat</span>
              <span className="text-[var(--text-secondary)] w-[60px] md:w-[76px] text-right">{mouseCoord.lat.toFixed(6)}</span>
              <span className="hidden md:block w-px h-3.5 bg-[var(--bg-card)]/[0.06]" />
              <span className="text-[var(--accent)]">E</span>
              <span className="text-[var(--accent)] font-medium w-[64px] md:w-[80px] text-right">{mouseCoord.e.toFixed(1)}</span>
              <span className="text-[var(--accent)]">N</span>
              <span className="text-[var(--accent)] font-medium w-[64px] md:w-[80px] text-right">{mouseCoord.n.toFixed(1)}</span>
              <span className="text-[var(--text-muted)] text-[9px] md:text-[10px]">EPSG:21037</span>
            </div>
          ) : (
            <span className="text-[10px] md:text-[11px] text-[var(--text-muted)]">Move cursor for coordinates</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Offline status indicator */}
          {!isOnline && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <WifiOff className="w-3 h-3" />
              <span className="text-[10px] font-semibold whitespace-nowrap">Offline</span>
            </div>
          )}

          {/* Project count badge */}
          {projectCount > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--accent)_20%,transparent)]">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
              <span className="text-[10px] text-[var(--accent)] font-semibold whitespace-nowrap">{projectCount} project{projectCount > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      {/* Drag-drop hint */}
      {dragHint && (
        <div className="text-center mb-1 transition-opacity duration-1000">
          <span className="text-[10px] text-[var(--text-secondary)] bg-[color-mix(in_srgb,var(--bg-secondary)_60%,transparent)] px-3 py-0.5 rounded-full backdrop-blur-sm">
            Drag &amp; drop GeoJSON, KML, or WKT files onto the map
          </span>
        </div>
      )}
    </div>
  )
})
