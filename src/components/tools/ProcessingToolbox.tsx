'use client'

/**
 * ProcessingToolbox — Searchable catalog of all METARDU tools
 *
 * Inspired by QGIS Processing Toolbox. Provides:
 * - Searchable list of all 60+ calculation tools
 * - Categorized by survey type
 * - Recent tools section
 * - Favorites
 * - Quick access from any page
 *
 * This consolidates the scattered tools into one discoverable interface.
 */

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Star, Clock, ChevronRight, Calculator,
  Compass, Ruler, MapPin, FileText, Mountain,
  Waves, Building2, Navigation, Layers,
  X, Activity, Satellite, FileCheck, AlertTriangle, Building, TrendingUp,
} from 'lucide-react'

interface Tool {
  id: string
  name: string
  description: string
  category: string
  href: string
  icon: typeof Calculator
  keywords: string[]
}

// All METARDU tools categorized
const TOOLS: Tool[] = [
  // Calculations
  { id: 'cogo', name: 'COGO Calculator', description: 'Coordinate geometry — radiation, intersection, resection', category: 'Calculations', href: '/tools/cogo', icon: Compass, keywords: ['cogo', 'coordinate', 'geometry', 'radiation', 'intersection', 'resection'] },
  { id: 'traverse', name: 'Traverse Computation', description: 'Bowditch adjustment, open/closed/link traverse', category: 'Calculations', href: '/tools/traverse', icon: Navigation, keywords: ['traverse', 'bowditch', 'adjustment', 'closure', 'loop'] },
  { id: 'leveling', name: 'Leveling Computation', description: 'Rise & fall, height of collimation', category: 'Calculations', href: '/tools/leveling', icon: Ruler, keywords: ['level', 'leveling', 'rise', 'fall', 'collimation', 'benchmark'] },
  { id: 'distance', name: 'Distance Calculator', description: 'Point-to-point distance', category: 'Calculations', href: '/tools/distance', icon: Ruler, keywords: ['distance', 'length', 'measure'] },
  { id: 'bearing', name: 'Bearing Calculator', description: 'Bearing between two points', category: 'Calculations', href: '/tools/bearing', icon: Compass, keywords: ['bearing', 'azimuth', 'angle'] },
  { id: 'area', name: 'Area Calculator', description: 'Polygon area (Shoelace formula)', category: 'Calculations', href: '/tools/area', icon: Calculator, keywords: ['area', 'acre', 'hectare', 'parcel', 'shoelace'] },
  { id: 'grade', name: 'Grade Calculator', description: 'Slope/grade percentage', category: 'Calculations', href: '/tools/grade', icon: Calculator, keywords: ['grade', 'slope', 'percentage', 'gradient'] },
  { id: 'chainage', name: 'Chainage Calculator', description: 'Chainage along alignment', category: 'Calculations', href: '/tools/chainage', icon: MapPin, keywords: ['chainage', 'stationing', 'alignment'] },
  { id: 'curves', name: 'Curve Calculator', description: 'Horizontal/vertical curves', category: 'Calculations', href: '/tools/curves', icon: Compass, keywords: ['curve', 'radius', 'arc', 'transition', 'clothoid'] },
  { id: 'tacheometry', name: 'Tacheometry', description: 'Tacheometric computations', category: 'Calculations', href: '/tools/tacheometry', icon: Calculator, keywords: ['tacheometry', 'stadia', 'hair'] },

  // Coordinate Systems
  { id: 'coordinates', name: 'Coordinate Transform', description: 'WGS84 ↔ Arc 1960 ↔ Cassini', category: 'Coordinates', href: '/tools/coordinates', icon: Layers, keywords: ['coordinate', 'transform', 'wgs84', 'arc 1960', 'cassini', 'utm', 'datum'] },
  { id: 'cassini-utm', name: 'Cassini ↔ UTM', description: 'Legacy Cassini-Soldner to UTM conversion', category: 'Coordinates', href: '/tools/cassini-utm', icon: Layers, keywords: ['cassini', 'soldner', 'utm', 'colonial', 'legacy'] },
  { id: 'gnss', name: 'GNSS Tools', description: 'GNSS baseline, observation log', category: 'Coordinates', href: '/tools/gnss', icon: Satellite, keywords: ['gnss', 'gps', 'baseline', 'rinex'] },
  { id: 'gnss-baseline', name: 'GNSS Baseline', description: 'Baseline processing', category: 'Coordinates', href: '/tools/gnss-baseline', icon: Satellite, keywords: ['gnss', 'baseline', 'vector'] },

  // Engineering
  { id: 'road-design', name: 'Road Design', description: 'Road alignment, curves, setting out', category: 'Engineering', href: '/tools/road-design', icon: Building2, keywords: ['road', 'highway', 'alignment', 'design'] },
  { id: 'earthworks', name: 'Earthworks', description: 'Cut/fill volumes, mass haul', category: 'Engineering', href: '/tools/earthworks', icon: Mountain, keywords: ['earthwork', 'cut', 'fill', 'volume', 'mass haul'] },
  { id: 'cross-sections', name: 'Cross Sections', description: 'Road cross-section generation', category: 'Engineering', href: '/tools/cross-sections', icon: Layers, keywords: ['cross', 'section', 'profile'] },
  { id: 'slope-analysis', name: 'Slope Analysis', description: 'Terrain slope analysis', category: 'Engineering', href: '/tools/slope-analysis', icon: Mountain, keywords: ['slope', 'gradient', 'terrain'] },
  { id: 'setting-out', name: 'Setting Out', description: 'Construction setting out data', category: 'Engineering', href: '/tools/setting-out', icon: MapPin, keywords: ['setting', 'out', 'construction', 'stakeout'] },
  { id: 'superelevation', name: 'Superelevation', description: 'Curve superelevation calculation', category: 'Engineering', href: '/tools/superelevation', icon: Compass, keywords: ['superelevation', 'cant', 'curve'] },
  { id: 'sight-distance', name: 'Sight Distance', description: 'Stopping/overtaking sight distance', category: 'Engineering', href: '/tools/sight-distance', icon: Navigation, keywords: ['sight', 'distance', 'stopping', 'overtaking'] },

  // Volumes
  { id: 'volume-comparison', name: 'Volume Comparison', description: 'Compare two surface volumes', category: 'Volumes', href: '/tools/volume-comparison', icon: Mountain, keywords: ['volume', 'comparison', 'surface'] },

  // Documents
  { id: 'beacon-certificate', name: 'Beacon Certificate', description: 'Generate beacon certificate PDF', category: 'Documents', href: '/tools/beacon-certificate', icon: FileText, keywords: ['beacon', 'certificate', 'pdf'] },
  { id: 'survey-report', name: 'Survey Report Builder', description: 'Build comprehensive survey report', category: 'Documents', href: '/tools/survey-report-builder', icon: FileText, keywords: ['report', 'survey', 'document'] },
  { id: 'statutory-workbook', name: 'Statutory Workbook', description: 'Generate statutory workbook', category: 'Documents', href: '/tools/statutory-workbook', icon: FileText, keywords: ['statutory', 'workbook', 'submission'] },

  // Leveling
  { id: 'level-book', name: 'Level Book', description: 'Digital level book', category: 'Field Books', href: '/tools/level-book', icon: FileText, keywords: ['level', 'book', 'field'] },
  { id: 'traverse-field-book', name: 'Traverse Field Book', description: 'Traverse field book', category: 'Field Books', href: '/tools/traverse-field-book', icon: FileText, keywords: ['traverse', 'field', 'book'] },
  { id: 'two-peg-test', name: 'Two Peg Test', description: 'Collimation check', category: 'Field Books', href: '/tools/two-peg-test', icon: Ruler, keywords: ['two', 'peg', 'test', 'collimation'] },

  // Validation
  { id: 'gcp-validation', name: 'GCP Validation', description: 'Ground control point validation', category: 'Validation', href: '/tools/gcp-validation', icon: MapPin, keywords: ['gcp', 'ground', 'control', 'validation'] },
  { id: 'detail-tolerances', name: 'Detail Tolerances', description: 'Survey detail tolerance check', category: 'Validation', href: '/tools/detail-tolerances', icon: Ruler, keywords: ['detail', 'tolerance', 'accuracy'] },

  // Advanced
  { id: 'cut-fill', name: 'Cut & Fill Engine', description: 'Earthwork volume with heat map', category: 'Engineering', href: '/tools/cut-fill', icon: Mountain, keywords: ['cut', 'fill', 'earthwork', 'volume', 'grid'] },
  { id: 'deformation', name: 'Deformation Monitor', description: 'Epoch tracking + displacement', category: 'Validation', href: '/tools/deformation', icon: Activity, keywords: ['deformation', 'monitoring', 'epoch', 'displacement', 'dam', 'settlement'] },
  { id: 'gcp-optimizer', name: 'GCP Optimizer', description: 'Drone GCP planning + Pix4D export', category: 'Engineering', href: '/tools/gcp-optimizer', icon: MapPin, keywords: ['gcp', 'drone', 'pix4d', 'webodm', 'ground', 'control'] },
  { id: 'lsa', name: 'Least Squares', description: 'Parametric adjustment + error ellipses', category: 'Calculations', href: '/tools/lsa', icon: Calculator, keywords: ['least', 'squares', 'adjustment', 'lsa', 'control', 'network'] },
  { id: 'field-records', name: 'F/R Vault', description: 'Historic field record search', category: 'Documents', href: '/field-records', icon: FileText, keywords: ['field', 'record', 'fr', 'historic', 'archive', 'vault'] },
  { id: 'staking-table', name: 'Staking Table', description: 'Batch staking + chainage schedule for setting out', category: 'Engineering', href: '/tools/staking-table', icon: MapPin, keywords: ['staking', 'setting', 'out', 'chainage', 'offset', 'alignment', 'curve'] },
  { id: 'mass-haul', name: 'Mass Haul Optimization', description: 'Free-haul, overhaul, borrow/spoil analysis', category: 'Engineering', href: '/tools/mass-haul', icon: Mountain, keywords: ['mass', 'haul', 'overhaul', 'borrow', 'spoil', 'earthwork', 'cost'] },
  { id: 'title-comparison', name: 'Title Dimension Check', description: 'Compare surveyed vs title deed dimensions', category: 'Validation', href: '/tools/title-comparison', icon: FileCheck, keywords: ['title', 'dimension', 'comparison', 'deed', 'mutation', 'discrepancy'] },
  { id: 'boundary-dispute', name: 'Boundary Dispute Analysis', description: 'Overlay legal boundary vs physical occupation', category: 'Validation', href: '/tools/boundary-dispute', icon: AlertTriangle, keywords: ['boundary', 'dispute', 'encroachment', 'fence', 'occupation', 'legal'] },
  { id: 'sectional-properties', name: 'Sectional Properties', description: 'Apartment units, parking, common areas per Act 2020', category: 'Documents', href: '/tools/sectional-properties', icon: Building, keywords: ['sectional', 'apartment', 'unit', 'floor', 'participation', 'quota'] },
  { id: 'encumbrance', name: 'Encumbrance Registration', description: 'Wayleaves, easements, restrictions on parcels', category: 'Documents', href: '/tools/encumbrance', icon: FileText, keywords: ['encumbrance', 'wayleave', 'easement', 'restriction', 'caveat', 'kplc'] },
  { id: 'super-runout', name: 'Superelevation Runout', description: 'Cross-slope transition profile diagram', category: 'Engineering', href: '/tools/super-runout', icon: Activity, keywords: ['superelevation', 'runout', 'transition', 'cross', 'slope', 'crown'] },
  { id: 'grade-analysis', name: 'Grade Analysis', description: 'Sustained grades, critical lengths, climbing lane warrants', category: 'Engineering', href: '/tools/grade-analysis', icon: TrendingUp, keywords: ['grade', 'slope', 'critical', 'climbing', 'lane', 'sustained'] },
  { id: 'pier-alignment', name: 'Bridge Pier Alignment', description: 'Perpendicular offsets from centerline at pier locations', category: 'Engineering', href: '/tools/pier-alignment', icon: Building, keywords: ['bridge', 'pier', 'alignment', 'offset', 'perpendicular', 'staking'] },
  { id: 'pipeline-asbuilt', name: 'Pipeline As-Built', description: 'Invert levels, cover depth, joint schedule', category: 'Engineering', href: '/tools/pipeline-asbuilt', icon: Activity, keywords: ['pipeline', 'as-built', 'invert', 'cover', 'joint', 'pipe'] },
  { id: 'composite-plans', name: 'Composite Plans', description: 'Multi-parcel layout on A1/A0 sheets, registry index', category: 'Documents', href: '/tools/composite-plans', icon: Layers, keywords: ['composite', 'plan', 'sheet', 'registry', 'index', 'multi', 'parcel'] },
  { id: 'community-land', name: 'Community Land Survey', description: 'Communal boundaries per Community Land Act 2016', category: 'Documents', href: '/tools/community-land', icon: Building2, keywords: ['community', 'land', 'communal', 'household', 'grazing', 'farming'] },
  { id: 'adverse-possession', name: 'Adverse Possession', description: 'Evaluate 12-year occupation claim per Limitation Act', category: 'Validation', href: '/tools/adverse-possession', icon: AlertTriangle, keywords: ['adverse', 'possession', 'occupation', 'limitation', '12', 'years', 'claim'] },
]

