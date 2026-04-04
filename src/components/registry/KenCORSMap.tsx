'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Copy, ExternalLink, MapPin, Wifi, WifiOff, AlertTriangle } from 'lucide-react'
import type { KenCORSStation } from '@/types/kencors'

const MapContainer = dynamic(
  () => import('react-leaflet').then(mod => mod.MapContainer),
  { ssr: false }
)
const TileLayer = dynamic(
  () => import('react-leaflet').then(mod => mod.TileLayer),
  { ssr: false }
)
const Marker = dynamic(
  () => import('react-leaflet').then(mod => mod.Marker),
  { ssr: false }
)
const Popup = dynamic(
  () => import('react-leaflet').then(mod => mod.Popup),
  { ssr: false }
)

const statusColors: Record<KenCORSStation['status'], string> = {
  ONLINE: 'bg-green-500',
  DEGRADED: 'bg-yellow-500',
  OFFLINE: 'bg-red-500'
}

const statusLabels: Record<KenCORSStation['status'], string> = {
  ONLINE: 'ONLINE',
  DEGRADED: 'DEGRADED',
  OFFLINE: 'OFFLINE'
}

export default function KenCORSMap() {
  const [stations, setStations] = useState<KenCORSStation[]>([])
  const [selectedStation, setSelectedStation] = useState<KenCORSStation | null>(null)
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLon, setUserLon] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/kencors/stations')
      .then(res => res.json())
      .then(data => setStations(data.stations || []))
      .catch(console.error)
      .finally(() => setLoading(false))

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setUserLat(pos.coords.latitude)
          setUserLon(pos.coords.longitude)
        },
        () => {}
      )
    }
  }, [])

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  const copySettings = () => {
    if (!selectedStation) return
    const mp = selectedStation.mountPoints[0]
    const settings = `NTRIP Caster: ntrip.kencors.go.ke
Port: 2101
Mount Point: ${mp.name}
Format: ${mp.format}
Username: [your KenCORS username]
Password: [your KenCORS password]`

    navigator.clipboard.writeText(settings)
  }

  const onlineCount = stations.filter(s => s.status === 'ONLINE').length
  const degradedCount = stations.filter(s => s.status === 'DEGRADED').length
  const offlineCount = stations.filter(s => s.status === 'OFFLINE').length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-green-600" />
            <span className="text-2xl font-bold text-green-800">{onlineCount}</span>
          </div>
          <p className="text-sm text-green-700">Online</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <span className="text-2xl font-bold text-yellow-800">{degradedCount}</span>
          </div>
          <p className="text-sm text-yellow-700">Degraded</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <div className="flex items-center gap-2">
            <WifiOff className="w-5 h-5 text-red-600" />
            <span className="text-2xl font-bold text-red-800">{offlineCount}</span>
          </div>
          <p className="text-sm text-red-700">Offline</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-gray-600" />
            <span className="text-2xl font-bold text-gray-800">{stations.length}</span>
          </div>
          <p className="text-sm text-gray-700">Total Stations</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 border rounded-xl overflow-hidden" style={{ height: '400px' }}>
          {loading ? (
            <div className="h-full flex items-center justify-center bg-gray-100">
              <p className="text-[var(--text-muted)]">Loading stations...</p>
            </div>
          ) : (
            <MapContainer
              center={[-1.0, 38.0]}
              zoom={6}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="© OpenStreetMap"
              />
              {stations.map(station => (
                <Marker
                  key={station.id}
                  position={[station.latitude, station.longitude]}
                >
                  <Popup>
                    <div className="p-2">
                      <h3 className="font-semibold">{station.name}</h3>
                      <p className="text-sm">{station.county}</p>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                        station.status === 'ONLINE' ? 'bg-green-100 text-green-800' :
                        station.status === 'DEGRADED' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {station.status}
                      </span>
                      {userLat !== null && userLon !== null && (
                        <p className="text-xs mt-2">
                          Distance: {calculateDistance(
                            userLat, userLon, station.latitude, station.longitude
                          ).toFixed(1)} km
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold">Stations</h3>
          {stations.map(station => (
            <button
              key={station.id}
              onClick={() => setSelectedStation(station)}
              className={`w-full p-3 rounded-lg border text-left transition ${
                selectedStation?.id === station.id
                  ? 'border-sky-500 bg-sky-50'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{station.name}</p>
                  <p className="text-sm text-[var(--text-muted)]">{station.county}</p>
                </div>
                <span
                  className={`w-2 h-2 rounded-full ${statusColors[station.status]}`}
                  title={statusLabels[station.status]}
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedStation && (
        <div className="bg-gray-50 border rounded-xl p-6">
          <h3 className="font-semibold text-lg mb-4">KenCORS RTK Connection Settings</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div>
                <p className="text-sm text-[var(--text-muted)]">NTRIP Caster</p>
                <p className="font-mono font-medium">ntrip.kencors.go.ke</p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">Port</p>
                <p className="font-mono font-medium">2101</p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">Mount Point</p>
                <p className="font-mono font-medium">{selectedStation.mountPoints[0]?.name}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">Format</p>
                <p className="font-mono font-medium">{selectedStation.mountPoints[0]?.format}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-[var(--text-muted)]">Navigation System</p>
                <p className="font-medium">{selectedStation.mountPoints[0]?.navSystem}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">Expected Accuracy</p>
                <p className="font-medium">±10mm horizontal, ±20mm vertical</p>
              </div>
              <div className="pt-4">
                <p className="text-xs text-[var(--text-muted)] italic">
                  KenCORS credentials obtained from Survey of Kenya.
                  Cite: Survey Act Cap 299 s.9 — national control
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={copySettings}
              className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
            >
              <Copy className="w-4 h-4" />
              Copy Settings
            </button>
            <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-100">
              <ExternalLink className="w-4 h-4" />
              Open in GNSS App
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
