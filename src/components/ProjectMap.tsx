'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, Polygon, useMapEvents, useMap, LayersControl } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { distanceBearing } from '@/lib/engine/distance'
import { bearingToString } from '@/lib/engine/angles'
import { utmToGeographic } from '@/lib/engine/coordinates'
import { testConnection } from '@/lib/supabase/client'

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
  control_order?: string
  locked?: boolean
  lat?: number
  lon?: number
}

type MapMode = 'idle' | 'distance' | 'area' | 'traverse'

interface ProjectMapProps {
  points: SurveyPoint[]
  parcels?: Array<{
    id: string
    name: string | null
    boundary_points: Array<{ easting: number; northing: number }>
  }>
  draftParcelBoundary?: Array<{ easting: number; northing: number }> | null
  height?: string
  selectedPointId?: string | null
  onSelectPoint?: (point: SurveyPoint) => void
  utmZone: number
  hemisphere: 'N' | 'S'
  onMapClick?: (lat: number, lon: number) => void
  mode?: MapMode
  onModeChange?: (mode: MapMode) => void
  onAreaPointsUpdate?: (points: SurveyPoint[]) => void
  areaPoints?: SurveyPoint[]
  onDeletePoint?: (point: SurveyPoint) => void
  onEditPoint?: (point: SurveyPoint) => void
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

const orangeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

const yellowIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

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
      const converted = utmToGeographic(lastPoint.easting, lastPoint.northing, utmZone, hemisphere)
      map.flyTo([converted.lat, converted.lon], 16, { duration: 1 })
    } else if (points.length > 1 && prevPointsLength.current === 0) {
      const bounds = L.latLngBounds(
        points.map(p => {
          const converted = utmToGeographic(p.easting, p.northing, utmZone, hemisphere)
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
  parcels = [],
  draftParcelBoundary = null,
  height = '500px',
  selectedPointId = null,
  onSelectPoint,
  utmZone, 
  hemisphere, 
  onMapClick, 
  mode = 'idle',
  onModeChange,
  onAreaPointsUpdate,
  areaPoints = [],
  onDeletePoint,
  onEditPoint
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

  // Test Supabase connection on mount
  useEffect(() => {
    testConnection()
  }, [])

  // Sync area points from props
  useEffect(() => {
    setLocalAreaPoints(areaPoints)
  }, [areaPoints])

  const uniquePoints = useMemo(() => {
    const seen = new Set<string>()
    const out: SurveyPoint[] = []
    for (const p of points) {
      // Dedupe by survey meaning (name + coordinates + control flags), not by DB id.
      // This prevents UI duplicate markers when a point is accidentally inserted twice with different ids.
      const key = `${p.name}|${p.easting}|${p.northing}|${p.elevation ?? ''}|${p.is_control ? 'c' : 'p'}|${p.control_order ?? ''}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(p)
    }
    return out
  }, [points])

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

  const markers = useMemo(() => {
    return uniquePoints
      .map((point) => {
        let lat = point.lat
        let lon = point.lon

        if (lat === undefined || lon === undefined) {
          const result = utmToGeographic(Number(point.easting), Number(point.northing), Number(utmZone), hemisphere as 'N' | 'S')
          lat = result.lat
          lon = result.lon
        }

        return { ...point, lat, lon }
      })
      .filter((p) => p.lat !== undefined && p.lon !== undefined)
  }, [uniquePoints, utmZone, hemisphere])

  const handleMapClick = (lat: number, lon: number) => {
    if (mode === 'idle' && onMapClick) {
      // Pass lat/lon directly - parent will convert to UTM if needed
      onMapClick(lat, lon)
    }
  }

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; point: SurveyPoint } | null>(null)

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
    } else {
      onSelectPoint?.(point)
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

  const parcelPolygons = useMemo(() => {
    const out: Array<{ id: string; name: string | null; positions: [number, number][] }> = []
    for (const parcel of parcels) {
      const raw = Array.isArray((parcel as any).boundary_points) ? (parcel as any).boundary_points : []
      if (raw.length < 3) continue
      const positions: [number, number][] = raw
        .map((p: any) => {
          const { lat, lon } = utmToGeographic(Number(p.easting), Number(p.northing), Number(utmZone), hemisphere as 'N' | 'S')
          return [lat, lon] as [number, number]
        })
        .filter((x: any) => Number.isFinite(x[0]) && Number.isFinite(x[1]))
      if (positions.length >= 3) out.push({ id: parcel.id, name: parcel.name ?? null, positions })
    }
    return out
  }, [parcels, utmZone, hemisphere])

  const draftParcelPositions = useMemo(() => {
    const raw = Array.isArray(draftParcelBoundary) ? draftParcelBoundary : []
    if (raw.length < 2) return null
    const positions: [number, number][] = raw
      .map((p) => {
        const { lat, lon } = utmToGeographic(Number(p.easting), Number(p.northing), Number(utmZone), hemisphere as 'N' | 'S')
        return [lat, lon] as [number, number]
      })
      .filter((x: any) => Number.isFinite(x[0]) && Number.isFinite(x[1]))
    return positions.length >= 2 ? positions : null
  }, [draftParcelBoundary, utmZone, hemisphere])

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
        style={{ height, width: '100%', borderRadius: '8px' }}
        className="z-0"
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Street">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CartoDB</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution='&copy; Esri World Imagery'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Hybrid">
            <TileLayer
              attribution='&copy; Esri'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
            <TileLayer
              attribution='CartoDB Labels'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Topographic">
            <TileLayer
              attribution='&copy; OpenTopoMap'
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        <MapClickHandler onClick={handleMapClick} />
        <RecenterMap center={center} />
        <FlyToPoints points={markers} utmZone={utmZone} hemisphere={hemisphere} />

        {/* Parcel draft (builder) */}
        {draftParcelPositions ? (
          <>
            {draftParcelPositions.length >= 3 ? (
              <Polygon
                positions={draftParcelPositions}
                pathOptions={{ color: '#E8841A', weight: 2, dashArray: '6 6', fillColor: '#E8841A', fillOpacity: 0.08 }}
              >
                <Tooltip sticky>Parcel draft</Tooltip>
              </Polygon>
            ) : (
              <Polyline positions={draftParcelPositions} pathOptions={{ color: '#E8841A', weight: 2, dashArray: '6 6' }} />
            )}
          </>
        ) : null}

        {/* Parcel polygons */}
        {parcelPolygons.map((p) => (
          <Polygon
            key={p.id}
            positions={p.positions}
            pathOptions={{ color: '#22c55e', weight: 2, fillColor: '#22c55e', fillOpacity: 0.12 }}
          >
            <Popup>
              <div className="text-sm">
                <strong className="text-gray-900">{p.name || 'Parcel'}</strong>
                <div className="text-gray-600">{p.positions.length} vertices</div>
              </div>
            </Popup>
          </Polygon>
        ))}
        
        {/* Distance polyline */}
        {distanceLinePositions.length === 2 && (
          <Polyline positions={distanceLinePositions} color="#E8841A" weight={3} dashArray="5, 10" />
        )}
        
        {/* Area polyline */}
        {areaLinePositions.length > 1 && (
          <Polyline positions={areaLinePositions} color="#8B5CF6" weight={3} />
        )}
        
        {/* Marker clustering */}
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={60}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
          iconCreateFunction={(cluster: any) => {
            const count = cluster.getChildCount()
            return L.divIcon({
              html: `<div class="bg-[#E8841A] text-white rounded-full flex items-center justify-center font-bold text-xs" style="width: 30px; height: 30px;">${count}</div>`,
              className: '',
              iconSize: L.point(30, 30)
            })
          }}
        >
          {markers.map((point, idx) => {
            const isDistanceSelected = distancePoints.some(s => s.id === point.id)
            const isAreaSelected = localAreaPoints.some(d => d.id === point.id)
            const isAreaFirst = localAreaPoints.length > 0 && localAreaPoints[0].id === point.id
            const isSelected = !!selectedPointId && point.id === selectedPointId
            
            // Default to amber for survey points
            let icon = amberIcon
            if (point.is_control) {
              // Control points: red (primary), orange (secondary), yellow (temporary)
              if (point.control_order === 'primary') icon = redIcon
              else if (point.control_order === 'secondary') icon = orangeIcon
              else if (point.control_order === 'temporary') icon = yellowIcon
              else icon = redIcon // default to red for generic control points
            }
            if (isDistanceSelected) icon = selectedIcon
            if (isAreaSelected || isAreaFirst) icon = areaIcon
            if (isSelected) icon = selectedIcon
            
            return (
              <Marker
              key={point.id ?? `${point.name}-${point.easting}-${point.northing}-${idx}`}
              position={[point.lat!, point.lon!]}
              icon={icon}
              eventHandlers={{
                click: () => handleMarkerClick(point),
                contextmenu: (e) => {
                  e.originalEvent.preventDefault()
                  setContextMenu({
                    x: e.originalEvent.clientX,
                    y: e.originalEvent.clientY,
                    point
                  })
                }
              }}
            >
              <Tooltip permanent direction="top" offset={[0, -10]} className="font-mono text-xs">
                {point.name}
              </Tooltip>
              <Popup>
                <div className="text-sm">
                  <strong className="text-gray-900">{point.name}</strong>
                  {point.locked && <span className="text-gray-900"> 🔒</span>}
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
                    <span className={`font-semibold ${
                      point.control_order === 'primary' ? 'text-red-600' : 
                      point.control_order === 'secondary' ? 'text-orange-600' : 
                      point.control_order === 'temporary' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {' (' + (point.control_order || 'primary') + ' control)'}
                      {point.locked ? ' 🔒' : ''}
                    </span>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        })}
        </MarkerClusterGroup>
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

      {/* Context menu for right-click */}
      {contextMenu && (
        <>
          <div 
            className="fixed inset-0 z-[1100]"
            onClick={() => setContextMenu(null)}
          />
          <div 
            className="fixed z-[1200] bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-[150px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => {
                onEditPoint?.(contextMenu.point)
                setContextMenu(null)
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-100 hover:bg-gray-700"
            >
              Edit Point
            </button>
            <button
              onClick={() => {
                if (contextMenu.point.locked) return
                onDeletePoint?.(contextMenu.point)
                setContextMenu(null)
              }}
              disabled={!!contextMenu.point.locked}
              title={contextMenu.point.locked ? 'Locked control points cannot be deleted' : 'Delete point'}
              className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete Point
            </button>
          </div>
        </>
      )}
    </div>
  )
}
