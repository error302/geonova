/**
 * Survey Field Day Planner
 * Stores survey missions in localStorage — all user data, no placeholders.
 *
 * Country types are defined locally here to match the SurveyingCountry type
 * from the shared country registry (@/lib/country). The country registry
 * provides authoritative standards data; fieldplan uses it for precision rules.
 */

export type Country = 'kenya' | 'uganda' | 'tanzania' | 'nigeria' | 'ghana' | 'south_africa' | 'bahrain' | 'new_zealand' | 'other'

export type SurveyType = 'traverse' | 'leveling' | 'boundary' | 'topographic' | 'engineering' | 'mining' | 'hydrographic' | 'gnss_baseline' | 'stakeout' | 'tacheometric'

export type MissionStatus = 'planned' | 'ready' | 'in_progress' | 'completed' | 'postponed'

export interface ControlPoint {
  name: string
  beaconNo: string
  location: string
  confirmed: boolean
}

export interface Equipment {
  item: string
  quantity: number
  checked: boolean
}

export interface ChecklistItem {
  item: string
  done: boolean
}

export interface FieldMission {
  id: string
  projectName: string
  client: string
  surveyType: SurveyType
  country: Country
  location: string
  fieldDate: string
  reportDeadline: string
  surveyorName: string
  licenseNumber: string
  teamSize: number
  status: MissionStatus
  utmZone: string
  datum: string
  requiredPrecision: string
  closureLimit: string
  controlPoints: ControlPoint[]
  equipment: Equipment[]
  preChecklist: ChecklistItem[]
  objectives: string
  hazards: string
  accessNotes: string
  createdAt: string
  updatedAt: string
}

const KEY = 'metardu_field_missions'

function load(): FieldMission[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
function persist(items: FieldMission[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(items))
}

export function getMissions(): FieldMission[] {
  return load().sort((a: any, b: any) => a.fieldDate.localeCompare(b.fieldDate))
}

export function saveMission(m: Omit<FieldMission, 'id' | 'createdAt' | 'updatedAt'>): FieldMission {
  const items = load()
  const now = new Date().toISOString()
  const full: FieldMission = { ...m, id: `FM_${Date.now()}`, createdAt: now, updatedAt: now }
  persist([...items, full])
  return full
}

export function updateMission(id: string, updates: Partial<FieldMission>): boolean {
  const items = load()
  const idx = items.findIndex(m => m.id === id)
  if (idx === -1) return false
  items[idx] = { ...items[idx], ...updates, updatedAt: new Date().toISOString() }
  persist(items)
  return true
}

export function deleteMission(id: string) {
  persist(load().filter((m: any) => m.id !== id))
}

export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr)
  const today = new Date(); today.setHours(0,0,0,0)
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}

export interface Standard {
  minPrecision: string
  closureLimit: string
  minControlPoints: number
  notes: string
  requiredDocs: string[]
}

const STD = (p: string, c: string, n: number, notes: string, docs: string[]): Standard =>
  ({ minPrecision: p, closureLimit: c, minControlPoints: n, notes, requiredDocs: docs })

