/**
 * Global Geodetic Datums and Transformations
 *
 * Reference:
 *   USACE EM 1110-1-1005 §5-2 (NAD83/WGS84)
 *   EPSG Registry v10 (all parameters)
 *   NOAA NGS (NAD83(2011) epoch)
 *   OSNet/OSTN15 (OSGB36 transformation)
 */

export interface DatumParameters {
  name: string
  ellipsoid: string
  semiMajorAxis: number          // metres
  inverseFlattening: number
  dx: number; dy: number; dz: number  // to WGS84, metres (Helmert)
  rx: number; ry: number; rz: number  // arc-seconds
  scale: number                       // ppm
  countries: string[]
  projection?: string
  notes?: string
}

export const DATUM_REGISTRY: Record<string, DatumParameters> = {

  // ── Africa ──────────────────────────────────────────────────────────────────
  ARC1960: {
    name: 'Arc 1960',
    ellipsoid: 'Clarke 1880',
    semiMajorAxis: 6378249.145,
    inverseFlattening: 293.465,
    dx: -157, dy: -2, dz: -299,
    rx: 0, ry: 0, rz: 0, scale: 0,
    countries: ['Kenya', 'Uganda', 'Tanzania'],
    projection: 'UTM Zone 36/37',
  },
  HARTEBEESTHOEK94: {
    name: 'Hartebeesthoek94',
    ellipsoid: 'GRS80',
    semiMajorAxis: 6378137.0,
    inverseFlattening: 298.257222101,
    dx: 0, dy: 0, dz: 0,
    rx: 0, ry: 0, rz: 0, scale: 0,
    countries: ['South Africa', 'Namibia', 'Lesotho', 'Swaziland', 'Botswana'],
    projection: 'South African CRS',
  },
  ADINDAN: {
    name: 'Adindan',
    ellipsoid: 'Clarke 1880',
    semiMajorAxis: 6378249.145,
    inverseFlattening: 293.465,
    dx: -166, dy: -15, dz: 204,
    rx: 0, ry: 0, rz: 0, scale: 0,
    countries: ['Ethiopia', 'Sudan', 'Somalia', 'Mali'],
  },

  // ── United States ──────────────────────────────────────────────────────────
  NAD83_2011: {
    name: 'NAD83(2011) / NSRS',
    ellipsoid: 'GRS80',
    semiMajorAxis: 6378137.0,
    inverseFlattening: 298.257222101,
    dx: 0, dy: 0, dz: 0,
    rx: 0, ry: 0, rz: 0, scale: 0,
    countries: ['United States'],
    projection: 'State Plane Coordinate System (SPCS) / UTM',
    notes: 'Epoch 2010.00 — replaces NAD83(CORS96). Tie to NSRS via OPUS or CORS.',
  },
  NAD83_1986: {
    name: 'NAD83(1986)',
    ellipsoid: 'GRS80',
    semiMajorAxis: 6378137.0,
    inverseFlattening: 298.257222101,
    dx: 0, dy: 0, dz: 0,
    rx: 0, ry: 0, rz: 0, scale: 0,
    countries: ['United States'],
    projection: 'State Plane / UTM',
    notes: 'Original NAD83. Still used in some legacy surveys.',
  },
  WGS84: {
    name: 'WGS84 (G1762)',
    ellipsoid: 'WGS84',
    semiMajorAxis: 6378137.0,
    inverseFlattening: 298.257223563,
    dx: 0, dy: 0, dz: 0,
    rx: 0, ry: 0, rz: 0, scale: 0,
    countries: ['Worldwide', 'United States', 'International'],
    projection: 'WGS84 / UTM',
    notes: 'IGS08 epoch. Equivalent to ITRF08 at 1–2cm. Use for GNSS/GPS.',
  },
  NAVD88: {
    name: 'NAVD88',
    ellipsoid: 'GRS80',
    semiMajorAxis: 6378137.0,
    inverseFlattening: 298.257222101,
    dx: 0, dy: 0, dz: 0,
    rx: 0, ry: 0, rz: 0, scale: 0,
    countries: ['United States'],
    projection: 'Orthometric (gravity-based)',
    notes: 'NGVD29 → NAVD88 shift: ~0–1.5m depending on region. Use GEOIDxx for GNSS-to-ortho.',
  },

  // ── United Kingdom ─────────────────────────────────────────────────────────
  OSGB36: {
    name: 'OSGB36',
    ellipsoid: 'Airy 1830',
    semiMajorAxis: 6377563.396,
    inverseFlattening: 299.3249646,
    dx: 446.448, dy: -125.157, dz: 542.060,
    rx: 0.1502, ry: 0.2470, rz: 0.8421, scale: -20.4894,
    countries: ['United Kingdom'],
    projection: 'British National Grid (Transverse Mercator)',
    notes: 'OSTN15/NTv2 grid shift for sub-cm transformation to ETRS89/WGS84.',
  },
  ETRS89: {
    name: 'ETRS89',
    ellipsoid: 'GRS80',
    semiMajorAxis: 6378137.0,
    inverseFlattening: 298.257222101,
    dx: 0, dy: 0, dz: 0,
    rx: 0, ry: 0, rz: 0, scale: 0,
    countries: ['United Kingdom', 'European Union'],
    projection: 'British National Grid / UTM',
    notes: 'European Terrestrial Reference System 1989. Tied to EUREF.',
  },

  // ── Australia ──────────────────────────────────────────────────────────────
  GDA2020: {
    name: 'GDA2020',
    ellipsoid: 'GRS80',
    semiMajorAxis: 6378137.0,
    inverseFlattening: 298.257222101,
    dx: 0, dy: 0, dz: 0,
    rx: 0, ry: 0, rz: 0, scale: 0,
    countries: ['Australia'],
    projection: 'MGA2020 (UTM)',
    notes: 'Replaced GDA94. ITRF at epoch 2020.0. AUSGeoid2020 for AHD.',
  },
  GDA94: {
    name: 'GDA94',
    ellipsoid: 'GRS80',
    semiMajorAxis: 6378137.0,
    inverseFlattening: 298.257222101,
    dx: 0, dy: 0, dz: 0,
    rx: 0, ry: 0, rz: 0, scale: 0,
    countries: ['Australia'],
    projection: 'MGA94 (UTM)',
    notes: 'GDA94 to GDA2020 shift: ~1.8m across Australia.',
  },

  // ── New Zealand ────────────────────────────────────────────────────────────
  NZGD2000: {
    name: 'NZGD2000',
    ellipsoid: 'GRS80',
    semiMajorAxis: 6378137.0,
    inverseFlattening: 298.257222101,
    dx: 0, dy: 0, dz: 0,
    rx: 0, ry: 0, rz: 0, scale: 0,
    countries: ['New Zealand'],
    projection: 'NZTM2000',
    notes: 'ITRF at epoch 2000.00. NZVD2016 for orthometric (NZVD09 → NZVD2016 shift up to 0.5m).',
  },

  // ── Bahrain ────────────────────────────────────────────────────────────────
  AIN_AL_ABD_1970: {
    name: 'Ain Al-Abd 1970',
    ellipsoid: 'Clarke 1880 (International 1924)',
    semiMajorAxis: 6378249.145,
    inverseFlattening: 293.465,
    dx: -243.1, dy: -154.4, dz: 406.1,
    rx: 0, ry: 0, rz: 0, scale: 0,
    countries: ['Bahrain'],
    projection: 'UTM Zone 39N, CM Scale Factor 0.9996',
    notes: 'Bahrain local datum. PRN: 8 GNSS reference stations (Diyar Al Muharraq, King Fahd Causeway, Scout Camp, Durrat, Jauu, Budaiya, Hawar, Umm Al Hassam). Leica GPS 1200 / Bahrain CSCS v1 coordinate system.',
  },

  // ── Saudi Arabia ───────────────────────────────────────────────────────────
  IGM1969: {
    name: 'IGM 1969 (GCS 1924)',
    ellipsoid: 'Clarke 1880',
    semiMajorAxis: 6378249.145,
    inverseFlattening: 293.465,
    dx: -144.9, dy: -115.1, dz: -141.8,
    rx: 0, ry: 0, rz: 0, scale: 0,
    countries: ['Saudi Arabia'],
    projection: 'UTM Zone 37/38/39N',
    notes: 'Saudi Arabia primary geodetic datum. GCS 1924 (not GDA). Modern surveys reference WGS84 via GNSS.',
  },

  // ── Oman ─────────────────────────────────────────────────────────────────
  OMAN_OTM: {
    name: 'Oman Transverse Mercator (OTM)',
    ellipsoid: 'GRS80',
    semiMajorAxis: 6378137.0,
    inverseFlattening: 298.257222101,
    dx: 0, dy: 0, dz: 0,
    rx: 0, ry: 0, rz: 0, scale: 0,
    countries: ['Oman'],
    projection: 'UTM Zone 39/40N / OTM',
    notes: 'WGS84-aligned. UTM or Oman Transverse Mercator projection.',
  },

  // ── UAE ───────────────────────────────────────────────────────────────────
  UAE_NAD83: {
    name: 'UAE NAD83(CSRS)',
    ellipsoid: 'GRS80',
    semiMajorAxis: 6378137.0,
    inverseFlattening: 298.257222101,
    dx: 0, dy: 0, dz: 0,
    rx: 0, ry: 0, rz: 0, scale: 0,
    countries: ['United Arab Emirates'],
    projection: 'UTM Zone 39/40/41N',
    notes: 'WGS84 primary for modern GNSS. UTM zones 39–41.',
  },

  // ── Nigeria ────────────────────────────────────────────────────────────────
  MINNA: {
    name: 'Minna',
    ellipsoid: 'Clarke 1880',
    semiMajorAxis: 6378249.145,
    inverseFlattening: 293.465,
    dx: -92.7, dy: -47.5, dz: -48.4,
    rx: 0, ry: 0, rz: 0, scale: 0,
    countries: ['Nigeria'],
    projection: 'UTM Zone 31/32N',
  },

  // ── Ghana ─────────────────────────────────────────────────────────────────
  Ghana_1920: {
    name: 'Gold Coast 1920 / Accra',
    ellipsoid: 'War Office',
    semiMajorAxis: 6378300.58,
    inverseFlattening: 296.0,
    dx: -88.0, dy: 290.0, dz: -207.0,
    rx: 0, ry: 0, rz: 0, scale: 0,
    countries: ['Ghana'],
    projection: 'Ghana National Grid',
  },
}

