/**
 * Enterprise Module
 * Phase 10 - Enterprise Features
 * White-label, licensing, cloud rendering, insurance integration
 */

export interface EnterpriseSettings {
  organizationName: string
  logo?: string
  primaryColor: string
  secondaryColor: string
  contactEmail: string
  customDomain?: string
}

export interface SubscriptionPlan {
  id: string
  name: string
  tier: 'starter' | 'professional' | 'enterprise'
  price: number
  currency: string
  features: string[]
  projectsLimit: number
  teamMembersLimit: number
  storageGb: number
  support: 'email' | 'priority' | 'dedicated'
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tier: 'starter',
    price: 0,
    currency: 'USD',
    features: [
      '5 Survey Projects',
      'Basic Tools',
      'Field Mode',
      'PDF Reports',
      'Community Support'
    ],
    projectsLimit: 5,
    teamMembersLimit: 1,
    storageGb: 1,
    support: 'email'
  },
  {
    id: 'professional',
    name: 'Professional',
    tier: 'professional',
    price: 49,
    currency: 'USD',
    features: [
      'Unlimited Projects',
      'All Survey Tools',
      'Advanced Modules',
      'GNSS Processing',
      'Parcel Intelligence',
      'Priority Support',
      'API Access'
    ],
    projectsLimit: -1,
    teamMembersLimit: 10,
    storageGb: 50,
    support: 'priority'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tier: 'enterprise',
    price: 199,
    currency: 'USD',
    features: [
      'Everything in Professional',
      'White-label Branding',
      'Custom Domain',
      'Dedicated Support',
      'University API',
      'Insurance Integration',
      'Cloud Rendering',
      'Advanced Analytics'
    ],
    projectsLimit: -1,
    teamMembersLimit: -1,
    storageGb: 500,
    support: 'dedicated'
  }
]

export interface TeamMember {
  id: string
  name: string
  email: string
  role: 'admin' | 'surveyor' | 'viewer'
  projects: string[]
  lastActive: string
}

export interface AuditLog {
  id: string
  userId: string
  action: string
  resource: string
  resourceId: string
  timestamp: string
  ipAddress: string
  details?: Record<string, unknown>
}

export interface CloudProject {
  id: string
  name: string
  owner: string
  status: 'processing' | 'ready' | 'error'
  progress: number
  createdAt: string
  completedAt?: string
  resultUrl?: string
}

export function getPlanById(id: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find(p => p.id === id)
}

export function canAccessFeature(planId: string, feature: string): boolean {
  const plan = getPlanById(planId)
  if (!plan) return false
  return plan.features.includes(feature) || plan.tier === 'enterprise'
}

export function canCreateProject(planId: string, currentCount: number): boolean {
  const plan = getPlanById(planId)
  if (!plan) return false
  if (plan.projectsLimit === -1) return true
  return currentCount < plan.projectsLimit
}

export function canAddTeamMember(planId: string, currentCount: number): boolean {
  const plan = getPlanById(planId)
  if (!plan) return false
  if (plan.teamMembersLimit === -1) return true
  return currentCount < plan.teamMembersLimit
}

export interface WhiteLabelConfig {
  enabled: boolean
  organizationName: string
  logoUrl?: string
  faviconUrl?: string
  primaryColor: string
  customCss?: string
  customDomain?: string
  emailFooter?: string
}

export const DEFAULT_WHITE_LABEL: WhiteLabelConfig = {
  enabled: false,
  organizationName: 'METARDU',
  primaryColor: '#0EA5E9'
}

export interface UniversityAPIConfig {
  institutionName: string
  apiKey: string
  allowedOrigins: string[]
  rateLimit: number
  features: string[]
}

export interface InsurancePolicy {
  id: string
  projectId: string
  policyNumber: string
  provider: string
  coverage: number
  premium: number
  startDate: string
  endDate: string
  status: 'active' | 'expired' | 'pending'
  surveyType: string
}

export interface ClaimRecord {
  id: string
  policyId: string
  incidentDate: string
  description: string
  amount: number
  status: 'pending' | 'approved' | 'rejected'
  documents: string[]
}

export function generateAuditLog(
  userId: string,
  action: string,
  resource: string,
  resourceId: string,
  details?: Record<string, unknown>
): AuditLog {
  return {
    id: `audit_${Date.now()}`,
    userId,
    action,
    resource,
    resourceId,
    timestamp: new Date().toISOString(),
    ipAddress: '0.0.0.0',
    details
  }
}

export function getEnterpriseFeatures(): string[] {
  return [
    'White-label Branding',
    'Custom Domain',
    'Dedicated Support',
    'University API',
    'Insurance Integration',
    'Cloud Rendering',
    'Advanced Analytics',
    'Team Management',
    'Audit Logs',
    'SSO Integration'
  ]
}

export function getUniversityFeatures(): string[] {
  return [
    'Student Licenses',
    'Course Integration',
    'Assignment Templates',
    'Lab Access',
    'Research Data Export',
    'Curriculum Aligned Tools'
  ]
}

export * from './cloudRendering'
export * from './insurance'
export * from './governmentLicensing'
export * from './universityApi'
export * from './payments'
