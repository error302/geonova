/**
 * University API Service
 * Phase 10 - Enterprise Features
 * Educational institution access to GeoNova
 */

export interface UniversityLicense {
  id: string
  universityName: string
  universityCode: string
  country: string
  licenseType: 'research' | 'teaching' | 'enterprise'
  seats: number
  seatsUsed: number
  validFrom: number
  validUntil: number
  status: 'active' | 'expiring' | 'expired'
  features: string[]
  apiKeys: number
  apiCallsUsed: number
  annualFee: number
  currency: string
}

export interface APIKey {
  id: string
  key: string
  name: string
  createdAt: number
  lastUsed?: number
  callsThisMonth: number
  rateLimit: number
}

export interface StudentAccess {
  id: string
  studentId: string
  studentName: string
  studentEmail: string
  course: string
  assignedAt: number
}

export interface UsageRecord {
  id: string
  licenseId: string
  period: string
  totalApiCalls: number
  uniqueUsers: number
  courses: string[]
  projects: number
}

const universities = [
  {
    id: 'uon',
    name: 'University of Nairobi',
    country: 'Kenya',
    code: 'UON',
    type: 'teaching',
    courses: ['Geodesy', 'Cadastral Surveying', 'Engineering Surveying', 'GIS'],
  },
  {
    id: 'mku',
    name: 'Moi University',
    country: 'Kenya',
    code: 'MKU',
    type: 'teaching',
    courses: ['Surveying', 'Geomatics', 'Remote Sensing'],
  },
  {
    id: 'must',
    name: 'Makerere University',
    country: 'Uganda',
    code: 'MUST',
    type: 'teaching',
    courses: ['Land Surveying', 'Geodesy', 'Cartography'],
  },
  {
    id: 'aru',
    name: 'Ardhi University',
    country: 'Tanzania',
    code: 'ARU',
    type: 'teaching',
    courses: ['Surveying and Mapping', 'Urban Planning', 'Geospatial'],
  },
  {
    id: 'uj',
    name: 'University of Johannesburg',
    country: 'South Africa',
    code: 'UJ',
    type: 'research',
    courses: ['Advanced Geodesy', 'Mining Surveying', 'Hydrographic Surveying'],
  },
  {
    id: 'uct',
    name: 'University of Cape Town',
    country: 'South Africa',
    code: 'UCT',
    type: 'research',
    courses: ['Geomatic Engineering', 'Geospatial Science'],
  },
]

export function getUniversities(country?: string) {
  if (!country) return universities
  return universities.filter(u => u.country.toLowerCase() === country.toLowerCase())
}

export function requestUniversityLicense(
  universityId: string,
  seats: number,
  licenseType: UniversityLicense['licenseType']
): UniversityLicense {
  const uni = universities.find(u => u.id === universityId)
  if (!uni) throw new Error('University not found')
  
  const fees: Record<UniversityLicense['licenseType'], number> = {
    teaching: 500,
    research: 1000,
    enterprise: 2000,
  }
  
  return {
    id: `uni-lic-${Date.now()}`,
    universityName: uni.name,
    universityCode: uni.code,
    country: uni.country,
    licenseType,
    seats,
    seatsUsed: 0,
    validFrom: Date.now(),
    validUntil: Date.now() + 365 * 24 * 60 * 60 * 1000,
    status: 'active',
    features: [
      'all_basic_tools',
      'all_advanced_tools',
      'api_access',
      'student_management',
      'curriculum_integration',
    ],
    apiKeys: 3,
    apiCallsUsed: 0,
    annualFee: seats * fees[licenseType],
    currency: uni.country === 'Kenya' ? 'KES' : 'USD',
  }
}

export function generateAPIKey(
  licenseId: string,
  name: string
): APIKey {
  const key = `gnv_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`
  
  return {
    id: `key-${Date.now()}`,
    key,
    name,
    createdAt: Date.now(),
    callsThisMonth: 0,
    rateLimit: 10000,
  }
}

export function addStudentAccess(
  licenseId: string,
  studentId: string,
  studentName: string,
  studentEmail: string,
  course: string
): StudentAccess {
  return {
    id: `student-${Date.now()}`,
    studentId,
    studentName,
    studentEmail,
    course,
    assignedAt: Date.now(),
  }
}

export function getUsageStats(licenseId: string): UsageRecord {
  return {
    id: `usage-${Date.now()}`,
    licenseId,
    period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    totalApiCalls: Math.floor(Math.random() * 50000),
    uniqueUsers: Math.floor(Math.random() * 100) + 10,
    courses: ['Geodesy', 'Cadastral Surveying', 'GIS'],
    projects: Math.floor(Math.random() * 50),
  }
}

export function getCurriculumIntegration() {
  return [
    {
      university: 'University of Nairobi',
      course: 'SGS 201: Basic Surveying',
      topics: ['Distance measurement', 'Leveling', 'Angles', 'Bearings'],
      geoNovaTools: ['Distance Calculator', 'Leveling', 'Bearing Calculator'],
    },
    {
      university: 'University of Nairobi',
      course: 'SGS 301: Advanced Surveying',
      topics: ['Traverse adjustment', 'COGO', 'Curves'],
      geoNovaTools: ['Traverse', 'COGO', 'Curves'],
    },
    {
      university: 'Makerere University',
      course: 'SUR 201: Land Surveying',
      topics: ['Boundary surveys', 'Subdivision', 'Area calculation'],
      geoNovaTools: ['Traverse', 'Area Calculator', 'Coordinates'],
    },
    {
      university: 'Ardhi University',
      course: 'SUR 101: Introduction to Surveying',
      topics: ['Basic measurements', 'Field notes'],
      geoNovaTools: ['Distance', 'Bearing', 'Field Book'],
    },
  ]
}

export function getUniversityFeatures() {
  return [
    { id: 'all_basic_tools', name: 'All Basic Surveying Tools' },
    { id: 'all_advanced_tools', name: 'Advanced Tools (GNSS, Least Squares)' },
    { id: 'api_access', name: 'REST API Access' },
    { id: 'student_management', name: 'Student Management Dashboard' },
    { id: 'curriculum_integration', name: 'Curriculum Integration' },
    { id: 'research_data', name: 'Research Data Export' },
    { id: 'white_label', name: 'White-Label for Lab' },
  ]
}
