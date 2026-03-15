/**
 * Survey Project Insurance Service
 * Phase 10 - Enterprise Features
 */

export interface InsurancePolicy {
  id: string
  projectId: string
  projectName: string
  surveyorName: string
  surveyorLicense: string
  policyType: 'professional' | 'equipment' | 'project' | 'comprehensive'
  coverage: number
  premium: number
  currency: 'USD' | 'KES'
  startDate: number
  endDate: number
  status: 'active' | 'expired' | 'pending'
  insurer: string
  policyNumber: string
}

export interface InsuranceQuote {
  projectValue: number
  projectType: 'residential' | 'commercial' | 'industrial' | 'infrastructure'
  surveyorExperience: number
  surveyType: 'boundary' | 'topographic' | 'engineering' | 'mining' | 'hydrographic'
  country: string
  estimatedPremium: number
  coverage: number
  deductible: number
  validUntil: number
}

export interface Claim {
  id: string
  policyId: string
  projectId: string
  incidentDate: number
  reportedAt: number
  description: string
  amount: number
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid'
}

const insuranceProviders = [
  { id: 'jubi', name: 'Jubilee Insurance', country: 'Kenya' },
  { id: 'old_mutual', name: 'Old Mutual', country: 'Kenya' },
  { id: 'sanlam', name: 'Sanlam', country: 'South Africa' },
  { id: 'leadway', name: 'Leadway Assurance', country: 'Nigeria' },
]

export function getInsuranceProviders(country?: string) {
  if (!country) return insuranceProviders
  return insuranceProviders.filter(p => p.country.toLowerCase() === country.toLowerCase())
}

export function getInsuranceQuote(
  projectValue: number,
  projectType: InsuranceQuote['projectType'],
  surveyorExperience: number,
  surveyType: InsuranceQuote['surveyType'],
  country: string
): InsuranceQuote {
  const baseRates: Record<InsuranceQuote['projectType'], number> = {
    residential: 0.02,
    commercial: 0.015,
    industrial: 0.025,
    infrastructure: 0.03,
  }
  
  const surveyTypeMultipliers: Record<InsuranceQuote['surveyType'], number> = {
    boundary: 1.0,
    topographic: 1.2,
    engineering: 1.5,
    mining: 2.0,
    hydrographic: 1.8,
  }
  
  const baseRate = baseRates[projectType]
  const typeMultiplier = surveyTypeMultipliers[surveyType]
  const experienceFactor = Math.max(0.7, 1 - (surveyorExperience / 50) * 0.3)
  
  const estimatedPremium = projectValue * baseRate * typeMultiplier * experienceFactor
  const coverage = projectValue
  const deductible = Math.max(1000, projectValue * 0.01)
  
  return {
    projectValue,
    projectType,
    surveyorExperience,
    surveyType,
    country,
    estimatedPremium: Math.round(estimatedPremium * 100) / 100,
    coverage,
    deductible,
    validUntil: Date.now() + 30 * 24 * 60 * 60 * 1000,
  }
}

export function purchasePolicy(
  projectId: string,
  projectName: string,
  surveyorName: string,
  surveyorLicense: string,
  quote: InsuranceQuote,
  insurerId: string
): InsurancePolicy {
  const insurer = insuranceProviders.find(i => i.id === insurerId) || insuranceProviders[0]
  
  const policy: InsurancePolicy = {
    id: `policy-${Date.now()}`,
    projectId,
    projectName,
    surveyorName,
    surveyorLicense,
    policyType: 'professional',
    coverage: quote.coverage,
    premium: quote.estimatedPremium,
    currency: quote.country === 'Kenya' ? 'KES' : 'USD',
    startDate: Date.now(),
    endDate: Date.now() + 365 * 24 * 60 * 60 * 1000,
    status: 'active',
    insurer: insurer.name,
    policyNumber: `POL-${Date.now()}`,
  }
  
  return policy
}

export function submitClaim(
  policyId: string,
  projectId: string,
  incidentDate: number,
  description: string,
  amount: number
): Claim {
  return {
    id: `claim-${Date.now()}`,
    policyId,
    projectId,
    incidentDate,
    reportedAt: Date.now(),
    description,
    amount,
    status: 'submitted',
  }
}

export function getPolicyTypes() {
  return [
    { id: 'professional', name: 'Professional Indemnity', description: 'Covers errors in professional services' },
    { id: 'equipment', name: 'Equipment Insurance', description: 'Covers total station, GNSS, drones' },
    { id: 'project', name: 'Project Insurance', description: 'Covers specific survey project risks' },
    { id: 'comprehensive', name: 'Comprehensive', description: 'All-inclusive coverage' },
  ]
}
