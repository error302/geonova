'use client'
/**
 * CogoInfoPanel — Survey of Kenya compliant COGO readout
 *
 * Computes and displays traverse legs (bearing + distance) between
 * consecutive parcel vertices, plus total perimeter and enclosed area.
 *
 * Uses:
 *   - distanceBearing from @/lib/engine/distance (WCB 0-360°)
 *   - coordinateArea  from @/lib/engine/area    (Shoelace method)
 *   - vertexEditingVertices from MapReactContext
 *
 * SoK formatting:
 *   - Bearings in DMS  (DDD° MM' SS.SSS")
 *   - Distances in metres (3 dp)
 *   - Area in m², Ha, Acres
 */

import React, { useMemo, useState, memo } from 'react'
import { ChevronDown, ChevronUp, X, Ruler, MapPin } from 'lucide-react'
import { useMapContext } from '@/app/map/MapReactContext'
import { distanceBearing } from '@/lib/engine/distance'
import { coordinateArea } from '@/lib/engine/area'
import type { Point2D } from '@/lib/engine/types'

// ─── Types ────────────────────────────────────────────────────────────────

interface TraverseLegDisplay {
  fromIndex: number
  toIndex: number
  bearing: number
  bearingDMS: string
  quadrant: string
  distance: number
  deltaE: number
  deltaN: number
}

// ─── Computation helpers ──────────────────────────────────────────────────

function computeTraverseLegs(
  vertices: Array<{ easting: number; northing: number }>
): TraverseLegDisplay[] {
  if (vertices.length < 2) return []

  const legs: TraverseLegDisplay[] = []
  const n = vertices.length

  for (let i = 0; i < n; i++) {
    const from: Point2D = { easting: vertices[i].easting, northing: vertices[i].northing }
    const to: Point2D = {
      easting: vertices[(i + 1) % n].easting,
      northing: vertices[(i + 1) % n].northing,
    }
    const result = distanceBearing(from, to)
    legs.push({
      fromIndex: i,
      toIndex: (i + 1) % n,
      bearing: result.bearing,
      bearingDMS: result.bearingDMS,
      quadrant: result.quadrant,
      distance: result.distance,
      deltaE: result.deltaE,
      deltaN: result.deltaN,
    })
  }

  return legs
}

function computeAreaInfo(
  vertices: Array<{ easting: number; northing: number }>
) {
  const points: Point2D[] = vertices.map(v => ({
    easting: v.easting,
    northing: v.northing,
  }))
  return coordinateArea(points)
}

// ─── Component ────────────────────────────────────────────────────────────

