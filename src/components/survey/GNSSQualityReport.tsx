'use client'

/**
 * GNSSQualityReport — Comprehensive GNSS quality monitoring
 *
 * Enhances the existing GPSGuardrail with full quality metrics:
 * - Fix quality (RTK Fixed/Float, DGPS, GPS, No Fix)
 * - Satellites tracked (GPS, GLONASS, Galileo, BeiDou)
 * - PDOP (Position Dilution of Precision)
 * - HDOP (Horizontal DOP)
 * - VDOP (Vertical DOP)
 * - Base station distance (for RTK)
 * - Age of differential correction
 *
 * Generates a QA/QC report for ArdhiSasa submission compliance.
 * Warns if PDOP > 4.0 or fix is RTK Float (not acceptable for cadastral).
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Satellite, AlertTriangle, CheckCircle2, Activity,
  Download, RefreshCw,
} from 'lucide-react'

interface GNSSQuality {
  fixQuality: 'rtk_fixed' | 'rtk_float' | 'dgps' | 'gps' | 'none'
  satellites: number
  satellitesGPS: number
  satellitesGLONASS: number
  satellitesGalileo: number
  satellitesBeiDou: number
  pdop: number
  hdop: number
  vdop: number
  baseDistanceKm: number | null
  correctionAge: number | null  // seconds
  latitude: number
  longitude: number
  altitude: number
  timestamp: Date
}

interface QualityCheck {
  metric: string
  value: string
  threshold: string
  status: 'pass' | 'warning' | 'fail'
  description: string
}

const FIX_QUALITY_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  rtk_fixed: { label: 'RTK Fixed', color: 'text-emerald-400', icon: '' },
  rtk_float: { label: 'RTK Float', color: 'text-amber-400', icon: '' },
  dgps: { label: 'DGPS', color: 'text-blue-400', icon: '' },
  gps: { label: 'GPS Only', color: 'text-amber-400', icon: '[Y]' },
  none: { label: 'No Fix', color: 'text-red-400', icon: '[R]' },
}

export function GNSSQualityReport({ externalPosition }: {
  /** When provided (from GNSS rover), uses NMEA data instead of browser geolocation */
  externalPosition?: { lat: number; lng: number; altitude: number; hdop: number; satellites: number; fixType: string; quality: number } | null
}) {
  const [quality, setQuality] = useState<GNSSQuality | null>(null)
  const [history, setHistory] = useState<GNSSQuality[]>([])
  const [watching, setWatching] = useState(false)
  const watchIdRef = useRef<number | null>(null)

  // Use external rover data when available
  useEffect(() => {
    if (!externalPosition) return

    const q: GNSSQuality = {
      fixQuality: externalPosition.fixType as GNSSQuality['fixQuality'] || (externalPosition.quality >= 4 ? 'rtk_fixed' : externalPosition.quality >= 2 ? 'dgps' : 'gps'),
      satellites: externalPosition.satellites || 0,
      satellitesGPS: 0,
      satellitesGLONASS: 0,
      satellitesGalileo: 0,
      satellitesBeiDou: 0,
      pdop: 0, // Not available from NMEA GGA
      hdop: externalPosition.hdop || 0,
      vdop: 0, // Not available from NMEA GGA
      baseDistanceKm: null,
      correctionAge: null,
      latitude: externalPosition.lat,
      longitude: externalPosition.lng,
      altitude: externalPosition.altitude,
      timestamp: new Date(),
    }
    setQuality(q)
    setHistory(prev => [...prev.slice(-99), q])
  }, [externalPosition])

  const startWatch = useCallback(() => {
    if (watchIdRef.current != null) return // Already watching
    if (externalPosition) return // Using external data, don't start browser GPS
    setWatching(true)

    if (!('geolocation' in navigator)) {
      setWatching(false)
      return
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const q: GNSSQuality = {
          fixQuality: pos.coords.accuracy < 0.1 ? 'rtk_fixed' :
                       pos.coords.accuracy < 1 ? 'rtk_float' :
                       pos.coords.accuracy < 5 ? 'dgps' :
                       pos.coords.accuracy < 15 ? 'gps' : 'none',
          satellites: 0,
          satellitesGPS: 0,
          satellitesGLONASS: 0,
          satellitesGalileo: 0,
          satellitesBeiDou: 0,
          pdop: 0,
          hdop: pos.coords.accuracy || 99,
          vdop: pos.coords.altitudeAccuracy || 99,
          baseDistanceKm: null,
          correctionAge: null,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          altitude: pos.coords.altitude || 0,
          timestamp: new Date(pos.timestamp),
        }
        setQuality(q)
        setHistory(prev => [...prev.slice(-99), q])
      },
      () => {
        setQuality(null)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
    )
  }, [externalPosition]) // AUDIT FIX: Removed `watching` from deps — caused infinite loop

  const stopWatch = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setWatching(false)
  }, [])

  // AUDIT FIX: Only start on mount, don't re-run when startWatch changes
  useEffect(() => {
    startWatch()
    return () => stopWatch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Quality checks
  const checks: QualityCheck[] = useMemo(() => quality ? [
    {
      metric: 'Fix Quality',
      value: FIX_QUALITY_LABELS[quality.fixQuality].label,
      threshold: 'RTK Fixed (cadastral), DGPS (topo)',
      status: quality.fixQuality === 'rtk_fixed' ? 'pass' :
              quality.fixQuality === 'rtk_float' ? 'warning' :
              quality.fixQuality === 'dgps' ? 'warning' : 'fail',
      description: 'RTK Fixed is required for cadastral surveys. RTK Float and DGPS are acceptable for topographic only.',
    },
    {
      metric: 'PDOP',
      value: quality.pdop > 0 ? quality.pdop.toFixed(2) : 'N/A',
      threshold: '< 4.0 (good), < 2.0 (excellent)',
      status: quality.pdop === 0 ? 'warning' :
              quality.pdop < 2.0 ? 'pass' :
              quality.pdop < 4.0 ? 'pass' : 'fail',
      description: 'Position Dilution of Precision. Lower is better. >4.0 means poor satellite geometry.',
    },
    {
      metric: 'HDOP',
      value: quality.hdop > 0 ? quality.hdop.toFixed(2) : 'N/A',
      threshold: '< 2.0 (good), < 1.0 (excellent)',
      status: quality.hdop === 0 ? 'warning' :
              quality.hdop < 1.0 ? 'pass' :
              quality.hdop < 2.0 ? 'pass' : 'warning',
      description: 'Horizontal Dilution of Precision. Affects Easting/Northing accuracy.',
    },
    {
      metric: 'VDOP',
      value: quality.vdop > 0 ? quality.vdop.toFixed(2) : 'N/A',
      threshold: '< 3.0 (good), < 2.0 (excellent)',
      status: quality.vdop === 0 ? 'warning' :
              quality.vdop < 2.0 ? 'pass' :
              quality.vdop < 3.0 ? 'pass' : 'warning',
      description: 'Vertical Dilution of Precision. Affects elevation accuracy.',
    },
    {
      metric: 'Satellites',
      value: quality.satellites > 0 ? String(quality.satellites) : 'N/A',
      threshold: '≥ 6 (minimum), ≥ 10 (good), ≥ 15 (excellent)',
      status: quality.satellites === 0 ? 'warning' :
              quality.satellites >= 15 ? 'pass' :
              quality.satellites >= 10 ? 'pass' :
              quality.satellites >= 6 ? 'warning' : 'fail',
      description: 'Number of satellites used in position calculation. More satellites = better geometry.',
    },
    {
      metric: 'Base Distance',
      value: quality.baseDistanceKm != null ? `${quality.baseDistanceKm.toFixed(1)} km` : 'N/A',
      threshold: '< 10 km (optimal), < 30 km (acceptable)',
      status: quality.baseDistanceKm == null ? 'warning' :
              quality.baseDistanceKm < 10 ? 'pass' :
              quality.baseDistanceKm < 30 ? 'pass' : 'warning',
      description: 'Distance to base station. RTK accuracy degrades beyond 30km.',
    },
    {
      metric: 'Correction Age',
      value: quality.correctionAge != null ? `${quality.correctionAge.toFixed(1)}s` : 'N/A',
      threshold: '< 5s (good), < 10s (acceptable)',
      status: quality.correctionAge == null ? 'warning' :
              quality.correctionAge < 5 ? 'pass' :
              quality.correctionAge < 10 ? 'pass' : 'fail',
      description: 'Age of differential correction. Stale corrections indicate connection issues.',
    },
  ] : [], [quality])

  const overallStatus = checks.length > 0
    ? checks.some(c => c.status === 'fail') ? 'fail' :
      checks.some(c => c.status === 'warning') ? 'warning' : 'pass'
    : 'pending'

  const handleExport = useCallback(() => {
    if (!quality) return

    const report = {
      format: 'metardu-gnss-quality-v1',
      exportedAt: new Date().toISOString(),
      overallStatus,
      checks: checks.map(c => ({
        metric: c.metric,
        value: c.value,
        threshold: c.threshold,
        status: c.status,
        description: c.description,
      })),
      rawQuality: {
        fixQuality: quality.fixQuality,
        satellites: quality.satellites,
        pdop: quality.pdop,
        hdop: quality.hdop,
        vdop: quality.vdop,
        baseDistanceKm: quality.baseDistanceKm,
        correctionAge: quality.correctionAge,
        position: {
          latitude: quality.latitude,
          longitude: quality.longitude,
          altitude: quality.altitude,
        },
        timestamp: quality.timestamp.toISOString(),
      },
      history: history.slice(-20).map(h => ({
        timestamp: h.timestamp.toISOString(),
        fixQuality: h.fixQuality,
        hdop: h.hdop,
        satellites: h.satellites,
      })),
    }

    const json = JSON.stringify(report, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gnss-quality-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [quality, checks, overallStatus, history])

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            overallStatus === 'pass' ? 'bg-emerald-500/10' :
            overallStatus === 'warning' ? 'bg-amber-500/10' :
            overallStatus === 'fail' ? 'bg-red-500/10' : 'bg-gray-500/10'
          }`}>
            <Satellite className={`w-4 h-4 ${
              overallStatus === 'pass' ? 'text-emerald-400' :
              overallStatus === 'warning' ? 'text-amber-400' :
              overallStatus === 'fail' ? 'text-red-400' : 'text-gray-400'
            }`} />
          </div>
          <div>
            <span className="text-sm font-semibold text-[var(--text-primary)]">GNSS Quality Report</span>
            <p className="text-[10px] text-gray-500">QA/QC for ArdhiSasa submission compliance</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleExport}
            disabled={!quality}
            className="flex items-center gap-1 px-2 h-7 rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[10px] text-gray-400 hover:text-gray-200 disabled:opacity-30"
          >
            <Download className="w-3 h-3" />
            Export
          </button>
          <button
            onClick={watching ? stopWatch : startWatch}
            className="flex items-center gap-1 px-2 h-7 rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[10px] text-gray-400 hover:text-gray-200"
          >
            <RefreshCw className={`w-3 h-3 ${watching ? 'animate-spin' : ''}`} />
            {watching ? 'Stop' : 'Start'}
          </button>
        </div>
      </div>

      {/* Overall status */}
      {quality && (
        <div className={`px-4 py-2 border-b border-[var(--border-color)] ${
          overallStatus === 'pass' ? 'bg-emerald-500/5' :
          overallStatus === 'warning' ? 'bg-amber-500/5' :
          'bg-red-500/5'
        }`}>
          <div className="flex items-center gap-2">
            {overallStatus === 'pass' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {overallStatus === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
            {overallStatus === 'fail' && <AlertTriangle className="w-4 h-4 text-red-400" />}
            <span className={`text-xs font-semibold ${
              overallStatus === 'pass' ? 'text-emerald-400' :
              overallStatus === 'warning' ? 'text-amber-400' : 'text-red-400'
            }`}>
              {overallStatus === 'pass' ? 'ACCEPTABLE FOR SUBMISSION' :
               overallStatus === 'warning' ? 'ACCEPTABLE WITH CAUTION' :
               'NOT ACCEPTABLE — FIX BEFORE SUBMISSION'}
            </span>
          </div>
        </div>
      )}

      {/* Checks list */}
      <div className="p-4 space-y-2">
        {!quality ? (
          <div className="flex flex-col items-center py-6">
            <Activity className="w-8 h-8 text-gray-600 mb-2" />
            <p className="text-xs text-gray-500">Waiting for GNSS data...</p>
          </div>
        ) : (
          checks.map((check, i) => (
            <div
              key={`${check}-${i}`}
              className={`flex items-start gap-3 p-2.5 rounded-lg border ${
                check.status === 'pass' ? 'bg-emerald-500/5 border-emerald-500/20' :
                check.status === 'warning' ? 'bg-amber-500/5 border-amber-500/20' :
                'bg-red-500/5 border-red-500/20'
              }`}
            >
              <div className={`shrink-0 w-5 h-5 rounded flex items-center justify-center ${
                check.status === 'pass' ? 'bg-emerald-500/10' :
                check.status === 'warning' ? 'bg-amber-500/10' :
                'bg-red-500/10'
              }`}>
                {check.status === 'pass' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> :
                 <AlertTriangle className={`w-3 h-3 ${check.status === 'warning' ? 'text-amber-400' : 'text-red-400'}`} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[var(--text-primary)]">{check.metric}</span>
                  <span className={`text-[11px] font-mono font-bold ${
                    check.status === 'pass' ? 'text-emerald-400' :
                    check.status === 'warning' ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {check.value}
                  </span>
                </div>
                <p className="text-[9px] text-gray-500 mt-0.5">Threshold: {check.threshold}</p>
                <p className="text-[9px] text-gray-600 mt-0.5">{check.description}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Live position */}
      {quality && (
        <div className="px-4 py-2 border-t border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div>
              <span className="text-gray-600">Lat:</span>
              <span className="text-gray-300 font-mono ml-1">{quality.latitude.toFixed(8)}</span>
            </div>
            <div>
              <span className="text-gray-600">Lng:</span>
              <span className="text-gray-300 font-mono ml-1">{quality.longitude.toFixed(8)}</span>
            </div>
            <div>
              <span className="text-gray-600">Alt:</span>
              <span className="text-gray-300 font-mono ml-1">{quality.altitude.toFixed(2)}m</span>
            </div>
          </div>
          <div className="text-[8px] text-gray-600 mt-1">
            Updated: {quality.timestamp.toLocaleTimeString()} · History: {history.length} readings
          </div>
        </div>
      )}
    </div>
  )
}