const CATEGORIES = ['All', 'Calculations', 'Coordinates', 'Engineering', 'Volumes', 'Documents', 'Field Books', 'Validation']

const CATEGORY_ICONS: Record<string, typeof Calculator> = {
  All: Layers,
  Calculations: Calculator,
  Coordinates: Compass,
  Engineering: Building2,
  Volumes: Mountain,
  Documents: FileText,
  'Field Books': FileText,
  Validation: Ruler,
}

export function ProcessingToolbox({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [favorites, setFavorites] = useState<string[]>([])
  const [recent, setRecent] = useState<string[]>([])

  // Load favorites and recent from localStorage.
  // P1-4 (2026-07-24): Unified with /tools catalog page storage keys.
  // Read from both old (metardu-tool-*) and canonical (metardu-*-tools)
  // keys for backward compat, write only to canonical.
  useEffect(() => {
    const canonicalFav = JSON.parse(localStorage.getItem('metardu-fav-tools') || '[]')
    const oldFav = JSON.parse(localStorage.getItem('metardu-tool-favorites') || '[]')
    const fav = Array.from(new Set([...canonicalFav, ...oldFav])) as string[]

    const canonicalRec = JSON.parse(localStorage.getItem('metardu-recent-tools') || '[]')
    const oldRec = JSON.parse(localStorage.getItem('metardu-tool-recent') || '[]')
    const rec = Array.from(new Set([...canonicalRec, ...oldRec])) as string[]

    setFavorites(fav)
    setRecent(rec)
  }, [])

  const toggleFavorite = useCallback((toolId: string) => {
    setFavorites(prev => {
      const next = prev.includes(toolId)
        ? prev.filter(id => id !== toolId)
        : [...prev, toolId]
      // Write to canonical key only
      localStorage.setItem('metardu-fav-tools', JSON.stringify(next))
      return next
    })
  }, [])

  const handleToolClick = useCallback((tool: Tool) => {
    // Add to recent
    setRecent(prev => {
      const next = [tool.id, ...prev.filter(id => id !== tool.id)].slice(0, 8)
      // Write to canonical key only
      localStorage.setItem('metardu-recent-tools', JSON.stringify(next))
      return next
    })
    router.push(tool.href)
  }, [router])

  // Filter tools
  const filteredTools = useMemo(() => {
    let result = TOOLS
    if (activeCategory !== 'All') {
      result = result.filter(t => t.category === activeCategory)
    }
    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.keywords.some(k => k.includes(q))
      )
    }
    return result
  }, [query, activeCategory])

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, Tool[]> = {}
    for (const tool of filteredTools) {
      if (!groups[tool.category]) groups[tool.category] = []
      groups[tool.category].push(tool)
    }
    return groups
  }, [filteredTools])

  const recentTools = useMemo(() => {
    return recent
      .map(id => TOOLS.find(t => t.id === id))
      .filter((t): t is Tool => t !== undefined)
  }, [recent])

  const favoriteTools = useMemo(() => {
    return favorites
      .map(id => TOOLS.find(t => t.id === id))
      .filter((t): t is Tool => t !== undefined)
  }, [favorites])

  return (
    <div className={`flex flex-col ${compact ? 'h-full' : 'h-[600px]'} bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] overflow-hidden`}>
      {/* Search bar */}
      <div className="p-3 border-b border-[var(--border-color)]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search 60+ tools..." placeholder="Search 60+ tools..."
            className="w-full h-9 pl-9 pr-8 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] placeholder-gray-600 focus:border-[var(--accent)]/30 focus:outline-none"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Category filter */}
      <div className="px-3 py-2 border-b border-[var(--border-color)] flex items-center gap-1.5 overflow-x-auto">
        {CATEGORIES.map(cat => {
          const Icon = CATEGORY_ICONS[cat]
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat
                  ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)]'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-white/[0.04]'
              }`}
            >
              {Icon && <Icon className="w-3 h-3" />}
              {cat}
            </button>
          )
        })}
      </div>

      {/* Tool list */}
      <div className="flex-1 overflow-y-auto">
        {/* Recent tools */}
        {recentTools.length > 0 && !query && activeCategory === 'All' && (
          <div className="p-3 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="w-3 h-3 text-gray-500" />
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Recent</span>
            </div>
            <div className="space-y-1">
              {recentTools.slice(0, 4).map(tool => (
                <ToolRow
                  key={tool.id}
                  tool={tool}
                  isFavorite={favorites.includes(tool.id)}
                  onToggleFavorite={() => toggleFavorite(tool.id)}
                  onClick={() => handleToolClick(tool)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Favorites */}
        {favoriteTools.length > 0 && !query && activeCategory === 'All' && (
          <div className="p-3 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-1.5 mb-2">
              <Star className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Favorites</span>
            </div>
            <div className="space-y-1">
              {favoriteTools.map(tool => (
                <ToolRow
                  key={tool.id}
                  tool={tool}
                  isFavorite={true}
                  onToggleFavorite={() => toggleFavorite(tool.id)}
                  onClick={() => handleToolClick(tool)}
                />
              ))}
            </div>
          </div>
        )}

        {/* All tools grouped by category */}
        {Object.entries(grouped).map(([cat, tools]) => (
          <div key={cat} className="p-3 border-b border-[var(--border-color)]/50">
            <div className="flex items-center gap-1.5 mb-2">
              {(() => {
                const Icon = CATEGORY_ICONS[cat] || Calculator
                return <Icon className="w-3 h-3 text-gray-500" />
              })()}
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{cat}</span>
              <span className="text-[9px] text-gray-600">({tools.length})</span>
            </div>
            <div className="space-y-1">
              {tools.map(tool => (
                <ToolRow
                  key={tool.id}
                  tool={tool}
                  isFavorite={favorites.includes(tool.id)}
                  onToggleFavorite={() => toggleFavorite(tool.id)}
                  onClick={() => handleToolClick(tool)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* No results */}
        {filteredTools.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="w-8 h-8 text-gray-600 mb-2" />
            <p className="text-sm text-gray-500">No tools found for &quot;{query}&quot;</p>
            <p className="text-[10px] text-gray-600 mt-1">Try a different search term</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ToolRow({
  tool,
  isFavorite,
  onToggleFavorite,
  onClick,
}: {
  tool: Tool
  isFavorite: boolean
  onToggleFavorite: () => void
  onClick: () => void
}) {
  const Icon = tool.icon
  return (
    <div
      onClick={onClick}
      className="group flex items-center gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-white/[0.04] transition-colors"
    >
      <div className="shrink-0 w-8 h-8 rounded-lg bg-[var(--accent)]/5 border border-[var(--accent)]/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-[var(--accent)]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-[var(--text-primary)] truncate">{tool.name}</div>
        <div className="text-[10px] text-gray-500 truncate">{tool.description}</div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
        className="shrink-0 w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-amber-400 text-amber-400' : 'text-gray-500 hover:text-amber-400'}`} />
      </button>
      <ChevronRight className="w-3.5 h-3.5 text-gray-600 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  )
}