export const STANDARDS: Partial<Record<Country, Partial<Record<SurveyType, Standard>>>> = {
  kenya: {
    traverse:      STD('1:5000',   '1/(100√n) rad', 2, 'Survey of Kenya order III+. Retain field notes 5 years. Tie to national grid.', ['Survey plan','Field notes','Computation sheets','Surveyor certificate']),
    leveling:      STD('1:50000',  '12√K mm',       1, 'Vertical datum: MSL Mombasa. 3rd order: ±24mm/km. Close loop before leaving site.', ['Level book','Misclosure computation','Reduced level table']),
    boundary:      STD('1:7500',   '5mm+50ppm',     2, '3rd party verification required for parcels >5ha. File with Land Registry within 30 days.', ['Survey plan','Registry index map','Parcel area certificate','Title deed']),
    topographic:   STD('1:2000',   '15cm horiz.',   3, 'Contour interval ≥1m. All features to be captured. Coordinate grid on output.', ['Survey plan','Field sketches','Control report']),
    engineering:   STD('1:10000',  '10mm+20ppm',    3, 'Road/building setout must be certified by licensed surveyor. As-built required within 6 months.', ['Setting out data','As-built plan','Engineer certificate']),
    mining:        STD('1:5000',   '5cm',            2, 'Mine surveyor licence required. Monthly progress plans to mine manager.', ['Mine plan','Section plan','Volume computation']),
    hydrographic:  STD('1:2000',   '0.5m depth',    2, 'Chart datum: LAT. Sounding lines ≤20m spacing. Tidal corrections mandatory.', ['Hydrographic chart','Sounding record','Tide gauge readings']),
    gnss_baseline: STD('1:100000', '10mm+1ppm',     1, 'Min 1hr observation. PDOP<3. Static mode only for control surveys.', ['GNSS report','Baseline data','Network adjustment']),
    stakeout:      STD('1:5000',   '20mm',           2, 'Check measurements against computed values before leaving site. Peg witness required.', ['Setting out sheet','Check measurements']),
    tacheometric:  STD('1:1000',   '30cm horiz.',   2, 'K=100 C=0. Vertical angles required for elevation. Stadia modern total station preferred.', ['Tacheometric sheets','Computed plan']),
  },
  uganda: {
    traverse:      STD('1:5000',   '1:10000',       2, 'UNBS standards. Datum: Arc 1960. Tie to national grid at start and end.', ['Survey plan','Field notes','Computation']),
    leveling:      STD('1:25000',  '15√K mm',       1, 'Datum: MSL Mombasa (shared with Kenya). 4th order: ±30mm/km.', ['Level book','Misclosure table']),
    boundary:      STD('1:5000',   '5mm+40ppm',     2, 'Ministry of Lands approval. File with district land board within 60 days.', ['Survey plan','Area computation','Surveyor report']),
    topographic:   STD('1:2000',   '20cm',           2, 'UTM Zone 36N/S. National Topographic Survey standards.', ['Survey plan','Field notes']),
    engineering:   STD('1:10000',  '15mm+25ppm',    2, 'Engineers and Related Bodies Act compliance required.', ['Setting out data','Certificate']),
    gnss_baseline: STD('1:50000',  '15mm+2ppm',     1, 'Tie to CORS network where available. 45min minimum session.', ['GNSS report','Adjustment']),
    stakeout:      STD('1:2000',   '30mm',           2, 'Independent check required by second surveyor on urban plots.', ['Setting out sheet']),
    mining:        STD('1:2000',   '10cm',           2, 'Directorate of Geological Survey oversight.', ['Mine plan','Section plan']),
    hydrographic:  STD('1:5000',   '1m depth',      2, 'Lake Victoria: datum ordinary water level.', ['Chart','Sounding record']),
    tacheometric:  STD('1:1000',   '50cm',           2, 'Digital levels preferred where available.', ['Field sheets','Plan']),
  },
  tanzania: {
    traverse:      STD('1:5000',   '1:7500',        2, 'COSTECH standards. WGS84 / UTM Zone 36-37S. Datum: Arc 1960.', ['Survey plan','Field notes','Certificate']),
    leveling:      STD('1:25000',  '12√K mm',       1, 'Datum: MSL Dar es Salaam. Close within ±20mm/km for 3rd order.', ['Level book','Misclosure']),
    boundary:      STD('1:5000',   '50ppm',          2, 'Ministry of Lands Housing and Human Settlements approval required.', ['Survey plan','Plot area certificate']),
    topographic:   STD('1:2000',   '20cm',           2, 'COSTECH approved. Contour interval specified by client.', ['Plan','Field notes']),
    engineering:   STD('1:10000',  '10mm+20ppm',    2, 'TANROADS/TANESCO approval for infrastructure.', ['Setting out data','As-built']),
    gnss_baseline: STD('1:100000', '10mm+1ppm',     1, 'Tie to TANSANET CORS network where available.', ['GNSS report']),
    stakeout:      STD('1:5000',   '25mm',           2, 'Two-person check on urban plots.', ['Setting out sheet']),
    mining:        STD('1:2000',   '10cm',           2, 'Ministry of Minerals oversight. Monthly submission.', ['Mine plan','Section plan','Volume']),
    hydrographic:  STD('1:2000',   '0.5m',          2, 'Tanzania Ports Authority. Indian Ocean MSL datum.', ['Chart','Soundings']),
    tacheometric:  STD('1:1000',   '40cm',           2, 'Standard stadia method.', ['Field sheets']),
  },
  nigeria: {
    traverse:      STD('1:3000',   '1/(50√n)',      2, 'OSGOF standards. Minna Datum / UTM Zone 31-33N.', ['Field notes','Computation','Survey plan']),
    leveling:      STD('1:20000',  '15√K mm',       1, 'Datum: MSL Lagos. 3rd order: ±25mm/km.', ['Level book','Misclosure']),
    boundary:      STD('1:5000',   '40ppm',          2, 'State land authority approval. Stamped plan required.', ['Survey plan','Area certificate','Title document']),
    topographic:   STD('1:1000',   '30cm',           3, 'OSGOF standards. Minna datum coordinates.', ['Plan','Field notes']),
    engineering:   STD('1:5000',   '20mm+30ppm',    2, 'COREN registered engineer. FMW standards.', ['Setting out','Certificate','As-built']),
    gnss_baseline: STD('1:50000',  '20mm+2ppm',     1, 'Tie to NigNet CORS if available.', ['GNSS report']),
    stakeout:      STD('1:2000',   '40mm',           2, 'Check peg positions independently.', ['Setting out sheet']),
    mining:        STD('1:2000',   '15cm',           2, 'Ministry of Mines and Steel Development.', ['Mine plan','Volume computation']),
    hydrographic:  STD('1:2000',   '1m depth',      2, 'NIMASA standards. Chart datum: LAT.', ['Chart','Soundings','Tide record']),
    tacheometric:  STD('1:1000',   '50cm',           2, 'Traverse-tacheometry combined method.', ['Field sheets']),
  },
  ghana: {
    traverse:      STD('1:5000',   '1:7500',        2, 'Survey Department Ghana. Accra Datum / UTM Zone 30N.', ['Field notes','Survey plan']),
    leveling:      STD('1:20000',  '12√K mm',       1, 'Datum: MSL Accra.', ['Level book']),
    boundary:      STD('1:5000',   '50ppm',          2, 'Lands Commission approval. File within 30 days.', ['Survey plan','Site plan']),
    topographic:   STD('1:2000',   '20cm',           2, 'Survey Department Ghana. WGS84/UTM.', ['Plan','Notes']),
    engineering:   STD('1:10000',  '15mm+25ppm',    2, 'Ghana Institution of Engineers standards.', ['Setting out','Certificate']),
    gnss_baseline: STD('1:50000',  '15mm+2ppm',     1, 'Tie to Ghana GNSS network.', ['GNSS report']),
    stakeout:      STD('1:5000',   '30mm',           2, 'Check all pegs before handover.', ['Setting out sheet']),
    mining:        STD('1:2000',   '10cm',           2, 'Minerals Commission oversight.', ['Mine plan']),
    hydrographic:  STD('1:5000',   '1m',             2, 'Ghana Ports and Harbours Authority.', ['Chart','Soundings']),
    tacheometric:  STD('1:1000',   '40cm',           2, 'Standard stadia.', ['Field sheets']),
  },
  new_zealand: {
    traverse:      STD('1:10000',  '10mm+20ppm',    2, 'LINZ Rule 8 — cadastral traverses must be reported.', ['Survey record','Computation','Surveyor report']),
    leveling:      STD('1:10000',  '12√K mm',       1, 'LINZ vertical control standards.', ['Level book','Adjustment']),
    boundary:      STD('1:10000',  '25ppm',          2, 'LINZ Rule 8 — all boundary decisions require documented reasons.', ['Survey record','Surveyor report','LDS Parcel Report']),
    topographic:   STD('1:2000',   '20cm',           3, 'LINZ topographic standards.', ['Plan','Metadata']),
    engineering:   STD('1:20000',  '5mm+10ppm',     3, 'LINZ engineering setout.', ['Setting out','As-built']),
    mining:        STD('1:5000',   '5cm',            3, 'NZ minerals — Department of Conservation / regional council.', ['Mine plan']),
    hydrographic:  STD('1:2000',   '0.3m',          2, 'LINZ hydrographic standards — chart datum.', ['Chart','Soundings']),
    gnss_baseline: STD('1:100000', '5mm+0.5ppm',    1, 'LINZ CORS (NZ CORS) — ≥1hr observation.', ['GNSS report']),
    stakeout:      STD('1:10000',  '20mm',           2, 'LINZ setout standards.', ['Setting out data']),
    tacheometric:  STD('1:2000',   '20cm',           2, 'LINZ tacheometric standards.', ['Field sheets']),
  },
  other: {
    traverse:      STD('1:5000',   '12√n mm',       2, 'Apply applicable national standard. Retain field notes 5 years minimum.', ['Survey plan','Field notes','Computation']),
    leveling:      STD('1:25000',  '12√K mm',       1, 'Standard 3rd-order leveling. Retain level book.', ['Level book','Misclosure table']),
    boundary:      STD('1:5000',   '50ppm',          2, 'File with appropriate land authority.', ['Survey plan','Area certificate']),
    topographic:   STD('1:2000',   '20cm',           2, 'All features to scale. Coordinate grid required.', ['Plan','Field notes']),
    engineering:   STD('1:10000',  '15mm+25ppm',    2, 'ISO 4463 setout tolerances. As-built required.', ['Setting out','As-built']),
    mining:        STD('1:2000',   '10cm',           2, 'Monthly progress plans required.', ['Mine plan','Volume']),
    hydrographic:  STD('1:2000',   '1m depth',      2, 'IHO S-44 standards. Sounding lines per scale.', ['Chart','Soundings']),
    gnss_baseline: STD('1:50000',  '15mm+2ppm',     1, 'Minimum 1hr observation. PDOP<4.', ['GNSS report']),
    stakeout:      STD('1:5000',   '25mm',           2, 'Check all positions independently.', ['Setting out sheet']),
    tacheometric:  STD('1:1000',   '40cm',           2, 'K=100 C=0 stadia constants.', ['Field sheets']),
  },
}

