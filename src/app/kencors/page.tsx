'use client'

import { useState, useEffect } from 'react'
import { 
  getNetworkStatus, 
  getRTKCorrections, 
  getNearestStations, 
  CORSStation 
} from '@/lib/integrations/kencors'

export default function KencorsPage() {
  const [networkStatus, setNetworkStatus] = useState<any[]>([])
  const [nearestStations, setNearestStations] = useState<CORSStation[]>([])
  const [rtkResult, setRtkResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [selectedNetwork, setSelectedNetwork] = useState<string>('KENTCORS')

  const [gpsInput, setGpsInput] = useState({
    latitude: '-1.2921',
    longitude: '36.8219',
    network: 'KENTCORS'
  })

  useEffect(() => {
    loadNetworkStatus()
  }, [])

  const loadNetworkStatus = async () => {
    const status = await getNetworkStatus()
    setNetworkStatus(status)
  }

  const handleFindStations = async () => {
    setLoading(true)
    try {
      const lat = parseFloat(gpsInput.latitude)
      const lon = parseFloat(gpsInput.longitude)
      const stations = await getNearestStations(lat, lon, 3)
      setNearestStations(stations)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const handleGetRTK = async () => {
    setLoading(true)
    setRtkResult(null)
    try {
      const lat = parseFloat(gpsInput.latitude)
      const lon = parseFloat(gpsInput.longitude)
      const result = await getRTKCorrections({
        latitude: lat,
        longitude: lon,
        network: gpsInput.network as any
      })
      setRtkResult(result)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500'
      case 'offline': return 'bg-red-500'
      case 'maintenance': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">KenCORS RTK Corrections</h1>
        <p className="text-[var(--text-muted)] mb-8">Real-time corrections from Kenya's CORS network</p>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {networkStatus.map(net => (
            <div key={net.network} className="bg-white p-4 rounded-lg shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium">{net.network}</h3>
                <span className={`px-2 py-1 text-xs rounded ${
                  net.online === net.stations ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {net.online}/{net.stations} online
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-sky-600 h-2 rounded-full" 
                  style={{ width: `${(net.online / net.stations) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Get RTK Corrections</h2>
          <div className="grid md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Latitude</label>
              <input
                type="number"
                step="any"
                value={gpsInput.latitude}
                onChange={e => setGpsInput({ ...gpsInput, latitude: e.target.value })}
                className="w-full p-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Longitude</label>
              <input
                type="number"
                step="any"
                value={gpsInput.longitude}
                onChange={e => setGpsInput({ ...gpsInput, longitude: e.target.value })}
                className="w-full p-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Network</label>
              <select
                value={gpsInput.network}
                onChange={e => setGpsInput({ ...gpsInput, network: e.target.value })}
                className="w-full p-2 border rounded-lg"
              >
                <option value="KENTCORS">KENTCORS</option>
                <option value="KEGNSS">KEGNSS</option>
                <option value="TRIFFID">TRIFFID</option>
              </select>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleFindStations}
                disabled={loading}
                className="flex-1 bg-[var(--border-color)] text-white py-2 px-4 rounded-lg hover:bg-[var(--border-hover)] disabled:opacity-50"
              >
                Find Stations
              </button>
              <button
                onClick={handleGetRTK}
                disabled={loading}
                className="flex-1 bg-sky-600 text-white py-2 px-4 rounded-lg hover:bg-sky-700 disabled:opacity-50"
              >
                Get RTK
              </button>
            </div>
          </div>

          {nearestStations.length > 0 && (
            <div className="mt-4">
              <h3 className="font-medium mb-2">Nearest CORS Stations</h3>
              <div className="grid md:grid-cols-3 gap-3">
                {nearestStations.map(station => (
                  <div key={station.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{station.id}</span>
                      <span className={`w-2 h-2 rounded-full ${getStatusColor(station.status)}`} />
                    </div>
                    <p className="text-sm text-[var(--text-muted)]">{station.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{station.location}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {rtkResult && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">RTK Correction Results</h2>
            
            {rtkResult.success ? (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-sky-50 rounded-lg">
                    <h3 className="font-medium text-sky-800">Network</h3>
                    <p className="text-2xl font-bold text-sky-600">{rtkResult.corrections.network}</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h3 className="font-medium text-green-800">Expected Accuracy</h3>
                    <p className="text-2xl font-bold text-green-600">{rtkResult.corrections.approximateAccuracy}</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-3 border rounded-lg">
                    <p className="text-sm text-[var(--text-muted)]">Distance to Base</p>
                    <p className="font-medium">{rtkResult.corrections.distanceToBase} m</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-sm text-[var(--text-muted)]">Data Age</p>
                    <p className="font-medium">{rtkResult.corrections.age} s</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-sm text-[var(--text-muted)]">Ionospheric Condition</p>
                    <p className={`font-medium capitalize ${
                      rtkResult.corrections.ionosphericCondition === 'normal' ? 'text-green-600' :
                      rtkResult.corrections.ionosphericCondition === 'elevated' ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {rtkResult.corrections.ionosphericCondition}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-medium text-blue-800 mb-2">Recommended Solution</h3>
                  <p className="text-blue-700">{rtkResult.corrections.recommendedSolution}</p>
                </div>

                <div>
                  <h3 className="font-medium mb-2">Nearest Stations</h3>
                  <div className="space-y-2">
                    {rtkResult.corrections.nearestStations.map((s: CORSStation) => (
                      <div key={s.id} className="flex justify-between text-sm">
                        <span>{s.name} ({s.id})</span>
                        <span className="text-[var(--text-muted)]">{s.location}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-red-600">{rtkResult.error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
