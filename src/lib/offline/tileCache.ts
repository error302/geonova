import { useState, useEffect, useCallback } from 'react'
import type { MapExtent } from '@/app/map/MapReactContext'

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
      const request = indexedDB.open('METARDUTileCache', 1)
      
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
            resolve((request.result as { blob: Blob }).blob)
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

/** Count the total tiles for a bounding box across a zoom range.
 *  Accepts the shared MapExtent shape (minLat, maxLat, minLon, maxLon). */
export function calculateTileCount(
  bounds: MapExtent,
  minZoom: number,
  maxZoom: number
): { total: number } {
  let total = 0
  for (let z = minZoom; z <= maxZoom; z++) {
    const tileBounds = calculateTileBounds(bounds.maxLat, bounds.minLat, bounds.maxLon, bounds.minLon, z)
    total += (tileBounds.maxX - tileBounds.minX + 1) * (tileBounds.maxY - tileBounds.minY + 1)
  }
  return { total }
}

/** Estimate storage in bytes for a given number of tiles.
 *  The second argument is the source type (string), used to vary average tile size. */
export function estimateStorageSize(tileCount: number, sourceType?: string): number {
  const avgTileBytes = sourceType === 'satellite' ? 40000 : 15000
  return tileCount * avgTileBytes
}

/** Download progress callback type — matches what the UI component expects */
export interface DownloadProgress {
  total: number
  downloaded: number
  skipped: number
  failed: number
  bytesDownloaded: number
  currentZoom: number
  percent: number
}

/** Download tiles for a bounding box range.
 *  Accepts the shared MapExtent shape (minLat, maxLat, minLon, maxLon).
 *  Returns a DownloadProgress-shaped result so callers can feed it directly to setState.
 *
 *  Real implementation: fetches tiles from the tile server, stores as blobs in IndexedDB.
 */
export async function downloadTilesForBounds(
  sourceId: string,
  url: string,
  bounds: MapExtent,
  minZoom: number,
  maxZoom: number,
  _type: string,
  onProgress: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<DownloadProgress> {
  const { total } = calculateTileCount(bounds, minZoom, maxZoom)
  let downloaded = 0
  let skipped = 0
  let failed = 0
  let bytesDownloaded = 0

  // Open IndexedDB
  let db: IDBDatabase
  try {
    db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('METARDUTileCache', 1)
      req.onerror = () => reject(req.error)
      req.onsuccess = () => resolve(req.result)
      req.onupgradeneeded = (event) => {
        const d = (event.target as IDBOpenDBRequest).result
        if (!d.objectStoreNames.contains('tiles')) d.createObjectStore('tiles', { keyPath: 'url' })
        if (!d.objectStoreNames.contains('metadata')) d.createObjectStore('metadata', { keyPath: 'key' })
      }
    })
  } catch {
    return { total, downloaded: 0, skipped: 0, failed: total, bytesDownloaded: 0, currentZoom: minZoom, percent: 0 }
  }

  // Helper: cache a tile
  const cacheTile = async (tileUrl: string, blob: Blob) => {
    return new Promise<void>((resolve) => {
      const tx = db.transaction('tiles', 'readwrite')
      const store = tx.objectStore('tiles')
      const req = store.put({ url: tileUrl, blob, timestamp: Date.now(), sourceId })
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
    })
  }

  // Helper: check if tile is already cached
  const isCached = async (tileUrl: string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const tx = db.transaction('tiles', 'readonly')
      const store = tx.objectStore('tiles')
      const req = store.get(tileUrl)
      req.onsuccess = () => resolve(!!req.result)
      req.onerror = () => resolve(false)
    })
  }

  for (let z = minZoom; z <= maxZoom; z++) {
    const tileBounds = calculateTileBounds(bounds.maxLat, bounds.minLat, bounds.maxLon, bounds.minLon, z)

    for (let x = tileBounds.minX; x <= tileBounds.maxX; x++) {
      for (let y = tileBounds.minY; y <= tileBounds.maxY; y++) {
        if (signal?.aborted) {
          return { total, downloaded, skipped, failed, bytesDownloaded, currentZoom: z, percent: Math.round(((downloaded + skipped) / total) * 100) }
        }

        const tileUrl = url
          .replace('{z}', String(z))
          .replace('{x}', String(x))
          .replace('{y}', String(y))
          .replace('{s}', ['a', 'b', 'c'][Math.abs(x + y) % 3])

        // Check cache first
        if (await isCached(tileUrl)) {
          skipped++
        } else {
          try {
            const response = await fetch(tileUrl, { mode: 'cors', signal })
            if (response.ok) {
              const blob = await response.blob()
              await cacheTile(tileUrl, blob)
              bytesDownloaded += blob.size
              downloaded++
            } else {
              failed++
            }
          } catch {
            failed++
          }
        }

        // Report progress every 10 tiles
        if ((downloaded + skipped + failed) % 10 === 0) {
          onProgress({
            total,
            downloaded,
            skipped,
            failed,
            bytesDownloaded,
            currentZoom: z,
            percent: Math.round(((downloaded + skipped) / total) * 100),
          })
        }
      }
    }
  }

  const finalProgress: DownloadProgress = {
    total,
    downloaded,
    skipped,
    failed,
    bytesDownloaded,
    currentZoom: maxZoom,
    percent: Math.round(((downloaded + skipped) / total) * 100),
  }
  onProgress(finalProgress)
  return finalProgress
}

