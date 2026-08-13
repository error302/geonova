'use client'

/**
 * OfflineDownloadButton — Floating button on the map for quick tile download
 *
 * Shows a prominent button that lets surveyors pre-cache map tiles
 * for a specific area before going offline (field work).
 */

import { Download } from 'lucide-react'
import { useMapContext } from '@/app/map/MapReactContext'

export function OfflineDownloadButton() {
  const { setOfflineDialogOpen, offlineDialogOpen } = useMapContext()

  return (
    <button
      onClick={() => setOfflineDialogOpen(true)}
      className={`flex items-center gap-2 px-3 h-10 rounded-xl backdrop-blur-xl border transition-all duration-200 shadow-lg ${
        offlineDialogOpen
          ? 'bg-[var(--accent)]/15 border-[var(--accent)]/30 text-[var(--accent)]'
          : 'bg-[var(--bg-secondary)]/60 border-[var(--border-color)]/[0.06] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]/80 hover:text-[var(--text-secondary)]'
      }`}
      title="Download offline map tiles for this area"
    >
      <Download className="w-4 h-4" />
      <span className="text-xs font-medium hidden sm:inline">Offline Tiles</span>
    </button>
  )
}
