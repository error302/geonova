/**
 * Kenya CORS Network data
 * Sources: Muya CORS (Measurement Systems Ltd), AGL CORS (Africa Geonetwork Ltd),
 * Survey of Kenya KenCORS, Kenya Power CORS
 *
 * Note: Exact station coordinates are proprietary — providers give NTRIP credentials
 * on registration. Positions below are at the town/facility level.
 */

export type NetworkId = 'MUYA' | 'AGL' | 'KENCORS' | 'KPLC'
export type StationStatus = 'online' | 'offline' | 'unknown'

export interface CORSStation {
  id: string
  name: string
  town: string
  county: string
  network: NetworkId
  latitude: number    // approximate — at town centre
  longitude: number
  elevation: number   // metres above MSL (approximate)
  status: StationStatus
  notes?: string
}

export interface CORSNetwork {
  id: NetworkId
  name: string
  operator: string
  website: string
  mountpoint: string    // NTRIP mountpoint
  rtcmFormat: string
  accuracy: string
  coverage: string
  registrationRequired: boolean
  contactEmail?: string
  contactPhone?: string
  notes: string
}

// ── Networks ─────────────────────────────────────────────────────────────────

export const NETWORKS: Record<NetworkId, CORSNetwork> = {
  MUYA: {
    id: 'MUYA',
    name: 'Muya CORS',
    operator: 'Measurement Systems Ltd',
    website: 'https://muya-cors.com',
    mountpoint: 'RTCM32_NR_MUYA',
    rtcmFormat: 'RTCM 3.2 / NTRIP',
    accuracy: '<1 cm horizontal, <2 cm vertical',
    coverage: 'Nationwide — 25+ stations',
    registrationRequired: true,
    contactPhone: '+254 722 xxx xxx',
    notes: 'Coordinates computed via OPUS (NGS/USA) and Trimble RTX on ITRF2014. Supports WGS84 and Arc 1960 / UTM and Cassini Soldner.',
  },
  AGL: {
    id: 'AGL',
    name: 'AGL CORS',
    operator: 'Africa Geonetwork Limited',
    website: 'https://aglcors.com',
    mountpoint: 'RTCM3_AGL',
    rtcmFormat: 'RTCM 3.x / NTRIP',
    accuracy: '<2 cm horizontal, <4 cm vertical',
    coverage: 'Mombasa, Central, Western regions',
    registrationRequired: true,
    notes: 'Available 24/7, 365 days. Expanding to north and east based on user demand.',
  },
  KENCORS: {
    id: 'KENCORS',
    name: 'KenCORS',
    operator: 'Survey of Kenya',
    website: 'https://www.surveyofkenya.go.ke',
    mountpoint: 'KENCORS_NTRIP',
    rtcmFormat: 'RTCM 3.x',
    accuracy: '<5 cm (network RTK)',
    coverage: 'National (selective)',
    registrationRequired: true,
    contactEmail: 'info@surveyofkenya.go.ke',
    notes: 'National network operated by Survey of Kenya. Used as authoritative reference for cadastral surveys. Contact Survey of Kenya directly for access credentials.',
  },
  KPLC: {
    id: 'KPLC',
    name: 'Kenya Power CORS',
    operator: 'Kenya Power & Lighting Company',
    website: 'https://www.kplc.co.ke',
    mountpoint: 'KPLC_CORS',
    rtcmFormat: 'RTCM 3.x',
    accuracy: '<3 cm (pending gazettement)',
    coverage: '15 stations nationwide (being gazetted)',
    registrationRequired: true,
    notes: 'Being gazetted as third-tier geodetic control by Survey of Kenya. 50-person joint campaign with Survey of Kenya for approval.',
  },
}

// ── Stations (approximate city-level coordinates) ────────────────────────────
// Exact station coordinates are proprietary — contact the network operator.

