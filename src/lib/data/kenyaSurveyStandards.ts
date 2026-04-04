// Kenya Survey Standards Reference Data
// Based on: Survey Regulations 1994 (Legal Notice 168 of 1994), RDM 1.1, Cadastral Survey Standards

export interface AccuracyStandard {
  name: string
  order: number
  traversePrecision: number  // 1:X ratio
  levelingAllowable: string // mm per √km
  description: string
}

export interface SurveyMarkSpec {
  code: string
  name: string
  regulation: string
  isPermanent: boolean
  description: string
}

export interface DatumSpec {
  name: string
  code: string
  region: string
  ellipsoid: string
  projection: string
}

export interface SurveyRegulation {
  number: string
  part: string
  title: string
  description: string
}

// Traverse Accuracy Standards per RDM 1.1 Table 5.2
export const TRAVERSE_ACCURACY_STANDARDS: AccuracyStandard[] = [
  { name: 'First Order Class I', order: 1, traversePrecision: 20000, levelingAllowable: '4√K', description: 'Very high precision geodetic control' },
  { name: 'First Order Class II', order: 2, traversePrecision: 10000, levelingAllowable: '6√K', description: 'High precision geodetic control' },
  { name: 'Second Order Class I', order: 3, traversePrecision: 5000, levelingAllowable: '8√K', description: 'Primary control survey' },
  { name: 'Second Order Class II', order: 4, traversePrecision: 2500, levelingAllowable: '10√K', description: 'Secondary control survey' },
  { name: 'Third Order', order: 5, traversePrecision: 1000, levelingAllowable: '12√K', description: 'Cadastral and detail survey' },
]

// Levelling Accuracy Standards per RDM 1.1 Table 5.1
export const LEVELING_ACCURACY_STANDARDS: AccuracyStandard[] = [
  { name: 'First Order', order: 1, traversePrecision: 0, levelingAllowable: '4√K', description: 'Precision levelling - benchmarks' },
  { name: 'Second Order Class I', order: 2, traversePrecision: 0, levelingAllowable: '6√K', description: 'Engineer levelling' },
  { name: 'Second Order Class II', order: 3, traversePrecision: 0, levelingAllowable: '8√K', description: 'Technical levelling' },
  { name: 'Third Order', order: 4, traversePrecision: 0, levelingAllowable: '10√K', description: 'Cadastral survey levelling' },
  { name: 'Fourth Order', order: 5, traversePrecision: 0, levelingAllowable: '20√K', description: 'Detail survey elevations' },
]

// Survey Marks per Kenya Survey Regulations 1994
export const SURVEY_MARKS: SurveyMarkSpec[] = [
  { code: 'PSC', name: 'Primary Survey Control', regulation: 'Reg 14(1)', isPermanent: true, description: 'Concrete pillar with brass plate, established by Survey of Kenya' },
  { code: 'PSC-F', name: 'Primary Survey Control (Flush)', regulation: 'Reg 14(2)', isPermanent: true, description: 'Primary control mark flush with ground surface' },
  { code: 'SSC', name: 'Secondary Survey Control', regulation: 'Reg 15(1)', isPermanent: true, description: 'Concrete pillar or bench mark of secondary order' },
  { code: 'TSC', name: 'Tertiary Survey Control', regulation: 'Reg 16(1)', isPermanent: false, description: 'Temporary control mark, iron pin or nail' },
  { code: 'MN', name: 'Masonry Nail', regulation: 'Reg 17(a)', isPermanent: false, description: 'Nail in masonry, concrete or rock' },
  { code: 'IP', name: 'Iron Pin', regulation: 'Reg 17(b)', isPermanent: false, description: 'Iron pin driven into ground' },
  { code: 'WP', name: 'Wooden Peg', regulation: 'Reg 17(c)', isPermanent: false, description: 'Temporary wooden peg for boundary delineation' },
  { code: 'CB', name: 'Concrete Beacon', regulation: 'Reg 17(d)', isPermanent: true, description: 'Concrete boundary beacon with centre mark' },
  { code: 'IND', name: 'Indicatory Beacon', regulation: 'Reg 18', isPermanent: false, description: 'Indicatory beacon (not a physical corner mark)' },
  { code: 'RV', name: 'Rivet', regulation: 'Reg 17(e)', isPermanent: true, description: 'Brass or steel rivet in rock or concrete' },
  { code: 'BM', name: 'Benchmark', regulation: 'Reg 20(1)', isPermanent: true, description: 'Permanent benchmark referencing Kenya National Datum' },
  { code: 'TBM', name: 'Temporary Benchmark', regulation: 'Reg 20(2)', isPermanent: false, description: 'Temporary benchmark for short-term surveys' },
  { code: 'FB', name: 'Flush Bracket', regulation: 'Reg 20(3)', isPermanent: true, description: 'Flush bracket on wall or permanent structure' },
]

