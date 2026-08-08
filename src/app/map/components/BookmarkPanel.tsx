'use client'
/**
 * BookmarkPanel — Save and restore map view presets
 *
 * Saves current center, zoom, and rotation to localStorage.
 * Lists saved bookmarks with click-to-navigate and delete buttons.
 */

import React, { memo, useState, useCallback, useEffect } from 'react'
import { Bookmark, Trash2, Navigation, ChevronDown } from 'lucide-react'
import { useMapContext } from '@/app/map/MapReactContext'

const STORAGE_KEY = 'metardu-bookmarks'

interface BookmarkEntry {
  id: string
  label: string
  center: [number, number]
  zoom: number
  rotation: number
  createdAt: string
}

function loadBookmarks(): BookmarkEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as BookmarkEntry[]) : []
  } catch {
    return []
  }
}

function saveBookmarks(entries: BookmarkEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export const BookmarkPanel = memo(function BookmarkPanel() {
  const { mapInstance } = useMapContext()
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([])
  const [label, setLabel] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  // Load bookmarks on mount
  useEffect(() => {
    setBookmarks(loadBookmarks())
  }, [])

  const saveCurrentView = useCallback(() => {
    if (!mapInstance.current) return

    const view = mapInstance.current.getView()
    const center = view.getCenter()
    const zoom = view.getZoom()
    const rotation = view.getRotation()

    if (!center || zoom == null) return

    const entry: BookmarkEntry = {
      id: `bm-${Date.now()}`,
      label: label.trim() || `View ${bookmarks.length + 1}`,
      center: [center[0], center[1]],
      zoom,
      rotation: rotation || 0,
      createdAt: new Date().toISOString(),
    }

    const updated = [...bookmarks, entry]
    setBookmarks(updated)
    saveBookmarks(updated)
    setLabel('')
  }, [mapInstance, label, bookmarks])

  const navigateToBookmark = useCallback((entry: BookmarkEntry) => {
    if (!mapInstance.current) return
    const view = mapInstance.current.getView()
    view.animate({
      center: entry.center,
      zoom: entry.zoom,
      rotation: entry.rotation,
      duration: 600,
    })
  }, [mapInstance])

  const deleteBookmark = useCallback((id: string) => {
    const updated = bookmarks.filter(b => b.id !== id)
    setBookmarks(updated)
    saveBookmarks(updated)
  }, [bookmarks])

  return (
    <div className="bg-[var(--bg-secondary)]/90 backdrop-blur-xl border border-[var(--border-color)]/[0.06] rounded-lg w-56">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer select-none"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <Bookmark className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">
            Bookmarks
          </span>
        </div>
        <ChevronDown className={`w-3 h-3 text-[var(--text-muted)] transition-transform ${collapsed ? '-rotate-90' : ''}`} />
      </div>

      {!collapsed && (
        <div className="px-3 pb-3 space-y-2">
          {/* Save current view */}
          <div className="flex gap-1.5">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              aria-label="Bookmark name"
              className="flex-1 h-7 px-2 text-[10px] bg-[var(--bg-card)]/5 border border-[var(--border-color)]/[0.08] rounded text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:border-[var(--accent)]/40"
              onKeyDown={(e) => { if (e.key === 'Enter') saveCurrentView() }}
            />
            <button
              onClick={saveCurrentView}
              className="h-7 px-2 text-[10px] bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30 rounded hover:bg-[var(--accent)]/30 transition-colors"
              title="Save current view"
            >
              Save
            </button>
          </div>

          {/* Bookmark list */}
          {bookmarks.length === 0 ? (
            <div className="text-[9px] text-[var(--text-muted)] text-center py-1">
              No saved views
            </div>
          ) : (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {bookmarks.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between px-2 py-1 bg-[var(--bg-card)]/[0.03] rounded group hover:bg-[var(--bg-card)]/[0.06] transition-colors"
                >
                  <button
                    onClick={() => navigateToBookmark(entry)}
                    className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                  >
                    <Navigation className="w-3 h-3 text-[var(--text-muted)] flex-shrink-0" />
                    <span className="text-[10px] text-[var(--text-secondary)] truncate">{entry.label}</span>
                  </button>
                  <button
                    onClick={() => deleteBookmark(entry.id)}
                    className="p-0.5 text-[var(--text-muted)] hover:text-[var(--error)] opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete bookmark"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
})
