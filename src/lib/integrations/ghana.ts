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

const ghanaRegistryData: GhanaParcel[] = []

export function searchGhanaRegistry(query: string): GhanaSearchResult {
  const q = query.toLowerCase()
  const results = ghanaRegistryData.filter((p) => 
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
  return ghanaRegistryData.find((p) => p.parcelId === parcelId)
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
