import {
  Map, FileText, Shield, Cpu, Waves, Ship,
  AlertTriangle, Database, Compass, BarChart2,
  BookOpen, Layers, Users, ShoppingBag,
  Globe, Building2, Scale, Layout,
  Calculator, Ruler, Target, TrendingUp,
  Route, Hash, ScanLine, Droplets,
  MapPin, Calculator as Calc, FileSearch,
  Settings, HardDrive, Cloud, Folder
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: 'NEW' | 'AI' | 'BETA'
  description: string
  group: NavGroup
  requiresSubscription?: 'pro' | 'enterprise'
}

export type NavGroup =
  | 'CORE_TOOLS'
  | 'ADVANCED_MODULES'
  | 'DOCUMENTS'
  | 'DATA'
  | 'COMMUNITY'
  | 'ENTERPRISE'
  | 'SETTINGS'

export const NAV_GROUPS: Record<NavGroup, { label: string; order: number }> = {
  CORE_TOOLS: { label: 'Survey Tools', order: 1 },
  ADVANCED_MODULES: { label: 'Advanced Modules', order: 2 },
  DOCUMENTS: { label: 'Documents', order: 3 },
  DATA: { label: 'Data & Integration', order: 4 },
  COMMUNITY: { label: 'Community', order: 5 },
  ENTERPRISE: { label: 'Enterprise', order: 6 },
  SETTINGS: { label: 'Settings', order: 7 },
}

