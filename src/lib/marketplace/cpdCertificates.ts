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

// HONESTY CLEANUP (audit H9 follow-up, 2026-08-30): the dead stub functions
// (getUserActivities -> [], calculateCPDSummary from that [], fake
// issueCPDCertificate with a metardu.app verification URL — wrong domain —
// and verifyCertificate -> null) were REMOVED. They had zero callers and
// existed only to produce fake-looking data. The real CPD backend lives in
// src/lib/cpd.ts (cpd_records / cpd_certificates tables) behind /api/cpd.
// This module keeps only the genuine static reference data (country
// requirements + activity types).

export function getCPDRequirements(country?: string): CPDRequirement[] {
  if (!country) return cpdRequirements
  return cpdRequirements.filter((r) => r.country.toLowerCase() === country.toLowerCase())
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

