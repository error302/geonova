/**
 * Parcel Intelligence Module
 * Phase 9 - Parcel Intelligence & Boundary Extraction System
 * Universal parcel search using integration layer
 */

import { searchParcel as nlimsSearchParcel, NLIMSParcel, verifyLandOwnership } from '@/lib/integrations/nlims'
import { searchLand as nlisSearchLand, NLISParcel, validateTitle } from '@/lib/integrations/nlis'
import { searchPlot as tanzaniaSearchPlot, TanzaniaPlot } from '@/lib/integrations/tanzania'

export interface ParcelSearchParams {
  country: 'Kenya' | 'Uganda' | 'Tanzania'
  parcelId?: string
  registryPlotNumber?: string
  titleNumber?: string
  plotNumber?: string
  county?: string
  region?: string
  district?: string
  subCounty?: string
  ward?: string
  ownerName?: string
}

export interface UniversalParcelResult {
  parcelId: string
  country: string
  registrySource: string
  owners: string[]
  area: number
  areaUnit: string
  landUse: string
  tenure: string
  coordinates?: {
    latitude?: number
    longitude?: number
  }
  geometry?: {
    type: string
    coordinates: number[][][]
  }
  registrationDate?: string
  lastUpdated?: string
}

export async function searchParcel(params: ParcelSearchParams): Promise<UniversalParcelResult[]> {
  const { country, ...searchParams } = params
  
  let results: UniversalParcelResult[] = []
  
  switch (country) {
    case 'Kenya': {
      const nlimsResults = await nlimsSearchParcel({
        parcelId: searchParams.parcelId,
        registryPlotNumber: searchParams.registryPlotNumber,
        county: searchParams.county,
        subCounty: searchParams.subCounty,
        ward: searchParams.ward,
        ownerName: searchParams.ownerName
      })
      
      if (nlimsResults.parcels) {
        results = nlimsResults.parcels.map((p: any) => convertNLIMSParcel(p))
      }
      break
    }
    
    case 'Uganda': {
      const nlisResults = await nlisSearchLand({
        parcelId: searchParams.parcelId,
        titleNumber: searchParams.titleNumber,
        county: searchParams.county,
        subCounty: searchParams.subCounty,
        ownerName: searchParams.ownerName
      })
      
      if (nlisResults.parcels) {
        results = nlisResults.parcels.map((p: any) => convertNLISParcel(p))
      }
      break
    }
    
    case 'Tanzania': {
      const tzResults = await tanzaniaSearchPlot({
        plotNumber: searchParams.plotNumber || searchParams.parcelId,
        district: searchParams.district,
        region: searchParams.region,
        ward: searchParams.ward,
        ownerName: searchParams.ownerName
      })
      
      if (tzResults.plots) {
        results = tzResults.plots.map((p: any) => convertTanzaniaPlot(p))
      }
      break
    }
  }
  
  return results
}

function convertNLIMSParcel(p: NLIMSParcel): UniversalParcelResult {
  let coordinates: UniversalParcelResult['coordinates']
  let geometry: UniversalParcelResult['geometry']
  
  if (p.coordinates?.coordinates?.[0]?.[0]) {
    const coords = p.coordinates.coordinates[0]
    const centerLon = coords.reduce((sum, c) => sum + c[0], 0) / coords.length
    const centerLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length
    coordinates = { latitude: centerLat, longitude: centerLon }
    geometry = p.coordinates
  }
  
  return {
    parcelId: p.parcelId,
    country: 'Kenya',
    registrySource: 'NLIMS',
    owners: p.owners,
    area: p.area,
    areaUnit: p.areaUnit,
    landUse: p.landUse,
    tenure: p.leaseStatus,
    coordinates,
    geometry,
    registrationDate: p.registrationDate
  }
}

function convertNLISParcel(p: NLISParcel): UniversalParcelResult {
  let coordinates: UniversalParcelResult['coordinates']
  let geometry: UniversalParcelResult['geometry']
  
  if (p.boundaries?.coordinates?.[0]?.[0]) {
    const coords = p.boundaries.coordinates[0]
    const centerLon = coords.reduce((sum, c) => sum + c[0], 0) / coords.length
    const centerLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length
    coordinates = { latitude: centerLat, longitude: centerLon }
    geometry = p.boundaries
  }
  
  return {
    parcelId: p.parcelId,
    country: 'Uganda',
    registrySource: 'NLIS',
    owners: p.registeredOwners,
    area: p.size,
    areaUnit: p.sizeUnit,
    landUse: p.landUse,
    tenure: p.tenureType,
    coordinates,
    geometry,
    registrationDate: p.registrationDate
  }
}

function convertTanzaniaPlot(p: TanzaniaPlot): UniversalParcelResult {
  let coordinates: UniversalParcelResult['coordinates']
  let geometry: UniversalParcelResult['geometry']
  
  if (p.coordinates?.coordinates?.[0]?.[0]) {
    const coords = p.coordinates.coordinates[0]
    const centerLon = coords.reduce((sum, c) => sum + c[0], 0) / coords.length
    const centerLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length
    coordinates = { latitude: centerLat, longitude: centerLon }
    geometry = p.coordinates
  }
  
  return {
    parcelId: p.plotNumber,
    country: 'Tanzania',
    registrySource: 'Ministry of Lands',
    owners: p.owners,
    area: p.extent,
    areaUnit: p.extentUnit,
    landUse: p.landUse,
    tenure: p.tenure,
    coordinates,
    geometry,
    registrationDate: p.grantDate
  }
}

export async function verifyOwnership(
  country: string,
  parcelId: string,
  ownerName: string
): Promise<{ verified: boolean; message: string }> {
  if (country === 'Kenya') {
    return verifyLandOwnership(parcelId, ownerName)
  }
  
  if (country === 'Uganda') {
    const validation = await validateTitle(parcelId)
    if (!validation.valid) {
      return { verified: false, message: validation.message }
    }
    return { verified: true, message: `Title verified: ${parcelId}` }
  }
  
  return { verified: false, message: 'Verification not available for this country' }
}

export function getParcelAsGeoJSON(parcel: UniversalParcelResult): object | null {
  if (!parcel.geometry) return null
  
  return {
    type: 'Feature',
    properties: {
      parcelId: parcel.parcelId,
      country: parcel.country,
      registrySource: parcel.registrySource,
      owners: parcel.owners,
      area: parcel.area,
      areaUnit: parcel.areaUnit,
      landUse: parcel.landUse,
      tenure: parcel.tenure
    },
    geometry: parcel.geometry
  }
}

export function getSupportedCountries(): string[] {
  return ['Kenya', 'Uganda', 'Tanzania']
}

export function getCountryRegistry(country: string): string {
  switch (country) {
    case 'Kenya': return 'NLIMS'
    case 'Uganda': return 'NLIS'
    case 'Tanzania': return 'Ministry of Lands'
    default: return 'Unknown'
  }
}