/** Information about a cached tile source — matches what the UI manager expects */
export interface CachedSourceInfo {
  sourceId: string
  stats: {
    count: number
    sizeBytes: number
    newestTimestamp: number
  }
}

/** List all cached tile sources by scanning IndexedDB */
export async function listCachedSources(): Promise<CachedSourceInfo[]> {
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('METARDUTileCache', 1)
      req.onerror = () => reject(req.error)
      req.onsuccess = () => resolve(req.result)
      req.onupgradeneeded = (event) => {
        const d = (event.target as IDBOpenDBRequest).result
        if (!d.objectStoreNames.contains('tiles')) d.createObjectStore('tiles', { keyPath: 'url' })
        if (!d.objectStoreNames.contains('metadata')) d.createObjectStore('metadata', { keyPath: 'key' })
      }
    })

    return new Promise<CachedSourceInfo[]>((resolve) => {
      const tx = db.transaction('tiles', 'readonly')
      const store = tx.objectStore('tiles')
      const req = store.getAll()

      req.onsuccess = () => {
        const tiles = req.result as Array<{ url: string; blob: Blob; timestamp: number; sourceId?: string }>
        const sourceMap = new Map<string, { count: number; sizeBytes: number; newestTimestamp: number }>()

        for (const tile of tiles) {
          const sid = tile.sourceId || 'unknown'
          const existing = sourceMap.get(sid) || { count: 0, sizeBytes: 0, newestTimestamp: 0 }
          existing.count++
          existing.sizeBytes += tile.blob?.size || 0
          existing.newestTimestamp = Math.max(existing.newestTimestamp, tile.timestamp || 0)
          sourceMap.set(sid, existing)
        }

        resolve(Array.from(sourceMap.entries()).map(([sourceId, stats]) => ({ sourceId, stats })))
      }
      req.onerror = () => resolve([])
    })
  } catch {
    return []
  }
}

/** Delete cached tiles for a specific source */
export async function deleteCachedTiles(sourceId: string): Promise<void> {
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('METARDUTileCache', 1)
      req.onerror = () => reject(req.error)
      req.onsuccess = () => resolve(req.result)
    })

    const tx = db.transaction('tiles', 'readwrite')
    const store = tx.objectStore('tiles')
    const cursorReq = store.openCursor()

    await new Promise<void>((resolve) => {
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result
        if (cursor) {
          if ((cursor.value as { sourceId: string }).sourceId === sourceId) {
            cursor.delete()
          }
          cursor.continue()
        } else {
          resolve()
        }
      }
      cursorReq.onerror = () => resolve()
    })
  } catch {
    // ignore
  }
}

/** Clear all tile cache */
export async function clearAllTileCache(): Promise<void> {
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('METARDUTileCache', 1)
      req.onerror = () => reject(req.error)
      req.onsuccess = () => resolve(req.result)
    })

    const tx = db.transaction('tiles', 'readwrite')
    const store = tx.objectStore('tiles')

    await new Promise<void>((resolve) => {
      const req = store.clear()
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
    })
  } catch {
    // ignore
  }
}

/** Get a cached tile blob by URL — used by custom tileLoadFunction for offline basemaps */
export async function getCachedTileBlob(url: string): Promise<Blob | null> {
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('METARDUTileCache', 1)
      req.onerror = () => reject(req.error)
      req.onsuccess = () => resolve(req.result)
    })

    return new Promise<Blob | null>((resolve) => {
      const tx = db.transaction('tiles', 'readonly')
      const store = tx.objectStore('tiles')
      const req = store.get(url)
      req.onsuccess = () => resolve((req.result as { blob: Blob } | undefined)?.blob || null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}
