/**
 * Additional International Registry Integrations
 * India, Bangladesh, Indonesia, Malaysia, Brazil, Colombia, Egypt, Morocco
 */

export interface Parcel {
  id: string
  country: string
  registry: string
  parcelNumber: string
  ownerName: string
  area: number
  areaUnit: string
  coordinates?: { easting: number; northing: number }
  status: 'registered' | 'pending'
}

// ============ INDIA ============

export function searchIndiaRegistry(query: string): Parcel[] {
  const data: Parcel[] = [
    {
      id: 'IN-MH-001',
      country: 'India',
      registry: 'Maharashtra',
      parcelNumber: 'Survey No. 45/1',
      ownerName: 'Rajesh Kumar',
      area: 500,
      areaUnit: 'sqm',
      coordinates: { easting: 730000, northing: 1900000 },
      status: 'registered',
    },
  ]
  return data.filter(p => 
    p.parcelNumber.toLowerCase().includes(query.toLowerCase()) ||
    p.ownerName.toLowerCase().includes(query.toLowerCase())
  )
}

// ============ BANGLADESH ============

export function searchBangladeshRegistry(query: string): Parcel[] {
  const data: Parcel[] = [
    {
      id: 'BD-DHK-001',
      country: 'Bangladesh',
      registry: 'Dhaka',
      parcelNumber: 'CS-12345',
      ownerName: 'Ahmed Hasan',
      area: 250,
      areaUnit: 'sqm',
      coordinates: { easting: 900000, northing: 2400000 },
      status: 'registered',
    },
  ]
  return data.filter(p => 
    p.parcelNumber.toLowerCase().includes(query.toLowerCase()) ||
    p.ownerName.toLowerCase().includes(query.toLowerCase())
  )
}

// ============ INDONESIA ============

export function searchIndonesiaRegistry(query: string): Parcel[] {
  const data: Parcel[] = [
    {
      id: 'ID-JK-001',
      country: 'Indonesia',
      registry: 'Jakarta',
      parcelNumber: 'KEL-001',
      ownerName: 'PT Maju Jaya',
      area: 1000,
      areaUnit: 'sqm',
      coordinates: { easting: 690000, northing: 9230000 },
      status: 'registered',
    },
  ]
  return data.filter(p => 
    p.parcelNumber.toLowerCase().includes(query.toLowerCase()) ||
    p.ownerName.toLowerCase().includes(query.toLowerCase())
  )
}

// ============ MALAYSIA ============

export function searchMalaysiaRegistry(query: string): Parcel[] {
  const data: Parcel[] = [
    {
      id: 'MY-KL-001',
      country: 'Malaysia',
      registry: 'Kuala Lumpur',
      parcelNumber: 'GM-001',
      ownerName: 'Sdn Bhd Holdings',
      area: 0.5,
      areaUnit: 'acre',
      coordinates: { easting: 400000, northing: 3500000 },
      status: 'registered',
    },
  ]
  return data.filter(p => 
    p.parcelNumber.toLowerCase().includes(query.toLowerCase()) ||
    p.ownerName.toLowerCase().includes(query.toLowerCase())
  )
}

// ============ BRAZIL ============

export function searchBrazilRegistry(query: string): Parcel[] {
  const data: Parcel[] = [
    {
      id: 'BR-SP-001',
      country: 'Brazil',
      registry: 'São Paulo',
      parcelNumber: 'MAT-12345',
      ownerName: 'Empresa Brasiliera',
      area: 5000,
      areaUnit: 'sqm',
      coordinates: { easting: 350000, northing: 7400000 },
      status: 'registered',
    },
  ]
  return data.filter(p => 
    p.parcelNumber.toLowerCase().includes(query.toLowerCase()) ||
    p.ownerName.toLowerCase().includes(query.toLowerCase())
  )
}

// ============ COLOMBIA ============

export function searchColombiaRegistry(query: string): Parcel[] {
  const data: Parcel[] = [
    {
      id: 'CO-BOG-001',
      country: 'Colombia',
      registry: 'Bogotá',
      parcelNumber: '001-23456',
      ownerName: 'Carlos Rodriguez',
      area: 800,
      areaUnit: 'sqm',
      coordinates: { easting: 720000, northing: 4900000 },
      status: 'registered',
    },
  ]
  return data.filter(p => 
    p.parcelNumber.toLowerCase().includes(query.toLowerCase()) ||
    p.ownerName.toLowerCase().includes(query.toLowerCase())
  )
}

// ============ EGYPT ============

export function searchEgyptRegistry(query: string): Parcel[] {
  const data: Parcel[] = [
    {
      id: 'EG-CAI-001',
      country: 'Egypt',
      registry: 'Cairo',
      parcelNumber: 'CAI-00123',
      ownerName: 'Egyptian Real Estate Co',
      area: 1500,
      areaUnit: 'sqm',
      coordinates: { easting: 300000, northing: 3300000 },
      status: 'registered',
    },
  ]
  return data.filter(p => 
    p.parcelNumber.toLowerCase().includes(query.toLowerCase()) ||
    p.ownerName.toLowerCase().includes(query.toLowerCase())
  )
}

// ============ MOROCCO ============

export function searchMoroccoRegistry(query: string): Parcel[] {
  const data: Parcel[] = [
    {
      id: 'MA-RAB-001',
      country: 'Morocco',
      registry: 'Rabat',
      parcelNumber: '001-T-12345',
      ownerName: 'Groupe Moroccan',
      area: 2000,
      areaUnit: 'sqm',
      coordinates: { easting: 500000, northing: 3600000 },
      status: 'registered',
    },
  ]
  return data.filter(p => 
    p.parcelNumber.toLowerCase().includes(query.toLowerCase()) ||
    p.ownerName.toLowerCase().includes(query.toLowerCase())
  )
}

// ============ UNIVERSAL SEARCH ============

export function searchAllRegistries(query: string): Parcel[] {
  return [
    ...searchIndiaRegistry(query),
    ...searchBangladeshRegistry(query),
    ...searchIndonesiaRegistry(query),
    ...searchMalaysiaRegistry(query),
    ...searchBrazilRegistry(query),
    ...searchColombiaRegistry(query),
    ...searchEgyptRegistry(query),
    ...searchMoroccoRegistry(query),
  ]
}

export function getSupportedCountries() {
  return [
    { code: 'IN', name: 'India', region: 'South Asia' },
    { code: 'BD', name: 'Bangladesh', region: 'South Asia' },
    { code: 'ID', name: 'Indonesia', region: 'Southeast Asia' },
    { code: 'MY', name: 'Malaysia', region: 'Southeast Asia' },
    { code: 'BR', name: 'Brazil', region: 'South America' },
    { code: 'CO', name: 'Colombia', region: 'South America' },
    { code: 'EG', name: 'Egypt', region: 'North Africa' },
    { code: 'MA', name: 'Morocco', region: 'North Africa' },
    { code: 'KE', name: 'Kenya', region: 'East Africa' },
    { code: 'UG', name: 'Uganda', region: 'East Africa' },
    { code: 'TZ', name: 'Tanzania', region: 'East Africa' },
    { code: 'GH', name: 'Ghana', region: 'West Africa' },
    { code: 'NG', name: 'Nigeria', region: 'West Africa' },
    { code: 'ZA', name: 'South Africa', region: 'Southern Africa' },
  ]
}
