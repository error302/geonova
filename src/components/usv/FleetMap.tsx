'use client'

import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { USVTelemetry, Waypoint } from '@/types/usv'
import 'leaflet/dist/leaflet.css'

interface FleetMapProps {
  usvPositions: USVTelemetry[]
  waypoints?: Waypoint[]
  height?: string
  showPath?: boolean
}

function createUsvIcon(status: 'active' | 'inactive' | 'warning' = 'active') {
  const colors = {
    active: '#10b981',
    inactive: '#6b7280',
    warning: '#f59e0b'
  }
  const color = colors[status]

  return L.divIcon({
    className: 'custom-usv-marker',
    html: `
      <div style="
        width: 24px;
        height: 24px;
        background: ${color};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
          <path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.5L17 8l-5 3.5L7 8l5-3.5zM6 9.5l5 3.5v6.5l-5-3v-7zm12 0v7l-5 3v-6.5l5-3.5z"/>
        </svg>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  })
}

function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap()

  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [bounds, map])

  return null
}

export default function FleetMap({
  usvPositions,
  waypoints = [],
  height = '400px',
  showPath = true
}: FleetMapProps) {
  const bounds = useMemo(() => {
    const points: [number, number][] = []

    usvPositions.forEach((t) => {
      points.push([t.position.lat, t.position.lng])
    })

    waypoints.forEach((wp) => {
      points.push([wp.lat, wp.lng])
    })

    if (points.length === 0) return null
    return L.latLngBounds(points)
  }, [usvPositions, waypoints])

  const center: [number, number] = useMemo(() => {
    if (usvPositions.length === 0 && waypoints.length === 0) {
      return [0, 0]
    }

    if (usvPositions.length > 0) {
      const latest = usvPositions[usvPositions.length - 1]
      return [latest.position.lat, latest.position.lng]
    }

    if (waypoints.length > 0) {
      return [waypoints[0].lat, waypoints[0].lng]
    }

    return [0, 0]
  }, [usvPositions, waypoints])

  const waypointPath: [number, number][] = useMemo(() => {
    return waypoints
      .sort((a, b) => a.order - b.order)
      .map((wp) => [wp.lat, wp.lng])
  }, [waypoints])

  const usvPath: [number, number][] = useMemo(() => {
    return usvPositions
      .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
      .map((t) => [t.position.lat, t.position.lng])
  }, [usvPositions])

  return (
    <MapContainer
      center={center}
      zoom={15}
      style={{ height, width: '100%' }}
      className="rounded-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {bounds && <FitBounds bounds={bounds} />}

      {waypoints.length > 0 && showPath && (
        <Polyline
          positions={waypointPath}
          pathOptions={{ color: '#3b82f6', weight: 2, dashArray: '5, 10' }}
        />
      )}

      {usvPositions.length > 0 && showPath && (
        <Polyline
          positions={usvPath}
          pathOptions={{ color: '#10b981', weight: 3 }}
        />
      )}

      {waypoints.map((wp) => (
        <Marker key={wp.id} position={[wp.lat, wp.lng]}>
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">Waypoint {wp.order}</p>
              <p className="text-xs text-gray-500">
                {wp.lat.toFixed(5)}, {wp.lng.toFixed(5)}
              </p>
              {wp.action && <p className="text-xs">Action: {wp.action}</p>}
            </div>
          </Popup>
        </Marker>
      ))}

      {usvPositions.map((t, idx) => (
        <Marker
          key={`${t.usv_id}-${idx}`}
          position={[t.position.lat, t.position.lng]}
          icon={createUsvIcon(t.battery_percent < 20 ? 'warning' : 'active')}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">USV {t.usv_id}</p>
              <p className="text-xs">
                Speed: {t.speed.toFixed(1)} m/s
              </p>
              <p className="text-xs">
                Heading: {t.heading.toFixed(0)}°
              </p>
              <p className="text-xs">
                Battery: {t.battery_percent}%
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
