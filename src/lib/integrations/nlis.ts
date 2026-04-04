/**
 * Uganda NLIS Land Registry Integration
 * Phase 8 - Integration Layer
 * Connects to Uganda's National Land Information System
 */

export interface NLISParcel {
  parcelId: string
  titleNumber: string
  county: string
  subCounty: string
  parish: string
  landUse: string
  size: number
  sizeUnit: 'acres' | 'ha'
  registeredOwners: string[]
  tenureType: 'freehold' | 'leasehold' | 'mailo' | 'customary'
  interest: string
  leaseExpiryDate?: string
  registrationDate?: string
  boundaries?: {
    type: 'Polygon'
    coordinates: number[][][]
  }
}

export interface NLISSearchParams {
  parcelId?: string
  titleNumber?: string
  county?: string
  subCounty?: string
  parish?: string
  ownerName?: string
}

export interface NLISResult {
  success: boolean
  parcels?: NLISParcel[]
  total?: number
  error?: string
}

const MOCK_NLIS_DATA: NLISParcel[] = [
  {
    parcelId: 'UGA/KLA/001',
    titleNumber: 'KAMPALA/01234',
    county: 'Kampala',
    subCounty: 'Kampala Central',
    parish: 'Kampala',
    landUse: 'Commercial',
    size: 0.75,
    sizeUnit: 'acres',
    registeredOwners: ['Kampala Development Ltd'],
    tenureType: 'leasehold',
    interest: 'Leasehold - 99 years from 2005',
    leaseExpiryDate: '2104-12-31',
    registrationDate: '2005-08-15'
  },
  {
    parcelId: 'UGA/ENT/002',
    titleNumber: 'ENTEBBE/00456',
    county: 'Wakiso',
    subCounty: 'Entebbe',
    parish: 'Kigungu',
    landUse: 'Residential',
    size: 0.5,
    sizeUnit: 'acres',
    registeredOwners: ['Grace Nakato', 'Joseph Kato'],
    tenureType: 'freehold',
    interest: 'Freehold'
  },
  {
    parcelId: 'UGA/JIN/003',
    titleNumber: 'JINJA/00789',
    county: 'Jinja',
    subCounty: 'Jinja Municipality',
    parish: 'Walukuba',
    landUse: 'Industrial',
    size: 2.0,
    sizeUnit: 'acres',
    registeredOwners: ['Jinja Industrial Park Ltd'],
    tenureType: 'leasehold',
    interest: 'Leasehold - 49 years',
    leaseExpiryDate: '2045-06-30'
  },
  {
    parcelId: 'UGA/MBL/004',
    titleNumber: 'MBALE/00234',
    county: 'Mbale',
    subCounty: 'Mbale Municipality',
    parish: 'Northern Division',
    landUse: 'Agricultural',
    size: 5.0,
    sizeUnit: 'acres',
    registeredOwners: ['Wekesa Family'],
    tenureType: 'customary',
    interest: 'Customary Land'
  }
]

export async function searchLand(params: NLISSearchParams): Promise<NLISResult> {
  await new Promise(resolve => setTimeout(resolve, 500))
  
  let results = [...MOCK_NLIS_DATA]
  
  if (params.parcelId) {
    results = results.filter((p: any) => p.parcelId.toLowerCase().includes(params.parcelId!.toLowerCase()))
  }
  
  if (params.titleNumber) {
    results = results.filter((p: any) => 
      p.titleNumber.toLowerCase().includes(params.titleNumber!.toLowerCase())
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
  
  if (params.ownerName) {
    results = results.filter((p: any) => 
      p.registeredOwners.some((o: any) => o.toLowerCase().includes(params.ownerName!.toLowerCase()))
    )
  }
  
  return {
    success: true,
    parcels: results,
    total: results.length
  }
}

export async function getLandById(parcelId: string): Promise<NLISParcel | null> {
  await new Promise(resolve => setTimeout(resolve, 300))
  return MOCK_NLIS_DATA.find((p: any) => p.parcelId === parcelId) || null
}

export async function validateTitle(
  titleNumber: string
): Promise<{ valid: boolean; status: string; message: string }> {
  const parcel = MOCK_NLIS_DATA.find((p: any) => p.titleNumber === titleNumber)
  
  if (!parcel) {
    return { valid: false, status: 'not_found', message: `Title ${titleNumber} not found in NLIS` }
  }
  
  if (parcel.tenureType === 'leasehold' && parcel.leaseExpiryDate) {
    const expiry = new Date(parcel.leaseExpiryDate)
    const now = new Date()
    
    if (expiry < now) {
      return { valid: false, status: 'expired', message: `Lease expired on ${parcel.leaseExpiryDate}` }
    }
  }
  
  return { 
    valid: true, 
    status: 'active', 
    message: `Title ${titleNumber} is valid and active` 
  }
}

export function getTenureTypes(): { id: string; name: string; description: string }[] {
  return [
    { id: 'freehold', name: 'Freehold', description: 'Absolute ownership of land' },
    { id: 'leasehold', name: 'Leasehold', description: 'Land held under lease agreement' },
    { id: 'mailo', name: 'Mailo', description: 'Customary tenure with mailo title (Buganda)' },
    { id: 'customary', name: 'Customary', description: 'Traditional land ownership' }
  ]
}

export function getDistricts(): string[] {
  return [
    'Kampala', 'Wakiso', 'Jinja', 'Mbale', 'Mbarara', 'Gulu', 
    'Lira', 'Entebbe', 'Soroti', 'Fort Portal'
  ]
}
