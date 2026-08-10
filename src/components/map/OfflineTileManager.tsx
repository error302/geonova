'use client'

import { useState, useEffect, useCallback } from 'react'
import { logger } from '@/lib/logger'
import {
  Trash2,
  HardDrive,
  RefreshCw,
  AlertTriangle,
  Layers,
  Clock,
  Database,
  WifiOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  listCachedSources,
  deleteCachedTiles,
  clearAllTileCache,
  type CachedSourceInfo,
} from '@/lib/offline/tileCache'

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}

function formatDate(timestamp: number | null): string {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getSourceIcon(sourceId: string): string {
  if (sourceId.includes('osm') || sourceId.includes('openstreetmap')) return '[Map]'
  if (sourceId.includes('satellite') || sourceId.includes('esri')) return '[Sat]'
  return ''
}

// ─── Component ──────────────────────────────────────────────────────────────

export function OfflineTileManager() {
  const [sources, setSources] = useState<CachedSourceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)

  const refreshSources = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listCachedSources()
      setSources(data)
    } catch (err) {
      logger.error('Failed to list cached sources:', { error: err })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshSources()
  }, [refreshSources])

  const handleDeleteSource = useCallback(
    async (sourceId: string) => {
      setDeleting(sourceId)
      try {
        await deleteCachedTiles(sourceId)
        await refreshSources()
      } catch (err) {
        logger.error('Failed to delete source:', { error: err })
      } finally {
        setDeleting(null)
      }
    },
    [refreshSources],
  )

  const handleClearAll = useCallback(async () => {
    setClearing(true)
    try {
      await clearAllTileCache()
      await refreshSources()
    } catch (err) {
      logger.error('Failed to clear cache:', { error: err })
    } finally {
      setClearing(false)
    }
  }, [refreshSources])

  const totalSizeBytes = sources.reduce((sum, s) => sum + s.stats.sizeBytes, 0)
  const totalTiles = sources.reduce((sum, s) => sum + s.stats.count, 0)

  // Rough storage quota (most browsers allow ~50MB–unlimited for persistent storage)
  const estimatedQuota = 500 * 1024 * 1024 // 500 MB estimate
  const usagePercent = Math.min(100, Math.round((totalSizeBytes / estimatedQuota) * 100))

  return (
    <div className="space-y-6">
      {/* ─── Storage Overview ──────────────────────────────────────── */}
      <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
            <HardDrive className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">Offline Storage</h3>
            <p className="text-xs text-[var(--text-muted)]">
              {formatBytes(totalSizeBytes)} used across {sources.length} source{sources.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-[var(--text-muted)]">
            <span>{formatBytes(totalSizeBytes)} used</span>
            <span>~{formatBytes(estimatedQuota)} estimated quota</span>
          </div>
          <Progress
            value={usagePercent}
            className="h-2 bg-[var(--bg-primary)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] p-3 text-center">
            <div className="text-xl font-bold font-mono text-[var(--accent)]">
              {totalTiles.toLocaleString()}
            </div>
            <div className="text-xs text-[var(--text-muted)]">Total Tiles</div>
          </div>
          <div className="rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] p-3 text-center">
            <div className="text-xl font-bold font-mono text-[var(--text-primary)]">
              {sources.length}
            </div>
            <div className="text-xs text-[var(--text-muted)]">Sources</div>
          </div>
        </div>
      </div>

      {/* ─── Action Buttons ────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={refreshSources}
          disabled={loading}
          className="border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>

        {sources.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={clearing}
                className="border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Clear All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-primary)]">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  Clear All Cached Tiles?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-[var(--text-muted)]">
                  This will permanently delete all {totalTiles.toLocaleString()} cached tiles
                  ({formatBytes(totalSizeBytes)}) from {sources.length} source{sources.length !== 1 ? 's' : ''}.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)]">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearAll}
                  className="bg-red-600 text-white hover:bg-red-500"
                >
                  {clearing ? 'Clearing…' : 'Clear All'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* ─── Source List ───────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 animate-spin text-[var(--accent)]" />
          <span className="ml-3 text-sm text-[var(--text-muted)]">Loading cache info…</span>
        </div>
      ) : sources.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center mb-4">
            <WifiOff className="w-8 h-8 text-[var(--text-muted)]" />
          </div>
          <p className="text-[var(--text-secondary)] font-medium mb-1">No offline tiles cached</p>
          <p className="text-sm text-[var(--text-muted)] max-w-xs">
            Download map tiles for offline use by selecting an area and zoom range.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {sources.map((source) => (
            <div
              key={source.sourceId}
              className="group rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-4 transition-all hover:border-[var(--accent)]/20"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="text-xl mt-0.5">{getSourceIcon(source.sourceId)}</span>
                  <div className="min-w-0">
                    <h4 className="font-medium text-[var(--text-primary)] truncate">
                      {source.sourceId}
                    </h4>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-[var(--text-muted)]">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        {source.stats.count.toLocaleString()} tiles
                      </span>
                      <span className="flex items-center gap-1">
                        <Database className="w-3 h-3" />
                        {formatBytes(source.stats.sizeBytes)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(source.stats.newestTimestamp)}
                      </span>
                    </div>
                  </div>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={deleting === source.sourceId}
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 h-8 w-8"
                    >
                      {deleting === source.sourceId ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-primary)]">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete &ldquo;{source.sourceId}&rdquo;?</AlertDialogTitle>
                      <AlertDialogDescription className="text-[var(--text-muted)]">
                        This will delete {source.stats.count.toLocaleString()} cached tiles
                        ({formatBytes(source.stats.sizeBytes)}). This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)]">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteSource(source.sourceId)}
                        className="bg-red-600 text-white hover:bg-red-500"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
