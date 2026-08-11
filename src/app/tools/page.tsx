'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/shared/PageHeader'
import { useSubscription } from '@/lib/subscription/subscriptionContext'
import { trackToolUsed } from '@/lib/analytics/events'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import type { FeatureKey } from '@/lib/subscription/featureGates'
import type { PlanId } from '@/lib/subscription/catalog'
import type { ComponentType } from 'react'
import {
  BookOpenText,
  ChartArea,
  ChartColumnIncreasing,
  ChartNoAxesCombined,
  ClipboardCheck,
  Compass,
  Construction,
  Download,
  DraftingCompass,
  Drone,
  Eye,
  FileCheck,
  FileBadge,
  FileChartColumn,
  FileCog,
  FileSpreadsheet,
  FileStack,
  GitBranch,
  Globe,
  Grid3X3,
  LandPlot,
  MapPinned,
  Milestone,
  Mountain,
  Layers,
  NotebookPen,
  Pickaxe,
  PlaneTakeoff,
  RadioTower,
  Ruler,
  RulerDimensionLine,
  Satellite,
  ScanLine,
  Search,
  Ship,
  Spline,
  SquareDashedMousePointer,
  Star,
  TrendingUp,
  Waypoints,
  X,
  Lock,
  Clock,
  ArrowRightLeft,
} from 'lucide-react'

/* ══════════════════════════════════════════════════════════════════════
 *  TOOL FEATURE GATE MAP
 *  Maps each tool route to the minimum plan + feature key required.
 *  If a tool is NOT in this map, it's available on ALL tiers (free+).
 *
 *  P0-2 (2026-07-24): Moved to src/lib/subscription/toolGates.ts as the
 *  single source of truth. The catalog page imports it for badge display;
 *  each gated tool page wraps its content in <ToolGate> for enforcement.
 * ══════════════════════════════════════════════════════════════════════ */
import { TOOL_GATES, PLAN_RANK, type GateInfo } from '@/lib/subscription/toolGates'
type GateInfoLocal = GateInfo // alias to keep the rest of this file unchanged

const TOOL_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  '/tools/beacon-certificate': FileBadge,
  '/tools/billable-documents': FileStack,
  '/tools/gnss-observation-log': Satellite,
  '/tools/statutory-workbook': FileSpreadsheet,
  '/tools/survey-report-builder': FileChartColumn,
  '/tools/mobilisation-report': ClipboardCheck,
  '/tools/level-book': NotebookPen,
  '/tools/setting-out': MapPinned,
  '/tools/missing-line': GitBranch,
  '/tools/control-marks-register': RadioTower,
  '/tools/pile-grid': Grid3X3,
  '/tools/leveling': ChartNoAxesCombined,
  '/tools/two-peg-test': Ruler,
  '/tools/height-of-object': RulerDimensionLine,
  '/tools/distance': RulerDimensionLine,
  '/tools/bearing': Compass,
  '/tools/area': LandPlot,
  '/tools/grade': TrendingUp,
  '/tools/traverse': Waypoints,
  '/tools/traverse-field-book': BookOpenText,
  '/tools/coordinates': DraftingCompass,
  '/tools/cassini-utm': ArrowRightLeft,
  '/tools/cogo': DraftingCompass,
  '/tools/gnss': Satellite,
  '/tools/road-design': Construction,
  '/tools/earthworks': Mountain,
  '/tools/curves': Spline,
  '/tools/vertical-curve-designer': TrendingUp,
  '/tools/tacheometry': ScanLine,
  '/tools/drone': Drone,
  '/tools/orthophoto-viewer': Eye,
  '/tools/gcp-validation': FileCheck,
  '/tools/contour-generator': Layers,
  '/tools/volume-comparison': ChartNoAxesCombined,
  '/tools/point-cloud-import': ScanLine,
  '/tools/topo-drawing': SquareDashedMousePointer,
  '/tools/slope-analysis': ChartArea,
  '/tools/machine-control': PlaneTakeoff,
  '/tools/progress-monitor': ChartColumnIncreasing,
  '/tools/beacon-reference': RadioTower,
  '/tools/survey-regulations': BookOpenText,
  '/tools/us-survey-reference': Globe,
  '/tools/detail-tolerances': Ruler,
  '/tools/superelevation': TrendingUp,
  '/tools/sight-distance': Eye,
  '/tools/pipe-gradient': Construction,
  '/tools/chainage': Milestone,
  '/tools/cross-sections': ChartNoAxesCombined,
  '/tools/civil-export': Download,
  '/tools/gis-export': Download,
  '/tools/gcp-export': Download,
  '/tools/survey-plan-demo': MapPinned,
  '/tools/mutation-plan': MapPinned,
  '/tools/gnss-baseline': Satellite,
}

