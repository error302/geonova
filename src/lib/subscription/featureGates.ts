import type { PlanId } from '@/lib/subscription/catalog'

export type FeatureKey =
  | 'quick_tools'
  | '1_project'
  | '50_points'
  | 'basic_pdf'
  | 'csv_import'
  | 'offline'
  | 'unlimited_projects'
  | 'unlimited_points'
  | 'full_pdf'
  | 'dxf_export'
  | 'landxml'
  | 'share_link'
  | 'gps_stakeout'
  | 'process_notes'
  | 'priority_support'
  | '5_members'
  | 'realtime_collab'
  | 'roles'
  | 'version_history'
  | 'audit_trail'
  | 'branded_reports'
  | 'dedicated_support'

export interface TierLimits {
  maxProjects: number
  maxPointsPerProject: number
  maxTeamMembers: number
  features: FeatureKey[]
}

export const TIERS: Record<PlanId, TierLimits> = {
  free: {
    maxProjects: 1,
    maxPointsPerProject: 50,
    maxTeamMembers: 1,
    features: [
      'quick_tools',
      '1_project',
      '50_points',
      'basic_pdf',
      'csv_import',
      'offline',
    ],
  },
  pro: {
    maxProjects: -1,
    maxPointsPerProject: -1,
    maxTeamMembers: 1,
    features: [
      'quick_tools',
      'unlimited_projects',
      'unlimited_points',
      'basic_pdf',
      'full_pdf',
      'csv_import',
      'offline',
      'dxf_export',
      'landxml',
      'share_link',
      'gps_stakeout',
      'process_notes',
      'priority_support',
    ],
  },
  team: {
    maxProjects: -1,
    maxPointsPerProject: -1,
    maxTeamMembers: 5,
    features: [
      'quick_tools',
      'unlimited_projects',
      'unlimited_points',
      'basic_pdf',
      'full_pdf',
      'csv_import',
      'offline',
      'dxf_export',
      'landxml',
      'share_link',
      'gps_stakeout',
      'process_notes',
      'priority_support',
      '5_members',
      'realtime_collab',
      'roles',
      'version_history',
      'audit_trail',
      'branded_reports',
      'dedicated_support',
    ],
  },
  firm: {
    maxProjects: -1,
    maxPointsPerProject: -1,
    maxTeamMembers: 15,
    features: [
      'quick_tools',
      'unlimited_projects',
      'unlimited_points',
      'basic_pdf',
      'full_pdf',
      'csv_import',
      'offline',
      'dxf_export',
      'landxml',
      'share_link',
      'gps_stakeout',
      'process_notes',
      'priority_support',
      '5_members',
      'realtime_collab',
      'roles',
      'version_history',
      'audit_trail',
      'branded_reports',
      'dedicated_support',
    ],
  },
  enterprise: {
    maxProjects: -1,
    maxPointsPerProject: -1,
    maxTeamMembers: -1,
    features: [
      'quick_tools',
      'unlimited_projects',
      'unlimited_points',
      'basic_pdf',
      'full_pdf',
      'csv_import',
      'offline',
      'dxf_export',
      'landxml',
      'share_link',
      'gps_stakeout',
      'process_notes',
      'priority_support',
      '5_members',
      'realtime_collab',
      'roles',
      'version_history',
      'audit_trail',
      'branded_reports',
      'dedicated_support',
    ],
  },
}

export function canAccess(plan: PlanId, feature: FeatureKey): boolean {
  return TIERS[plan].features.includes(feature)
}

export function getLimit(plan: PlanId, limit: 'projects' | 'points' | 'members'): number {
  const t = TIERS[plan]
  switch (limit) {
    case 'projects': return t.maxProjects
    case 'points': return t.maxPointsPerProject
    case 'members': return t.maxTeamMembers
  }
}

export function isUnlimited(limit: number): boolean {
  return limit < 0
}

export function requiresUpgrade(
  plan: PlanId,
  requirement: { type: 'feature'; key: FeatureKey } | { type: 'count'; what: 'projects' | 'points' | 'members'; current: number }
): { needed: PlanId; reason: string } | null {
  if (requirement.type === 'feature') {
    if (!canAccess(plan, requirement.key)) {
      if (plan === 'free') return { needed: 'pro', reason: `Pro plan required for ${requirement.key}` }
      if (plan === 'pro') return { needed: 'team', reason: `Team plan required for ${requirement.key}` }
      if (plan === 'team') return { needed: 'firm', reason: `Firm plan required for ${requirement.key}` }
      if (plan === 'firm') return { needed: 'enterprise', reason: `Enterprise plan required for ${requirement.key}` }
    }
    return null
  }

  const limit = getLimit(plan, requirement.what)
  if (limit < 0) return null
  if (requirement.current >= limit) {
    const upgradePath: Record<string, PlanId> = { free: 'pro', pro: 'team', team: 'firm', firm: 'enterprise' }
    const nextPlan = upgradePath[plan]
    return { needed: nextPlan, reason: `${requirement.what} limit reached (${requirement.current}/${limit})` }
  }
  return null
}

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  quick_tools: 'All quick calculation tools',
  '1_project': '1 survey project',
  '50_points': 'Up to 50 survey points',
  basic_pdf: 'Basic PDF report',
  csv_import: 'CSV import',
  offline: 'Offline calculations',
  unlimited_projects: 'Unlimited projects',
  unlimited_points: 'Unlimited survey points',
  full_pdf: 'Full professional PDF reports',
  dxf_export: 'DXF export for AutoCAD',
  landxml: 'LandXML export',
  share_link: 'Report share link',
  gps_stakeout: 'GPS Stakeout mode',
  process_notes: 'Process field notes',
  priority_support: 'Priority support',
  '5_members': '5 team members',
  realtime_collab: 'Real-time collaboration',
  roles: 'Role-based access',
  version_history: 'Version history',
  audit_trail: 'Audit trail',
  branded_reports: 'Branded reports with firm logo',
  dedicated_support: 'Dedicated support',
}
