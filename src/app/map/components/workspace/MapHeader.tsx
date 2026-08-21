'use client'

import React, { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Compass, Search, Undo2, Redo2, Bell, HelpCircle, User,
  Sparkles, ChevronDown, Check, Folder, MapPin, Hexagon, Globe,
} from 'lucide-react'
import { useMapContext } from '@/app/map/MapReactContext'
import { MAP_HEADER_HEIGHT, Z_INDEX } from '@/lib/map/workspaceLayout'
import { SURVEY_WORKFLOWS, type SurveyWorkflow } from './types'

interface SearchResultItem {
  category: 'PROJECTS' | 'POINTS' | 'PARCELS' | 'LOCATIONS'
  title: string
  subtitle: string
  action: () => void
}

export const MapHeader = memo(function MapHeader({
  workflow,
  onOpenWorkflows,
  onOpenHelp,
}: {
  workflow: SurveyWorkflow
  onOpenWorkflows: () => void
  onOpenHelp?: () => void
}) {
  const {
    schemeProjectId, canUndo, canRedo, undo, redo,
    activeProjection, hasTraverse, handleCoordSearch, mapInstance,
  } = useMapContext()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const activeWorkflowDef = SURVEY_WORKFLOWS.find((w) => w.id === workflow)

  // Auto-detect coordinate patterns: "572872.1, 9548578.6" or "572872.1 9548578.6" or "lat, lon"
  const isCoordPattern = useMemo(() => {
    const trimmed = searchQuery.trim()
    return /^-?\d+(\.\d+)?[\s,]+-?\d+(\.\d+)?$/.test(trimmed)
  }, [searchQuery])

  // Mock / dynamic search categorization
  const searchResults: SearchResultItem[] = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.trim().toLowerCase()
    const list: SearchResultItem[] = []

    if (isCoordPattern) {
      list.push({
        category: 'LOCATIONS',
        title: `Jump to Coordinates: ${searchQuery}`,
        subtitle: `Zoom map to Easting/Northing in ${activeProjection}`,
        action: () => {
          handleCoordSearch(searchQuery)
          setSearchFocused(false)
          setSearchQuery('')
        },
      })
    }

    // Projects
    if ('nairobi block 12'.includes(q) || 'project'.includes(q) || (schemeProjectId && schemeProjectId.toLowerCase().includes(q))) {
      list.push({
        category: 'PROJECTS',
        title: schemeProjectId ? `Project ${schemeProjectId}` : 'Nairobi Block 12 Cadastre',
        subtitle: 'Arc 1960 / UTM 37S · Active Project',
        action: () => {
          setSearchFocused(false)
        },
      })
    }

    // Points
    if (q.startsWith('p') || q.startsWith('bm') || q.startsWith('pt')) {
      list.push({
        category: 'POINTS',
        title: `Control Mark ${searchQuery.toUpperCase()}`,
        subtitle: 'Observed Beacon (E: 250124.5, N: 9851420.2)',
        action: () => {
          mapInstance.current?.getView().animate({ center: [250124.5, 9851420.2], zoom: 18, duration: 400 })
          setSearchFocused(false)
        },
      })
    }

    // Parcels
    if (q.includes('parcel') || q.includes('plot') || q.includes('/') || /\d+/.test(q)) {
      list.push({
        category: 'PARCELS',
        title: `Parcel ${searchQuery.toUpperCase()}`,
        subtitle: 'Cadastral Title Subdivision (0.245 Ha)',
        action: () => {
          setSearchFocused(false)
        },
      })
    }

    return list
  }, [searchQuery, isCoordPattern, activeProjection, schemeProjectId, handleCoordSearch, mapInstance])

  // Handle direct Enter on search input
  const onSubmitSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    handleCoordSearch(searchQuery)
    setSearchFocused(false)
  }, [searchQuery, handleCoordSearch])

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header
      className="flex items-center justify-between px-3 shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/95 backdrop-blur-md relative"
      style={{ height: MAP_HEADER_HEIGHT, zIndex: Z_INDEX.header }}
    >
      {/* ── LEFT: Logo & Product Label ── */}
      <div className="flex items-center gap-3 min-w-[200px]">
        <Link href="/dashboard" className="flex items-center gap-2.5 no-underline group" title="Return to Dashboard">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#D17B47] to-[#B35E2D] flex items-center justify-center shadow-md shadow-[#D17B47]/20 group-hover:scale-105 transition-transform">
            <Compass className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-black tracking-tight text-[var(--text-primary)]">
              META<span className="text-[#D17B47]">RDU</span>
            </span>
            <span className="text-[9px] font-semibold tracking-wider uppercase text-[var(--text-muted)] -mt-1">
              Survey Workspace
            </span>
          </div>
        </Link>
      </div>

      {/* ── CENTER: Unified Intelligent Search Bar ── */}
      <div ref={searchContainerRef} className="relative flex-1 max-w-xl mx-4">
        <form onSubmit={onSubmitSearch} className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            placeholder="Search projects, points, parcels, coordinates (E, N)..."
            aria-label="Search projects, points, parcels, coordinates"
            className="w-full h-9 bg-[var(--bg-secondary)]/80 hover:bg-[var(--bg-secondary)] focus:bg-[var(--bg-secondary)] border border-[var(--border-color)] focus:border-[#D17B47]/50 rounded-xl pl-10 pr-10 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#D17B47]/30 transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </form>

        {/* Categorized Autocomplete Dropdown */}
        {searchFocused && (searchQuery.trim().length > 0 || searchResults.length > 0) && (
          <div className="absolute top-11 left-0 right-0 rounded-xl bg-[var(--bg-secondary)]/95 backdrop-blur-xl border border-[var(--border-color)] shadow-2xl p-1.5 space-y-1 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
            {searchResults.length > 0 ? (
              searchResults.map((item, idx) => (
                <button
                  key={idx}
                  onClick={item.action}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/[0.06] flex items-center justify-between gap-2 transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-md bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0 text-[var(--text-muted)] group-hover:text-[#D17B47]">
                      {item.category === 'PROJECTS' && <Folder className="w-3.5 h-3.5" />}
                      {item.category === 'POINTS' && <MapPin className="w-3.5 h-3.5" />}
                      {item.category === 'PARCELS' && <Hexagon className="w-3.5 h-3.5" />}
                      {item.category === 'LOCATIONS' && <Globe className="w-3.5 h-3.5" />}
                    </span>
                    <div className="truncate">
                      <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{item.title}</p>
                      <p className="text-[10px] text-[var(--text-muted)] truncate">{item.subtitle}</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono font-semibold tracking-wider text-[var(--text-muted)] uppercase shrink-0 px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.06]">
                    {item.category}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-center text-xs text-[var(--text-muted)]">
                Press <kbd className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] font-mono text-[10px]">Enter</kbd> to search coordinate or place
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── RIGHT: Project Selector, Workflow State, Undo/Redo, Notifications, Profile ── */}
      <div className="flex items-center gap-2 min-w-[240px] justify-end">
        {/* Project Selector Badge */}
        <div className="relative">
          <button
            onClick={() => setProjectMenuOpen(!projectMenuOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)]/70 hover:bg-[var(--bg-secondary)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title="Switch project"
          >
            <Folder className="w-3.5 h-3.5 text-[#D17B47]" />
            <span className="max-w-[100px] sm:max-w-[140px] truncate font-medium">
              {schemeProjectId ? `Project ${schemeProjectId}` : 'Global Workspace'}
            </span>
            <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
          </button>

          {projectMenuOpen && (
            <div className="absolute right-0 top-10 w-56 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl p-1.5 space-y-1 z-50">
              <div className="px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
                Active Projects
              </div>
              <Link
                href="/dashboard"
                onClick={() => setProjectMenuOpen(false)}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/[0.06] text-[var(--text-primary)]"
              >
                <span>Browse All Projects</span>
                <span className="text-[10px] text-[var(--text-muted)]">Dashboard</span>
              </Link>
            </div>
          )}
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center bg-[var(--bg-secondary)]/50 rounded-lg p-0.5 border border-[var(--border-color)]">
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] disabled:opacity-25 transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
            className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] disabled:opacity-25 transition-colors"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Active Workflow Trigger */}
        <button
          onClick={onOpenWorkflows}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
            workflow !== 'idle'
              ? 'bg-[#D17B47]/15 border-[#D17B47]/40 text-[#D17B47] shadow-sm shadow-[#D17B47]/20'
              : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/30'
          }`}
          title="Active Survey Workflow (Shortcut: P, T, S, M, A, V)"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#D17B47]" />
          <span className="hidden sm:inline">{activeWorkflowDef ? activeWorkflowDef.label : 'Workflows'}</span>
          {hasTraverse && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Traverse in memory" />}
        </button>

        {/* Help / Shortcuts modal trigger */}
        {onOpenHelp && (
          <button
            onClick={onOpenHelp}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
            title="Shortcuts & Documentation (?)"
            aria-label="Help and shortcuts"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        )}

        {/* User Profile */}
        <Link
          href="/profile"
          className="w-8 h-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[#D17B47]/40 transition-colors"
          title="Surveyor Profile & License"
        >
          <User className="w-4 h-4" />
        </Link>
      </div>
    </header>
  )
})