/* ══════════════════════════════════════════════════════════════════════
 *  RECENTLY USED TOOLS (localStorage)
 * ══════════════════════════════════════════════════════════════════════ */
const STORAGE_KEY = 'metardu-recent-tools'
const MAX_RECENT = 6

function getRecentTools(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as string[]
  } catch {
    return []
  }
}

function addRecentTool(href: string) {
  try {
    const recent = getRecentTools().filter(h => h !== href)
    recent.unshift(href)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)))
  } catch { /* ignore */ }
}

/* ══════════════════════════════════════════════════════════════════════
 *  FAVORITE TOOLS (localStorage)
 * ══════════════════════════════════════════════════════════════════════ */
const FAV_STORAGE_KEY = 'metardu-fav-tools'

function getFavTools(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FAV_STORAGE_KEY) || '[]') as string[]
  } catch {
    return []
  }
}

function toggleFavTool(href: string): boolean {
  try {
    const favs = getFavTools()
    const isFav = favs.includes(href)
    const updated = isFav ? favs.filter(h => h !== href) : [href, ...favs]
    localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(updated))
    return !isFav
  } catch {
    return false
  }
}

/* ══════════════════════════════════════════════════════════════════════
 *  TOOL DEFINITIONS (structured data for search/filter)
 * ══════════════════════════════════════════════════════════════════════ */
interface ToolDef {
  href: string
  title: string
  description: string
  badge?: string
  section: string
  keywords: string
}

