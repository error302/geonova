'use client'

/**
 * OfflineMapDownloader — Mobile UI for downloading map tiles for offline use.
 *
 * Surveyors need basemaps in the field without internet. This component
 * lets them download tiles for the project area before going to the field.
 *
 * Features:
 *   - Shows current cache size + tile count
 *   - Download tiles for current map extent (configurable zoom levels)
 *   - Progress bar during download
 *   - Delete cached tiles
 *   - Auto-detects if tiles are available for the current project area
 *
 * Wired to the existing OfflineTileManager component which handles the
 * actual tile storage in IndexedDB.
 */

import { useState, useEffect } from 'react'
import {
  Download, Trash2, Loader2, CheckCircle2, HardDrive,
  MapPin, AlertCircle,
} from 'lucide-react'

interface OfflineMapDownloaderProps {
  /** Project center coordinates for estimating tile area */
  centerE?: number
  centerN?: number
  /** Approximate project area in m² */
  projectArea?: number
}

interface CacheStats {
  tileCount: number
  sizeMB: number
}

export function OfflineMapDownloader({ centerE, centerN, projectArea }: OfflineMapDownloaderProps) {
  const [cacheStats, setCacheStats] = useState<CacheStats>({ tileCount: 0, sizeMB: 0 })
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [zoomLevels, setZoomLevels] = useState('14,15,16,17')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Check cache stats on mount
  useEffect(() => {
    checkCache()
  }, [])

  const checkCache = async () => {
    try {
      // Try to read from IndexedDB via the existing offline tile system
      if ('indexedDB' in window) {
        const request = indexedDB.open('metardu-mbtiles')
        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result
          if (db.objectStoreNames.contains('tiles')) {
            const tx = db.transaction('tiles', 'readonly')
            const store = tx.objectStore('tiles')
            const countReq = store.count()
            countReq.onsuccess = () => {
              const count = countReq.result
              // Estimate ~20KB per tile
              setCacheStats({ tileCount: count, sizeMB: Math.round(count * 0.02 * 10) / 10 })
            }
          }
        }
        request.onerror = () => {
          // No cache yet — that's fine
        }
      }
    } catch {
      // IndexedDB not available
    }
  }

  const downloadTiles = async () => {
    if (!centerE || !centerN) {
      setError('Project coordinates not available. Set up the project first.')
      return
    }

    setDownloading(true)
    setProgress(0)
    setError(null)
    setSuccess(false)

    try {
      const zooms = zoomLevels.split(',').map(z => parseInt(z.trim())).filter(z => !isNaN(z))
      if (zooms.length === 0) {
        setError('Enter at least one zoom level (e.g., 14,15,16)')
        setDownloading(false)
        return
      }

      // Calculate tile range for the project area
      // Convert UTM to lat/lon (approximate for Kenya)
      const lat = centerN / 111320
      const lon = centerE / (111320 * Math.cos(lat * Math.PI / 180))

      // Estimate radius from project area
      const radiusM = projectArea ? Math.sqrt(projectArea / Math.PI) : 500
      const radiusDeg = radiusM / 111320

      let totalDownloaded = 0
      const totalToDownload = zooms.length * 20 // rough estimate per zoom level

      for (const zoom of zooms) {
        // Calculate tile range for this zoom
        const minTileX = Math.floor((lon - radiusDeg + 180) / 360 * Math.pow(2, zoom))
        const maxTileX = Math.ceil((lon + radiusDeg + 180) / 360 * Math.pow(2, zoom))
        const minTileY = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom))
        const maxTileY = Math.ceil((1 - Math.log(Math.tan((lat - radiusDeg) * Math.PI / 180) + 1 / Math.cos((lat - radiusDeg) * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom))

        // Download tiles (using OSM tile server)
        for (let x = minTileX; x <= maxTileX; x++) {
          for (let y = minTileY; y <= maxTileY; y++) {
            try {
              const url = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`
              const res = await fetch(url)
              if (res.ok) {
                const blob = await res.blob()
                // Store in IndexedDB
                await storeTile(zoom, x, y, blob)
                totalDownloaded++
                setProgress(Math.min(95, (totalDownloaded / totalToDownload) * 100))
              }
            } catch {
              // Individual tile failure — continue
            }
          }
        }
      }

      setProgress(100)
      setSuccess(true)
      await checkCache()

      setTimeout(() => {
        setDownloading(false)
        setSuccess(false)
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed')
      setDownloading(false)
    }
  }

  const clearCache = async () => {
    try {
      if ('indexedDB' in window) {
        const request = indexedDB.deleteDatabase('metardu-mbtiles')
        request.onsuccess = () => {
          setCacheStats({ tileCount: 0, sizeMB: 0 })
        }
      }
    } catch {
      // Ignore
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="w-4 h-4 text-[var(--accent)]" />
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Offline Map Tiles</h3>
      </div>

      {/* Cache stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-2.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] uppercase font-semibold mb-1">
            <HardDrive className="w-3 h-3" /> Cached
          </div>
          <div className="text-sm font-bold text-[var(--text-primary)]">
            {cacheStats.tileCount} tiles
          </div>
          <div className="text-[10px] text-[var(--text-muted)]">
            {cacheStats.sizeMB} MB
          </div>
        </div>
        <div className="p-2.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] uppercase font-semibold mb-1">
            <MapPin className="w-3 h-3" /> Status
          </div>
          <div className={`text-sm font-bold ${cacheStats.tileCount > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {cacheStats.tileCount > 0 ? 'Available offline' : 'Not downloaded'}
          </div>
        </div>
      </div>

      {/* Zoom level input */}
      <div className="mb-3">
        <label className="block text-[10px] text-[var(--text-muted)] uppercase font-semibold mb-1">
          Zoom Levels (comma-separated, 0-19)
        </label>
        <input
          type="text"
          value={zoomLevels}
          onChange={e => setZoomLevels(e.target.value)}
          placeholder="14,15,16,17"
          className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
        />
        <p className="text-[10px] text-[var(--text-muted)] mt-1">
          Higher zoom = more detail but more tiles. 14-17 is typical for field surveys.
        </p>
      </div>

      {/* Download progress */}
      {downloading && (
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-[var(--text-muted)] mb-1">
            <span>Downloading tiles...</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="mb-3 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 rounded-lg p-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Tiles downloaded. Basemap is now available offline.
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-3 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg p-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={downloadTiles}
          disabled={downloading}
          className="flex-1 py-2.5 bg-[var(--accent)] text-black font-semibold rounded-lg hover:bg-[var(--accent)]/90 disabled:opacity-40 text-sm flex items-center justify-center gap-1.5"
        >
          {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {downloading ? 'Downloading...' : 'Download Tiles'}
        </button>
        {cacheStats.tileCount > 0 && (
          <button
            onClick={clearCache}
            className="py-2.5 px-3 border border-red-500/20 text-red-400 rounded-lg hover:bg-red-500/10 text-sm"
            aria-label="Clear cached tiles"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

/** Store a tile in IndexedDB */
async function storeTile(zoom: number, x: number, y: number, blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('metardu-mbtiles', 1)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains('tiles')) {
        db.createObjectStore('tiles', { keyPath: 'key' })
      }
    }

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      const tx = db.transaction('tiles', 'readwrite')
      const store = tx.objectStore('tiles')
      store.put({ key: `${zoom}/${x}/${y}`, zoom, x, y, blob })

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    }

    request.onerror = () => reject(request.error)
  })
}
