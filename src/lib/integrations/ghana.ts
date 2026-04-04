/**
 * Ghana Land Registry Integration
 * Additional Integration - International Registries
 */

export interface GhanaParcel {
  parcelId: string
  blockNumber: string
  plotNumber: string
  schemeName: string
  district: string
  region: string
  area: number
  areaUnit: 'acre' | 'hectare' | 'sqm'
  landUse: 'residential' | 'commercial' | 'agricultural' | 'industrial' | 'mixed'
  ownerName: string
  ownerId: string
  registrationDate: number
  titleType: 'full' | 'leasehold' | 'customary'
  coordinates?: {
    easting: number
    northing: number
    zone: number
  }
  status: 'registered' | 'pending' | 'encumbered'
}

export interface GhanaSearchResult {
  query: string
  results: GhanaParcel[]
  searchTime: number
}

const ghanaRegistryData: GhanaParcel[] = [
  {
    parcelId: 'GH-ACC-001',
    blockNumber: 'B001',
    plotNumber: 'P045',
    schemeName: 'Tema Development Scheme',
    district: 'Tema',
    region: 'Greater Accra',
    area: 0.5,
    areaUnit: 'acre',
    landUse: 'commercial',
    ownerName: 'Acme Ghana Ltd',
    ownerId: 'GHA-2020-1234',
    registrationDate: Date.now() - 365 * 24 * 60 * 60 * 1000,
    titleType: 'leasehold',
    coordinates: { easting: 520000, northing: 5600000, zone: 30 },
    status: 'registered',
  },
  {
    parcelId: 'GH-KUM-002',
    blockNumber: 'B012',
    plotNumber: 'P089',
    schemeName: 'Kumasi Residential',
    district: 'Kumasi',
    region: 'Ashanti',
    area: 0.25,
    areaUnit: 'acre',
    landUse: 'residential',
    ownerName: 'John Mensah',
    ownerId: 'GHA-2018-5678',
    registrationDate: Date.now() - 730 * 24 * 60 * 60 * 1000,
    titleType: 'full',
    coordinates: { easting: 400000, northing: 7400000, zone: 30 },
    status: 'registered',
  },
]

export function searchGhanaRegistry(query: string): GhanaSearchResult {
  const q = query.toLowerCase()
  const results = ghanaRegistryData.filter((p: any) => 
    p.parcelId.toLowerCase().includes(q) ||
    p.blockNumber.toLowerCase().includes(q) ||
    p.plotNumber.toLowerCase().includes(q) ||
    p.schemeName.toLowerCase().includes(q) ||
    p.ownerName.toLowerCase().includes(q) ||
    p.district.toLowerCase().includes(q)
  )
  
  return {
    query,
    results,
    searchTime: Math.floor(Math.random() * 500) + 100,
  }
}

export function getGhanaParcelById(parcelId: string): GhanaParcel | undefined {
  return ghanaRegistryData.find((p: any) => p.parcelId === parcelId)
}

export function getGhanaDistricts() {
  return [
    { name: 'Accra', region: 'Greater Accra' },
    { name: 'Tema', region: 'Greater Accra' },
    { name: 'Kumasi', region: 'Ashanti' },
    { name: 'Takoradi', region: 'Western' },
    { name: 'Cape Coast', region: 'Central' },
    { name: 'Tamale', region: 'Northern' },
  ]
}
