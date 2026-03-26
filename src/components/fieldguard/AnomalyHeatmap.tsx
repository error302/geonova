'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { CleanedPoint, Anomaly } from '@/types/fieldguard'

interface AnomalyHeatmapProps {
  points: CleanedPoint[]
  anomalies: Anomaly[]
}

export default function AnomalyHeatmap({ points, anomalies }: AnomalyHeatmapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return
    
    mapInstance.current = L.map(mapRef.current).setView([0, 0], 10)
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(mapInstance.current)
    
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [])
  
  useEffect(() => {
    if (!mapInstance.current || points.length === 0) return
    
    const anomalyIds = new Set(anomalies.map(a => a.point_id))
    
    const bounds = L.latLngBounds(
      points.map(p => [p.northing, p.easting] as [number, number])
    )
    mapInstance.current.fitBounds(bounds, { padding: [50, 50] })
    
    points.forEach((pt, i) => {
      const isAnomaly = anomalyIds.has(String(i))
      const color = !pt.cleaned ? '#ef4444' : pt.classification === 'ground' ? '#22c55e' : '#3b82f6'
      
      L.circleMarker([pt.northing, pt.easting], {
        radius: 6,
        fillColor: color,
        fillOpacity: 0.7,
        color: isAnomaly ? '#dc2626' : '#1e40af',
        weight: isAnomaly ? 3 : 1
      })
        .bindPopup(`
          <b>Point ${i}</b><br/>
          E: ${pt.easting.toFixed(3)}<br/>
          N: ${pt.northing.toFixed(3)}<br/>
          RL: ${pt.elevation?.toFixed(3) || 'N/A'}<br/>
          Status: ${pt.cleaned ? 'Clean' : 'Flagged'}<br/>
          Classification: ${pt.classification || 'N/A'}
        `)
        .addTo(mapInstance.current!)
    })
  }, [points, anomalies])
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Anomaly Visualization</h3>
      
      <div className="flex gap-4 mb-4 text-sm">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-500"></span> Ground
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-blue-500"></span> Other
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-red-500"></span> Flagged
        </span>
      </div>
      
      <div ref={mapRef} className="h-96 rounded-lg overflow-hidden" />
    </div>
  )
}