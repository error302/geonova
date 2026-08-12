'use client'

/**
 * CoordinateChip — Live multi-datum coordinate display
 *
 * Shows a captured coordinate in multiple Kenya survey datums simultaneously:
 * - WGS84 (lat/lng) — what GNSS rovers record
 * - Arc 1960 / UTM 37S (EPSG:21037) — what registries use
 * - Cassini-Soldner — what legacy RIMs use
 *
 * This eliminates the need for surveyors to export to desktop software
 * just to verify their field points match reference title coordinates.
 */

import { useEffect, useState } from 'react'
import { Globe, MapPin, Layers } from 'lucide-react'
import { logger } from '@/lib/logger'

interface CoordinateChipProps {
  lat: number
  lng: number
  /** Show all datums or just WGS84 + UTM (compact mode) */
  showCassini?: boolean
  /** Label for the coordinate (e.g., "Captured Point", "Beacon 04") */
  label?: string
  /** Accuracy in meters (optional) */
  accuracy?: number
  /** Compact mode — smaller text, single line per datum */
  compact?: boolean
  /** T1.5 FIX (2026-07-09): UTM EPSG for the transform (default 'EPSG:21037') */
  epsg?: string
}

interface DatumDisplay {
  wgs84: { lat: number; lng: number } | null
  utm37s: { easting: number; northing: number } | null
  cassini: { easting: number; northing: number; sheet?: string } | null
}

export function CoordinateChip({
  lat,
  lng,
  showCassini = false,
  label,
  accuracy,
  compact = false,
  epsg = 'EPSG:21037',
}: CoordinateChipProps) {
  const [datums, setDatums] = useState<DatumDisplay>({
    wgs84: { lat, lng },
    utm37s: null,
    cassini: null,
  })

  useEffect(() => {
    let cancelled = false

    async function transform() {
      try {
        // Transform to UTM (Arc 1960 / UTM 37S by default)
        let utm37s: { easting: number; northing: number } | null = null
        try {
          const { transform } = await import('ol/proj')
          const [e, n] = transform([lng, lat], 'EPSG:4326', epsg) as [number, number]
          if (!cancelled && isFinite(e) && isFinite(n)) {
            utm37s = { easting: e, northing: n }
          }
        } catch {}

        // Transform to Cassini-Soldner (if requested)
        // Note: Cassini transform requires knowing the specific sheet origin.
        // The cassini module provides feet-to-UTM transforms, not direct WGS84→Cassini.
        // For now, we skip Cassini display unless a sheet-specific transform is available.
        let cassini: { easting: number; northing: number; sheet?: string } | null = null
        if (showCassini) {
          // TODO: Integrate sheet-specific Cassini transform when available
          // For now, display a note that Cassini requires sheet selection
          cassini = null
        }

        if (!cancelled) {
          setDatums({
            wgs84: { lat, lng },
            utm37s,
            cassini,
          })
        }
      } catch (err) {
        logger.warn('[CoordinateChip] Transform failed:', { error: err })
      }
    }

    transform()
    return () => { cancelled = true }
  }, [lat, lng, showCassini])

  const fmt = (n: number, decimals: number) => n.toFixed(decimals)

  return (
    <div className={`rounded-lg border border-white/[0.06] bg-[#0d0d14]/60 backdrop-blur-sm ${compact ? 'p-2' : 'p-3'} space-y-1.5`}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">{label}</span>
          {accuracy != null && (
            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
              accuracy < 3 ? 'bg-emerald-500/15 text-emerald-400' :
              accuracy <= 10 ? 'bg-amber-500/15 text-amber-400' :
              'bg-red-500/15 text-red-400'
            }`}>
              ±{accuracy.toFixed(1)}m
            </span>
          )}
        </div>
      )}

      {/* WGS84 */}
      <div className="flex items-start gap-2">
        <Globe className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <span className="text-[9px] text-gray-600 uppercase tracking-wider">WGS84</span>
          <div className={`font-mono text-gray-300 ${compact ? 'text-[10px]' : 'text-xs'}`}>
            {fmt(datums.wgs84?.lat ?? 0, 6)}, {fmt(datums.wgs84?.lng ?? 0, 6)}
          </div>
        </div>
      </div>

      {/* Arc 1960 / UTM 37S */}
      {datums.utm37s && (
        <div className="flex items-start gap-2">
          <MapPin className="w-3 h-3 text-[#D17B47] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-[9px] text-gray-600 uppercase tracking-wider">Arc 1960 / UTM 37S</span>
            <div className={`font-mono text-gray-300 ${compact ? 'text-[10px]' : 'text-xs'}`}>
              E: {fmt(datums.utm37s.easting, 3)}, N: {fmt(datums.utm37s.northing, 3)}
            </div>
          </div>
        </div>
      )}

      {/* Cassini-Soldner */}
      {datums.cassini && (
        <div className="flex items-start gap-2">
          <Layers className="w-3 h-3 text-purple-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-[9px] text-gray-600 uppercase tracking-wider">
              Cassini{datums.cassini.sheet ? ` — Sheet ${datums.cassini.sheet}` : ''}
            </span>
            <div className={`font-mono text-gray-300 ${compact ? 'text-[10px]' : 'text-xs'}`}>
              E: {fmt(datums.cassini.easting, 3)}, N: {fmt(datums.cassini.northing, 3)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
