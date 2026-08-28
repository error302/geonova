'use client'

/**
 * CommandPalette — Global search and navigation (Cmd+K / Ctrl+K)
 *
 * Features:
 * - Press Cmd+K (Mac) or Ctrl+K (Windows/Linux) to open
 * - Search across: projects, parcels, beacons, tools, pages, documents
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Recent items shown when query is empty
 * - Quick navigation shortcuts
 *
 * Integrates with:
 * - /api/search (existing backend search)
 * - Static page navigation (tools, docs, settings)
 */

import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Command, ArrowRight, CornerDownLeft,
  FolderKanban, Wrench, Map, FileText, Settings, LayoutDashboard,
  Calculator, Ruler, Compass, Users, CreditCard, BarChart3,
  BookOpen, Loader2,
} from 'lucide-react'
import { useDebounceValue } from '@/lib/performance'

interface SearchResult {
  id: string
  type: string
  title: string
  subtitle?: string
  href?: string
  meta?: Record<string, unknown>
}

interface StaticNavItem {
  title: string
  subtitle: string
  href: string
  icon: typeof LayoutDashboard
  category: string
  keywords: string[]
}

// Static navigation items (always available)
const STATIC_NAV: StaticNavItem[] = [
  { title: 'Dashboard', subtitle: 'Your project overview', href: '/dashboard', icon: LayoutDashboard, category: 'Pages', keywords: ['home', 'main', 'overview'] },
  { title: 'Map', subtitle: 'Global survey map', href: '/map', icon: Map, category: 'Pages', keywords: ['openlayers', 'gis'] },
  { title: 'Field Book', subtitle: 'Digital field notes', href: '/fieldbook', icon: FileText, category: 'Pages', keywords: ['notes', 'observations', 'leveling', 'traverse'] },
  { title: 'Documents', subtitle: 'Generated documents', href: '/documents', icon: FileText, category: 'Pages', keywords: ['pdf', 'deed', 'plan'] },
  { title: 'Analytics', subtitle: 'Usage statistics', href: '/analytics', icon: BarChart3, category: 'Pages', keywords: ['stats', 'reports'] },
  { title: 'Community', subtitle: 'Surveyor network', href: '/community', icon: Users, category: 'Pages', keywords: ['network', 'peer', 'review'] },
  { title: 'Settings', subtitle: 'Account preferences', href: '/settings', icon: Settings, category: 'Pages', keywords: ['profile', 'account', 'preferences'] },
  { title: 'Pricing', subtitle: 'Subscription plans', href: '/pricing', icon: CreditCard, category: 'Pages', keywords: ['upgrade', 'plan', 'subscription'] },

  // Tools
  { title: 'COGO Calculator', subtitle: 'Coordinate geometry', href: '/tools/cogo', icon: Calculator, category: 'Tools', keywords: ['cogo', 'coordinate', 'geometry', 'intersection'] },
  { title: 'Traverse', subtitle: 'Traverse computation', href: '/tools/traverse', icon: Compass, category: 'Tools', keywords: ['bowditch', 'adjustment', 'closure'] },
  { title: 'Leveling', subtitle: 'Rise & fall computation', href: '/tools/leveling', icon: Ruler, category: 'Tools', keywords: ['level', 'rl', 'benchmark'] },
  { title: 'Distance Calculator', subtitle: 'Point-to-point distance', href: '/tools/distance', icon: Ruler, category: 'Tools', keywords: ['length', 'measure'] },
  { title: 'Area Calculator', subtitle: 'Polygon area', href: '/tools/area', icon: Calculator, category: 'Tools', keywords: ['acre', 'hectare', 'parcel'] },
  { title: 'Coordinate Transform', subtitle: 'Datum conversion', href: '/tools/coordinates', icon: Compass, category: 'Tools', keywords: ['utm', 'wgs84', 'arc 1960', 'cassini'] },
  { title: 'Curve Calculator', subtitle: 'Horizontal/vertical curves', href: '/tools/curves', icon: Compass, category: 'Tools', keywords: ['radius', 'arc', 'transition'] },
  { title: 'Cassini-UTM Conversion', subtitle: 'Legacy grid transform', href: '/tools/cassini-utm', icon: Compass, category: 'Tools', keywords: ['cassini', 'soldner', 'colonial'] },

  // Docs
  { title: 'Documentation', subtitle: 'User manuals & guides', href: '/docs', icon: BookOpen, category: 'Help', keywords: ['manual', 'guide', 'help', 'docs'] },
  { title: 'Quick Start Guide', subtitle: 'Get started in 5 minutes', href: '/docs/quick-start', icon: BookOpen, category: 'Help', keywords: ['begin', 'tutorial', 'setup'] },
  { title: 'API Documentation', subtitle: 'Developer reference', href: '/api-docs', icon: BookOpen, category: 'Help', keywords: ['api', 'developer', 'rest'] },
]

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [searching, setSearching] = useState(false)
  const [apiResults, setApiResults] = useState<SearchResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Open/close with Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setApiResults([])
      setSelectedIndex(0)
    }
  }, [open])

  // Debounced query using performance utility
  const debouncedQuery = useDebounceValue(query, 200)

  // Search API when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim() || debouncedQuery.length < 2) {
      setApiResults([])
      return
    }

    setSearching(true)
    let cancelled = false

    async function doSearch() {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=10`)
        if (cancelled || !res.ok) return
        const data = (await res.json()) as { data?: { groups?: Array<{ type: string; hits?: Array<{ id: string; title: string; subtitle?: string; meta?: Record<string, unknown> }> }> } }
        if (cancelled) return
        const results: SearchResult[] = []
        if (data.data?.groups) {
          for (const group of data.data.groups) {
            for (const hit of group.hits || []) {
              results.push({
                id: hit.id,
                type: group.type,
                title: hit.title,
                subtitle: hit.subtitle,
                href: getHrefForType(group.type, hit.id, hit.meta),
              })
            }
          }
        }
        setApiResults(results)
      } catch {
        // Silent fail
      } finally {
        if (!cancelled) setSearching(false)
      }
    }

    doSearch()

    return () => { cancelled = true }
  }, [debouncedQuery])

  // Filter static nav by query
  const filteredNav = useMemo(() => {
    if (!query.trim()) return STATIC_NAV.slice(0, 8)
    const q = query.toLowerCase()
    return STATIC_NAV.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q) ||
      item.keywords.some(k => k.includes(q))
    )
  }, [query])

  // Combine results
  const allResults = useMemo(() => {
    const combined: (StaticNavItem | SearchResult)[] = []
    if (apiResults.length > 0) combined.push(...apiResults)
    combined.push(...filteredNav)
    return combined.slice(0, 20)
  }, [apiResults, filteredNav])

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [allResults.length])

  // Keyboard navigation
  const handleSelect = useCallback((item: StaticNavItem | SearchResult) => {
    const href = 'href' in item ? item.href : undefined
    if (href) {
      router.push(href)
      setOpen(false)
    }
  }, [router])

  const handleHover = useCallback((idx: number) => {
    setSelectedIndex(idx)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, allResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = allResults[selectedIndex]
      if (item) handleSelect(item)
    }
  }, [allResults, selectedIndex, handleSelect])

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div className="fixed top-[15vh] left-1/2 -translate-x-1/2 z-[9999] w-[640px] max-w-[calc(100vw-2rem)] bg-[#0d0d14]/95 backdrop-blur-2xl border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06]">
          {searching ? (
            <Loader2 className="w-5 h-5 text-gray-500 animate-spin shrink-0" />
          ) : (
            <Search className="w-5 h-5 text-gray-500 shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Search projects, parcels, tools, pages..."
            className="flex-1 bg-transparent text-white text-sm placeholder-gray-600 focus:outline-none"
          />
          <kbd className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.1] text-[9px] text-gray-500 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto p-2">
          {allResults.length === 0 && query.length >= 2 && !searching && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="w-8 h-8 text-gray-600 mb-2" />
              <p className="text-sm text-gray-500">No results for &quot;{query}&quot;</p>
              <p className="text-[10px] text-gray-600 mt-1">Try a different search term</p>
            </div>
          )}

          {allResults.length === 0 && query.length < 2 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Command className="w-8 h-8 text-gray-600 mb-2" />
              <p className="text-sm text-gray-500">Start typing to search</p>
              <p className="text-[10px] text-gray-600 mt-1">
                Search across projects, parcels, beacons, tools, and pages
              </p>
            </div>
          )}

          {/* API results section */}
          {apiResults.length > 0 && (
            <div className="mb-2">
              <div className="px-2 py-1 text-[9px] text-gray-600 uppercase tracking-wider font-semibold">
                Database Results
              </div>
              {apiResults.map((item, idx) => (
                <ResultRow
                  key={`api-${item.id}`}
                  item={item}
                  index={idx}
                  selected={idx === selectedIndex}
                  onSelect={handleSelect}
                  onHover={handleHover}
                  icon={getResultIcon(item.type)}
                  title={item.title}
                  subtitle={item.subtitle || item.type}
                  href={item.href}
                />
              ))}
            </div>
          )}

          {/* Static nav section */}
          {filteredNav.length > 0 && (
            <div>
              {apiResults.length > 0 && (
                <div className="px-2 py-1 text-[9px] text-gray-600 uppercase tracking-wider font-semibold">
                  Pages & Tools
                </div>
              )}
              {filteredNav.map((item, idx) => {
                const actualIndex = apiResults.length + idx
                return (
                  <ResultRow
                    key={`nav-${item.href}`}
                    item={item}
                    index={actualIndex}
                    selected={actualIndex === selectedIndex}
                    onSelect={handleSelect}
                    onHover={handleHover}
                    icon={item.icon}
                    title={item.title}
                    subtitle={item.subtitle}
                    category={item.category}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.06] bg-[#0d0d14]/60">
          <div className="flex items-center gap-3 text-[9px] text-gray-600">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-white/[0.06] border border-white/[0.1] font-mono">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-white/[0.06] border border-white/[0.1] font-mono">
                <CornerDownLeft className="w-2.5 h-2.5" />
              </kbd>
              Select
            </span>
          </div>
          <span className="text-[9px] text-gray-600">METARDU Search</span>
        </div>
      </div>
    </>
  )
}

// ─── Helper components ──────────────────────────────────────────────────

const ResultRow = memo(function ResultRow({
  item, index, selected, onSelect, onHover, icon: Icon, title, subtitle, category,
}: {
  item: StaticNavItem | SearchResult
  index: number
  selected: boolean
  onSelect: (item: StaticNavItem | SearchResult) => void
  onHover: (idx: number) => void
  icon: typeof LayoutDashboard
  title: string
  subtitle: string
  href?: string
  category?: string
}) {
  return (
    <div
      onClick={() => onSelect(item)}
      onMouseEnter={() => onHover(index)}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
        selected ? 'bg-[#D17B47]/10' : 'hover:bg-white/[0.03]'
      }`}
    >
      <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
        selected ? 'bg-[#D17B47]/15' : 'bg-white/[0.04]'
      }`}>
        <Icon className={`w-4 h-4 ${selected ? 'text-[#D17B47]' : 'text-gray-400'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-white truncate">{title}</div>
        <div className="text-[10px] text-gray-500 truncate">{subtitle}</div>
      </div>
      {category && (
        <span className="text-[9px] text-gray-600 px-1.5 py-0.5 rounded bg-white/[0.04] shrink-0">
          {category}
        </span>
      )}
      {selected && <ArrowRight className="w-3 h-3 text-[#D17B47] shrink-0" />}
    </div>
  )
})

function getResultIcon(type: string): typeof LayoutDashboard {
  switch (type) {
    case 'projects': return FolderKanban
    case 'tools': return Wrench
    case 'surveyors': return Users
    case 'documents': return FileText
    default: return Search
  }
}

function getHrefForType(type: string, id: string, _meta?: Record<string, unknown>): string {
  switch (type) {
    case 'projects': return `/project/${id}`
    case 'surveyors': return `/community/directory?id=${id}`
    case 'documents': return `/documents?id=${id}`
    default: return `/search?q=${id}`
  }
}
