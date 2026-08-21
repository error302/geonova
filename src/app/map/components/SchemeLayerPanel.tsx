'use client'
/**
 * SchemeLayerPanel — Floating panel for scheme data layer controls
 *
 * Provides:
 *  - Load Scheme button (fetches from API)
 *  - Toggle switches for parcel / block / beacon layers
 *  - Parcel / block / beacon counts
 *  - Loading spinner during fetch
 *  - Error state with retry
 *  - Zoom-to-scheme button
 *  - Create Parcel from Traverse button (when traverse is computed)
 *  - Traverse-to-parcel preview/confirm/cancel workflow
 *
 * Positioned at the top-right of the map, styled to match the
 * existing dark glass-morphism UI (bg-[color-mix(in_srgb,var(--bg-secondary)_95%,transparent)], #D17B47 accents).
 *
 * Now consumes all state and actions from MapReactContext via useMapContext().
 * Previously received 18 props from MapClient — now reads from context directly.
 */

import React, { memo, useState } from 'react'
import { useMapContext } from '@/app/map/MapReactContext'

export const SchemeLayerPanel = memo(function SchemeLayerPanel() {
  const {
    hasProjectId,
    schemeLoading: loading,
    schemeError: error,
    schemeLoaded: loaded,
    schemeParcelCount: parcelCount,
    schemeBlockCount: blockCount,
    schemeBeaconCount: beaconCount,
    showSchemeParcels: showParcels,
    showSchemeBlocks: showBlocks,
    showSchemeBeacons: showBeacons,
    hasTraverse,
    traverseParcelPreviewActive,
    loadSchemeData,
    toggleSchemeParcelVisibility,
    toggleSchemeBlockVisibility,
    toggleSchemeBeaconVisibility,
    zoomToScheme,
    removeScheme,
    createParcelFromTraverse,
    confirmTraverseParcel,
    cancelTraverseParcel,
  } = useMapContext()

  const [, setShowTraverseWorkflow] = useState(false)

  if (!hasProjectId) return null

  return (
    <div
      className="max-w-[260px]"
      role="region"
      aria-label="Scheme layer controls"
    >
      <div className="bg-[color-mix(in_srgb,var(--bg-secondary)_95%,transparent)] border border-[var(--border-color)]/[0.08] rounded-xl shadow-2xl backdrop-blur-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border-color)]/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />
            <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              Scheme Data
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="px-3 py-2.5 space-y-2.5">
          {/* Load / Loading / Error State */}
          {!loaded && !loading && !error && (
            <button
              onClick={loadSchemeData}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                         bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] text-[var(--accent)]
                         text-xs font-semibold transition-all duration-200
                         hover:bg-[color-mix(in_srgb,var(--accent)_25%,transparent)] hover:border-[color-mix(in_srgb,var(--accent)_50%,transparent)]
                         focus:outline-none focus:ring-1 focus:ring-[#D17B47]/50"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Load Scheme
            </button>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-3">
              <svg className="animate-spin h-4 w-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs text-[var(--text-secondary)]">Loading scheme data...</span>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="space-y-2">
              <div className="text-[11px] text-[var(--error)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] rounded-lg px-2.5 py-1.5 border border-red-500/20">
                {error}
              </div>
              <button
                onClick={loadSchemeData}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg
                           bg-[var(--bg-card)]/[0.04] border border-[var(--border-color)]/[0.08] text-[var(--text-secondary)]
                           text-[11px] font-medium transition-all duration-200
                           hover:bg-[var(--bg-card)]/[0.08] hover:text-[var(--text-secondary)]
                           focus:outline-none focus:ring-1 focus:ring-white/20"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retry
              </button>
            </div>
          )}

          {/* Layer Toggles (only when loaded) */}
          {loaded && (
            <>
              <div className="space-y-1.5">
                {/* Parcels toggle */}
                <LayerToggle
                  label="Parcels"
                  count={parcelCount}
                  active={showParcels}
                  color="#006600"
                  onToggle={toggleSchemeParcelVisibility}
                />
                {/* Blocks toggle */}
                <LayerToggle
                  label="Blocks"
                  count={blockCount}
                  active={showBlocks}
                  color="#D17B47"
                  onToggle={toggleSchemeBlockVisibility}
                />
                {/* Beacons toggle */}
                <LayerToggle
                  label="Beacons"
                  count={beaconCount}
                  active={showBeacons}
                  color="#FFD700"
                  onToggle={toggleSchemeBeaconVisibility}
                />
              </div>

              {/* Traverse-to-Parcel Workflow */}
              {hasTraverse && !traverseParcelPreviewActive && (
                <div className="pt-1 border-t border-[var(--border-color)]/[0.06]">
                  <button
                    onClick={() => {
                      setShowTraverseWorkflow(true)
                      createParcelFromTraverse()
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                               bg-[color-mix(in_srgb,var(--success)_10%,transparent)] border border-green-500/25 text-[var(--success)]
                               text-xs font-semibold transition-all duration-200
                               hover:bg-[color-mix(in_srgb,var(--success)_20%,transparent)] hover:border-green-500/40
                               focus:outline-none focus:ring-1 focus:ring-green-500/40"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                    Create Parcel from Traverse
                  </button>
                </div>
              )}

              {/* Traverse preview confirm/cancel */}
              {traverseParcelPreviewActive && (
                <div className="pt-1 border-t border-[var(--border-color)]/[0.06] space-y-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
                    <span className="text-[10px] text-[var(--success)] uppercase tracking-wider font-semibold">
                      Traverse Preview
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                    The traverse stations are shown as a polygon preview. Confirm to save as a parcel boundary.
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={confirmTraverseParcel}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg
                                 bg-[color-mix(in_srgb,var(--success)_20%,transparent)] border border-green-500/30 text-[var(--success)]
                                 text-[11px] font-semibold transition-all duration-200
                                 hover:bg-[color-mix(in_srgb,var(--success)_30%,transparent)] hover:text-[var(--success)]
                                 focus:outline-none focus:ring-1 focus:ring-green-500/30"
                      title="Save traverse as parcel boundary"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Confirm
                    </button>
                    <button
                      onClick={cancelTraverseParcel}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg
                                 bg-[color-mix(in_srgb,var(--error)_10%,transparent)] border border-red-500/20 text-[var(--error)]
                                 text-[11px] font-medium transition-all duration-200
                                 hover:bg-[color-mix(in_srgb,var(--error)_20%,transparent)] hover:text-[var(--error)]
                                 focus:outline-none focus:ring-1 focus:ring-red-500/30"
                      title="Cancel — remove preview"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={zoomToScheme}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg
                             bg-[var(--bg-card)]/[0.04] border border-[var(--border-color)]/[0.08] text-[var(--text-secondary)]
                             text-[11px] font-medium transition-all duration-200
                             hover:bg-[var(--bg-card)]/[0.08] hover:text-[var(--text-secondary)]
                             focus:outline-none focus:ring-1 focus:ring-white/20"
                  title="Zoom to scheme extent"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                  </svg>
                  Zoom
                </button>
                <button
                  onClick={removeScheme}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg
                             bg-[color-mix(in_srgb,var(--error)_10%,transparent)] border border-red-500/20 text-[var(--error)]
                             text-[11px] font-medium transition-all duration-200
                             hover:bg-[color-mix(in_srgb,var(--error)_20%,transparent)] hover:text-[var(--error)]
                             focus:outline-none focus:ring-1 focus:ring-red-500/30"
                  title="Remove scheme layers"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Remove
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
})

// ── Sub-component: Layer Toggle ─────────────────────────────────────────

function LayerToggle({
  label,
  count,
  active,
  color,
  onToggle,
}: {
  label: string
  count: number
  active: boolean
  color: string
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className={`
        w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-all duration-200
        ${active
          ? 'bg-[var(--bg-card)]/[0.06] border border-[var(--border-color)]/[0.10]'
          : 'bg-transparent border border-transparent opacity-50'}
        focus:outline-none focus:ring-1 focus:ring-white/20
      `}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-2.5 h-2.5 rounded-sm transition-opacity duration-200"
          style={{ backgroundColor: color, opacity: active ? 1 : 0.3 }}
        />
        <span className={`text-[11px] font-medium ${active ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'}`}>
          {label}
        </span>
      </div>
      <span className="text-[10px] text-[var(--text-muted)] tabular-nums">
        {count}
      </span>
    </button>
  )
}
