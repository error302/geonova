'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

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

interface ProjectMapProps {
  points: SurveyPoint[]
  utmZone: number
  hemisphere: 'N' | 'S'
  onMapClick?: (lat: number, lon: number) => void
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

export default function ProjectMap({ points, utmZone, hemisphere, onMapClick }: ProjectMapProps) {
  // Default center based on UTM zone (Kenya center for zone 37S)
  const getDefaultCenter = (): [number, number] => {
    if (utmZone === 37 && hemisphere === 'S') {
      return [-1.2921, 36.8219] // Kenya
    }
    // Default to a reasonable location
    return [0, 0]
  }

  const [center, setCenter] = useState<[number, number]>(getDefaultCenter())

  // Convert points to lat/lon for markers
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
    if (onMapClick) {
      onMapClick(lat, lon)
    }
  }

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: '500px', width: '100%', borderRadius: '8px' }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapClickHandler onClick={handleMapClick} />
      <RecenterMap center={center} />
      
      {markers.map((point, idx) => (
        <Marker
          key={point.id || idx}
          position={[point.lat!, point.lon!]}
          icon={point.is_control ? redIcon : amberIcon}
        >
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
      ))}
    </MapContainer>
  )
}