function CogoInfoPanelInner() {
  const { vertexEditingVertices } = useMapContext()
  const [expanded, setExpanded] = useState(true)
  const [showDetails, setShowDetails] = useState(false)

  const legs = useMemo(
    () => computeTraverseLegs(vertexEditingVertices),
    [vertexEditingVertices]
  )

  const areaInfo = useMemo(
    () => computeAreaInfo(vertexEditingVertices),
    [vertexEditingVertices]
  )

  const totalDistance = useMemo(
    () => legs.reduce((sum, leg) => sum + leg.distance, 0),
    [legs]
  )

  // ── No vertices: show minimal placeholder ──
  if (vertexEditingVertices.length === 0) {
    return (
      <div
        className="bg-[var(--bg-card)] rounded-lg shadow-lg border border-[var(--border-color)] select-none"
        style={{ fontFamily: 'Calibri, sans-serif', minWidth: 260 }}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <Ruler className="w-4 h-4 text-[#1B3A5C]" />
            <span className="text-sm font-semibold text-[#1B3A5C]">
              COGO Traverse
            </span>
          </div>
        </div>
        <div className="px-3 py-3 text-xs text-[var(--text-muted)] text-center">
          Load a scheme to view traverse data
        </div>
      </div>
    )
  }

  return (
    <div
      className="bg-[var(--bg-card)] rounded-lg shadow-lg border border-[var(--border-color)] select-none"
      style={{ fontFamily: 'Calibri, sans-serif', minWidth: 300, maxWidth: 400 }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <Ruler className="w-4 h-4 text-[#1B3A5C]" />
          <span className="text-sm font-semibold text-[#1B3A5C]">
            COGO Traverse
          </span>
          <span className="text-[10px] text-[var(--text-secondary)] ml-1">
            {vertexEditingVertices.length} vertices
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1 hover:bg-[var(--bg-secondary)] rounded transition-colors"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          {/* ── Traverse legs table ── */}
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="bg-[var(--bg-secondary)] sticky top-0">
                <tr className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                  <th className="px-2 py-1.5 text-left font-semibold">Leg</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Bearing</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Distance</th>
                </tr>
              </thead>
              <tbody>
                {legs.map((leg, idx) => (
                  <tr
                    key={`${leg}-${idx}`}
                    className={idx % 2 === 0 ? 'bg-[var(--bg-card)]' : 'bg-[var(--bg-secondary)]'}
                  >
                    <td className="px-2 py-1 text-[var(--text-muted)] font-mono">
                      V{leg.fromIndex + 1}&rarr;V{leg.toIndex + 1}
                    </td>
                    <td className="px-2 py-1 font-mono text-[#1B3A5C]">
                      {leg.bearingDMS}
                    </td>
                    <td className="px-2 py-1 text-right font-mono text-[var(--text-secondary)]">
                      {leg.distance.toFixed(3)} m
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Summary ── */}
          <div className="px-3 py-2 border-t border-[var(--border-color)] bg-[var(--primary-blue)]/10/60">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-muted)] font-semibold">Perimeter</span>
              <span className="font-mono text-[#1B3A5C]">
                {totalDistance.toFixed(3)} m
              </span>
            </div>
            {vertexEditingVertices.length >= 3 && (
              <>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-[var(--text-muted)] font-semibold">Area</span>
                  <span className="font-mono text-[#1B3A5C]">
                    {areaInfo.areaSqm.toFixed(1)} m&sup2;
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs mt-0.5">
                  <span className="text-[var(--text-muted)] pl-4">&nbsp;</span>
                  <span className="font-mono text-[var(--text-muted)] text-[10px]">
                    {areaInfo.areaHa.toFixed(4)} Ha &middot; {areaInfo.areaAcres.toFixed(4)} Ac
                  </span>
                </div>
              </>
            )}
          </div>

          {/* ── Detailed delta E/N toggle ── */}
          <div className="px-3 py-1.5 border-t border-[var(--border-color)]">
            <button
              onClick={() => setShowDetails(v => !v)}
              className="w-full flex items-center justify-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[#1B3A5C] transition-colors"
            >
              {showDetails ? 'Hide' : 'Show'} Delta E / N
              {showDetails ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          </div>

          {showDetails && (
            <div className="max-h-48 overflow-y-auto border-t border-[var(--border-color)]">
              <table className="w-full text-[10px]">
                <thead className="bg-[var(--bg-secondary)] sticky top-0">
                  <tr className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">
                    <th className="px-2 py-1 text-left font-semibold">Leg</th>
                    <th className="px-2 py-1 text-left font-semibold">Quadrant</th>
                    <th className="px-2 py-1 text-right font-semibold">&Delta;E</th>
                    <th className="px-2 py-1 text-right font-semibold">&Delta;N</th>
                  </tr>
                </thead>
                <tbody>
                  {legs.map((leg, idx) => (
                    <tr
                      key={`${leg}-${idx}`}
                      className={idx % 2 === 0 ? 'bg-[var(--bg-card)]' : 'bg-[var(--bg-secondary)]'}
                    >
                      <td className="px-2 py-0.5 text-[var(--text-muted)] font-mono">
                        V{leg.fromIndex + 1}&rarr;V{leg.toIndex + 1}
                      </td>
                      <td className="px-2 py-0.5 font-mono text-[var(--text-secondary)]">
                        {leg.quadrant}
                      </td>
                      <td className="px-2 py-0.5 text-right font-mono text-[var(--text-secondary)]">
                        {leg.deltaE >= 0 ? '+' : ''}{leg.deltaE.toFixed(3)}
                      </td>
                      <td className="px-2 py-0.5 text-right font-mono text-[var(--text-secondary)]">
                        {leg.deltaN >= 0 ? '+' : ''}{leg.deltaN.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Centroid (if area computed) ── */}
          {vertexEditingVertices.length >= 3 && showDetails && (
            <div className="px-3 py-2 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
              <div className="flex items-center gap-1 mb-1">
                <MapPin className="w-3 h-3 text-[#1B3A5C]" />
                <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                  Centroid
                </span>
              </div>
              <div className="text-[10px] font-mono text-[var(--text-secondary)]">
                <span className="text-[var(--text-secondary)] mr-0.5">E</span>
                {areaInfo.centroid.easting.toFixed(3)}
                <span className="text-[var(--text-secondary)] mx-1">|</span>
                <span className="text-[var(--text-secondary)] mr-0.5">N</span>
                {areaInfo.centroid.northing.toFixed(3)}
              </div>
              <div className="text-[9px] text-[var(--text-secondary)] mt-0.5">
                Method: {areaInfo.method}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export const CogoInfoPanel = memo(CogoInfoPanelInner)
