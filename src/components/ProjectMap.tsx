'use client'

import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { distanceBearing } from '@/lib/engine/distance'
import { bearingToString } from '@/lib/engine/angles'

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export interface SurveyPoint {
  id?: string
  name: string
  easting: number
  northing: number
  elevation?: number
  is_control?: boolean
  lat?: number
  lon?: number
}

type MapMode = 'idle' | 'distance' | 'area' | 'traverse'

interface ProjectMapProps {
  points: SurveyPoint[]
  utmZone: number
  hemisphere: 'N' | 'S'
  onMapClick?: (lat: number, lon: number) => void
  mode?: MapMode
  onModeChange?: (mode: MapMode) => void
  onAreaPointsUpdate?: (points: SurveyPoint[]) => void
  areaPoints?: SurveyPoint[]
}

const amberIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-amber.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

const selectedIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

const areaIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

function UTMToLatLon(easting: number, northing: number, zone: number, hemisphere: 'N' | 'S'): { lat: number; lon: number } {
  const k0 = 0.9996
  const WGS84_A = 6378137.0
  const WGS84_F = 1 / 298.257223563
  const WGS84_E2 = 2 * WGS84_F - WGS84_F * WGS84_F
  const e1 = (1 - Math.sqrt(1 - WGS84_E2)) / (1 + Math.sqrt(1 - WGS84_E2))
  
  let y = northing
  if (hemisphere === 'S') {
    y -= 10000000
  }
  
  const lonOrigin = (zone - 1) * 6 - 180 + 3
  const lonOriginRad = lonOrigin * Math.PI / 180
  
  const M = y / k0
  const mu = M / (WGS84_A * (1 - WGS84_E2 / 4 - 3 * WGS84_E2 * WGS84_E2 / 64))
  
  const phi1 = mu + (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32) * Math.sin(2 * mu)
             + (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32) * Math.sin(4 * mu)
             + (151 * e1 * e1 * e1 / 96) * Math.sin(6 * mu)
  
  const N1 = WGS84_A / Math.sqrt(1 - WGS84_E2 * Math.sin(phi1) * Math.sin(phi1))
  const T1 = Math.tan(phi1) * Math.tan(phi1)
  const C1 = (WGS84_E2 / (1 - WGS84_E2)) * Math.cos(phi1) * Math.cos(phi1)
  const R1 = WGS84_A * (1 - WGS84_E2) / Math.pow(1 - WGS84_E2 * Math.sin(phi1) * Math.sin(phi1), 1.5)
  const D = (easting - 500000) / (N1 * k0)
  
  let lat = phi1 - (N1 * Math.tan(phi1) / R1) * (D * D / 2
             - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * WGS84_E2 / (1 - WGS84_E2)) * D * D * D * D / 24
             + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * WGS84_E2 / (1 - WGS84_E2) - 3 * C1 * C1) * D * D * D * D * D * D / 720)
  
  let lon = (lonOriginRad) + (D - (1 + 2 * T1 + C1) * D * D * D / 6
             + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * WGS84_E2 / (1 - WGS84_E2) + 24 * T1 * T1) * D * D * D * D * D / 120) / Math.cos(phi1)
  
  return {
    lat: Math.round(lat * 180 / Math.PI * 10000000) / 10000000,
    lon: Math.round(lon * 180 / Math.PI * 10000000) / 10000000
  }
}

function MapClickHandler({ onClick }: { onClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click: (e) => {
      onClick(e.latlng.lat, e.latlng.lng)
    }
  })
  return null
}

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, map.getZoom())
  }, [center, map])
  return null
}

function FlyToPoints({ points, utmZone, hemisphere }: { points: SurveyPoint[]; utmZone: number; hemisphere: 'N' | 'S' }) {
  const map = useMap()
  const prevPointsLength = useRef(0)
  
  useEffect(() => {
    if (points.length === 0) return
    
    if (points.length > prevPointsLength.current && points.length > 0) {
      const lastPoint = points[points.length - 1]
      const converted = UTMToLatLon(lastPoint.easting, lastPoint.northing, utmZone, hemisphere)
      map.flyTo([converted.lat, converted.lon], 16, { duration: 1 })
    } else if (points.length > 1 && prevPointsLength.current === 0) {
      const bounds = L.latLngBounds(
        points.map(p => {
          const converted = UTMToLatLon(p.easting, p.northing, utmZone, hemisphere)
          return [converted.lat, converted.lon] as [number, number]
        })
      )
      map.fitBounds(bounds, { padding: [50, 50] })
    }
    
    prevPointsLength.current = points.length
  }, [points, map, utmZone, hemisphere])
  
  return null
}

