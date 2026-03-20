/**
 * Marketplace Service
 * Phase 9 - Community & Marketplace
 */

export interface SurveyTemplate {
  id: string
  name: string
  description: string
  category: 'traverse' | 'leveling' | 'cogo' | 'mining' | 'hydrographic' | 'drone' | 'general'
  price: number
  currency: 'USD' | 'KES' | 'UGX' | 'TZS'
  author: {
    name: string
    verified: boolean
  }
  downloads: number
  rating: number
  reviews: number
  tags: string[]
  createdAt: number
  updatedAt: number
}

export interface SurveyorProfile {
  id: string
  name: string
  title: string
  country: string
  license: string
  specialties: string[]
  rating: number
  projects: number
  verified: boolean
  hourlyRate: number
  availability: 'available' | 'busy' | 'unavailable'
  bio: string
  completedProjects: number
}

const templates: SurveyTemplate[] = [
  {
    id: 'tpl-001',
    name: 'Complete Traverse Package',
    description: 'Full traverse calculation template with Bowditch and Transit adjustments, error analysis, and report generation.',
    category: 'traverse',
    price: 29.99,
    currency: 'USD',
    author: { name: 'GeoNova Team', verified: true },
    downloads: 1247,
    rating: 4.8,
    reviews: 89,
    tags: ['traverse', 'adjustment', 'bowditch', 'transit'],
    createdAt: Date.now() - 90 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'tpl-002',
    name: 'Kenya Land Registry Template',
    description: 'Standardized template for Kenya land surveys compliant with Survey Act and land registry requirements.',
    category: 'general',
    price: 49.99,
    currency: 'USD',
    author: { name: 'Kenya Surveyors Assoc.', verified: true },
    downloads: 892,
    rating: 4.9,
    reviews: 156,
    tags: ['kenya', 'land registry', 'compliance', 'title'],
    createdAt: Date.now() - 180 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'tpl-003',
    name: 'Underground Mining Survey',
    description: 'Complete underground mine survey calculations including azimuth transfer, volume calculations, and stakeout.',
    category: 'mining',
    price: 79.99,
    currency: 'USD',
    author: { name: 'MineSurvey Pro', verified: true },
    downloads: 324,
    rating: 4.7,
    reviews: 42,
    tags: ['mining', 'underground', 'volume', 'stakeout'],
    createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'tpl-004',
    name: 'Hydrographic Survey Form',
    description: 'Bathymetric survey data collection and processing template with depth corrections and area calculations.',
    category: 'hydrographic',
    price: 59.99,
    currency: 'USD',
    author: { name: 'HydroWorks', verified: true },
    downloads: 567,
    rating: 4.6,
    reviews: 38,
    tags: ['hydrographic', 'bathymetry', 'depth', 'sounding'],
    createdAt: Date.now() - 120 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 21 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'tpl-005',
    name: 'Drone Survey Flight Log',
    description: 'Comprehensive drone survey planning and execution log with GCP management and QC checks.',
    category: 'drone',
    price: 34.99,
    currency: 'USD',
    author: { name: 'AeroSurvey', verified: true },
    downloads: 1102,
    rating: 4.8,
    reviews: 67,
    tags: ['drone', 'uav', 'gcp', 'flight planning'],
    createdAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'tpl-006',
    name: 'Level Network Adjustment',
    description: 'Precise leveling network adjustment with least squares and confidence ellipse analysis.',
    category: 'leveling',
    price: 39.99,
    currency: 'USD',
    author: { name: 'GeoNova Team', verified: true },
    downloads: 445,
    rating: 4.5,
    reviews: 28,
    tags: ['leveling', 'adjustment', 'least squares', 'bm'],
    createdAt: Date.now() - 75 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
  },
]

