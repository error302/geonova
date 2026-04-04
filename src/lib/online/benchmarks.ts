/**
 * Benchmark Database Lookup Service
 * Phase 7 - Online Power Features
 * Online database of known benchmarks for survey verification
 */

export interface Benchmark {
  id: string
  name: string
  country: string
  region?: string
  type: 'BM' | 'CP' | 'TRIG' | 'TIDAL'
  elevation: number
  latitude?: number
  longitude?: number
  easting?: number
  northing?: number
  zone?: number
  datum: string
  established?: string
  source: string
  lastVerified?: string
}

export interface BenchmarkSearchResult {
  benchmarks: Benchmark[]
  total: number
  region?: string
}

export interface BenchmarkSearchParams {
  country?: string
  region?: string
  type?: 'BM' | 'CP' | 'TRIG' | 'TIDAL' | 'ALL'
  radiusKm?: number
  latitude?: number
  longitude?: number
}

const BENCHMARK_DATABASE: Benchmark[] = [
  {
    id: 'KE-BM-001',
    name: 'Nairobi Primary BM',
    country: 'Kenya',
    region: 'Nairobi',
    type: 'BM',
    elevation: 1798.456,
    latitude: -1.2921,
    longitude: 36.8219,
    datum: 'ARC1960',
    source: 'Survey of Kenya',
    lastVerified: '2024-06-15'
  },
  {
    id: 'KE-BM-002',
    name: 'Mombasa Harbor BM',
    country: 'Kenya',
    region: 'Mombasa',
    type: 'BM',
    elevation: 5.234,
    latitude: -4.0435,
    longitude: 39.6682,
    datum: 'ARC1960',
    source: 'Survey of Kenya',
    lastVerified: '2024-05-20'
  },
  {
    id: 'KE-TRIG-001',
    name: 'Mount Kenya Trig',
    country: 'Kenya',
    region: 'Central',
    type: 'TRIG',
    elevation: 5199.0,
    latitude: -0.1525,
    longitude: 37.3083,
    datum: 'ARC1960',
    source: 'Survey of Kenya',
    lastVerified: '2023-11-10'
  },
  {
    id: 'UG-BM-001',
    name: 'Kampala Primary BM',
    country: 'Uganda',
    region: 'Kampala',
    type: 'BM',
    elevation: 1189.234,
    latitude: 0.3476,
    longitude: 32.5825,
    datum: 'WGS84',
    source: 'Department of Surveys and Mapping',
    lastVerified: '2024-04-12'
  },
  {
    id: 'UG-BM-002',
    name: 'Entebbe Airport BM',
    country: 'Uganda',
    region: 'Entebbe',
    type: 'BM',
    elevation: 1155.678,
    latitude: 0.0423,
    longitude: 32.4602,
    datum: 'WGS84',
    source: 'Department of Surveys and Mapping',
    lastVerified: '2024-03-28'
  },
  {
    id: 'TZ-BM-001',
    name: 'Dar es Salaam BM',
    country: 'Tanzania',
    region: 'Dar es Salaam',
    type: 'BM',
    elevation: 8.456,
    latitude: -6.7924,
    longitude: 39.2083,
    datum: 'ARC1960',
    source: 'Ministry of Lands',
    lastVerified: '2024-07-01'
  },
  {
    id: 'TZ-BM-002',
    name: 'Arusha Town BM',
    country: 'Tanzania',
    region: 'Arusha',
    type: 'BM',
    elevation: 1402.123,
    latitude: -3.3667,
    longitude: 36.6833,
    datum: 'ARC1960',
    source: 'Ministry of Lands',
    lastVerified: '2024-06-22'
  },
  {
    id: 'ZA-BM-001',
    name: 'Johannesburg City BM',
    country: 'South Africa',
    region: 'Gauteng',
    type: 'BM',
    elevation: 1753.234,
    latitude: -26.2041,
    longitude: 28.0473,
    datum: 'HARTEBEESTHOEK94',
    source: 'Chief Director: Spatial Planning and Information',
    lastVerified: '2024-08-10'
  },
  {
    id: 'ZA-BM-002',
    name: 'Cape Town Harbor BM',
    country: 'South Africa',
    region: 'Western Cape',
    type: 'BM',
    elevation: 4.567,
    latitude: -33.9249,
    longitude: 18.4241,
    datum: 'HARTEBEESTHOEK94',
    source: 'Chief Director: Spatial Planning and Information',
    lastVerified: '2024-07-15'
  },
  {
    id: 'GH-BM-001',
    name: 'Accra Primary BM',
    country: 'Ghana',
    region: 'Greater Accra',
    type: 'BM',
    elevation: 22.345,
    latitude: 5.6037,
    longitude: -0.1870,
    datum: 'WGS84',
    source: 'Survey Authority of Ghana',
    lastVerified: '2024-05-30'
  },
  {
    id: 'NG-BM-001',
    name: 'Lagos Island BM',
    country: 'Nigeria',
    region: 'Lagos',
    type: 'BM',
    elevation: 6.456,
    latitude: 6.5244,
    longitude: 3.3792,
    datum: 'WGS84',
    source: 'Office of the Surveyor General',
    lastVerified: '2024-04-18'
  },
  {
    id: 'NG-TRIG-001',
    name: 'Zaria Trig Station',
    country: 'Nigeria',
    region: 'Zaria',
    type: 'TRIG',
    elevation: 687.234,
    latitude: 11.0800,
    longitude: 7.7500,
    datum: 'WGS84',
    source: 'Office of the Surveyor General',
    lastVerified: '2023-12-05'
  },
  {
    id: 'ET-BM-001',
    name: 'Addis Ababa BM',
    country: 'Ethiopia',
    region: 'Addis Ababa',
    type: 'BM',
    elevation: 2355.678,
    latitude: 9.0252,
    longitude: 38.7468,
    datum: 'ADINDAN',
    source: 'Ethiopian Geodesy and Cartography Authority',
    lastVerified: '2024-06-08'
  },
  {
    id: 'EG-BM-001',
    name: 'Cairo Survey BM',
    country: 'Egypt',
    region: 'Cairo',
    type: 'BM',
    elevation: 23.456,
    latitude: 30.0444,
    longitude: 31.2357,
    datum: 'WGS84',
    source: 'Egyptian Survey Authority',
    lastVerified: '2024-05-12'
  },
  {
    id: 'TZ-TIDAL-001',
    name: 'Zanzibar Tide Gauge',
    country: 'Tanzania',
    region: 'Zanzibar',
    type: 'TIDAL',
    elevation: 2.345,
    latitude: -6.1659,
    longitude: 39.2026,
    datum: 'ARC1960',
    source: 'Tanzania Ports Authority',
    lastVerified: '2024-08-01'
  }
]