export function getAvailableDatums(): DatumParameters[] {
  return Object.values(DATUM_REGISTRY)
}

export function getDatumByCountry(country: string): DatumParameters[] {
  const map: Record<string, string[]> = {
    kenya: ['ARC1960', 'WGS84', 'NAD83_2011'],
    uganda: ['ARC1960', 'WGS84'],
    tanzania: ['ARC1960', 'WGS84'],
    nigeria: ['MINNA', 'WGS84'],
    ghana: ['Ghana_1920', 'WGS84', 'NAD83_2011'],
    south_africa: ['HARTEBEESTHOEK94', 'CAPE', 'WGS84'],
    bahrain: ['AIN_AL_ABD_1970', 'WGS84'],
    saudi_arabia: ['IGM1969', 'WGS84'],
    oman: ['OMAN_OTM', 'WGS84'],
    uae: ['UAE_NAD83', 'WGS84'],
    new_zealand: ['NZGD2000', 'WGS84'],
    us: ['NAD83_2011', 'NAD83_1986', 'WGS84', 'NAVD88'],
    uk: ['OSGB36', 'ETRS89', 'WGS84'],
    australia: ['GDA2020', 'GDA94', 'WGS84'],
    india: ['WGS84', 'NAD83_2011'],
    indonesia: ['WGS84', 'NAD83_2011'],
    brazil: ['WGS84', 'NAD83_2011'],
    other: ['WGS84', 'NAD83_2011'],
  }
  const keys = map[country] ?? ['WGS84']
  return keys.map(k => DATUM_REGISTRY[k]).filter(Boolean)
}

