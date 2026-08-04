'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  Search,
  Circle,
  Square,
  Triangle,
  X,
  Plus,
  Link2,
  XCircle,
  Hash,
} from 'lucide-react'
import {
  type FeatureCodeDef,
  type FeatureCategory,
  getAllGroups,
  searchFeatureCodes,
  aciToHex,
} from '@/lib/topo/featureCodes'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

// ─── Props ──────────────────────────────────────────────────────────────────

interface FeatureCodeBrowserProps {
  onSelect: (code: FeatureCodeDef) => void
  selectedCode?: string
  compact?: boolean
}

// ─── Symbol icon helper ─────────────────────────────────────────────────────

function SymbolIcon({ symbol, size = 14 }: { symbol: FeatureCodeDef['symbol']; size?: number }) {
  switch (symbol) {
    case 'circle':
      return <Circle size={size} className="inline" />
    case 'square':
      return <Square size={size} className="inline" />
    case 'triangle':
      return <Triangle size={size} className="inline" />
    case 'cross':
      return <Plus size={size} className="inline" />
    case 'diamond':
      return <span style={{ width: size, height: size, display: 'inline-block' }} className="rotate-45 border border-current rounded-sm" />
    default:
      return <XCircle size={size} className="inline opacity-30" />
  }
}

// ─── Category icons (subtle colour tint per category) ───────────────────────

const CATEGORY_TINTS: Record<FeatureCategory, string> = {
  boundary:        'text-amber-400',
  structure:       'text-zinc-300',
  transportation:  'text-orange-400',
  utilities:       'text-cyan-400',
  hydrography:     'text-emerald-400',
  vegetation:      'text-green-400',
  relief:          'text-yellow-300',
  control:         'text-red-400',
  furniture:       'text-slate-300',
  other:           'text-zinc-500',
}

// ─── All categories for filter bar ──────────────────────────────────────────

const ALL_CATEGORIES: Array<{ key: FeatureCategory | '*'; label: string }> = [
  { key: '*',              label: 'All' },
  { key: 'boundary',       label: 'Boundary' },
  { key: 'structure',      label: 'Structures' },
  { key: 'transportation', label: 'Transport' },
  { key: 'utilities',      label: 'Utilities' },
  { key: 'hydrography',    label: 'Hydro' },
  { key: 'vegetation',     label: 'Veg' },
  { key: 'relief',         label: 'Relief' },
  { key: 'control',        label: 'Control' },
  { key: 'furniture',      label: 'Furniture' },
  { key: 'other',          label: 'Other' },
]

// ─── Component ──────────────────────────────────────────────────────────────

