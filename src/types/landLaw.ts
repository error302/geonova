export type BoundaryIssueType = 
  | 'BOUNDARY_DETERMINATION'
  | 'MONUMENT_CONFLICT'
  | 'DEED_vs_OCCUPATION'
  | 'ACQUIESCENCE'
  | 'RIPARIAN_BOUNDARY'
  | 'ROAD_BOUNDARY'
  | 'SURVEY_ERROR'
  | 'REGISTRATION_EFFECT'
  | 'ADVERSE_POSSESSION'
  | 'EASEMENT'
  | 'COVENANT'
  | 'PARTITION'
  | 'MISTAKE'
  | 'TRESPASS'
  | 'OTHER'

export type DisputeType = 
  | 'BOUNDARY_DISPUTE'
  | 'TITLE_DISPUTE'
  | 'EASEMENT_DISPUTE'
  | 'TRESPASS'
  | 'COVENANT_BREACH'
  | 'PARTITION_SUIT'
  | 'JUDICIAL_REVIEW'
  | 'ADMINISTRATIVE_APPEAL'

export type DisputeStage = 
  | 'OUT_OF_COURT_NEGOTIATION'
  | 'MEDIATION'
  | 'ARBITRATION'
  | 'LAND_DISPUTES_TRIBUNAL'
  | 'MAGISTRATE_COURET'
  | 'HIGH_COURET'
  | 'COURT_OF_APPEAL'
  | 'SUPREME_COURET'
  | 'ADMINISTRATIVE_APPEAL'

export type EasementType = 
  | 'RIGHT_OF_WAY'
  | 'WATER_PIPE'
  | 'DRAINAGE'
  | 'SUPPORT'
  | 'LIGHT'
  | 'AIR'
  | 'TEMPORARY'
  | 'NECESSARY'
  | 'PRESCRIBED'
  | 'IMPLIED'

export type PlanCheckCategory = 
  | 'GEOMETRIC'
  | 'BOUNDARY'
  | 'REGULATORY'
  | 'MATHEMATICAL'
  | 'DOCUMENTATION'

export type PlanCheckSeverity = 'ERROR' | 'WARNING' | 'INFO'

export interface BoundaryLawEntry {
  id: string
  issueType: BoundaryIssueType
  title: string
  description: string
  legalFramework: string[]
  relevantActs: string[]
  caseLaw: string[]
  procedure: string
  typicalEvidence: string[]
  surveyorRole: string
  brownsPrinciple?: string
  commonPitfalls: string[]
}

export interface DisputeProcedure {
  id: string
  disputeType: DisputeType
  title: string
  description: string
  stages: DisputeStage[]
  jurisdiction: string
  timeframe: string
  estimatedCost: string
  requiredDocuments: string[]
  mediationSteps?: string[]
  courtProcedure?: string
  precedentCases: string[]
}

export interface AdversePossessionCase {
  id: string
  claimantId: string
  parcelId: string
  adverseType: 'HOSTILE' | 'OPEN' | 'NOTORIOUS' | 'EXCLUSIVE' | 'CONTINUOUS'
  startDate: string
  endDate?: string
  duration: number
  meetsAllRequirements: boolean
  evidence: AdversePossessionEvidence[]
  status: 'PENDING' | 'FILED' | 'GRANTED' | 'REJECTED'
  createdAt: string
}

export interface AdversePossessionEvidence {
  type: 'WITNESS' | 'DOCUMENTARY' | 'PHOTOGRAPHIC' | 'SURVEY' | 'OCCUPATION_RECORD' | 'RATE_PAYMENT' | 'IMPROVEMENT'
  description: string
  date: string
  strength: 'STRONG' | 'MODERATE' | 'WEAK'
}

export interface EasementGuidance {
  id: string
  easementType: EasementType
  title: string
  description: string
  creationMethods: string[]
  terminationMethods: string[]
  typicalDisputes: string[]
  surveyorTasks: string[]
  legalRequirements: string[]
  kenyaSpecific?: string
}

export interface PlanCheckResult {
  id: string
  category: PlanCheckCategory
  checkName: string
  description: string
  severity: PlanCheckSeverity
  passed: boolean
  details: string
  recommendation?: string
  regulation?: string
}

export interface PlanCheckReport {
  planId: string
  overallPass: boolean
  score: number
  checks: PlanCheckResult[]
  checkedAt: string
  warnings: number
  errors: number
  suggestions: string[]
}

export interface LandLawSearchResult {
  entries: BoundaryLawEntry[]
  total: number
  query: string
}

export const BOUNDARY_ISSUE_LABELS: Record<BoundaryIssueType, string> = {
  BOUNDARY_DETERMINATION: 'Boundary Determination',
  MONUMENT_CONFLICT: 'Monument Conflict',
  DEED_vs_OCCUPATION: 'Deed vs Occupation',
  ACQUIESCENCE: 'Acquiescence',
  RIPARIAN_BOUNDARY: 'Riparian Boundary',
  ROAD_BOUNDARY: 'Road Boundary',
  SURVEY_ERROR: 'Survey Error',
  REGISTRATION_EFFECT: 'Registration Effect',
  ADVERSE_POSSESSION: 'Adverse Possession',
  EASEMENT: 'Easement',
  COVENANT: 'Covenant',
  PARTITION: 'Partition',
  MISTAKE: 'Mistake',
  TRESPASS: 'Trespass',
  OTHER: 'Other'
}

export const DISPUTE_TYPE_LABELS: Record<DisputeType, string> = {
  BOUNDARY_DISPUTE: 'Boundary Dispute',
  TITLE_DISPUTE: 'Title Dispute',
  EASEMENT_DISPUTE: 'Easement Dispute',
  TRESPASS: 'Trespass',
  COVENANT_BREACH: 'Covenant Breach',
  PARTITION_SUIT: 'Partition Suit',
  JUDICIAL_REVIEW: 'Judicial Review',
  ADMINISTRATIVE_APPEAL: 'Administrative Appeal'
}

export const EASEMENT_TYPE_LABELS: Record<EasementType, string> = {
  RIGHT_OF_WAY: 'Right of Way',
  WATER_PIPE: 'Water Pipe Line',
  DRAINAGE: 'Drainage',
  SUPPORT: 'Right of Support',
  LIGHT: 'Right of Light',
  AIR: 'Right of Air',
  TEMPORARY: 'Temporary Easement',
  NECESSARY: 'Necessary Easement',
  PRESCRIBED: 'Prescriptive Easement',
  IMPLIED: 'Implied Easement'
}