const TOOL_DEFS: ToolDef[] = [
  // Documents & Certificates
  { href: '/tools/beacon-certificate', title: 'Beacon Certificate', description: 'Signed beacon description sheet | Reg. 20 Survey Regulations 1994', badge: 'NEW', section: 'Documents & Certificates', keywords: 'beacon certificate signed description sheet reg 20' },
  { href: '/tools/billable-documents', title: 'Billable Documents', description: 'Subdivision, road reserve, valuation, title search, and setback certificates', badge: 'NEW', section: 'Documents & Certificates', keywords: 'billable subdivision road reserve valuation title search setback certificate' },
  { href: '/tools/gnss-observation-log', title: 'GNSS Observation Log', description: 'Occupation schedule & baseline report | ISO 17123-8', badge: 'NEW', section: 'Documents & Certificates', keywords: 'gnss observation log occupation schedule baseline iso 17123' },
  { href: '/tools/statutory-workbook', title: 'Statutory Workbook', description: '9-sheet field abstract and computation workbook', badge: 'NEW', section: 'Documents & Certificates', keywords: 'statutory workbook field abstract computation 9-sheet' },
  { href: '/tools/detail-tolerances', title: 'Detail Tolerances', description: 'RDM 1.1 Table 5.2 detailed survey tolerances (printable)', section: 'Documents & Certificates', keywords: 'detail tolerances rdm table 5.2 survey' },
  { href: '/tools/survey-report-builder', title: 'Survey Report', description: 'RDM 1.1 Table 5.4 topographic survey report', section: 'Documents & Certificates', keywords: 'survey report builder rdm table 5.4 topographic' },
  { href: '/tools/mobilisation-report', title: 'Mobilisation Report', description: 'RDM 1.1 Table 5.3 field mobilisation sheet', section: 'Documents & Certificates', keywords: 'mobilisation report rdm table 5.3 field sheet' },

  // Field Layout
  { href: '/tools/setting-out', title: 'Setting Out', description: 'Stakeout from known coords | RDM 1.1', section: 'Field Layout', keywords: 'setting out stakeout known coordinates rdm' },
  { href: '/tools/missing-line', title: 'Missing Line', description: 'Distance & bearing between two points', section: 'Field Layout', keywords: 'missing line distance bearing two points' },
  { href: '/tools/control-marks-register', title: 'Control Marks Register', description: 'RDM 1.1 s5.6.3 mark register', section: 'Field Layout', keywords: 'control marks register rdm 5.6.3 mark' },
  { href: '/tools/pile-grid', title: 'Pile / Column Grid', description: 'Foundation grid coordinates & staking | Basak §8.5', badge: 'NEW', section: 'Field Layout', keywords: 'pile column grid foundation staking basak' },

  // Leveling
  { href: '/tools/leveling', title: 'Leveling', description: 'Quick differential levelling | 10√K closure', section: 'Leveling', keywords: 'leveling differential levelling closure 10√K' },
  { href: '/tools/level-book', title: 'Level Book', description: 'HPC / Rise & Fall field book | 10√K closure', section: 'Leveling', keywords: 'level book hpc rise fall field closure' },
  { href: '/tools/two-peg-test', title: 'Two Peg Test', description: 'Instrument collimation error check', section: 'Leveling', keywords: 'two peg test collimation error instrument' },
  { href: '/tools/height-of-object', title: 'Height of Object', description: 'Trigonometric height measurement', section: 'Leveling', keywords: 'height object trigonometric measurement' },

  // Calculations
  { href: '/tools/distance', title: 'Distance & Bearing', description: 'WCB & distance from coordinates', section: 'Calculations', keywords: 'distance bearing wcb coordinates' },
  { href: '/tools/bearing', title: 'Bearing', description: 'Forward & back bearing computation', section: 'Calculations', keywords: 'bearing forward back computation' },
  { href: '/tools/area', title: 'Area', description: 'Area from coordinate list', section: 'Calculations', keywords: 'area coordinate list computation' },
  { href: '/tools/grade', title: 'Gradient', description: 'Gradient & slope percentage', section: 'Calculations', keywords: 'gradient grade slope percentage' },

  // Traverse & Adjustment
  { href: '/tools/traverse', title: 'Traverse', description: 'Bowditch/Transit closed traverse | RDM 1.1 grading', section: 'Traverse & Adjustment', keywords: 'traverse bowditch transit closed rdm grading' },
  { href: '/tools/traverse-field-book', title: 'Traverse Field Book', description: 'Field observations with angular closure', section: 'Traverse & Adjustment', keywords: 'traverse field book observations angular closure' },
  { href: '/tools/coordinates', title: 'Coordinates', description: 'Survey Regulations 1994 | Kenya UTM Zones 36S/37S', section: 'Traverse & Adjustment', keywords: 'coordinates kenya utm zones 36s 37s survey regulations' },
  { href: '/tools/cassini-utm', title: 'Cassini ↔ UTM Converter', description: 'Convert legacy Cassini-Soldner (Clarke 1858) to UTM with preset Kenya district origins', badge: 'NEW', section: 'Traverse & Adjustment', keywords: 'cassini soldner utm converter clarke 1858 kenya district origin legacy' },
  { href: '/tools/cogo', title: 'COGO Calculator', description: 'Coordinate geometry computations', section: 'Traverse & Adjustment', keywords: 'cogo coordinate geometry calculator' },
  { href: '/tools/gnss', title: 'GNSS', description: 'GNSS observation & baseline processing', section: 'Traverse & Adjustment', keywords: 'gnss observation baseline processing' },

  // Road Design
  { href: '/tools/road-design', title: 'Road Design', description: 'Full road design workflow | RDM 1.1 (2025)', section: 'Road Design', keywords: 'road design workflow rdm' },
  { href: '/tools/earthworks', title: 'Earthworks', description: 'Cut/fill volumes | Prismoidal formula | RDM 1.1', section: 'Road Design', keywords: 'earthworks cut fill volumes prismoidal formula rdm' },
  { href: '/tools/curves', title: 'Horizontal Curves', description: 'Horizontal/vertical curve elements | RDM 1.1', section: 'Road Design', keywords: 'curves horizontal vertical elements rdm' },
  { href: '/tools/vertical-curve-designer', title: 'Vertical Curve Designer', description: 'Multi-VIP parabolic alignment with AASHTO K-factor & SSD compliance checking | Tier 2', badge: 'NEW', section: 'Road Design', keywords: 'vertical curve parabolic k factor ssd aashto alignment vip' },
  { href: '/tools/tacheometry', title: 'Tacheometry', description: 'Stadia/EDM distance & elevation | RDM 1.1 Section 5.6', section: 'Road Design', keywords: 'tacheometry stadia edm distance elevation rdm 5.6' },
  { href: '/tools/superelevation', title: 'Superelevation', description: 'e = V²/127R calculator per KRDM', section: 'Road Design', keywords: 'superelevation v2 127r krdm calculator' },
  { href: '/tools/sight-distance', title: 'Sight Distance', description: 'SSD & OSD calculator per KRDM/KeRRA', section: 'Road Design', keywords: 'sight distance ssd osd krdm kerra calculator' },
  { href: '/tools/pipe-gradient', title: 'Pipe Gradient', description: "Manning's equation pipe gradient check with drainage standards", section: 'Road Design', keywords: 'pipe gradient mannings equation drainage' },
  { href: '/tools/chainage', title: 'Chainage', description: 'Chainage calculator for road projects', section: 'Road Design', keywords: 'chainage calculator road projects' },

  // Earthworks & Volumes
  { href: '/tools/cross-sections', title: 'Cross Sections', description: 'Road cross-section generation and analysis', section: 'Earthworks & Volumes', keywords: 'cross sections road generation analysis' },

  // Specialized Surveys
  { href: '/tools/drone', title: 'Drone/UAV', description: 'UAV survey & GCP processing', section: 'Specialized Surveys', keywords: 'drone uav survey gcp processing' },
  { href: '/tools/orthophoto-viewer', title: 'GeoTIFF / Orthophoto Viewer', description: 'Upload orthophotos from Pix4D/Agisoft, trace boundaries on the map, export DXF & KML', badge: 'NEW', section: 'Drone-to-Cadastral Bridge', keywords: 'geotiff orthophoto viewer trace boundaries pix4d agisoft dxf kml' },
  { href: '/tools/gcp-validation', title: 'GCP Residual Validation', description: 'Import residuals from Agisoft/Pix4D, compare against known GCPs, flag per Kenya accuracy classes', badge: 'NEW', section: 'Drone-to-Cadastral Bridge', keywords: 'gcp residual validation agisoft pix4d accuracy class kenya isk' },
  { href: '/tools/point-cloud-import', title: 'Point Cloud Import', description: 'Import XYZ/CSV point clouds from CloudCompare/Agisoft into slope analysis & TIN volume engine', badge: 'NEW', section: 'Drone-to-Cadastral Bridge', keywords: 'point cloud import xyz csv cloudcompare agisoft slope tin volume' },
  { href: '/tools/contour-generator', title: 'Contour Generator', description: 'Generate contour lines from point cloud data with TIN interpolation, SVG map preview, DXF & KML export', badge: 'NEW', section: 'Drone-to-Cadastral Bridge', keywords: 'contour generator point cloud tin marching triangles dxf kml svg' },
  { href: '/tools/volume-comparison', title: 'Volume Comparison', description: 'Compare two surveys — cut/fill volumes between existing and as-built surfaces using TIN or IDW grid methods', badge: 'NEW', section: 'Drone-to-Cadastral Bridge', keywords: 'volume comparison cut fill survey as-built tin idw earthworks' },
  { href: '/tools/topo-drawing', title: 'Topo Drawing Composer', description: 'Feature codes & DXF topographic drawings', badge: 'NEW', section: 'Specialized Surveys', keywords: 'topo drawing composer feature codes dxf topographic' },
  { href: '/tools/slope-analysis', title: 'Slope & Area Analysis', description: 'DTM slope classification, cut/fill, area', badge: 'NEW', section: 'Specialized Surveys', keywords: 'slope area analysis dtm classification cut fill' },
  { href: '/tools/gnss-baseline', title: 'GNSS Baseline', description: 'GNSS baseline file processing | RINEX, Topcon, Trimble', section: 'Specialized Surveys', keywords: 'gnss baseline rinex topcon trimble processing' },
  { href: '/tools/survey-plan-demo', title: 'Survey Plan Viewer', description: 'CAD-style boundary identification plan renderer', section: 'Specialized Surveys', keywords: 'survey plan viewer cad boundary identification renderer' },
  { href: '/tools/mutation-plan', title: 'Mutation Survey Plan (Form No. 3)', description: 'Generate Form No. 3 mutation scheme plans for subdivision submissions to Director of Surveys', badge: 'NEW', section: 'Documents & Certificates', keywords: 'mutation form 3 survey plan subdivision scheme' },

  // Engineering
  { href: '/tools/machine-control', title: 'Machine Control Export', description: 'Trimble, Leica, Topcon export formats', badge: 'NEW', section: 'Engineering', keywords: 'machine control export trimble leica topcon' },
  { href: '/tools/progress-monitor', title: 'Progress Monitor', description: 'Construction progress tracking & reports', badge: 'NEW', section: 'Engineering', keywords: 'progress monitor construction tracking reports' },

  // Data Export
  { href: '/tools/civil-export', title: 'Civil Engineering Export', description: 'Export for Civil 3D, 12d, QGIS, ArcGIS, CloudCompare', section: 'Data Export', keywords: 'civil engineering export 3d 12d qgis arcgis cloudcompare' },
  { href: '/tools/gis-export', title: 'GIS Export', description: 'GeoJSON, KML, LandXML, CSV with UTM to WGS84 conversion', section: 'Data Export', keywords: 'gis export geojson kml landxml csv utm wgs84' },
  { href: '/tools/gcp-export', title: 'GCP Export', description: 'Ground control points for Pix4D, DroneDeploy, Metashape, ODM', section: 'Data Export', keywords: 'gcp export ground control points pix4d dronedeploy metashape odm' },

  // Reference
  { href: '/tools/beacon-reference', title: 'Beacon Reference', description: 'Kenya Survey Regulations 1994 beacon symbols & descriptions', section: 'Reference', keywords: 'beacon reference kenya survey regulations symbols descriptions' },
  { href: '/tools/survey-regulations', title: 'Kenya Survey Standards', description: 'Permitted errors, datums, UTM zones, accuracy classes', section: 'Reference', keywords: 'kenya survey standards permitted errors datums utm zones accuracy' },
  { href: '/tools/us-survey-reference', title: 'US Survey Standards', description: 'BLM Manual, FWS Land Survey Handbook, DOJ Title Standards', section: 'Reference', keywords: 'us survey standards blm manual fws doj title' },
]

