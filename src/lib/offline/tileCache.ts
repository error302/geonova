import { useState, useEffect, useCallback } from 'react'

interface TileCacheStats {
  cached: number
  total: number
  size: number
}

interface BoundingBox {
  north: number
  south: number
  east: number
  west: number
}

const TILE_SIZE = 256
const DEFAULT_ZOOM_RANGE = [1, 18]

export function useTileCache() {
  const [isOnline, setIsOnline] = useState(true)
  const [cacheStats, setCacheStats] = useState<TileCacheStats>({
    cached: 0,
    total: 0,
    size: 0
  })

  useEffect(() => {
    setIsOnline(navigator.onLine)
    
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const getTileIndexDB = useCallback(async () => {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('GeoNovaTileCache', 1)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('tiles')) {
          db.createObjectStore('tiles', { keyPath: 'url' })
        }
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' })
        }
      }
    })
  }, [])

  const cacheTile = useCallback(async (url: string, blob: Blob) => {
    try {
      const db = await getTileIndexDB()
      const tx = db.transaction('tiles', 'readwrite')
      const store = tx.objectStore('tiles')
      
      await new Promise((resolve, reject) => {
        const request = store.put({ url, blob, timestamp: Date.now() })
        request.onsuccess = resolve
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Failed to cache tile:', error)
    }
  }, [getTileIndexDB])

  const getCachedTile = useCallback(async (url: string): Promise<Blob | null> => {
    try {
      const db = await getTileIndexDB()
      const tx = db.transaction('tiles', 'readonly')
      const store = tx.objectStore('tiles')
      
      return new Promise((resolve) => {
        const request = store.get(url)
        request.onsuccess = () => {
          if (request.result) {
            resolve(request.result.blob)
          } else {
            resolve(null)
          }
        }
        request.onerror = () => resolve(null)
      })
    } catch {
      return null
    }
  }, [getTileIndexDB])

  const getTileUrl = useCallback((server: string, z: number, x: number, y: number): string => {
    return server
      .replace('{z}', z.toString())
      .replace('{x}', x.toString())
      .replace('{y}', y.toString())
  }, [])

  const preCacheArea = useCallback(async (
    bounds: BoundingBox,
    zoomRange: number[] = DEFAULT_ZOOM_RANGE,
    tileServers: string[] = [
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    ]
  ) => {
    if (!isOnline) return
    
    const cached: string[] = []
    
    for (let z = zoomRange[0]; z <= zoomRange[1]; z++) {
      const minX = Math.floor((bounds.west + 180) / 360 * Math.pow(2, z))
      const maxX = Math.floor((bounds.east + 180) / 360 * Math.pow(2, z))
      const minY = Math.floor((90 - bounds.north) / 180 * Math.pow(2, z))
      const maxY = Math.floor((90 - bounds.south) / 180 * Math.pow(2, z))
      
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          for (const server of tileServers) {
            const url = getTileUrl(server, z, x, y)
            
            const existing = await getCachedTile(url)
            if (!existing) {
              try {
                const response = await fetch(url, { mode: 'cors' })
                if (response.ok) {
                  const blob = await response.blob()
                  await cacheTile(url, blob)
                  cached.push(url)
                }
              } catch {
                // Skip failed tiles
              }
            }
          }
        }
      }
    }
    
    return cached.length
  }, [isOnline, getTileUrl, getCachedTile, cacheTile])

  const clearCache = useCallback(async () => {
    try {
      const db = await getTileIndexDB()
      const tx = db.transaction('tiles', 'readwrite')
      const store = tx.objectStore('tiles')
      
      await new Promise((resolve, reject) => {
        const request = store.clear()
        request.onsuccess = resolve
        request.onerror = () => reject(request.error)
      })
      
      setCacheStats({ cached: 0, total: 0, size: 0 })
    } catch (error) {
      console.error('Failed to clear cache:', error)
    }
  }, [getTileIndexDB])

  const getCacheSize = useCallback(async () => {
    try {
      const db = await getTileIndexDB()
      const tx = db.transaction('tiles', 'readonly')
      const store = tx.objectStore('tiles')
      
      return new Promise((resolve) => {
        const request = store.count()
        request.onsuccess = () => {
          setCacheStats(prev => ({ ...prev, cached: request.result }))
          resolve(request.result)
        }
        request.onerror = () => resolve(0)
      })
    } catch {
      return 0
    }
  }, [getTileIndexDB])

  useEffect(() => {
    getCacheSize()
  }, [getCacheSize])

  return {
    isOnline,
    cacheStats,
    preCacheArea,
    clearCache,
    getCacheSize,
    getCachedTile,
    cacheTile
  }
}

export function calculateTileBounds(
  north: number,
  south: number,
  east: number,
  west: number,
  zoom: number
): { minX: number; maxX: number; minY: number; maxY: number } {
  const minX = Math.floor((west + 180) / 360 * Math.pow(2, zoom))
  const maxX = Math.floor((east + 180) / 360 * Math.pow(2, zoom))
  const minY = Math.floor((90 - north) / 180 * Math.pow(2, zoom))
  const maxY = Math.floor((90 - south) / 180 * Math.pow(2, zoom))
  
  return { minX, maxX, minY, maxY }
}
