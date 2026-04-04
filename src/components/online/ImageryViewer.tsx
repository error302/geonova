'use client'

import { useState } from 'react'
import { getImageryLayers, getImageryMetadata } from '@/lib/online/satellite'

export default function ImageryViewer() {
  const [selectedLayer, setSelectedLayer] = useState('sentinelRecent')
  const [centerLat, setCenterLat] = useState('-1.2921')
  const [centerLon, setCenterLon] = useState('36.8219')
  const [zoom, setZoom] = useState('14')

  const layers = getImageryLayers()
  const metadata = getImageryMetadata(selectedLayer)

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Center Latitude</label>
          <input
            type="text"
            value={centerLat}
            onChange={e => setCenterLat(e.target.value)}
            placeholder="-1.2921"
            className="w-full p-2 border rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Center Longitude</label>
          <input
            type="text"
            value={centerLon}
            onChange={e => setCenterLon(e.target.value)}
            placeholder="36.8219"
            className="w-full p-2 border rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Zoom Level</label>
          <select
            value={zoom}
            onChange={e => setZoom(e.target.value)}
            className="w-full p-2 border rounded-lg"
          >
            <option value="10">10 (Region)</option>
            <option value="12">12 (District)</option>
            <option value="14">14 (Neighborhood)</option>
            <option value="16">16 (Street)</option>
            <option value="18">18 (Parcel)</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Imagery Layer</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {layers.map((layer: any) => (
            <button
              key={layer.id}
              onClick={() => setSelectedLayer(layer.id)}
              className={`p-2 text-sm rounded-lg border transition ${
                selectedLayer === layer.id
                  ? 'bg-sky-600 text-white border-sky-600'
                  : 'bg-[var(--bg-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              {layer.name}
            </button>
          ))}
        </div>
      </div>

      {metadata && (
        <div className="p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)]">
          <h4 className="font-medium mb-2">Layer Information</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-[var(--text-muted)]">Provider:</span>
              <p className="font-medium">{metadata.provider}</p>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Resolution:</span>
              <p className="font-medium">{metadata.resolution}</p>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Update:</span>
              <p className="font-medium">{metadata.updateFrequency}</p>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Coverage:</span>
              <p className="font-medium">{metadata.coverage}</p>
            </div>
          </div>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden" style={{ height: '400px', backgroundColor: '#1a1a2e' }}>
        <div className="h-full flex items-center justify-center text-[var(--text-muted)]">
          <div className="text-center">
            <p className="text-lg font-medium mb-2">Map Preview</p>
            <p className="text-sm">Lat: {centerLat}, Lon: {centerLon}</p>
            <p className="text-sm">Zoom: {zoom}</p>
            <p className="text-sm mt-2">{layers.find((l: any) => l.id === selectedLayer)?.name}</p>
            <p className="text-xs mt-4 text-[var(--text-muted)]">
              Integrate with Leaflet or Mapbox for interactive map
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button className="flex-1 bg-sky-600 text-white py-2 px-4 rounded-lg hover:bg-sky-700 transition">
          Open in Full Screen
        </button>
        <button className="flex-1 bg-[var(--bg-secondary)] text-[var(--text-primary)] py-2 px-4 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] transition">
          Export View
        </button>
      </div>
    </div>
  )
}
