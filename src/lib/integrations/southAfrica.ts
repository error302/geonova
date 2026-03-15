/**
 * South Africa Land Registry Integration
 * Additional Integration - International Registries
 */

export interface SouthAfricaParcel {
  parcelId: string
  erfNumber: string
  portion: number
  township: string
  municipality: string
  province: 'Western Cape' | 'Eastern Cape' | 'Northern Cape' | 'Free State' | 'KwaZulu-Natal' | 'North West' | 'Gauteng' | 'Limpopo' | 'Mpumalanga'
  area: number
  areaUnit: 'ha' | 'sqm'
  landUse: 'residential' | 'commercial' | 'agricultural' | 'industrial' | 'mining'
  ownerName: string
  ownerId: string
  registrationDate: number
  titleDeedNumber: string
  coordinates?: {
    longitude: number
    latitude: number
  }
  sgCode: string
  status: 'registered' | 'pending' | 'encumbered'
}

export interface SouthAfricaSearchResult {
  query: string
  results: SouthAfricaParcel[]
  searchTime: number
}

const southAfricaRegistryData: SouthAfricaParcel[] = [
  {
    parcelId: 'ZA-CPT-001',
    erfNumber: 'Erf 12345',
    portion: 0,
    township: 'Cape Town',
    municipality: 'City of Cape Town',
    province: 'Western Cape',
    area: 0.05,
    areaUnit: 'ha',
    landUse: 'residential',
    ownerName: 'Johannes Smith',
    ownerId: 'RSA-1980-123456789',
    registrationDate: Date.now() - 1000 * 24 * 60 * 60 * 1000,
    titleDeedNumber: 'T12345/2000',
    coordinates: { longitude: 18.4241, latitude: -33.9249 },
    sgCode: 'CPT00120000001',
    status: 'registered',
  },
  {
    parcelId: 'ZA-JHB-002',
    erfNumber: 'Erf 5678',
    portion: 2,
    township: 'Sandton',
    municipality: 'City of Johannesburg',
    province: 'Gauteng',
    area: 1.2,
    areaUnit: 'ha',
    landUse: 'commercial',
    ownerName: 'ABC Corporation SA',
    ownerId: 'RSA-1995-987654321',
    registrationDate: Date.now() - 800 * 24 * 60 * 60 * 1000,
    titleDeedNumber: 'T56789/2015',
    coordinates: { longitude: 28.0473, latitude: -26.1076 },
    sgCode: 'JHB044000002',
    status: 'registered',
  },
  {
    parcelId: 'ZA-DBN-003',
    erfNumber: 'Erf 901',
    portion: 0,
    township: 'Durban',
    municipality: 'eThekwini',
    province: 'KwaZulu-Natal',
    area: 0.25,
    areaUnit: 'ha',
    landUse: 'industrial',
    ownerName: 'Durban Manufacturing Pty Ltd',
    ownerId: 'RSA-2010-456789123',
    registrationDate: Date.now() - 500 * 24 * 60 * 60 * 1000,
    titleDeedNumber: 'T90123/2018',
    coordinates: { longitude: 31.0218, latitude: -29.8587 },
    sgCode: 'DBN03400001',
    status: 'registered',
  },
]

export function searchSouthAfricaRegistry(query: string): SouthAfricaSearchResult {
  const q = query.toLowerCase()
  const results = southAfricaRegistryData.filter(p => 
    p.parcelId.toLowerCase().includes(q) ||
    p.erfNumber.toLowerCase().includes(q) ||
    p.township.toLowerCase().includes(q) ||
    p.municipality.toLowerCase().includes(q) ||
    p.province.toLowerCase().includes(q) ||
    p.ownerName.toLowerCase().includes(q) ||
    p.sgCode.toLowerCase().includes(q)
  )
  
  return {
    query,
    results,
    searchTime: Math.floor(Math.random() * 500) + 100,
  }
}

export function getSouthAfricaParcelById(parcelId: string): SouthAfricaParcel | undefined {
  return southAfricaRegistryData.find(p => p.parcelId === parcelId)
}

export function getSouthAfricaProvinces() {
  return [
    { name: 'Western Cape', code: 'WC' },
    { name: 'Eastern Cape', code: 'EC' },
    { name: 'Northern Cape', code: 'NC' },
    { name: 'Free State', code: 'FS' },
    { name: 'KwaZulu-Natal', code: 'KZN' },
    { name: 'North West', code: 'NW' },
    { name: 'Gauteng', code: 'GP' },
    { name: 'Limpopo', code: 'LP' },
    { name: 'Mpumalanga', code: 'MP' },
  ]
}
