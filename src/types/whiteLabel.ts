export interface WhiteLabelConfig {
  id: string
  organizationId: string
  brandName: string
  logoUrl?: string
  faviconUrl?: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  customDomain?: string
  subdomain?: string
  footerText: string
  showPoweredBy: boolean
  customCss?: string
  emailFromName?: string
  emailFromAddress?: string
  reportHeader?: string
  reportFooter?: string
  active: boolean
  createdAt: string
}

export interface Organization {
  id: string
  name: string
  type: OrgType
  county?: string
  registrationNumber?: string
  contactEmail: string
  contactPhone?: string
  plan: 'ENTERPRISE' | 'GOVERNMENT' | 'UNIVERSITY'
  seatCount: number
  seatsUsed: number
  whiteLabelConfig?: WhiteLabelConfig
  createdAt: string
  expiresAt: string
  active: boolean
}

export type OrgType =
  | 'SURVEY_FIRM'
  | 'GOVERNMENT_NATIONAL'
  | 'GOVERNMENT_COUNTY'
  | 'UNIVERSITY'
  | 'NGO'
  | 'INFRASTRUCTURE_DEVELOPER'

export interface OrganizationMember {
  id: string
  organizationId: string
  userId: string
  role: 'ADMIN' | 'MEMBER' | 'VIEWER'
  joinedAt: string
}