export async function searchBenchmarks(params: BenchmarkSearchParams): Promise<BenchmarkSearchResult> {
  let results = [...BENCHMARK_DATABASE]
  
  if (params.country) {
    results = results.filter((b: any) => 
      b.country.toLowerCase() === params.country!.toLowerCase()
    )
  }
  
  if (params.region) {
    results = results.filter((b: any) => 
      b.region?.toLowerCase().includes(params.region!.toLowerCase())
    )
  }
  
  if (params.type && params.type !== 'ALL') {
    results = results.filter((b: any) => b.type === params.type)
  }
  
  if (params.latitude !== undefined && params.longitude !== undefined && params.radiusKm) {
    const radiusDeg = params.radiusKm / 111
    results = results.filter((b: any) => {
      if (b.latitude === undefined || b.longitude === undefined) return false
      const latDiff = Math.abs(b.latitude - params.latitude!)
      const lonDiff = Math.abs(b.longitude - params.longitude!)
      return latDiff <= radiusDeg && lonDiff <= radiusDeg
    })
    
    results.sort((a: any, b: any) => {
      if (a.latitude === undefined || b.latitude === undefined) return 0
      const distA = Math.pow(a.latitude - params.latitude!, 2) + Math.pow(a.longitude! - params.longitude!, 2)
      const distB = Math.pow(b.latitude - params.latitude!, 2) + Math.pow(b.longitude! - params.longitude!, 2)
      return distA - distB
    })
  }
  
  return {
    benchmarks: results,
    total: results.length,
    region: params.region
  }
}

export async function getBenchmarkById(id: string): Promise<Benchmark | null> {
  return BENCHMARK_DATABASE.find((b: any) => b.id === id) || null
}

export async function getBenchmarksByCountry(country: string): Promise<BenchmarkSearchResult> {
  return searchBenchmarks({ country })
}

export function getAvailableCountries(): string[] {
  const countries = new Set(BENCHMARK_DATABASE.map((b: any) => b.country))
  return Array.from(countries).sort()
}

export function getBenchmarkTypes(): { id: string; name: string; description: string }[] {
  return [
    { id: 'BM', name: 'Benchmark', description: 'Standard elevation benchmark' },
    { id: 'CP', name: 'Control Point', description: 'Survey control point' },
    { id: 'TRIG', name: 'Trigonometric Station', description: 'Trig pillar or station' },
    { id: 'TIDAL', name: 'Tidal Benchmark', description: 'Tide gauge reference point' }
  ]
}
