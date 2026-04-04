/**
 * Government Department Licensing
 * Phase 10 - Enterprise Features
 */

export interface GovernmentLicense {
  id: string
  departmentName: string
  departmentCode: string
  country: string
  licenseType: 'department' | 'agency' | 'municipality' | 'federal'
  seats: number
  seatsUsed: number
  validFrom: number
  validUntil: number
  status: 'active' | 'expiring' | 'expired'
  features: string[]
  annualFee: number
  currency: string
}

export interface LicenseSeat {
  id: string
  userId: string
  userName: string
  userEmail: string
  role: 'admin' | 'surveyor' | 'viewer'
  assignedAt: number
}

export interface DepartmentUsage {
  licenseId: string
  period: 'monthly' | 'yearly'
  surveyCount: number
  userCount: number
  storageUsed: number
}

const governmentDepartments = [
  {
    id: 'ke-moj',
    name: 'Ministry of Lands (Kenya)',
    country: 'Kenya',
    code: 'MOJ-KE',
    type: 'federal',
    requiredFeatures: ['nlims_integration', 'digital_signature', 'audit_logs'],
  },
  {
    id: 'ke-lands',
    name: ' Nairobi County Lands',
    country: 'Kenya',
    code: 'Nairobi-Lands',
    type: 'municipality' as const,
    requiredFeatures: ['parcel_search', 'boundary_validation'],
  },
  {
    id: 'ug-mlg',
    name: 'Ministry of Lands (Uganda)',
    country: 'Uganda',
    code: 'MLG-UG',
    type: 'federal',
    requiredFeatures: ['nlis_integration', 'digital_signature'],
  },
  {
    id: 'tz-mlg',
    name: 'Ministry of Lands (Tanzania)',
    country: 'Tanzania',
    code: 'MLG-TZ',
    type: 'federal',
    requiredFeatures: ['tanzania_integration', 'cadastral_reports'],
  },
  {
    id: 'ng-fmls',
    name: 'Federal Ministry of Lands (Nigeria)',
    country: 'Nigeria',
    code: 'FMLS-NG',
    type: 'federal',
    requiredFeatures: ['nlis_integration', 'digital_signature'],
  },
  {
    id: 'za-dmr',
    name: 'Department of Mineral Resources (SA)',
    country: 'South Africa',
    code: 'DMR-ZA',
    type: 'department',
    requiredFeatures: ['mining_surveys', 'underground'],
  },
]

const activeLicenses: GovernmentLicense[] = []

export function getGovernmentDepartments(country?: string) {
  if (!country) return governmentDepartments
  return governmentDepartments.filter((d: any) => d.country.toLowerCase() === country.toLowerCase())
}

export function requestGovernmentLicense(
  departmentId: string,
  seats: number
): GovernmentLicense {
  const dept = governmentDepartments.find((d: any) => d.id === departmentId)
  if (!dept) throw new Error('Department not found')
  
  const license: GovernmentLicense = {
    id: `gov-lic-${Date.now()}`,
    departmentName: dept.name,
    departmentCode: dept.code,
    country: dept.country,
    licenseType: dept.type as GovernmentLicense['licenseType'],
    seats,
    seatsUsed: 0,
    validFrom: Date.now(),
    validUntil: Date.now() + 365 * 24 * 60 * 60 * 1000,
    status: 'active',
    features: dept.requiredFeatures,
    annualFee: seats * 500,
    currency: dept.country === 'Kenya' ? 'KES' : 'USD',
  }
  
  activeLicenses.push(license)
  return license
}

export function getDepartmentLicense(licenseId: string): GovernmentLicense | undefined {
  return activeLicenses.find((l: any) => l.id === licenseId)
}

export function addLicenseSeat(
  licenseId: string,
  userId: string,
  userName: string,
  userEmail: string,
  role: LicenseSeat['role']
): LicenseSeat | null {
  const license = activeLicenses.find((l: any) => l.id === licenseId)
  if (!license) return null
  
  if (license.seatsUsed >= license.seats) {
    throw new Error('License seat limit reached')
  }
  
  license.seatsUsed++
  
  return {
    id: `seat-${Date.now()}`,
    userId,
    userName,
    userEmail,
    role,
    assignedAt: Date.now(),
  }
}

export function getDepartmentUsage(licenseId: string): DepartmentUsage {
  return {
    licenseId,
    period: 'monthly',
    surveyCount: Math.floor(Math.random() * 100) + 10,
    userCount: Math.floor(Math.random() * 20) + 5,
    storageUsed: Math.floor(Math.random() * 1000000000),
  }
}

export function getLicenseFeatures() {
  return [
    { id: 'nlims_integration', name: 'Kenya NLIMS Integration' },
    { id: 'nlis_integration', name: 'Uganda NLIS Integration' },
    { id: 'tanzania_integration', name: 'Tanzania Registry Integration' },
    { id: 'digital_signature', name: 'Digital Signature' },
    { id: 'audit_logs', name: 'Audit Logs' },
    { id: 'parcel_search', name: 'Parcel Search' },
    { id: 'boundary_validation', name: 'Boundary Validation' },
    { id: 'cadastral_reports', name: 'Cadastral Reports' },
    { id: 'mining_surveys', name: 'Mining Survey Tools' },
    { id: 'underground', name: 'Underground Survey' },
  ]
}
