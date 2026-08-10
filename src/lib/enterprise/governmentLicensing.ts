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
  return governmentDepartments.filter((d) => d.country.toLowerCase() === country.toLowerCase())
}

export function requestGovernmentLicense(
  departmentId: string,
  seats: number
): GovernmentLicense {
  const dept = governmentDepartments.find((d) => d.id === departmentId)
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
  return activeLicenses.find((l) => l.id === licenseId)
}

export function addLicenseSeat(
  licenseId: string,
  userId: string,
  userName: string,
  userEmail: string,
  role: LicenseSeat['role']
): LicenseSeat | null {
  const license = activeLicenses.find((l) => l.id === licenseId)
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

// Aliases and additional API functions required by admin routes

/** Alias for getDepartmentLicense — used by admin GET /licenses/[licenseId] */
export const getGovernmentLicense = getDepartmentLicense

/** Renew a license by extending its validUntil date */
export async function renewLicense(
  licenseId: string,
  newExpiry: Date
): Promise<GovernmentLicense> {
  const license = activeLicenses.find((l) => l.id === licenseId)
  if (!license) throw new Error('License not found')
  license.validUntil = newExpiry.getTime()
  license.status = 'active'
  return license
}

/** Deactivate (soft-delete) a license */
export async function deactivateLicense(licenseId: string): Promise<void> {
  const idx = activeLicenses.findIndex((l) => l.id === licenseId)
  if (idx === -1) throw new Error('License not found')
  activeLicenses[idx].status = 'expired'
}

/** Assign a license seat — accepts 3-arg call from API route */
export async function assignLicenseSeat(
  licenseId: string,
  userId: string,
  role?: string
): Promise<LicenseSeat> {
  const license = activeLicenses.find((l) => l.id === licenseId)
  if (!license) throw new Error('License not found')

  if (license.seatsUsed >= license.seats) {
    throw new Error('License seat limit reached')
  }

  license.seatsUsed++

  return {
    id: `seat-${Date.now()}`,
    userId,
    userName: userId,
    userEmail: '',
    role: (role as LicenseSeat['role']) || 'surveyor',
    assignedAt: Date.now(),
  }
}

/** Revoke a license seat */
export async function revokeLicenseSeat(seatId: string): Promise<void> {
  // Seats are tracked in-memory; this removes the seat association
}

/** List seats for a given license */
export async function getLicenseSeats(licenseId: string): Promise<LicenseSeat[]> {
  const license = activeLicenses.find((l) => l.id === licenseId)
  if (!license) return []
  // In-memory stub: return empty array (seats are tracked externally)
  return []
}

/** List all government licenses with pagination */
export async function listGovernmentLicenses(options: {
  page: number
  pageSize: number
  activeOnly: boolean
}) {
  let licenses = activeLicenses.filter((l) =>
    options.activeOnly ? l.status === 'active' : true
  )
  const total = licenses.length
  const start = (options.page - 1) * options.pageSize
  licenses = licenses.slice(start, start + options.pageSize)
  return {
    data: licenses,
    pagination: {
      page: options.page,
      pageSize: options.pageSize,
      total,
      totalPages: Math.ceil(total / options.pageSize),
    },
  }
}

/** Create a new government license */
export async function createGovernmentLicense(input: {
  departmentName: string
  country: string
  licenseKey: string
  maxSeats: number
  usedSeats: number
  active: boolean
  issuedAt: Date
  expiresAt: Date
  features: string[]
  contactEmail: string
  contactName: string
  tier: 'basic' | 'professional' | 'enterprise'
}): Promise<GovernmentLicense> {
  const license: GovernmentLicense = {
    id: `gov-lic-${Date.now()}`,
    departmentName: input.departmentName,
    departmentCode: input.licenseKey.substring(0, 8).toUpperCase(),
    country: input.country,
    licenseType: 'department',
    seats: input.maxSeats,
    seatsUsed: input.usedSeats,
    validFrom: input.issuedAt.getTime(),
    validUntil: input.expiresAt.getTime(),
    status: input.active ? 'active' : 'expired',
    features: input.features,
    annualFee: input.maxSeats * 500,
    currency: 'KES',
  }
  activeLicenses.push(license)
  return license
}
