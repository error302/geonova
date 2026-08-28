'use client'
/**
 * MapOverlays — Floating map UI overlays (zoom controls, GPS badge, stakeout HUD, project count)
 *
 * Now reads state from MapReactContext via useMapContext().
 * Memoized to prevent re-renders from unrelated state changes.
 * All overlays are absolutely positioned within the map container.
 * Mobile-responsive: adjusts sizes and positions for small screens.
 */

import React, { memo } from 'react'
import { useMapContext } from '@/app/map/MapReactContext'

export const MapOverlays = memo(function MapOverlays() {
  const {
    mapInstance,
    panelOpen,
    setPanelOpen,
    gpsTracking,
    gpsPos,
    stakeoutActive,
    stakeoutTarget,
    stakeoutInfo,
    toggleStakeout,
    toggleGPS,
    projectCount,
    isMobile,
  } = useMapContext()

  return (
    <>
      {/* Hamburger toggle when panel is open */}
      {panelOpen && (
        <button
          onClick={() => setPanelOpen(false)}
          className="absolute top-3 z-30 w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]/[0.06] transition-colors"
          style={{ left: isMobile ? '0px' : '260px' }}
          title="Collapse panel"
        >
          <span className="text-sm">{'\u2039'}</span>
        </button>
      )}

      {/* Zoom controls - top right */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1" role="group" aria-label="Map zoom controls">
        <button
          onClick={() => {
            const view = mapInstance.current?.getView()
            view?.animate({ zoom: (view.getZoom() ?? 0) + 1 }, { duration: 200 })
          }}
          className="w-10 h-10 bg-[color-mix(in_srgb,var(--bg-secondary)_90%,transparent)] backdrop-blur-sm border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] flex items-center justify-center hover:bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] transition-colors"
          title="Zoom In"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => {
            const view = mapInstance.current?.getView()
            view?.animate({ zoom: Math.max(6, (view.getZoom() ?? 0) - 1) }, { duration: 200 })
          }}
          className="w-10 h-10 bg-[color-mix(in_srgb,var(--bg-secondary)_90%,transparent)] backdrop-blur-sm border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] flex items-center justify-center hover:bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] transition-colors"
          title="Zoom Out"
          aria-label="Zoom out"
        >
          {'\u2212'}
        </button>
      </div>

      {/* GPS status badge - bottom left */}
      {gpsTracking && gpsPos && (
        <div
          className="absolute z-[1000] bg-[color-mix(in_srgb,var(--bg-secondary)_90%,transparent)] backdrop-blur-sm border border-green-500/30 rounded-lg px-3 py-1.5 text-xs text-[var(--success)] font-mono"
          style={{ bottom: `calc(${isMobile ? '64px' : '0px'} + 56px)`, left: '16px' }}
        >
          GPS {'\u00B1'}{Math.round(gpsPos.accuracy)}m
        </div>
      )}

      {/* Stakeout HUD (simplified — full panel is in StakeoutPanel component) */}
      {stakeoutActive && stakeoutTarget && (() => {
        const info = stakeoutInfo()
        return (
          <div
            className="absolute z-[1000] bg-[color-mix(in_srgb,var(--bg-secondary)_95%,transparent)] backdrop-blur-xl border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] rounded-xl px-4 py-3 shadow-2xl"
            style={{ bottom: `calc(${isMobile ? '64px' : '0px'} + 56px)`, right: '16px', width: isMobile ? '180px' : '220px' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-[var(--accent)] uppercase tracking-[0.15em] font-bold">Stakeout</span>
              <button onClick={toggleStakeout} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">Stop</button>
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mb-1">Target</div>
            <div className="text-[11px] text-[var(--text-primary)] font-mono mb-2">E: {stakeoutTarget.e.toFixed(1)} N: {stakeoutTarget.n.toFixed(1)}</div>
            {info ? (
              <>
                <div className="text-[10px] text-[var(--text-muted)] mb-1">Distance / Bearing</div>
                <div className="text-lg font-bold text-[var(--accent)] font-mono">{info.distance.toFixed(1)} m</div>
                <div className="text-sm text-[var(--primary-blue)] font-mono">{info.bearing.toFixed(2)}{'\u00B0'}</div>
                <div className="mt-1.5 text-[10px] text-[var(--text-muted)]">
                  dE: {info.dE.toFixed(1)} | dN: {info.dN.toFixed(1)}
                </div>
              </>
            ) : (
              <div className="text-[10px] text-[var(--text-muted)]">Waiting for GPS position...</div>
            )}
            {!gpsTracking && (
              <button
                onClick={toggleGPS}
                className="mt-2 w-full py-1.5 rounded-lg bg-[color-mix(in_srgb,var(--success)_20%,transparent)] border border-green-500/30 text-[var(--success)] text-[10px] font-medium hover:bg-[color-mix(in_srgb,var(--success)_30%,transparent)] transition-colors"
              >
                Enable GPS
              </button>
            )}
          </div>
        )
      })()}

      {/* Project count moved to MapStatusBar to fix collision with MapCoordSearch */}
    </>
  )
})