export function getStandard(country: Country, type: SurveyType): Standard {
  const s = STANDARDS[country as keyof typeof STANDARDS]?.[type]
  return s ?? STANDARDS['other']?.['traverse'] ?? { minPrecision: '1:5000', closureLimit: '12√K mm', minControlPoints: 2, notes: 'Apply applicable national standard.', requiredDocs: ['Survey plan', 'Field notes'] }
}

export const DEFAULT_EQUIPMENT: Record<SurveyType, string[]> = {
  traverse:      ['Total station','Tripod × 3','Prism × 2','Prism pole × 2','Tape (30m)','Field book','Pegs & nails','Hammer','Spray paint','Battery × 2','USB/memory card'],
  leveling:      ['Digital level','Tripod','Staff × 2','Staff bubble check','Field book','Pegs','Hammer','Battery','Rain cover'],
  boundary:      ['Total station','GNSS rover','Tripod × 3','Prism × 2','Boundary beacons','Cement (1 bag)','Spade','String line','Tape','Field book','Panga/clearing tool'],
  topographic:   ['Total station or GNSS','Tripod','Prism pole','Field book','Sketch paper','Pegs','Ranging rods','Tape measure'],
  engineering:   ['Total station','Tripod × 3','Prism × 2','Prism pole','Setting-out data printout','Nails/pegs','Paint/chalk','Tape','Spirit level','Field book'],
  mining:        ['Total station','Tripod × 3','Prism','Prism pole','Underground lamp','Safety helmet','Safety boots','Field book','Reflective vest','Gas detector'],
  hydrographic:  ['GNSS receiver','Echo sounder','Boat','Life jackets × all','Anchor + rope','Tide gauge','Field book','Waterproof bag','Two-way radio'],
  gnss_baseline: ['GNSS receiver × 2','Tripod × 2','Tribrach × 2','Antenna cable','Battery × 4','Laptop','USB drives × 2','Tape (antenna height)','Field book'],
  stakeout:      ['Total station','Tripod','Prism pole','Nails/pegs','Hammer','Paint','Setting-out data','Tape','Plumb bob','Field book'],
  tacheometric:  ['Total station','Tripod','Prism pole × 2','Leveling staff','Ranging rods','Field book','Battery × 2'],
}