export default function ProjectMap({ 
  points, 
  utmZone, 
  hemisphere, 
  onMapClick, 
  mode = 'idle',
  onModeChange,
  onAreaPointsUpdate,
  areaPoints = []
}: ProjectMapProps) {
  const getDefaultCenter = (): [number, number] => {
    if (utmZone === 37 && hemisphere === 'S') {
      return [-1.2921, 36.8219]
    }
    return [0, 0]
  }

  const [center, setCenter] = useState<[number, number]>(getDefaultCenter())
  const [distancePoints, setDistancePoints] = useState<SurveyPoint[]>([])
  const [localAreaPoints, setLocalAreaPoints] = useState<SurveyPoint[]>(areaPoints)

  // Sync area points from props
  useEffect(() => {
    setLocalAreaPoints(areaPoints)
  }, [areaPoints])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onModeChange?.('idle')
      }
      if (e.key === 'd' || e.key === 'D') {
        onModeChange?.('distance')
      }
      if (e.key === 'a' || e.key === 'A') {
        onModeChange?.('area')
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onModeChange])

  const markers = points.map(point => {
    let lat = point.lat
    let lon = point.lon
    
    if (!lat || !lon) {
      const converted = UTMToLatLon(point.easting, point.northing, utmZone, hemisphere)
      lat = converted.lat
      lon = converted.lon
    }
    
    return {
      ...point,
      lat,
      lon
    }
  }).filter(p => p.lat !== undefined && p.lon !== undefined)

  const handleMapClick = (lat: number, lon: number) => {
    if (mode === 'idle' && onMapClick) {
      onMapClick(lat, lon)
    }
  }

  const handleMarkerClick = (point: SurveyPoint) => {
    if (mode === 'distance') {
      // Prevent selecting same point twice
      if (distancePoints.length > 0 && distancePoints[0].id === point.id) {
        return
      }
      setDistancePoints(prev => {
        if (prev.length >= 2) {
          return [prev[1], point]
        }
        return [...prev, point]
      })
    } else if (mode === 'area') {
      // Check if clicking first point to close polygon
      if (localAreaPoints.length >= 3 && localAreaPoints[0].id === point.id) {
        // Polygon closed - don't add, let parent handle calculation
        return
      }
      // Prevent clicking same point twice in a row
      if (localAreaPoints.length > 0 && localAreaPoints[localAreaPoints.length - 1].id === point.id) {
        return
      }
      // Prevent adding duplicate points
      if (localAreaPoints.some(p => p.id === point.id)) {
        return
      }
      const newPoints = [...localAreaPoints, point]
      setLocalAreaPoints(newPoints)
      onAreaPointsUpdate?.(newPoints)
    }
  }

  const clearDistanceSelection = () => {
    setDistancePoints([])
  }

  const clearAreaSelection = () => {
    setLocalAreaPoints([])
    onAreaPointsUpdate?.([])
  }

  // Calculate distance/bearing between selected points
  let distanceInfo: { distance: number; bearing: string; backBearing: string; deltaE: number; deltaN: number } | null = null
  if (distancePoints.length === 2) {
    const result = distanceBearing(
      { easting: distancePoints[0].easting, northing: distancePoints[0].northing },
      { easting: distancePoints[1].easting, northing: distancePoints[1].northing }
    )
    const backBearing = (result.bearing + 180) % 360
    distanceInfo = {
      distance: result.distance,
      bearing: bearingToString(result.bearing),
      backBearing: bearingToString(backBearing),
      deltaE: result.deltaE,
      deltaN: result.deltaN
    }
  }

  // Calculate area polygon positions
  const areaLinePositions: [number, number][] = localAreaPoints
    .filter(p => p.lat !== undefined && p.lon !== undefined)
    .map(p => [p.lat!, p.lon!] as [number, number])

  // Build polyline for distance
  const distanceLinePositions: [number, number][] = distancePoints.length === 2
    ? [[distancePoints[0].lat!, distancePoints[0].lon!], [distancePoints[1].lat!, distancePoints[1].lon!]]
    : []

  const getModeLabel = () => {
    if (mode === 'distance') return 'Distance Mode — click two points'
    if (mode === 'area') {
      if (localAreaPoints.length < 3) {
        return `${localAreaPoints.length} point${localAreaPoints.length !== 1 ? 's' : ''} selected — need ${3 - localAreaPoints.length} more`
      }
      return `${localAreaPoints.length} points — click first point to close`
    }
    return ''
  }

  return (
    <div className="relative">
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: '500px', width: '100%', borderRadius: '8px' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CartoDB</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <MapClickHandler onClick={handleMapClick} />
        <RecenterMap center={center} />
        <FlyToPoints points={markers} utmZone={utmZone} hemisphere={hemisphere} />
        
        {/* Distance polyline */}
        {distanceLinePositions.length === 2 && (
          <Polyline positions={distanceLinePositions} color="#E8841A" weight={3} dashArray="5, 10" />
        )}
        
        {/* Area polyline */}
        {areaLinePositions.length > 1 && (
          <Polyline positions={areaLinePositions} color="#8B5CF6" weight={3} />
        )}
        
        {markers.map((point, idx) => {
          const isDistanceSelected = distancePoints.some(s => s.id === point.id)
          const isAreaSelected = localAreaPoints.some(d => d.id === point.id)
          const isAreaFirst = localAreaPoints.length > 0 && localAreaPoints[0].id === point.id
          
          let icon = point.is_control ? redIcon : amberIcon
          if (isDistanceSelected) icon = selectedIcon
          if (isAreaSelected || isAreaFirst) icon = areaIcon
          
          return (
            <Marker
              key={point.id || idx}
              position={[point.lat!, point.lon!]}
              icon={icon}
              eventHandlers={{
                click: () => handleMarkerClick(point)
              }}
            >
              <Tooltip permanent direction="top" offset={[0, -10]} className="font-mono text-xs">
                {point.name}
              </Tooltip>
              <Popup>
                <div className="text-sm">
                  <strong className="text-gray-900">{point.name}</strong>
                  <br />
                  <span className="text-gray-600">E: {point.easting.toFixed(4)}</span>
                  <br />
                  <span className="text-gray-600">N: {point.northing.toFixed(4)}</span>
                  {point.elevation !== undefined && (
                    <>
                      <br />
                      <span className="text-gray-600">Elev: {point.elevation.toFixed(3)}</span>
                    </>
                  )}
                  {point.is_control && (
                    <span className="text-red-600 font-semibold"> (Control Point)</span>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      {/* Mode indicator */}
      {mode !== 'idle' && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-gray-900/95 border border-[#E8841A] rounded-lg px-4 py-2">
          <span className="text-sm text-[#E8841A] font-semibold">{getModeLabel()}</span>
          <span className="text-xs text-gray-500 ml-2">(Esc to cancel)</span>
        </div>
      )}

      {/* Distance info panel */}
      {distanceInfo && (
        <div className="absolute top-4 right-4 z-[1000] bg-gray-900/95 border border-gray-700 rounded-lg p-3 shadow-lg min-w-[220px]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-gray-100">
              {distancePoints[0]?.name} → {distancePoints[1]?.name}
            </span>
            <button onClick={clearDistanceSelection} className="text-gray-400 hover:text-white text-lg">×</button>
          </div>
          <div className="space-y-1 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-gray-400">Distance:</span>
              <span className="text-[#E8841A]">{distanceInfo.distance.toFixed(4)} m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Bearing:</span>
              <span className="text-gray-100">{distanceInfo.bearing}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Back Bearing:</span>
              <span className="text-gray-300">{distanceInfo.backBearing}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">ΔE:</span>
              <span className={distanceInfo.deltaE >= 0 ? 'text-green-400' : 'text-red-400'}>
                {distanceInfo.deltaE.toFixed(4)} m
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">ΔN:</span>
              <span className={distanceInfo.deltaN >= 0 ? 'text-green-400' : 'text-red-400'}>
                {distanceInfo.deltaN.toFixed(4)} m
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Area info panel */}
      {mode === 'area' && localAreaPoints.length > 0 && (
        <div className="absolute top-4 left-4 z-[1000] bg-gray-900/95 border border-purple-500 rounded-lg p-3 shadow-lg min-w-[200px]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-purple-400">Area Selection</span>
            <button onClick={clearAreaSelection} className="text-gray-400 hover:text-white text-lg">×</button>
          </div>
          <div className="space-y-1 text-xs">
            {localAreaPoints.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-600 text-black text-xs flex items-center justify-center font-bold">{i + 1}</span>
                <span className="font-mono text-gray-100">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
