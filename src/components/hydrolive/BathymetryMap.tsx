'use client'

import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet'
import type { SoundingPoint } from '@/types/bathymetry'
import 'leaflet/dist/leaflet.css'

interface BathymetryMapProps {
  soundings: SoundingPoint[]
  height?: string
}

function getDepthColor(depth: number, minDepth: number, maxDepth: number): string {
  const normalized = (depth - minDepth) / (maxDepth - minDepth)
  if (normalized < 0.25) return '#1e40af'
  if (normalized < 0.5) return '#3b82f6'
  if (normalized < 0.75) return '#60a5fa'
  return '#93c5fd'
}

function FitBounds({ soundings }: { soundings: SoundingPoint[] }) {
  const map = useMap()
  
  useEffect(() => {
    if (soundings.length === 0) return
    
    const bounds = soundings.map((s: any) => [s.northing, s.easting] as [number, number])
    map.fitBounds(bounds, { padding: [50, 50] })
  }, [soundings, map])
  
  return null
}

export default function BathymetryMap({ soundings, height = '400px' }: BathymetryMapProps) {
  const minDepth = useMemo(() => Math.min(...soundings.map((s: any) => s.depth)), [soundings])
  const maxDepth = useMemo(() => Math.max(...soundings.map((s: any) => s.depth)), [soundings])
  
  const center: [number, number] = useMemo(() => {
    if (soundings.length === 0) return [0, 0]
    return [
      soundings.reduce((sum, s) => sum + s.northing, 0) / soundings.length,
      soundings.reduce((sum, s) => sum + s.easting, 0) / soundings.length
    ]
  }, [soundings])
  
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
      <FitBounds soundings={soundings} />
      {soundings.map((point) => (
        <CircleMarker
          key={point.id}
          center={[point.northing, point.easting]}
          radius={6}
          pathOptions={{
            fillColor: getDepthColor(point.depth, minDepth, maxDepth),
            fillOpacity: 0.8,
            color: '#fff',
            weight: 1
          }}
        >
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
