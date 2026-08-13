import {
  BadgeDollarSign, BarChart2, BookMarked,
  BookOpen, Box, Building2, CalendarDays, ChartNoAxesCombined,
  ChartSpline, CodeXml, Compass, Construction,
  CreditCard, DraftingCompass, FileBadge, FileChartColumn,
  FileSearch, FileSpreadsheet, FolderKanban,
  GitBranch, Globe, GraduationCap, HardDrive, IdCard, Landmark,
  LandPlot, Layout, MapPinned, Milestone, Mountain,
  NotebookPen, Orbit, Radar, RadioTower, Route,
  Ruler, RulerDimensionLine, Satellite, Scale, ScanLine, ScanSearch, Settings2,
  ShieldCheck, Spline, Store, TrendingUp,
  UserRound, Users, Waypoints, Workflow
} from 'lucide-react'
import type { ComponentType } from 'react'

export interface NavItem {
  label: string
  href: string
  icon: ComponentType<{ className?: string }>
  badge?: 'NEW' | 'AI' | 'BETA'
  description: string
  group: NavGroup
  requiresSubscription?: 'pro' | 'enterprise'
  adminOnly?: boolean
}

export type NavGroup =
  | 'CORE_TOOLS'
  | 'DOCUMENTS'
  | 'DATA'
  | 'COMMUNITY'
  | 'ENTERPRISE'
  | 'SETTINGS'
  | 'AI_MODULES'
  | 'ADMIN'

export const NAV_GROUPS: Record<NavGroup, { label: string; order: number }> = {
  CORE_TOOLS: { label: 'Survey Tools', order: 1 },
  DOCUMENTS: { label: 'Documents', order: 2 },
  DATA: { label: 'Data & Integration', order: 3 },
  COMMUNITY: { label: 'Community', order: 4 },
  ENTERPRISE: { label: 'Enterprise', order: 5 },
  SETTINGS: { label: 'Settings', order: 6 },
  AI_MODULES: { label: 'AI Modules', order: 7 },
  ADMIN: { label: 'Admin', order: 0 },
}

