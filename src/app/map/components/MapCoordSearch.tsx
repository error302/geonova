'use client'
/**
 * MapCoordSearch — Coordinate search input overlay
 *
 * Now reads handleCoordSearch from MapReactContext via useMapContext().
 * Positioned top-left on the map. Accepts lat/lon, DMS, or UTM coordinates.
 */

import React, { memo, useState, useCallback } from 'react'
import { Search as SearchIcon } from 'lucide-react'
import { useMapContext } from '@/app/map/MapReactContext'

export const MapCoordSearch = memo(function MapCoordSearch() {
  const { handleCoordSearch } = useMapContext()
  const [searchInput, setSearchInput] = useState('')

  const handleSearch = useCallback(async () => {
    if (!searchInput.trim()) return
    await handleCoordSearch(searchInput)
    setSearchInput('')
  }, [searchInput, handleCoordSearch])

  return (
    <div className="absolute top-3 left-[344px] z-20 md:left-[344px]">
      <div className="relative">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
          aria-label="Search coord, beacon, or parcel"
          className="h-8 bg-[color-mix(in_srgb,var(--bg-secondary)_90%,transparent)] backdrop-blur-xl border border-[var(--border-color)]/[0.06] rounded-lg pl-7 pr-3 text-[11px] text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] transition-colors w-[160px] sm:w-[200px] md:w-[280px]"
        />
        <button
          onClick={handleSearch}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
          title="Search"
        >
          <SearchIcon className="w-3.5 h-3.5" />
        </button>
        <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
      </div>
    </div>
  )
})
