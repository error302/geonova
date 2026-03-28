'use client'

import { useState, useEffect, useCallback } from 'react'
import { Video, Camera, RefreshCw, Maximize2, AlertCircle } from 'lucide-react'
import { getCameraFeedUrl } from '@/lib/compute/safety'

interface CameraFeedProps {
  projectId: string
  cameraId: string
  cameraName?: string
}

export default function CameraFeed({ projectId, cameraId, cameraName = 'Camera Feed' }: CameraFeedProps) {
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchFeed = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const urls = await getCameraFeedUrl(projectId, cameraId)
      setStreamUrl(urls.stream_url)
      setSnapshotUrl(urls.snapshot_url)
      setLastUpdate(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load camera feed')
    } finally {
      setLoading(false)
    }
  }, [projectId, cameraId])

  useEffect(() => {
    fetchFeed()
    const interval = setInterval(fetchFeed, 30000)
    return () => clearInterval(interval)
  }, [fetchFeed])

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">{cameraName}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchFeed}
            className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
            title="Refresh feed"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
            title="Fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative aspect-video bg-black">
        {loading && !streamUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Camera className="h-8 w-8 text-gray-500 animate-pulse" />
              <span className="text-sm text-gray-400">Loading feed...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-red-400">
              <AlertCircle className="h-8 w-8" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {streamUrl && !error && (
          <video
            src={streamUrl}
            className="w-full h-full object-cover"
            autoPlay
            muted
            playsInline
            onError={() => setError('Stream failed')}
          />
        )}

        {snapshotUrl && !streamUrl && !loading && !error && (
          <img
            src={snapshotUrl}
            alt="Camera snapshot"
            className="w-full h-full object-cover"
            onError={() => setError('Failed to load snapshot')}
          />
        )}

        <div className="absolute bottom-2 left-2 flex items-center gap-2">
          <span className="px-2 py-0.5 bg-black/60 rounded text-xs text-white flex items-center gap-1">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            LIVE
          </span>
        </div>

        <div className="absolute bottom-2 right-2 text-xs text-white/60">
          Updated: {lastUpdate.toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}