const surveyors: SurveyorProfile[] = [
  {
    id: 'srv-001',
    name: 'Eng. Joseph Kamau',
    title: 'Registered Surveyor',
    country: 'Kenya',
    license: 'RS/2012/0892',
    specialties: ['Land Surveying', 'Boundary Surveys', 'Subdivision'],
    rating: 4.9,
    projects: 234,
    verified: true,
    hourlyRate: 75,
    availability: 'available',
    bio: 'Over 15 years experience in Kenya boundary surveys and land development projects.',
    completedProjects: 234,
  },
  {
    id: 'srv-002',
    name: 'Dr. Sarah Nakato',
    title: 'Geodetic Surveyor',
    country: 'Uganda',
    license: 'UGS/2018/0045',
    specialties: ['Geodetic Surveys', 'GNSS', 'CORS Networks'],
    rating: 4.8,
    projects: 89,
    verified: true,
    hourlyRate: 85,
    availability: 'busy',
    bio: 'PhD in Geodesy, specializing in reference frame establishment and GNSS networks.',
    completedProjects: 89,
  },
  {
    id: 'srv-003',
    name: 'Eng. Mohamed Salim',
    title: 'Mining Surveyor',
    country: 'Tanzania',
    license: 'TSS/MIN/2015/0234',
    specialties: ['Underground Mining', 'Volume Calculations', 'Mine Planning'],
    rating: 4.7,
    projects: 156,
    verified: true,
    hourlyRate: 95,
    availability: 'available',
    bio: 'Specialized in underground mine surveying with experience in gold and copper mines.',
    completedProjects: 156,
  },
  {
    id: 'srv-004',
    name: 'Peter Ochieng',
    title: 'Hydrographic Surveyor',
    country: 'Kenya',
    license: 'RS/2020/1156',
    specialties: ['Bathymetry', 'Marine Surveys', 'Dredging'],
    rating: 4.6,
    projects: 45,
    verified: true,
    hourlyRate: 80,
    availability: 'available',
    bio: 'Marine survey specialist focusing on coastal and port development projects.',
    completedProjects: 45,
  },
]

export function getTemplates(category?: string): SurveyTemplate[] {
  if (!category || category === 'all') return templates
  return templates.filter(t => t.category === category)
}

export function getTemplateById(id: string): SurveyTemplate | undefined {
  return templates.find(t => t.id === id)
}

export function searchTemplates(query: string): SurveyTemplate[] {
  const q = query.toLowerCase()
  return templates.filter(t => 
    t.name.toLowerCase().includes(q) ||
    t.description.toLowerCase().includes(q) ||
    t.tags.some(tag => tag.toLowerCase().includes(q))
  )
}

export function getTopTemplates(limit = 5): SurveyTemplate[] {
  return [...templates].sort((a, b) => b.downloads - a.downloads).slice(0, limit)
}

export function getSurveyors(specialty?: string): SurveyorProfile[] {
  if (!specialty || specialty === 'all') return surveyors
  return surveyors.filter(s => s.specialties.some(sp => 
    sp.toLowerCase().includes(specialty.toLowerCase())
  ))
}

export function getSurveyorById(id: string): SurveyorProfile | undefined {
  return surveyors.find(s => s.id === id)
}

export function searchSurveyors(query: string): SurveyorProfile[] {
  const q = query.toLowerCase()
  return surveyors.filter(s => 
    s.name.toLowerCase().includes(q) ||
    s.title.toLowerCase().includes(q) ||
    s.country.toLowerCase().includes(q) ||
    s.specialties.some(sp => sp.toLowerCase().includes(q))
  )
}

export function getCategories() {
  return [
    { id: 'all', name: 'All Templates', icon: '📁' },
    { id: 'traverse', name: 'Traverse', icon: '📐' },
    { id: 'leveling', name: 'Leveling', icon: '📊' },
    { id: 'cogo', name: 'COGO', icon: '🧮' },
    { id: 'mining', name: 'Mining', icon: '⛏' },
    { id: 'hydrographic', name: 'Hydrographic', icon: '🌊' },
    { id: 'drone', name: 'Drone/UAV', icon: '🚁' },
    { id: 'general', name: 'General', icon: '📋' },
  ]
}

export function getSpecialties() {
  return [
    'Land Surveying',
    'Boundary Surveys',
    'Geodetic Surveys',
    'GNSS',
    'Mining Surveying',
    'Hydrographic Surveys',
    'Drone/UAV Surveys',
    'Construction Surveys',
    'Cadastral Surveys',
  ]
}

// peerReview: use @/lib/marketplace/peerReview directly
export * from './aiPlanChecker'
export * from './cpdCertificates'
// jobMarketplace: use @/lib/marketplace/jobMarketplace directly