export default function FeatureCodeBrowser({
  onSelect,
  selectedCode,
  compact = false,
}: FeatureCodeBrowserProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<FeatureCategory | '*'>('*')
  const [focusIndex, setFocusIndex] = useState(-1)

  // Refs for keyboard nav scroll-into-view
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  // Debounce search input (300 ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  // ─── Build filtered list ─────────────────────────────────────────────────
  const filteredCodes = useMemo(() => {
    // Start with search results
    let results = searchFeatureCodes(debouncedQuery, 100)

    // Filter by category if set
    if (activeCategory !== '*') {
      results = results.filter(fc => fc.category === activeCategory)
    }

    return results
  }, [debouncedQuery, activeCategory])

  // Group by category (only in full mode)
  const grouped = useMemo(() => {
    if (compact || debouncedQuery || activeCategory !== '*') {
      return null // flat list for compact / search / filtered
    }
    return getAllGroups()
  }, [compact, debouncedQuery, activeCategory])

  // ─── Flat ordered list for keyboard navigation ───────────────────────────
  const flatCodes = useMemo(() => {
    if (grouped) {
      return grouped.flatMap(g => g.codes)
    }
    return filteredCodes
  }, [grouped, filteredCodes])

  // Reset focus when list changes
  useEffect(() => {
    setFocusIndex(-1)
    itemRefs.current.clear()
  }, [debouncedQuery, activeCategory])

  // ─── Keyboard navigation ─────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (flatCodes.length === 0) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setFocusIndex(prev => Math.min(prev + 1, flatCodes.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocusIndex(prev => Math.max(prev - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (focusIndex >= 0 && focusIndex < flatCodes.length) {
            onSelect(flatCodes[focusIndex])
          }
          break
        case 'Escape':
          setQuery('')
          setDebouncedQuery('')
          setFocusIndex(-1)
          break
      }
    },
    [flatCodes, focusIndex, onSelect],
  )

  // Scroll focused item into view
  useEffect(() => {
    if (focusIndex >= 0) {
      const el = itemRefs.current.get(focusIndex)
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [focusIndex])

  // ─── Render: Compact mode ───────────────────────────────────────────────
  if (compact) {
    return (
      <div
        className="w-full"
        onKeyDown={handleKeyDown}
        role="listbox"
        aria-label="Feature code list"
        aria-activedescendant={focusIndex >= 0 ? `fc-opt-${focusIndex}` : undefined}
        tabIndex={0}
      >
        {/* Search input */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search codes..."
            className="h-8 pl-8 text-sm bg-zinc-900 border-zinc-700 text-zinc-200 placeholder:text-zinc-500 focus-visible:border-blue-500 focus-visible:ring-blue-500/20"
          />
        </div>

        {/* Dropdown list */}
        <ScrollArea className="max-h-48 mt-1 rounded-md border border-zinc-700 bg-zinc-900">
          {filteredCodes.length === 0 && (
            <div className="py-4 text-center text-xs text-zinc-500">No matching codes</div>
          )}
          {filteredCodes.map((fc, idx) => {
            const isSelected = fc.code === selectedCode
            const isFocused = idx === focusIndex
            return (
              <div
                key={fc.code}
                id={`fc-opt-${idx}`}
                ref={el => { if (el) itemRefs.current.set(idx, el) }}
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                onClick={() => onSelect(fc)}
                className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs transition-colors ${
                  isSelected
                    ? 'bg-blue-500/20 text-blue-400 border-l-2 border-blue-500'
                    : isFocused
                      ? 'bg-zinc-800 text-zinc-200'
                      : 'text-zinc-300 hover:bg-zinc-800/60'
                }`}
              >
                <span
                  className="font-mono font-semibold min-w-[3.5rem] text-right"
                  style={{ color: aciToHex(fc.color) === '#FFFFFF' ? '#94a3b8' : aciToHex(fc.color) }}
                >
                  {fc.code}
                </span>
                <span className="truncate flex-1">{fc.description}</span>
                <SymbolIcon symbol={fc.symbol} size={12} />
              </div>
            )
          })}
        </ScrollArea>
      </div>
    )
  }

  // ─── Render: Full mode ──────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col gap-3 w-full"
      onKeyDown={handleKeyDown}
      role="listbox"
      aria-label="Feature code browser"
      aria-activedescendant={focusIndex >= 0 ? `fc-opt-${focusIndex}` : undefined}
      tabIndex={0}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Hash size={16} className="text-blue-400" />
        <h3 className="text-sm font-semibold text-zinc-200">Feature Codes</h3>
        <span className="ml-auto text-xs text-zinc-500">{flatCodes.length} codes</span>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by code, description, or layer..."
          className="h-9 pl-8 text-sm bg-zinc-900 border-zinc-700 text-zinc-200 placeholder:text-zinc-500 focus-visible:border-blue-500 focus-visible:ring-blue-500/20"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setDebouncedQuery('') }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Category filter buttons (hide when searching) */}
      {!debouncedQuery && (
        <div className="flex flex-wrap gap-1">
          {ALL_CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors border ${
                activeCategory === cat.key
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                  : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Code list */}
      <ScrollArea className="h-[320px] rounded-md border border-zinc-700 bg-zinc-900/80">
        <div ref={listRef} className="p-1">
          {flatCodes.length === 0 && (
            <div className="py-8 text-center text-sm text-zinc-500">
              No matching feature codes
            </div>
          )}

          {/* Grouped rendering (full mode, no search) */}
          {grouped
            ? grouped.map(group => {
                const groupCodes = group.codes
                if (activeCategory !== '*' && group.category !== activeCategory) return null
                return (
                  <div key={group.category}>
                    {/* Category header */}
                    <div className={`sticky top-0 z-10 flex items-center gap-2 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider bg-zinc-900 border-b border-zinc-800 ${CATEGORY_TINTS[group.category] ?? 'text-zinc-400'}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                      {group.name}
                      <span className="ml-auto text-zinc-600">{groupCodes.length}</span>
                    </div>
                    {groupCodes.map(fc => (
                      <CodeRow
                        key={fc.code}
                        fc={fc}
                        isSelected={fc.code === selectedCode}
                        isFocused={false}
                        flatIndex={flatCodes.indexOf(fc)}
                        onSelect={onSelect}
                        itemRefs={itemRefs}
                      />
                    ))}
                  </div>
                )
              })
            : /* Flat rendering (search / filtered) */
              filteredCodes.map((fc, idx) => (
                <CodeRow
                  key={fc.code}
                  fc={fc}
                  isSelected={fc.code === selectedCode}
                  isFocused={idx === focusIndex}
                  flatIndex={idx}
                  onSelect={onSelect}
                  itemRefs={itemRefs}
                />
              ))}
        </div>
      </ScrollArea>
    </div>
  )
}

// ─── Code Row (internal) ────────────────────────────────────────────────────

function CodeRow({
  fc,
  isSelected,
  isFocused,
  flatIndex,
  onSelect,
  itemRefs,
}: {
  fc: FeatureCodeDef
  isSelected: boolean
  isFocused: boolean
  flatIndex: number
  onSelect: (code: FeatureCodeDef) => void
  itemRefs: React.MutableRefObject<Map<number, HTMLDivElement>>
}) {
  const colorHex = aciToHex(fc.color)
  // ACI 7 is white; use muted slate on dark background
  const displayColor = colorHex === '#FFFFFF' ? '#94a3b8' : colorHex

  return (
    <div
      id={`fc-opt-${flatIndex}`}
      ref={el => { if (el) itemRefs.current.set(flatIndex, el) }}
      role="option"
      aria-selected={isSelected}
      tabIndex={-1}
      onClick={() => onSelect(fc)}
      className={`flex items-center gap-2 px-2.5 py-2 cursor-pointer rounded-sm transition-colors ${
        isSelected
          ? 'bg-blue-500/15 border-l-2 border-blue-500'
          : isFocused
            ? 'bg-zinc-800'
            : 'hover:bg-zinc-800/60'
      }`}
    >
      {/* Color swatch */}
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0 border border-zinc-600"
        style={{ backgroundColor: displayColor }}
      />

      {/* Code (monospace) */}
      <span
        className="font-mono text-xs font-bold min-w-[4.5rem]"
        style={{ color: displayColor }}
      >
        {fc.code}
      </span>

      {/* Description */}
      <span className="text-xs text-zinc-300 flex-1 truncate">{fc.description}</span>

      {/* Symbol icon */}
      <SymbolIcon symbol={fc.symbol} size={13} />

      {/* Join lines indicator */}
      {fc.joinLines && (
        <span title="Auto-join lines" className="inline-flex shrink-0">
          <Link2 size={11} className="text-blue-400/60" aria-label="Auto-join lines" />
        </span>
      )}

      {/* DXF layer tag */}
      <Badge
        variant="outline"
        className="text-[9px] px-1.5 py-0 h-4 border-zinc-700 text-zinc-500 font-mono hidden lg:inline-flex"
      >
        {fc.dxfLayer}
      </Badge>
    </div>
  )
}