// Datums and Projections used in Kenya
export const KENYA_DATUMS: DatumSpec[] = [
  { name: 'Arc 1960', code: 'ARC1960', region: 'Kenya', ellipsoid: 'Clarke 1880', projection: 'UTM' },
  { name: 'WGS 84', code: 'WGS84', region: 'Global', ellipsoid: 'WGS 1984', projection: 'UTM' },
  { name: 'Minna', code: 'MINNA', region: 'Nigeria', ellipsoid: 'Clarke 1880', projection: 'UTM' },
]

export const KENYA_UTM_ZONES = [
  { zone: 35, region: 'Turkana (North)', hemisphere: 'N' },
  { zone: 36, region: 'Western Kenya (Kisumu, Eldoret)', hemisphere: 'N' },
  { zone: 36, region: 'Central Kenya (Nakuru, Kericho)', hemisphere: 'S' },
  { zone: 37, region: 'Eastern & Southern Kenya', hemisphere: 'S' },
]

// Survey Regulations Index
export const SURVEY_REGULATIONS: SurveyRegulation[] = [
  { number: 'Reg 14', part: 'V', title: 'Primary Survey Control', description: 'Establishment of PSC marks' },
  { number: 'Reg 15', part: 'V', title: 'Secondary Survey Control', description: 'Establishment of SSC marks' },
  { number: 'Reg 16', part: 'V', title: 'Tertiary Survey Control', description: 'Establishment of TSC marks' },
  { number: 'Reg 17', part: 'V', title: 'Boundary Marks', description: 'Types of boundary marks' },
  { number: 'Reg 18', part: 'V', title: 'Indicatory Beacons', description: 'When indicatory beacons are used' },
  { number: 'Reg 20', part: 'V', title: 'Benchmarks', description: 'Permanent and temporary benchmarks' },
  { number: 'Reg 21', part: 'V', title: 'Special Marks', description: 'Road nails, spikes, railway marks' },
  { number: 'Reg 22', part: 'V', title: 'Natural Features', description: 'Trees, rocks as reference marks' },
  { number: 'Reg 24', part: 'V', title: 'Coordinate Systems', description: 'Systems of coordinates and projections' },
  { number: 'Reg 27', part: 'V', title: 'Permissible Errors', description: 'Maximum allowable measurement errors' },
  { number: 'Reg 37', part: 'VI', title: 'Survey Marks Design', description: 'Design and specification of survey marks' },
  { number: 'Reg 38', part: 'VI', title: 'Placement of Marks', description: 'Placement of survey marks' },
  { number: 'Reg 47', part: 'VI', title: 'Missing Beacons', description: 'Procedure for missing beacons' },
  { number: 'Reg 51', part: 'VII', title: 'Traverse Surveys', description: 'Guiding principle for traverses' },
  { number: 'Reg 52-59', part: 'VII', title: 'Triangulation & Traverse', description: 'Methods for control surveys' },
  { number: 'Reg 99', part: 'VIII', title: 'Deed Plan Requirements', description: 'Specifications for deed plans' },
  { number: 'Reg 100-108', part: 'VIII', title: 'Plan Drawing Standards', description: 'Drawing specifications for plans' },
]

// Measurement Units per Survey Regulations 1994
export const MEASUREMENT_UNITS = {
  linear: 'metres',
  angular: 'degrees-minutes-seconds (DMS)',
  area: 'square metres and hectares',
  height: 'metres above mean sea level',
}

// Permit Errors in Measurement (Reg 27)
export const PERMITTED_ERRORS: Record<string, string> = {
  baseline: '1:25000',
  angles: '10 seconds',
  chaining: '1:3000',
  tacheometry: '1:1000',
  leveling: '10√K mm',
}

export function getAccuracyForOrder(order: string): AccuracyStandard | undefined {
  return TRAVERSE_ACCURACY_STANDARDS.find((s: any) => s.name.includes(order)) || 
         LEVELING_ACCURACY_STANDARDS.find((s: any) => s.name.includes(order))
}

export function getLevellingAllowable(distanceKm: number, order: string): number {
  const standard = LEVELING_ACCURACY_STANDARDS.find((s: any) => s.name.includes(order))
  if (!standard) return 20 * Math.sqrt(distanceKm)
  
  const sqrtK = parseFloat(standard.levelingAllowable.replace('√K', ''))
  return sqrtK * Math.sqrt(distanceKm)
}