export const STATIONS: CORSStation[] = [
  // Muya CORS — major stations
  { id: 'MUYA_NBI', name: 'Nairobi', town: 'Nairobi', county: 'Nairobi', network: 'MUYA', latitude: -1.2921, longitude: 36.8219, elevation: 1661, status: 'online' },
  { id: 'MUYA_MSA', name: 'Mombasa', town: 'Mombasa', county: 'Mombasa', network: 'MUYA', latitude: -4.0435, longitude: 39.6682, elevation: 17, status: 'online' },
  { id: 'MUYA_KSM', name: 'Kisumu', town: 'Kisumu', county: 'Kisumu', network: 'MUYA', latitude: -0.0917, longitude: 34.7679, elevation: 1131, status: 'online' },
  { id: 'MUYA_NKR', name: 'Nakuru', town: 'Nakuru', county: 'Nakuru', network: 'MUYA', latitude: -0.3031, longitude: 36.0800, elevation: 1850, status: 'online' },
  { id: 'MUYA_ELD', name: 'Eldoret', town: 'Eldoret', county: 'Uasin Gishu', network: 'MUYA', latitude: 0.5143, longitude: 35.2698, elevation: 2100, status: 'online' },
  { id: 'MUYA_NYR', name: 'Nyeri', town: 'Nyeri', county: 'Nyeri', network: 'MUYA', latitude: -0.4167, longitude: 36.9500, elevation: 1759, status: 'online' },
  { id: 'MUYA_THK', name: 'Thika', town: 'Thika', county: 'Kiambu', network: 'MUYA', latitude: -1.0333, longitude: 37.0833, elevation: 1555, status: 'online' },
  { id: 'MUYA_KER', name: 'Kericho', town: 'Kericho', county: 'Kericho', network: 'MUYA', latitude: -0.3667, longitude: 35.2833, elevation: 2000, status: 'online' },
  { id: 'MUYA_MRU', name: 'Meru', town: 'Meru', county: 'Meru', network: 'MUYA', latitude: 0.0464, longitude: 37.6491, elevation: 1515, status: 'online' },
  { id: 'MUYA_EMB', name: 'Embu', town: 'Embu', county: 'Embu', network: 'MUYA', latitude: -0.5333, longitude: 37.4500, elevation: 1490, status: 'online' },
  { id: 'MUYA_MLN', name: 'Malindi', town: 'Malindi', county: 'Kilifi', network: 'MUYA', latitude: -3.2175, longitude: 40.1169, elevation: 26, status: 'online' },
  { id: 'MUYA_KTL', name: 'Kitale', town: 'Kitale', county: 'Trans Nzoia', network: 'MUYA', latitude: 1.0154, longitude: 35.0063, elevation: 1890, status: 'online' },
  { id: 'MUYA_KKM', name: 'Kakamega', town: 'Kakamega', county: 'Kakamega', network: 'MUYA', latitude: 0.2827, longitude: 34.7519, elevation: 1535, status: 'online' },
  { id: 'MUYA_GRS', name: 'Garissa', town: 'Garissa', county: 'Garissa', network: 'MUYA', latitude: -0.4532, longitude: 39.6461, elevation: 134, status: 'unknown', notes: 'Coverage may be limited in arid north' },
  { id: 'MUYA_ISL', name: 'Isiolo', town: 'Isiolo', county: 'Isiolo', network: 'MUYA', latitude: 0.3544, longitude: 37.5820, elevation: 1066, status: 'unknown' },
  // AGL CORS
  { id: 'AGL_MSA', name: 'Mombasa (AGL)', town: 'Mombasa', county: 'Mombasa', network: 'AGL', latitude: -4.0500, longitude: 39.6600, elevation: 15, status: 'online' },
  { id: 'AGL_NBI', name: 'Nairobi Central (AGL)', town: 'Nairobi', county: 'Nairobi', network: 'AGL', latitude: -1.2833, longitude: 36.8167, elevation: 1660, status: 'online' },
  { id: 'AGL_KSM', name: 'Kisumu (AGL)', town: 'Kisumu', county: 'Kisumu', network: 'AGL', latitude: -0.1022, longitude: 34.7617, elevation: 1130, status: 'online' },
  // KenCORS — Survey of Kenya (locations approximate)
  { id: 'SOK_NBI', name: 'Survey of Kenya HQ', town: 'Nairobi', county: 'Nairobi', network: 'KENCORS', latitude: -1.2940, longitude: 36.8062, elevation: 1675, status: 'online', notes: 'Primary reference station' },
  { id: 'SOK_MSA', name: 'Mombasa Regional', town: 'Mombasa', county: 'Mombasa', network: 'KENCORS', latitude: -4.0556, longitude: 39.6636, elevation: 14, status: 'online' },
  { id: 'SOK_KSM', name: 'Kisumu Regional', town: 'Kisumu', county: 'Kisumu', network: 'KENCORS', latitude: -0.0917, longitude: 34.7619, elevation: 1131, status: 'online' },
  { id: 'SOK_NKR', name: 'Nakuru Regional', town: 'Nakuru', county: 'Nakuru', network: 'KENCORS', latitude: -0.3031, longitude: 36.0800, elevation: 1850, status: 'online' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Distance between two lat/lon points in km (Haversine) */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

/** Find nearest N stations to given coordinates */
export function getNearestStations(lat: number, lon: number, n = 5, network?: NetworkId): (CORSStation & { distanceKm: number })[] {
  return STATIONS
    .filter((s: any) => !network || s.network === network)
    .map((s: any) => ({ ...s, distanceKm: distanceKm(lat, lon, s.latitude, s.longitude) }))
    .sort((a: any, b: any) => a.distanceKm - b.distanceKm)
    .slice(0, n)
}

export function getCounties(): string[] {
  const seen = new Set<string>(); return STATIONS.map((s: any) => s.county).filter((c: any) => { if (seen.has(c)) return false; seen.add(c); return true }).sort()
}