const SECTION_ORDER = [
  'Documents & Certificates',
  'Field Layout',
  'Leveling',
  'Calculations',
  'Traverse & Adjustment',
  'Road Design',
  'Earthworks & Volumes',
  'Specialized Surveys',
  'Drone-to-Cadastral Bridge',
  'Engineering',
  'Data Export',
  'Reference',
]

/* ══════════════════════════════════════════════════════════════════════
 *  NEW BADGE EXPIRY (time-based)
 * ══════════════════════════════════════════════════════════════════════ */
const NEW_BADGE_EXPIRY_DAYS = 30
const NEW_BADGE_START: Record<string, string> = {
  '/tools/beacon-certificate': '2025-05-15',
  '/tools/billable-documents': '2025-05-15',
  '/tools/gnss-observation-log': '2025-05-15',
  '/tools/statutory-workbook': '2025-05-15',
  '/tools/pile-grid': '2025-05-15',
  '/tools/topo-drawing': '2025-05-20',
  '/tools/slope-analysis': '2025-05-20',
  '/tools/machine-control': '2025-05-25',
  '/tools/progress-monitor': '2025-05-25',
  '/tools/mutation-plan': '2026-06-01',
  '/tools/orthophoto-viewer': '2026-06-01',
  '/tools/gcp-validation': '2026-06-01',
  '/tools/point-cloud-import': '2026-06-01',
  '/tools/contour-generator': '2026-06-01',
  '/tools/volume-comparison': '2026-06-01',
  '/tools/vertical-curve-designer': '2026-07-02',
  '/tools/cassini-utm': '2026-06-02',
}

