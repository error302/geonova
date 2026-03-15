'use client'

import { useEffect, useState, useCallback } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { useTileCache } from '@/lib/offline/tileCache'

interface OfflineTileLayerProps {
  url: string
  attribution?: string
  maxZoom?: number
  minZoom?: number
}

export function OfflineTileLayer({
  url,
  attribution = '&copy; OpenStreetMap contributors',
  maxZoom = 19,
  minZoom = 1
}: OfflineTileLayerProps) {
  const map = useMap()
  const { isOnline, getCachedTile } = useTileCache()
  const [tileLayer, setTileLayer] = useState<L.TileLayer | null>(null)

  useEffect(() => {
    if (!map) return

    const createOfflineLayer = () => {
      const layer = L.tileLayer(url, {
        attribution,
        maxZoom,
        minZoom
      })
      return layer
    }

    if (isOnline) {
      const layer = L.tileLayer(url, {
        attribution,
        maxZoom,
        minZoom,
        crossOrigin: 'anonymous'
      })
      layer.addTo(map)
      setTileLayer(layer)
    } else {
      const offlineUrl = url

      const createTile = function(this: L.TileLayer, coords: L.Coords) {
        const tile = L.DomUtil.create('img', 'leaflet-tile')
        const tileUrl = offlineUrl
          .replace('{z}', coords.z.toString())
          .replace('{x}', coords.x.toString())
          .replace('{y}', coords.y.toString())

        tile.style.width = tile.style.height = '256px'
        tile.alt = ''

        getCachedTile(tileUrl).then(blob => {
          if (blob) {
            tile.src = URL.createObjectURL(blob)
          }
        }).catch(() => {})

        return tile
      }

      const offlineLayer = L.tileLayer('', {
        attribution,
        maxZoom,
        minZoom
      })

      const layerAny = offlineLayer as L.TileLayer & { createTile?: typeof createTile }
      layerAny.createTile = createTile

      offlineLayer.addTo(map)
      setTileLayer(offlineLayer)
    }

    return () => {
      if (tileLayer) {
        map.removeLayer(tileLayer)
      }
    }
  }, [map, url, attribution, maxZoom, minZoom, isOnline, getCachedTile, tileLayer])

  return null
}

export function useOfflineMap() {
  const { isOnline, cacheStats, preCacheArea, clearCache } = useTileCache()

  const downloadArea = useCallback(async (
    bounds: L.LatLngBounds,
    zoomRange: [number, number] = [10, 16]
  ) => {
    return await preCacheArea(
      {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      },
      zoomRange
    )
  }, [preCacheArea])

  return {
    isOnline,
    cacheStats,
    downloadArea,
    clearCache
  }
}

export function OfflineStatus() {
  const { isOnline, cacheStats } = useOfflineMap()

  return (
    <div className="fixed bottom-4 left-4 z-[1000] flex items-center gap-2 bg-black/80 text-white px-3 py-2 rounded-lg text-sm">
      <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
      <span>{isOnline ? 'Online' : 'Offline'}</span>
      {cacheStats.cached > 0 && (
        <span className="text-gray-400">| {cacheStats.cached} tiles</span>
      )}
    </div>
  )
}