export const PRE_CHECKLIST: Record<SurveyType, string[]> = {
  traverse:      ['Total station calibrated (two-peg test done today)','Batteries fully charged','Instrument date/time set to correct time','Previous traverse closure verified','Control point coordinates loaded to instrument','Field book dated and titled','Signed job instruction received','Client/site contact notified of start','Site access confirmed','PPE checked (boots, vest, hat)'],
  leveling:      ['Level instrument bubble adjusted and checked','Staff length verified (no loose sections)','Opening BM confirmed from previous survey record','Route plan drawn in field book','Weather forecast checked (rain ≠ accurate)','Field book prepared with station list','Closing BM coordinates noted'],
  boundary:      ['Title deed copy in field bag','Adjacent parcel plans obtained from registry','Beacon numbers confirmed with registry list','Access confirmed with landowner in writing','Witness present on day of survey','Cement and tools loaded in vehicle','Panga/clearing tools for beacons'],
  topographic:   ['Area sketch drawn and agreed with client','Feature list prepared (what to capture)','Control network established and verified','Contour interval agreed and noted','Field sketching materials ready','Scale of final plan agreed'],
  engineering:   ['Setting-out computations checked by 2nd person','CAD drawing verified against approved drawing','Check measurements pre-computed','Site engineer notified of start time','Temporary benchmarks established and noted','Independent check measurements planned','Building lines referenced to permanent structures'],
  mining:        ['Mine plan brought up to date','Safety briefing completed and signed','Lamp battery fully charged and tested','Gas detector calibrated and reading zero','Emergency contact and rescue plan noted','Mine manager notified of survey area','Roof conditions checked on route'],
  hydrographic:  ['Boat safety check completed (engine, bung, flares)','Life jackets fitted for all crew','Weather and sea/lake state checked','Echo sounder calibrated with bar check','Tide gauge reading noted at start of survey','Anchor and sufficient rope ready','Communication plan with shore established'],
  gnss_baseline: ['GNSS firmware up to date','Satellite visibility checked in planning software','Session length calculated for PDOP<3','Antenna offsets recorded for each receiver','Processing software ready on laptop','Backup power plan (spare batteries)','Occupation times staggered to avoid simultaneous data loss'],
  stakeout:      ['Setting-out computations checked independently by 2nd person','Total station set to project coordinates and orientation verified','Sufficient peg/nail material counted','Check measurements pre-computed from second control point','Client representative on site for handover','Photographic record plan agreed','Weather forecast checked (no setout in heavy rain)'],
  tacheometric:  ['Instrument stadia constant K verified (K=100)','Stadia lines clean and clearly visible','Vertical index error checked and within 30"','Field sheet format prepared with columns','Ranging rod heights marked at 0.5m intervals','Instrument height measured and noted in field book'],
}
