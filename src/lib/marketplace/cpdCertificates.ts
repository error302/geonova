/**
 * CPD (Continuing Professional Development) Certificate System
 * Phase 9 - Community Features
 */

export interface CPDActivity {
  id: string
  userId: string
  type: 'course' | 'workshop' | 'seminar' | 'conference' | 'webinar' | 'self_study' | 'mentoring' | 'research'
  title: string
  provider: string
  date: number
  hours: number
  country: string
  description: string
  certificateUrl?: string
  verified: boolean
  status: 'pending' | 'approved' | 'rejected'
}

export interface CPDRequirement {
  id: string
  country: string
  body: string
  yearlyHours: number
  category: 'technical' | 'ethics' | 'safety' | 'management'
  notes: string
}

export interface CPDCertificate {
  id: string
  userId: string
  userName: string
  userLicense: string
  activityId: string
  activityTitle: string
  activityDate: number
  hours: number
  issuedAt: number
  certificateNumber: string
  verificationUrl: string
}

export interface CPDSummary {
  userId: string
  totalHours: number
  yearlyHours: number
  requirementHours: number
  compliancePercentage: number
  categoryBreakdown: {
    technical: number
    ethics: number
    safety: number
    management: number
  }
  upcomingRenewal: number
  status: 'compliant' | 'at_risk' | 'non_compliant'
}

const cpdRequirements: CPDRequirement[] = [
  {
    id: 'ke-isk',
    country: 'Kenya',
    body: 'Institution of Surveyors of Kenya (ISK)',
    yearlyHours: 40,
    category: 'technical',
    notes: '40 hours per year, including 5 hours ethics',
  },
  {
    id: 'ug-ugs',
    country: 'Uganda',
    body: 'Uganda Institution of Professional Engineers (UIPE)',
    yearlyHours: 30,
    category: 'technical',
    notes: '30 hours per year renewal requirement',
  },
  {
    id: 'tz-ars',
    country: 'Tanzania',
    body: 'Ardhi University',
    yearlyHours: 30,
    category: 'technical',
    notes: '30 hours CPD for license renewal',
  },
  {
    id: 'ng-nis',
    country: 'Nigeria',
    body: 'Nigerian Institution of Surveyors (NIS)',
    yearlyHours: 35,
    category: 'technical',
    notes: '35 hours per licensing period',
  },
  {
    id: 'za-sacaps',
    country: 'South Africa',
    body: 'South African Council for Professional and Technical Surveyors',
    yearlyHours: 30,
    category: 'technical',
    notes: '30 credits per year',
  },
]

// CPD activities will be loaded from the database when the integration is complete.
// Pending: backend storage for user CPD activity records.

export function getCPDRequirements(country?: string): CPDRequirement[] {
  if (!country) return cpdRequirements
  return cpdRequirements.filter((r) => r.country.toLowerCase() === country.toLowerCase())
}

export function getUserActivities(userId: string): CPDActivity[] {
  // Pending: fetch from database once CPD backend is integrated.
  return []
}

export function calculateCPDSummary(userId: string, country: string): CPDSummary {
  const activities = getUserActivities(userId)
  const requirement = cpdRequirements.find((r) => r.country.toLowerCase() === country.toLowerCase())
  const yearlyHours = requirement?.yearlyHours || 40

  const totalHours = activities.reduce((sum, a) => sum + a.hours, 0)
  
  const categoryBreakdown = {
    technical: 0,
    ethics: 0,
    safety: 0,
    management: 0,
  }

  activities.forEach((a) => {
    if (a.title.toLowerCase().includes('ethics') || a.title.toLowerCase().includes('law')) {
      categoryBreakdown.ethics += a.hours
    } else if (a.title.toLowerCase().includes('safety')) {
      categoryBreakdown.safety += a.hours
    } else if (a.title.toLowerCase().includes('management') || a.title.toLowerCase().includes('project')) {
      categoryBreakdown.management += a.hours
    } else {
      categoryBreakdown.technical += a.hours
    }
  })

  const compliancePercentage = Math.min(100, (totalHours / yearlyHours) * 100)
  
  let status: CPDSummary['status'] = 'compliant'
  if (compliancePercentage < 50) status = 'non_compliant'
  else if (compliancePercentage < 100) status = 'at_risk'

  return {
    userId,
    totalHours,
    yearlyHours,
    requirementHours: yearlyHours,
    compliancePercentage,
    categoryBreakdown,
    upcomingRenewal: Date.now() + 180 * 24 * 60 * 60 * 1000,
    status,
  }
}

export function issueCPDCertificate(
  userId: string,
  userName: string,
  userLicense: string,
  activity: CPDActivity
): CPDCertificate {
  const certNumber = `CPD-${activity.country.toUpperCase()}-${Date.now()}`
  
  return {
    id: `cert-${Date.now()}`,
    userId,
    userName,
    userLicense,
    activityId: activity.id,
    activityTitle: activity.title,
    activityDate: activity.date,
    hours: activity.hours,
    issuedAt: Date.now(),
    certificateNumber: certNumber,
    verificationUrl: `https://metardu.app/verify/cpd/${certNumber}`,
  }
}

export function getActivityTypes() {
  return [
    { id: 'course', name: 'Formal Course', icon: '[Books]' },
    { id: 'workshop', name: 'Workshop', icon: '[Tool]' },
    { id: 'seminar', name: 'Seminar', icon: '' },
    { id: 'conference', name: 'Conference', icon: '' },
    { id: 'webinar', name: 'Webinar', icon: '' },
    { id: 'self_study', name: 'Self Study', icon: '[Book]' },
    { id: 'mentoring', name: 'Mentoring', icon: '[Users]' },
    { id: 'research', name: 'Research/Publication', icon: '[Note]' },
  ]
}

export function verifyCertificate(certificateNumber: string): CPDCertificate | null {
  // Pending: integrate with certificate verification backend.
  return null
}