export const NAV_ITEMS: NavItem[] = [
  // CORE TOOLS
  { label: 'Dashboard', href: '/dashboard', icon: Layout, group: 'CORE_TOOLS', description: 'Project overview and recent activity' },
  { label: 'Traverse', href: '/tools/traverse', icon: Waypoints, group: 'CORE_TOOLS', description: 'Traverse adjustment and closure' },
  { label: 'COGO', href: '/tools/cogo', icon: DraftingCompass, group: 'CORE_TOOLS', description: 'Coordinate geometry calculations' },
  { label: 'Levelling', href: '/tools/leveling', icon: ChartNoAxesCombined, group: 'CORE_TOOLS', description: 'Rise & fall, height of collimation' },
  { label: 'Road Design', href: '/tools/road-design', icon: Construction, group: 'CORE_TOOLS', description: 'Horizontal & vertical curves, earthworks' },
  { label: 'Setting Out', href: '/tools/setting-out', icon: MapPinned, group: 'CORE_TOOLS', description: 'Bearing and distance stakeout sheets' },
  { label: 'Job Schedule', href: '/schedule', icon: CalendarDays, group: 'CORE_TOOLS', description: 'Plan and track survey job schedules with reminders' },
  { label: 'Field Book', href: '/fieldbook', icon: NotebookPen, group: 'CORE_TOOLS', description: 'Digital field book with offline sync' },
  { label: 'Coordinates', href: '/tools/coordinates', icon: Orbit, group: 'CORE_TOOLS', description: 'Coordinate transformations and conversions' },
  { label: 'Distance', href: '/tools/distance', icon: RulerDimensionLine, group: 'CORE_TOOLS', description: 'Distance calculations' },
  { label: 'Bearing', href: '/tools/bearing', icon: Compass, group: 'CORE_TOOLS', description: 'Bearing calculations' },
  { label: 'Area', href: '/tools/area', icon: LandPlot, group: 'CORE_TOOLS', description: 'Area calculations' },
  { label: 'Grade', href: '/tools/grade', icon: TrendingUp, group: 'CORE_TOOLS', description: 'Grade and gradient calculations' },
  { label: 'Curves', href: '/tools/curves', icon: Spline, group: 'CORE_TOOLS', description: 'Horizontal and vertical curves' },
  { label: 'Vertical Curve Designer', href: '/tools/vertical-curve-designer', icon: TrendingUp, group: 'CORE_TOOLS', badge: 'NEW', description: 'Multi-VIP parabolic alignment with AASHTO K-factor compliance' },
  { label: 'Chainage', href: '/tools/chainage', icon: Milestone, group: 'CORE_TOOLS', description: 'Chainage calculations' },
  { label: 'Tacheometry', href: '/tools/tacheometry', icon: ScanLine, group: 'CORE_TOOLS', description: 'Tacheometric survey calculations' },
  { label: 'Cross Sections', href: '/tools/cross-sections', icon: ChartSpline, group: 'CORE_TOOLS', description: 'Cross section analysis' },
  { label: 'Two Peg Test', href: '/tools/two-peg-test', icon: Ruler, group: 'CORE_TOOLS', description: 'Instrument calibration test' },
  { label: 'Earthworks', href: '/tools/earthworks', icon: Mountain, group: 'CORE_TOOLS', description: 'Cut and fill calculations' },
  { label: 'GNSS', href: '/tools/gnss', icon: Satellite, group: 'CORE_TOOLS', description: 'GNSS baseline processing' },
  { label: 'Missing Line', href: '/tools/missing-line', icon: GitBranch, group: 'CORE_TOOLS', description: 'Missing line calculations' },
  { label: '3D Viewer', href: '/tools/3d-viewer', icon: Box, group: 'CORE_TOOLS', badge: 'NEW', description: '3D TIN and point cloud visualization with Three.js' },
  { label: 'RTK Corrections', href: '/tools/rtk-corrections', icon: Satellite, group: 'CORE_TOOLS', badge: 'NEW', description: 'NTRIP client for real-time GNSS corrections from CORS networks' },
  { label: 'Road Design', href: '/engineering-workflow', icon: Route, group: 'CORE_TOOLS', badge: 'NEW', description: 'Integrated road design: horizontal → vertical → sections → earthworks → export' },
  { label: 'Topo Pipeline', href: '/topographic-workflow', icon: Mountain, group: 'CORE_TOOLS', badge: 'NEW', description: 'Integrated topo survey: import → contours → drawing → export' },

  // DOCUMENTS
  { label: 'Deed Plan', href: '/deed-plan', icon: FileBadge, group: 'DOCUMENTS', badge: 'NEW', description: 'Kenya Survey Regulations compliant deed plans' },
  { label: 'Survey Report', href: '/tools/survey-report-builder', icon: FileChartColumn, group: 'DOCUMENTS', badge: 'NEW', description: 'RDM 1.1 Table 5.4 auto-generated 14-section report' },
  { label: 'Beacon Reference', href: '/tools/beacon-reference', icon: MapPinned, group: 'DOCUMENTS', description: 'Survey mark symbols per Kenya Survey Regulations' },
  { label: 'Survey Regulations', href: '/tools/survey-regulations', icon: BookMarked, group: 'DOCUMENTS', description: 'Kenya Survey Regulations 1994, RDM 1.1 accuracy standards' },
  { label: 'US Survey Standards', href: '/tools/us-survey-reference', icon: Landmark, group: 'DOCUMENTS', description: 'US FWS Land Survey Handbook, BLM Manual, DOJ Title Standards' },

  // AI MODULES
  { label: 'FieldGuard AI', href: '/fieldguard', icon: ShieldCheck, group: 'AI_MODULES', badge: 'AI', description: 'GNSS/total-station data cleaner and outlier detection', requiresSubscription: 'pro' },
  { label: 'CadastraAI', href: '/cadastra', icon: LandPlot, group: 'AI_MODULES', badge: 'AI', description: 'Boundary dispute detection, overlap and gap analysis', requiresSubscription: 'pro' },
  { label: 'SurveyFlow', href: '/automator', icon: Workflow, group: 'AI_MODULES', badge: 'NEW', description: 'Drag-and-drop workflow automation builder', requiresSubscription: 'pro' },

  // DATA
  { label: 'Projects', href: '/project', icon: FolderKanban, group: 'DATA', description: 'Manage survey projects and revision history' },
  { label: 'Online Services', href: '/online', icon: Globe, group: 'DATA', description: 'GNSS baseline, coordinate API, Sentinel-2 imagery' },
  { label: 'Land Registry', href: '/registry', icon: IdCard, group: 'DATA', badge: 'NEW', description: 'NLIMS parcel lookup and title verification' },
  { label: 'Land Law', href: '/land-law', icon: Scale, group: 'DATA', badge: 'NEW', description: 'Boundary law, dispute resolution, plan compliance' },
  { label: 'KenCORS', href: '/kencors', icon: RadioTower, group: 'DATA', description: 'Kenya CORS RTK correction network' },
  { label: 'Field Data', href: '/field', icon: HardDrive, group: 'DATA', description: 'Field data collection and sync' },
  { label: 'Import', href: '/import', icon: FileSpreadsheet, group: 'DATA', description: 'Import survey data from various formats' },
  { label: 'CP Certificates', href: '/cpd', icon: FileSearch, group: 'DATA', description: 'CPD tracker and certificates' },

  // COMMUNITY
  { label: 'Community', href: '/community', icon: Users, group: 'COMMUNITY', badge: 'NEW', description: 'Surveyor network hub' },
  { label: 'Marketplace', href: '/marketplace', icon: Store, group: 'COMMUNITY', badge: 'NEW', description: 'Buy, sell and rent survey equipment' },
  // Peer Review page removed — feature not yet built. Will re-add when implemented.
  { label: 'Beacons Map', href: '/beacons', icon: MapPinned, group: 'COMMUNITY', description: 'Community beacon map' },
  { label: 'Plan Checker', href: '/ai-plan-checker', icon: ScanSearch, group: 'COMMUNITY', description: 'Compliance check against Survey Act & RDM 1.1' },

  // ENTERPRISE
  { label: 'Analytics', href: '/analytics', icon: BarChart2, group: 'ENTERPRISE', description: 'Usage analytics and performance', requiresSubscription: 'enterprise' },
  { label: 'Audit Logs', href: '/audit-logs', icon: ShieldCheck, group: 'ENTERPRISE', description: 'Security and compliance audit trail', requiresSubscription: 'enterprise' },
  { label: 'White Label', href: '/white-label', icon: Building2, group: 'ENTERPRISE', badge: 'NEW', description: 'Enterprise branding configuration', requiresSubscription: 'enterprise' },
  { label: 'Organization', href: '/organization', icon: Users, group: 'ENTERPRISE', badge: 'NEW', description: 'Manage organization seats and members', requiresSubscription: 'enterprise' },
  { label: 'University', href: '/university', icon: GraduationCap, group: 'ENTERPRISE', badge: 'NEW', description: 'University API and student management', requiresSubscription: 'enterprise' },
  { label: 'API Docs', href: '/api-docs', icon: CodeXml, group: 'ENTERPRISE', description: 'REST API documentation and keys' },

  // ADMIN
  { label: 'Admin Dashboard', href: '/admin', icon: ShieldCheck, group: 'ADMIN', description: 'Platform administration', adminOnly: true },
  { label: 'User Management', href: '/admin/users', icon: Users, group: 'ADMIN', description: 'Manage users and roles', adminOnly: true },

  // SETTINGS
  { label: 'Profile', href: '/profile', icon: UserRound, group: 'SETTINGS', description: 'User profile settings' },
  { label: 'Account', href: '/account', icon: Settings2, group: 'SETTINGS', description: 'Account management' },
  { label: 'Equipment Tracker', href: '/equipment', icon: Radar, group: 'SETTINGS', description: 'Instrument calibration tracker and reminders' },
  { label: 'Billing', href: '/checkout', icon: CreditCard, group: 'SETTINGS', description: 'Subscription and payment history' },
  { label: 'Pricing', href: '/pricing', icon: BadgeDollarSign, group: 'SETTINGS', description: 'Subscription plans' },
  { label: 'Documentation', href: '/docs', icon: BookOpen, group: 'SETTINGS', description: 'Knowledge base and guides' },
]

export function getNavGroup(group: NavGroup): NavItem[] {
  return NAV_ITEMS.filter((item) => item.group === group)
}

export function getActiveGroups(): NavGroup[] {
  const groupsWithItems = new Set(NAV_ITEMS.map((item) => item.group))
  return Object.entries(NAV_GROUPS)
    .filter(([group]) => groupsWithItems.has(group as NavGroup))
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([group]) => group as NavGroup)
}

export function getNavItemByHref(href: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.href === href)
}
