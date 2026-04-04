/**
 * Kenya NLIMS Land Registry Integration
 * Phase 8 - Integration Layer
 * Connects to Kenya's National Land Information Management System
 */

export interface NLIMSParcel {
  parcelId: string
  registryPlotNumber: string
  county: string
  subCounty: string
  ward: string
  landUse: string
  area: number
  areaUnit: 'acres' | 'ha'
  owners: string[]
  leaseStatus: 'freehold' | 'leasehold'
  interestType: string
  registrationDate?: string
  coordinates?: {
    type: 'Polygon'
    coordinates: number[][][]
  }
}

export interface NLIMSSearchParams {
  parcelId?: string
  registryPlotNumber?: string
  county?: string
  subCounty?: string
  ward?: string
  ownerName?: string
}

export interface NLIMSResult {
  success: boolean
  parcels?: NLIMSParcel[]
  total?: number
  error?: string
}

const MOCK_NLIMS_DATA: NLIMSParcel[] = [
  {
    parcelId: 'NRM/KISUMU/12345',
    registryPlotNumber: 'KISUMU/Block 1/1',
    county: 'Kisumu',
    subCounty: 'Kisumu Central',
    ward: 'Kisumu Central',
    landUse: 'Residential',
    area: 0.25,
    areaUnit: 'acres',
    owners: ['John Ochieng', 'Mary Akinyi'],
    leaseStatus: 'freehold',
    interestType: 'Absolute',
    registrationDate: '2015-03-20',
    coordinates: {
      type: 'Polygon',
      coordinates: [[
        [35.0012, -0.1023],
        [35.0035, -0.1023],
        [35.0035, -0.1001],
        [35.0012, -0.1001],
        [35.0012, -0.1023]
      ]]
    }
  },
  {
    parcelId: 'NRM/NAIROBI/54321',
    registryPlotNumber: 'NAIROBI/Block 45/12',
    county: 'Nairobi',
    subCounty: 'Westlands',
    ward: 'Kitisuru',
    landUse: 'Commercial',
    area: 0.5,
    areaUnit: 'acres',
    owners: ['Kenya Development Corporation'],
    leaseStatus: 'leasehold',
    interestType: 'Leasehold - 99 years',
    registrationDate: '2010-06-15',
    coordinates: {
      type: 'Polygon',
      coordinates: [[
        [36.8012, -1.2654],
        [36.8045, -1.2654],
        [36.8045, -1.2632],
        [36.8012, -1.2632],
        [36.8012, -1.2654]
      ]]
    }
  },
  {
    parcelId: 'NRM/MOMBASA/98765',
    registryPlotNumber: 'MOMBASA/Block 8/3',
    county: 'Mombasa',
    subCounty: 'Mombasa Central',
    ward: 'Tudor',
    landUse: 'Residential',
    area: 0.125,
    areaUnit: 'acres',
    owners: ['Ahmed Hassan'],
    leaseStatus: 'freehold',
    interestType: 'Absolute',
    registrationDate: '2018-09-10',
    coordinates: {
      type: 'Polygon',
      coordinates: [[
        [39.6512, -4.0435],
        [39.6545, -4.0435],
        [39.6545, -4.0412],
        [39.6512, -4.0412],
        [39.6512, -4.0435]
      ]]
    }
  }
]

export async function searchParcel(params: NLIMSSearchParams): Promise<NLIMSResult> {
  await new Promise(resolve => setTimeout(resolve, 500))
  
  let results = [...MOCK_NLIMS_DATA]
  
  if (params.parcelId) {
    results = results.filter((p: any) => p.parcelId.toLowerCase().includes(params.parcelId!.toLowerCase()))
  }
  
  if (params.registryPlotNumber) {
    results = results.filter((p: any) => 
      p.registryPlotNumber.toLowerCase().includes(params.registryPlotNumber!.toLowerCase())
    )
  }
  
  if (params.county) {
    results = results.filter((p: any) => 
      p.county.toLowerCase() === params.county!.toLowerCase()
    )
  }
  
  if (params.subCounty) {
    results = results.filter((p: any) => 
      p.subCounty.toLowerCase().includes(params.subCounty!.toLowerCase())
    )
  }
  
  if (params.ward) {
    results = results.filter((p: any) => 
      p.ward.toLowerCase().includes(params.ward!.toLowerCase())
    )
  }
  
  if (params.ownerName) {
    results = results.filter((p: any) => 
      p.owners.some((o: any) => o.toLowerCase().includes(params.ownerName!.toLowerCase()))
    )
  }
  
  return {
    success: true,
    parcels: results,
    total: results.length
  }
}

export async function getParcelById(parcelId: string): Promise<NLIMSParcel | null> {
  await new Promise(resolve => setTimeout(resolve, 300))
  return MOCK_NLIMS_DATA.find((p: any) => p.parcelId === parcelId) || null
}

export async function verifyLandOwnership(
  parcelId: string, 
  ownerName: string
): Promise<{ verified: boolean; message: string }> {
  const parcel = await getParcelById(parcelId)
  
  if (!parcel) {
    return { verified: false, message: 'Parcel not found in NLIMS registry' }
  }
  
  const isOwner = parcel.owners.some((o: any) => 
    o.toLowerCase().includes(ownerName.toLowerCase())
  )
  
  if (isOwner) {
    return { verified: true, message: `Verified: ${ownerName} is registered owner of ${parcelId}` }
  }
  
  return { verified: false, message: `Owner verification failed for ${parcelId}` }
}

export function getSupportedCounties(): string[] {
  return ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Kakamega', 'Thika', 'Garissa']
}

export function getLandUseTypes(): string[] {
  return [
    'Residential',
    'Commercial',
    'Industrial',
    'Agricultural',
    'Mixed Use',
    'Public Purpose',
    'Institutional',
    'Open Space'
  ]
}