export function getDatumByCountryAndIndex(country: string, index: number): DatumParameters {
  const datums = getDatumByCountry(country)
  return datums[index] ?? DATUM_REGISTRY['WGS84']
}

export function getDatumNames(): string[] {
  return Object.keys(DATUM_REGISTRY)
}

export function getDatumByName(name: string): DatumParameters | undefined {
  return DATUM_REGISTRY[name]
}

export function transformToWGS84(
  easting: number,
  northing: number,
  zone: number,
  hemisphere: 'N' | 'S',
  sourceDatum: DatumParameters
): { easting: number; northing: number; note: string } {
  const { dx, dy, dz, rx, ry, rz, scale } = sourceDatum
  if (dx === 0 && dy === 0 && dz === 0) {
    return { easting, northing, note: `${sourceDatum.name} is already WGS84-compatible.` }
  }

  const arcSec = Math.PI / 648000
  const rxRad = rx * arcSec
  const ryRad = ry * arcSec
  const rzRad = rz * arcSec
  const ppm = scale / 1_000_000

  const sc = 1 + ppm
  const newE = dx + (sc * easting - rzRad * northing)
  const newN = dy + (rzRad * easting + sc * northing)

  return {
    easting: newE,
    northing: newN,
    note: `Helmert 7-param: d(${dx.toFixed(1)}, ${dy.toFixed(1)}, ${dz.toFixed(1)}) r(${rx.toFixed(4)}", ${ry.toFixed(4)}", ${rz.toFixed(4)}") s(${scale.toFixed(4)}ppm)`,
  }
}

export function getScaleFactor(latitudeDegrees: number, heightMetres: number): number {
  const latRad = latitudeDegrees * Math.PI / 180
  const a = 6378137.0
  const f = 1 / 298.257222101
  const e2 = 2 * f - f * f
  const sin2 = Math.sin(latRad) ** 2
  const N = a / Math.sqrt(1 - e2 * sin2)
  const H = heightMetres
  return 1 + H / N
}

export function getConvergenceAngle(
  longitudeDegrees: number,
  latitudeDegrees: number,
  centralMeridianDegrees: number
): number {
  const dLon = (longitudeDegrees - centralMeridianDegrees) * Math.PI / 180
  const latRad = latitudeDegrees * Math.PI / 180
  const sinLat = Math.sin(latRad)
  return dLon * sinLat * 206264.806247  // arc-seconds
}