function isActiveNewBadge(href: string): boolean {
  const startStr = NEW_BADGE_START[href]
  if (!startStr) return false
  const startDate = new Date(startStr)
  const now = new Date()
  const diffDays = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  return diffDays >= 0 && diffDays <= NEW_BADGE_EXPIRY_DAYS
}

function getEffectiveBadge(tool: ToolDef): string | undefined {
  if (!tool.badge) return undefined
  if (tool.badge === 'NEW' && !isActiveNewBadge(tool.href)) return undefined
  return tool.badge
}

/* ══════════════════════════════════════════════════════════════════════
 *  MAIN COMPONENT
 * ══════════════════════════════════════════════════════════════════════ */
export default function ToolsPage() {
  const { plan, isAdmin, hasFeature, loading } = useSubscription()
  const [searchQuery, setSearchQuery] = useState('')
  const [recentTools, setRecentTools] = useState<string[]>([])
  const [favTools, setFavTools] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)
  const [activeSection, setActiveSection] = useState<string>('all')

  // Hydration-safe: only read localStorage after mount
  useEffect(() => {
    setRecentTools(getRecentTools())
    setFavTools(getFavTools())
    setMounted(true)
  }, [])

  const handleToggleFav = useCallback((href: string) => {
    const isNowFav = toggleFavTool(href)
    setFavTools(getFavTools())
  }, [])

  // Filter tools by section and search query
  const filteredTools = useMemo(() => {
    let tools = TOOL_DEFS
    if (activeSection !== 'all') {
      tools = tools.filter(t => t.section === activeSection)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      tools = tools.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.keywords.toLowerCase().includes(q) ||
        t.section.toLowerCase().includes(q)
      )
    }
    return tools
  }, [searchQuery, activeSection])

  // Group filtered tools by section
  const groupedTools = useMemo(() => {
    const groups: Record<string, ToolDef[]> = {}
    for (const tool of filteredTools) {
      if (!groups[tool.section]) groups[tool.section] = []
      groups[tool.section].push(tool)
    }
    // Return in defined section order
    return SECTION_ORDER
      .filter(s => groups[s]?.length)
      .map(s => ({ section: s, tools: groups[s] }))
  }, [filteredTools])

  // Recent tools (only show tools that exist in TOOL_DEFS)
  const recentToolDefs = useMemo(() => {
    if (!mounted) return []
    return recentTools
      .map(href => TOOL_DEFS.find(t => t.href === href))
      .filter((t): t is ToolDef => !!t)
  }, [recentTools, mounted])

  // Favorite tools
  const favToolDefs = useMemo(() => {
    if (!mounted) return []
    return favTools
      .map(href => TOOL_DEFS.find(t => t.href === href))
      .filter((t): t is ToolDef => !!t)
  }, [favTools, mounted])

  const userPlanRank = PLAN_RANK[plan] ?? 0

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-24 lg:pb-32">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Quick Tools</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        title="Quick Tools"
        subtitle="No project required — enter values and get instant results"
      />

      {/* ── CATEGORY FILTER TABS ── */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setActiveSection('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            activeSection === 'all'
              ? 'bg-[var(--accent)] text-black'
              : 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-white hover:border-[var(--accent)]/30'
          }`}
        >
          All Tools
        </button>
        {SECTION_ORDER.map(s => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              activeSection === s
                ? 'bg-[var(--accent)] text-black'
                : 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-white hover:border-[var(--accent)]/30'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* ── SEARCH BAR ────────────────────────────────────────────── */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search tools" placeholder="Search tools by name, category, or keyword..."
          className="w-full h-10 pl-10 pr-10 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-8">

        {/* ── RECENTLY USED ─────────────────────────────────────────── */}
        {mounted && recentToolDefs.length > 0 && !searchQuery && (
          <section>
            <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              Recently Used
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {recentToolDefs.map(tool => (
                <ToolLink
                  key={tool.href}
                  href={tool.href}
                  title={tool.title}
                  description={tool.description}
                  badge={getEffectiveBadge(tool)}
                  gate={TOOL_GATES[tool.href]}
                  userPlanRank={userPlanRank}
                  hasFeature={hasFeature}
                  isFav={favTools.includes(tool.href)}
                  onToggleFav={handleToggleFav}
                  onNavigate={addRecentTool}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── FAVORITES ─────────────────────────────────────────────── */}
        {mounted && favToolDefs.length > 0 && !searchQuery && (
          <section>
            <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
              <Star className="h-3.5 w-3.5" />
              Favorites
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {favToolDefs.map(tool => (
                <ToolLink
                  key={tool.href}
                  href={tool.href}
                  title={tool.title}
                  description={tool.description}
                  badge={getEffectiveBadge(tool)}
                  gate={TOOL_GATES[tool.href]}
                  userPlanRank={userPlanRank}
                  hasFeature={hasFeature}
                  isFav={true}
                  onToggleFav={handleToggleFav}
                  onNavigate={addRecentTool}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── SEARCH RESULTS / ALL TOOLS BY SECTION ─────────────────── */}
        {searchQuery && filteredTools.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[var(--text-muted)] text-sm">No tools found matching &quot;{searchQuery}&quot;</p>
            <button onClick={() => setSearchQuery('')} className="mt-2 text-[var(--accent)] text-sm hover:underline">
              Clear search
            </button>
          </div>
        )}

        {groupedTools.map(({ section, tools }) => (
          <section key={section}>
            <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
              {section}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {tools.map(tool => (
                <ToolLink
                  key={tool.href}
                  href={tool.href}
                  title={tool.title}
                  description={tool.description}
                  badge={getEffectiveBadge(tool)}
                  gate={TOOL_GATES[tool.href]}
                  userPlanRank={userPlanRank}
                  hasFeature={hasFeature}
                  isFav={favTools.includes(tool.href)}
                  onToggleFav={handleToggleFav}
                  onNavigate={addRecentTool}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
 *  TOOL LINK COMPONENT (with feature gating + favorites)
 * ══════════════════════════════════════════════════════════════════════ */
function ToolLink({
  href,
  title,
  description,
  badge,
  gate,
  userPlanRank,
  hasFeature,
  isFav,
  onToggleFav,
  onNavigate,
}: {
  href: string
  title: string
  description?: string
  badge?: string
  gate?: GateInfo
  userPlanRank: number
  hasFeature: (feature: string) => boolean
  isFav: boolean
  onToggleFav: (href: string) => void
  onNavigate: (href: string) => void
}) {
  const Icon = TOOL_ICONS[href] ?? FileCog

  const isLocked = gate ? !hasFeature(gate.feature) : false
  const requiredPlanRank = gate ? PLAN_RANK[gate.minPlan] : 0

  const handleClick = () => {
    if (!isLocked) {
      onNavigate(href)
      trackToolUsed(href)
    }
  }

  return (
    <div className="relative group">
      <Link
        href={isLocked ? '#' : href}
        onClick={handleClick}
        className={`card-interactive p-4 transition-colors block relative rounded-xl border bg-[var(--bg-card)] ${
          isLocked
            ? 'border-[var(--border-color)] cursor-not-allowed'
            : 'border-[var(--border-color)] hover:border-[var(--accent)]'
        }`}
      >
        {/* Top-right badges */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {badge && !isLocked && (
            <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-[var(--accent)] text-black leading-none">
              {badge}
            </span>
          )}
          {isLocked && gate && (
            <span className="flex items-center gap-1 text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 leading-none">
              <Lock className="h-2.5 w-2.5" />
              {gate.minPlan.toUpperCase()}
            </span>
          )}
        </div>

        {/* Favorite button */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFav(href) }}
          className={`absolute top-2 left-2 z-10 transition-opacity ${
            isFav ? 'opacity-100 text-amber-400' : 'opacity-0 group-hover:opacity-60 text-[var(--text-muted)] hover:!opacity-100 hover:text-amber-400'
          }`}
          title={isFav ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star className={`h-3.5 w-3.5 ${isFav ? 'fill-current' : ''}`} />
        </button>

        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--accent)]">
          <Icon className="h-5 w-5" />
        </div>
        <p className={`font-semibold text-sm pr-8 ${isLocked ? 'text-[var(--text-muted)]' : ''}`}>{title}</p>
        {description && <p className="text-xs text-[var(--text-muted)] mt-1">{description}</p>}

        {/* Upgrade prompt for locked tools */}
        {isLocked && gate && (
          <p className="text-[10px] text-amber-300 mt-2 flex items-center gap-1">
            <Lock className="h-3 w-3" />
            Requires {gate.minPlan.charAt(0).toUpperCase() + gate.minPlan.slice(1)} plan — {gate.label}
          </p>
        )}
      </Link>
    </div>
  )
}
