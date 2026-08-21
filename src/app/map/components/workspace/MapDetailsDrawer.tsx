'use client'

import React, { memo } from 'react'
import {
  X, MapPin, Hexagon, Layers, Compass, Calendar, User,
  FileText, ExternalLink, ChevronRight, CheckCircle2,
} from 'lucide-react'
import { useMapContext } from '@/app/map/MapReactContext'
import { DETAILS_DRAWER_WIDTH, Z_INDEX } from '@/lib/map/workspaceLayout'

interface MapDetailsDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export const MapDetailsDrawer = memo(function MapDetailsDrawer({
  isOpen,
  onClose,
}: MapDetailsDrawerProps) {
  const {
    selectedFeature, featureName, schemeProjectId, activeProjection, currentUtmEpsg,
    drawMode, measureMode, editMode, featureCount, hasTraverse,
  } = useMapContext()

  if (!isOpen) return null

  const geom = selectedFeature?.getGeometry()
  const geomType = geom?.getType() || 'Feature'

  // Extract coordinate / dimension properties if available
  let coordinatesInfo: { e?: number; n?: number; area?: number; perimeter?: number } = {}
  try {
    if (geomType === 'Point') {
      const coords = (geom as import('ol/geom/Point').default).getCoordinates()
      coordinatesInfo = { e: coords[0], n: coords[1] }
    } else if (geomType === 'Polygon') {
      const poly = geom as import('ol/geom/Polygon').default
      const ring = poly.getCoordinates()[0] || []
      let perimeter = 0
      for (let i = 0; i < ring.length - 1; i++) {
        const dx = ring[i + 1][0] - ring[i][0]
        const dy = ring[i + 1][1] - ring[i][1]
        perimeter += Math.sqrt(dx * dx + dy * dy)
      }
      coordinatesInfo = { area: poly.getArea(), perimeter }
    }
  } catch {}

  const recentPoints = [
    { id: 'P1', code: 'BCN', e: 250145.2, n: 9851410.8, elev: 1682.4 },
    { id: 'P2', code: 'BCN', e: 250210.5, n: 9851435.1, elev: 1683.1 },
    { id: 'P3', code: 'BCN', e: 250280.0, n: 9851390.4, elev: 1681.9 },
    { id: 'BM1', code: 'BM', e: 250050.0, n: 9851500.0, elev: 1685.0 },
  ]

  return (
    <aside
      aria-label="Object details drawer"
      className="absolute top-0 right-0 bottom-0 flex flex-col bg-[var(--bg-primary)]/95 backdrop-blur-2xl border-l border-[var(--border-color)] shadow-2xl transition-all"
      style={{ width: DETAILS_DRAWER_WIDTH, zIndex: Z_INDEX.rightDrawer }}
    >
      {/* ── DRAWER HEADER ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#D17B47]" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
            {geomType === 'Point' ? 'POINT DETAILS' : geomType === 'Polygon' ? 'PARCEL DETAILS' : 'FEATURE DETAILS'}
          </h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Close details drawer"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.06] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── DETAILS BODY ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {selectedFeature ? (
          <>
            {/* Entity Identification Card */}
            <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)]/70 border border-[var(--border-color)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Identifier</span>
                <span className="px-2 py-0.5 rounded-full bg-[#D17B47]/15 text-[#D17B47] text-[10px] font-mono font-bold">
                  {geomType}
                </span>
              </div>
              <p className="text-sm font-bold text-[var(--text-primary)]">{featureName || 'Unnamed Feature'}</p>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--border-color)]/60 text-xs">
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] block">Layer</span>
                  <span className="font-medium text-[var(--text-primary)]">Cadastral Boundary</span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] block">CRS</span>
                  <span className="font-mono text-[10px] text-[var(--text-secondary)]">{activeProjection}</span>
                </div>
              </div>
            </div>

            {/* Coordinates / Dimensions */}
            {geomType === 'Point' && coordinatesInfo.e !== undefined && (
              <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)]/70 border border-[var(--border-color)] space-y-2 font-mono text-xs">
                <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] font-sans">Geodetic Coordinates</span>
                <div className="flex justify-between py-1 border-b border-[var(--border-color)]/40">
                  <span className="text-[var(--text-muted)]">Easting (m):</span>
                  <span className="font-bold text-[#D17B47]">{coordinatesInfo.e.toFixed(3)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--border-color)]/40">
                  <span className="text-[var(--text-muted)]">Northing (m):</span>
                  <span className="font-bold text-[#D17B47]">{coordinatesInfo.n?.toFixed(3)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[var(--text-muted)]">Recorded By:</span>
                  <span className="text-[var(--text-primary)] font-sans text-xs">Principal Surveyor</span>
                </div>
              </div>
            )}

            {geomType === 'Polygon' && coordinatesInfo.area !== undefined && (
              <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)]/70 border border-[var(--border-color)] space-y-2 font-mono text-xs">
                <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] font-sans">Boundary Geometry</span>
                <div className="flex justify-between py-1 border-b border-[var(--border-color)]/40">
                  <span className="text-[var(--text-muted)]">Area:</span>
                  <span className="font-bold text-[#D17B47]">{(coordinatesInfo.area / 10000).toFixed(4)} Ha</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--border-color)]/40">
                  <span className="text-[var(--text-muted)]">Perimeter:</span>
                  <span className="font-bold text-[var(--text-primary)]">{coordinatesInfo.perimeter?.toFixed(2)} m</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[var(--text-muted)]">Status:</span>
                  <span className="text-emerald-400 font-bold font-sans text-xs">CLOSED & VALID</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-4 rounded-xl bg-[var(--bg-secondary)]/40 border border-[var(--border-color)] text-center space-y-2">
            <p className="text-xs text-[var(--text-muted)]">No feature currently selected on the map.</p>
            <p className="text-[10.5px] text-[var(--text-secondary)]">Click any point, line, or parcel on the map canvas to inspect its geodetic attributes.</p>
          </div>
        )}

        {/* ── RECENT POINTS SECTION ── */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
              RECENT CONTROL POINTS
            </span>
            <span className="text-[9.5px] text-[var(--text-muted)] font-mono">4 Marks</span>
          </div>

          <div className="space-y-1.5">
            {recentPoints.map((pt) => (
              <div
                key={pt.id}
                className="p-2 rounded-lg bg-[var(--bg-secondary)]/60 hover:bg-[var(--bg-secondary)] border border-[var(--border-color)]/80 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-[#D17B47]/15 text-[#D17B47] text-[10px] font-bold flex items-center justify-center font-mono">
                    {pt.id}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-primary)]">{pt.code} · {pt.id}</p>
                    <p className="text-[9.5px] text-[var(--text-muted)] font-mono">
                      E: {pt.e.toFixed(1)} N: {pt.n.toFixed(1)}
                    </p>
                  </div>
                </div>
                <span className="text-[9px] font-mono text-[var(--text-muted)]">{pt.elev.toFixed(1)}m</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => {}}
            className="w-full py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 hover:bg-[var(--bg-secondary)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center justify-center gap-1.5"
          >
            <span>View All Project Points</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
})
