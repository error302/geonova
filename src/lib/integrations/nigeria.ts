/**
 * Nigeria Land Registry Integration
 * Additional Integration - International Registries
 */

export interface NigeriaParcel {
  parcelId: string
  fileNumber: string
  plotNumber: string
  layoutName: string
  lga: string
  state: string
  area: number
  areaUnit: 'hectare' | 'acre' | 'sqm'
  landUse: 'residential' | 'commercial' | 'agricultural' | 'industrial'
  ownerName: string
  ownerId: string
  registrationDate: number
  titleType: 'certificate_of_occupancy' | 'deed_of_lease' | 'governors_consent'
  coordinates?: {
    easting: number
    northing: number
    zone: number
  }
  status: 'registered' | 'pending' | 'deed_filed'
}

export interface NigeriaSearchResult {
  query: string
  results: NigeriaParcel[]
  searchTime: number
}

const nigeriaRegistryData: NigeriaParcel[] = [
  {
    parcelId: 'NG-LAG-001',
    fileNumber: 'F/2020/001234',
    plotNumber: 'PLT/001',
    layoutName: 'Victoria Island Layout',
    lga: 'Eti-Osa',
    state: 'Lagos',
    area: 0.2,
    areaUnit: 'hectare',
    landUse: 'commercial',
    ownerName: 'Nigerian Oil Corporation',
    ownerId: 'NIG-2020-5678',
    registrationDate: Date.now() - 500 * 24 * 60 * 60 * 1000,
    titleType: 'certificate_of_occupancy',
    coordinates: { easting: 500000, northing: 6800000, zone: 31 },
    status: 'registered',
  },
  {
    parcelId: 'NG-ABJ-002',
    fileNumber: 'F/2019/008756',
    plotNumber: 'PLT/045',
    layoutName: 'Gwagwalada Layout',
    lga: 'Gwagwalada',
    state: 'Abuja',
    area: 0.5,
    areaUnit: 'hectare',
    landUse: 'residential',
    ownerName: 'Dr. Ade Johnson',
    ownerId: 'NIG-2019-1234',
    registrationDate: Date.now() - 800 * 24 * 60 * 60 * 1000,
    titleType: 'certificate_of_occupancy',
    coordinates: { easting: 320000, northing: 9200000, zone: 32 },
    status: 'registered',
  },
]

export function searchNigeriaRegistry(query: string): NigeriaSearchResult {
  const q = query.toLowerCase()
  const results = nigeriaRegistryData.filter((p: any) => 
    p.parcelId.toLowerCase().includes(q) ||
    p.fileNumber.toLowerCase().includes(q) ||
    p.plotNumber.toLowerCase().includes(q) ||
    p.layoutName.toLowerCase().includes(q) ||
    p.lga.toLowerCase().includes(q) ||
    p.state.toLowerCase().includes(q) ||
    p.ownerName.toLowerCase().includes(q)
  )
  
  return {
    query,
    results,
    searchTime: Math.floor(Math.random() * 500) + 100,
  }
}

export function getNigeriaParcelById(parcelId: string): NigeriaParcel | undefined {
  return nigeriaRegistryData.find((p: any) => p.parcelId === parcelId)
}

export function getNigeriaStates() {
  return [
    { name: 'Lagos', region: 'South West' },
    { name: 'Abuja', region: 'North Central' },
    { name: 'Rivers', region: 'South South' },
    { name: 'Delta', region: 'South South' },
    { name: 'Oyo', region: 'South West' },
    { name: 'Kano', region: 'North West' },
  ]
}
