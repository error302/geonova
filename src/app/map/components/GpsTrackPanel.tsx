'use client'
/**
 * GpsTrackPanel — GPS track logging panel
 *
 * Start/Stop GPS track logging. When started, accumulates GPS positions from
 * context. When stopped, creates a LineString feature from the accumulated
 * positions and adds it to the map as a vector layer (orange line, 3px).
 * Shows total track distance and point count.
 */

import React, { memo, useState, useCallback, useRef, useEffect } from 'react'
import { Play, Square, MapPin } from 'lucide-react'
import { useMapContext } from '@/app/map/MapReactContext'
import { logger } from '@/lib/logger'

export const GpsTrackPanel = memo(function GpsTrackPanel() {
  const { mapInstance, gpsPos, gpsTracking } = useMapContext()
  const [isTracking, setIsTracking] = useState(false)
  const [trackPoints, setTrackPoints] = useState<Array<[number, number]>>([])
  const [pointCount, setPointCount] = useState(0)
  const [totalDistance, setTotalDistance] = useState(0)
  const trackLayerRef = useRef<import('ol/layer/Vector').default | null>(null)

  // Accumulate GPS positions when tracking is active
  useEffect(() => {
    if (!isTracking || !gpsPos || !mapInstance.current) return

    // Capture current GPS position for the async closure
    const currentGpsPos = gpsPos
    let cancelled = false

    async function addTrackPoint() {
      if (cancelled) return
      try {
        const { fromLonLat } = await import('ol/proj')
        const coord = fromLonLat([currentGpsPos.lon, currentGpsPos.lat]) as [number, number]

        setTrackPoints((prev) => {
          const updated = [...prev, coord]

          // Calculate distance increment
          if (updated.length >= 2) {
            const last = updated[updated.length - 2]
            const dx = coord[0] - last[0]
            const dy = coord[1] - last[1]
            const dist = Math.sqrt(dx * dx + dy * dy)
            // Convert from meters (EPSG:3857 units at equator) — approximate
            const distMeters = dist * Math.cos((currentGpsPos.lat * Math.PI) / 180)
            setTotalDistance((d) => d + Math.abs(distMeters))
          }

          setPointCount(updated.length)
          return updated
        })
      } catch {
        // Skip this point
      }
    }

    addTrackPoint()
    return () => { cancelled = true }
  }, [isTracking, gpsPos, mapInstance])

  const startTracking = useCallback(() => {
    setTrackPoints([])
    setPointCount(0)
    setTotalDistance(0)
    setIsTracking(true)
  }, [])

  const stopTracking = useCallback(async () => {
    setIsTracking(false)

    if (trackPoints.length < 2 || !mapInstance.current) return

    try {
      const [
        { default: VectorSource },
        { default: VectorLayer },
        { default: LineString },
        { default: Feature },
        { default: Style },
        { default: Stroke },
        { default: GeoJSONFormat },
      ] = await Promise.all([
        import('ol/source/Vector'),
        import('ol/layer/Vector'),
        import('ol/geom/LineString'),
        import('ol/Feature'),
        import('ol/style/Style'),
        import('ol/style/Stroke'),
        import('ol/format/GeoJSON'),
      ])

      const geometry = new LineString(trackPoints)
      const feature = new Feature({ geometry })
      const trackDate = new Date().toISOString()
      feature.set('trackLog', true)
      feature.set('trackDate', trackDate)
      feature.set('trackPointCount', trackPoints.length)

      // Remove previous track layer if it exists
      if (trackLayerRef.current) {
        mapInstance.current.removeLayer(trackLayerRef.current)
      }

      const source = new VectorSource({ features: [feature] })
      const layer = new VectorLayer({
        source,
        style: new Style({
          stroke: new Stroke({
            color: '#D17B47',
            width: 3,
          }),
        }),
        zIndex: 60,
      })

      mapInstance.current.addLayer(layer)
      trackLayerRef.current = layer

      // ── Persist track to localStorage (survives reload) ──
      try {
        const fmt = new GeoJSONFormat()
        const geojson = fmt.writeFeatureObject(feature, {
          featureProjection: 'EPSG:3857',
          dataProjection: 'EPSG:4326',
        })
        const trackKey = `metardu:gps-track:${trackDate}`
        const trackData = {
          date: trackDate,
          pointCount: trackPoints.length,
          geojson,
          totalDistance: totalDistance.toFixed(1),
        }
        // Store in a list of tracks
        const existingTracks = JSON.parse(localStorage.getItem('metardu:gps-tracks') || '[]') as Array<{
          date: string
          pointCount: number
          geojson: unknown
          totalDistance: string
        }>
        existingTracks.push(trackData)
        // Keep last 50 tracks
        if (existingTracks.length > 50) existingTracks.shift()
        localStorage.setItem('metardu:gps-tracks', JSON.stringify(existingTracks))
        localStorage.setItem(trackKey, JSON.stringify(trackData))
      } catch {
        // localStorage might be full — track still visible on map
      }
    } catch (err) {
      logger.error('[GpsTrackPanel] Failed to create track layer:', { error: err })
    }
  }, [trackPoints, mapInstance, totalDistance])

  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`
    }
    return `${meters.toFixed(0)} m`
  }

  return (
    <div className="bg-[color-mix(in_srgb,var(--bg-secondary)_90%,transparent)] backdrop-blur-xl border border-[var(--border-color)]/[0.06] rounded-lg w-56">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">
            GPS Track
          </span>
        </div>
      </div>

      <div className="px-3 pb-3 space-y-2">
        {/* Start/Stop buttons */}
        <div className="flex gap-2">
          {!isTracking ? (
            <button
              onClick={startTracking}
              disabled={!gpsTracking}
              className="flex-1 h-7 flex items-center justify-center gap-1.5 text-[10px] bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] text-[var(--accent)] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] rounded hover:bg-[color-mix(in_srgb,var(--accent)_30%,transparent)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={gpsTracking ? 'Start track logging' : 'Enable GPS first'}
            >
              <Play className="w-3 h-3" />
              Start
            </button>
          ) : (
            <button
              onClick={stopTracking}
              className="flex-1 h-7 flex items-center justify-center gap-1.5 text-[10px] bg-[color-mix(in_srgb,var(--error)_20%,transparent)] text-[var(--error)] border border-red-500/30 rounded hover:bg-[color-mix(in_srgb,var(--error)_30%,transparent)] transition-colors"
              title="Stop track logging and save"
            >
              <Square className="w-3 h-3" />
              Stop &amp; Save
            </button>
          )}
        </div>

        {/* Stats */}
        {isTracking && (
          <div className="flex items-center justify-between px-2 py-1.5 bg-[var(--bg-card)]/[0.03] rounded">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--error)] animate-pulse" />
              <span className="text-[10px] text-[var(--text-secondary)]">Recording</span>
            </div>
            <span className="text-[10px] text-[var(--text-secondary)] font-mono">{pointCount} pts</span>
          </div>
        )}

        {(pointCount > 0 || totalDistance > 0) && (
          <div className="flex items-center justify-between px-2 py-1.5 bg-[var(--bg-card)]/[0.03] rounded">
            <span className="text-[10px] text-[var(--text-secondary)]">Distance</span>
            <span className="text-[10px] text-[var(--text-secondary)] font-mono">{formatDistance(totalDistance)}</span>
          </div>
        )}

        {!gpsTracking && !isTracking && (
          <div className="text-[9px] text-[var(--text-muted)] text-center py-0.5">
            Enable GPS tracking to log tracks
          </div>
        )}
      </div>
    </div>
  )
})