export const NAV_ITEMS: NavItem[] = [
  // CORE TOOLS
  { label: 'Dashboard', href: '/dashboard', icon: Layout, group: 'CORE_TOOLS', description: 'Project overview and recent activity' },
  { label: 'Traverse', href: '/tools/traverse', icon: Compass, group: 'CORE_TOOLS', description: 'Traverse adjustment and closure' },
  { label: 'COGO', href: '/tools/cogo', icon: Map, group: 'CORE_TOOLS', description: 'Coordinate geometry calculations' },
  { label: 'Levelling', href: '/tools/leveling', icon: BarChart2, group: 'CORE_TOOLS', description: 'Rise & fall, height of collimation' },
  { label: 'Road Design', href: '/tools/road-design', icon: Layers, group: 'CORE_TOOLS', description: 'Horizontal & vertical curves, earthworks' },
  { label: 'Setting Out', href: '/tools/setting-out', icon: Compass, group: 'CORE_TOOLS', description: 'Bearing and distance stakeout sheets' },
  { label: 'Field Book', href: '/fieldbook', icon: BookOpen, group: 'CORE_TOOLS', description: 'Digital field book with offline sync' },
  { label: 'Coordinates', href: '/tools/coordinates', icon: MapPin, group: 'CORE_TOOLS', description: 'Coordinate transformations and conversions' },
  { label: 'Distance', href: '/tools/distance', icon: Ruler, group: 'CORE_TOOLS', description: 'Distance calculations' },
  { label: 'Bearing', href: '/tools/bearing', icon: Target, group: 'CORE_TOOLS', description: 'Bearing calculations' },
  { label: 'Area', href: '/tools/area', icon: Map, group: 'CORE_TOOLS', description: 'Area calculations' },
  { label: 'Grade', href: '/tools/grade', icon: TrendingUp, group: 'CORE_TOOLS', description: 'Grade and gradient calculations' },
  { label: 'Curves', href: '/tools/curves', icon: Route, group: 'CORE_TOOLS', description: 'Horizontal and vertical curves' },
  { label: 'Chainage', href: '/tools/chainage', icon: Hash, group: 'CORE_TOOLS', description: 'Chainage calculations' },
  { label: 'Tacheometry', href: '/tools/tacheometry', icon: ScanLine, group: 'CORE_TOOLS', description: 'Tacheometric survey calculations' },
  { label: 'Cross Sections', href: '/tools/cross-sections', icon: Layers, group: 'CORE_TOOLS', description: 'Cross section analysis' },
  { label: 'Two Peg Test', href: '/tools/two-peg-test', icon: Target, group: 'CORE_TOOLS', description: 'Instrument calibration test' },
  { label: 'Earthworks', href: '/tools/earthworks', icon: Calculator, group: 'CORE_TOOLS', description: 'Cut and fill calculations' },
  { label: 'GNSS', href: '/tools/gnss', icon: MapPin, group: 'CORE_TOOLS', description: 'GNSS baseline processing' },
  { label: 'Missing Line', href: '/tools/missing-line', icon: Route, group: 'CORE_TOOLS', description: 'Missing line calculations' },

  // DOCUMENTS
  { label: 'Deed Plan', href: '/deed-plan', icon: FileText, group: 'DOCUMENTS', badge: 'NEW', description: 'Kenya Survey Regulations compliant deed plans' },
  { label: 'Survey Report', href: '/tools/survey-report-builder', icon: FileText, group: 'DOCUMENTS', badge: 'NEW', description: 'RDM 1.1 Table 5.4 auto-generated 14-section report' },
  { label: 'Beacon Reference', href: '/tools/beacon-reference', icon: Map, group: 'DOCUMENTS', description: 'Survey mark symbols per Kenya Survey Regulations' },
  { label: 'Survey Regulations', href: '/tools/survey-regulations', icon: BookOpen, group: 'DOCUMENTS', description: 'Kenya Survey Regulations 1994, RDM 1.1 accuracy standards' },
  { label: 'US Survey Standards', href: '/tools/us-survey-reference', icon: BookOpen, group: 'DOCUMENTS', description: 'US FWS Land Survey Handbook, BLM Manual, DOJ Title Standards' },

  // ADVANCED MODULES
  { label: 'FieldGuard AI', href: '/fieldguard', icon: Shield, group: 'ADVANCED_MODULES', badge: 'AI', description: 'GNSS/total-station data cleaner and outlier detection', requiresSubscription: 'pro' },
  { label: 'CadastraAI', href: '/cadastra', icon: Map, group: 'ADVANCED_MODULES', badge: 'AI', description: 'Boundary dispute detection, overlap and gap analysis', requiresSubscription: 'pro' },
  { label: 'MineTwin 3D', href: '/minetwin', icon: Cpu, group: 'ADVANCED_MODULES', badge: 'NEW', description: 'WebGL digital twin viewer for mining operations', requiresSubscription: 'pro' },
  { label: 'SurveyFlow', href: '/automator', icon: Layers, group: 'ADVANCED_MODULES', badge: 'NEW', description: 'Drag-and-drop workflow automation builder', requiresSubscription: 'pro' },
  { label: 'HydroLive', href: '/hydrolive', icon: Waves, group: 'ADVANCED_MODULES', badge: 'AI', description: 'Live contour maps, volume change, hazard detection', requiresSubscription: 'pro' },
  { label: 'USV Orchestrator', href: '/usv', icon: Ship, group: 'ADVANCED_MODULES', badge: 'NEW', description: 'Unmanned surface vehicle mission planning and telemetry', requiresSubscription: 'pro' },
  { label: 'MineScan Safety', href: '/minescan', icon: AlertTriangle, group: 'ADVANCED_MODULES', badge: 'AI', description: 'AI-powered safety monitoring for mining operations', requiresSubscription: 'pro' },
  { label: 'GeoFusion Hub', href: '/geofusion', icon: Database, group: 'ADVANCED_MODULES', badge: 'NEW', description: 'Unified survey, bathymetric, drone and cadastral data', requiresSubscription: 'pro' },

  // DATA
  { label: 'Projects', href: '/project', icon: Layers, group: 'DATA', description: 'Manage survey projects and revision history' },
  { label: 'Online Services', href: '/online', icon: Globe, group: 'DATA', description: 'GNSS baseline, coordinate API, Sentinel-2 imagery' },
  { label: 'Land Registry', href: '/registry', icon: Building2, group: 'DATA', badge: 'NEW', description: 'NLIMS parcel lookup and title verification' },
  { label: 'Land Law', href: '/land-law', icon: Scale, group: 'DATA', badge: 'NEW', description: 'Boundary law, dispute resolution, plan compliance' },
  { label: 'KenCORS', href: '/kencors', icon: Globe, group: 'DATA', description: 'Kenya CORS RTK correction network' },
  { label: 'Field Data', href: '/field', icon: HardDrive, group: 'DATA', description: 'Field data collection and sync' },
  { label: 'Import', href: '/import', icon: Folder, group: 'DATA', description: 'Import survey data from various formats' },
  { label: 'CP Certificates', href: '/cpd', icon: FileSearch, group: 'DATA', description: 'CPD tracker and certificates' },

  // COMMUNITY
  { label: 'Community', href: '/community', icon: Users, group: 'COMMUNITY', badge: 'NEW', description: 'Surveyor network hub' },
  { label: 'Jobs', href: '/jobs', icon: ShoppingBag, group: 'COMMUNITY', badge: 'NEW', description: 'Survey job marketplace' },
  { label: 'Marketplace', href: '/marketplace', icon: ShoppingBag, group: 'COMMUNITY', description: 'Templates and services store' },
  { label: 'Peer Review', href: '/peer-review', icon: Users, group: 'COMMUNITY', badge: 'NEW', description: 'Professional plan review' },
  { label: 'Beacons Map', href: '/beacons', icon: MapPin, group: 'COMMUNITY', description: 'Community beacon map' },
  { label: 'AI Plan Checker', href: '/ai-plan-checker', icon: Shield, group: 'COMMUNITY', badge: 'AI', description: 'AI-powered plan review' },

  // ENTERPRISE
  { label: 'Analytics', href: '/analytics', icon: BarChart2, group: 'ENTERPRISE', description: 'Usage analytics and performance', requiresSubscription: 'enterprise' },
  { label: 'Audit Logs', href: '/audit-logs', icon: Shield, group: 'ENTERPRISE', description: 'Security and compliance audit trail', requiresSubscription: 'enterprise' },
  { label: 'White Label', href: '/white-label', icon: Building2, group: 'ENTERPRISE', badge: 'NEW', description: 'Enterprise branding configuration', requiresSubscription: 'enterprise' },
  { label: 'Organization', href: '/organization', icon: Users, group: 'ENTERPRISE', badge: 'NEW', description: 'Manage organization seats and members', requiresSubscription: 'enterprise' },
  { label: 'University', href: '/university', icon: BookOpen, group: 'ENTERPRISE', badge: 'NEW', description: 'University API and student management', requiresSubscription: 'enterprise' },
  { label: 'API Docs', href: '/api-docs', icon: FileText, group: 'ENTERPRISE', description: 'REST API documentation and keys' },

  // SETTINGS
  { label: 'Profile', href: '/profile', icon: Settings, group: 'SETTINGS', description: 'User profile settings' },
  { label: 'Account', href: '/account', icon: Settings, group: 'SETTINGS', description: 'Account management' },
  { label: 'Equipment', href: '/equipment', icon: Cpu, group: 'SETTINGS', description: 'Instrument calibration tracker' },
  { label: 'Billing', href: '/checkout', icon: Calculator, group: 'SETTINGS', description: 'Subscription and payment history' },
  { label: 'Pricing', href: '/pricing', icon: Calculator, group: 'SETTINGS', description: 'Subscription plans' },
  { label: 'Documentation', href: '/docs', icon: BookOpen, group: 'SETTINGS', description: 'Knowledge base and guides' },
]

export function getNavGroup(group: NavGroup): NavItem[] {
  return NAV_ITEMS.filter(item => item.group === group)
}

export function getActiveGroups(): NavGroup[] {
  const groupsWithItems = new Set(NAV_ITEMS.map(i => i.group))
  return Object.entries(NAV_GROUPS)
    .filter(([group]) => groupsWithItems.has(group as NavGroup))
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([group]) => group as NavGroup)
}

export function getNavItemByHref(href: string): NavItem | undefined {
  return NAV_ITEMS.find(item => item.href === href)
}
