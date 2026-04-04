/**
 * Land Law Intelligence System
 * Phase 11 - Legal boundary guidance for surveyors
 * Based on Brown's Boundary Control and Legal Principles
 */

export interface BoundaryEvidence {
  type: string
  description: string
  priority: number
}

export interface LegalGuidance {
  scenario: string
  principles: string[]
  recommendations: string[]
  references: { book: string; chapter: string }[]
  severity: 'info' | 'warning' | 'critical'
}

export const EVIDENCE_HIERARCHY: BoundaryEvidence[] = [
  { type: 'monument', description: 'Physical monuments and markers', priority: 1 },
  { type: 'corner', description: 'Original corner markers', priority: 1 },
  { type: 'lines', description: 'Boundary lines shown on recorded surveys', priority: 2 },
  { type: 'possessory', description: 'Possessory boundary markers', priority: 3 },
  { type: 'title', description: 'Title deed descriptions', priority: 4 },
  { type: 'adjoining', description: 'Adjoining property surveys', priority: 5 },
  { type: 'coordinates', description: 'Coordinate-based boundaries', priority: 6 }
]

export function getGuidanceForMissingMonument(): LegalGuidance {
  return {
    scenario: 'Missing Boundary Monument',
    principles: [
      'Original monuments take precedence over calculated coordinates',
      'Monument-based evidence supersedes all other forms',
      'Senior rights control over junior rights'
    ],
    recommendations: [
      'Search for physical monument remnants at reported location',
      'Review adjacent parcel surveys for corner evidence',
      'Check for replaced or disturbed monuments',
      'If monument unrecoverable, apply proportionate measurement method',
      'Document all search efforts in survey notes'
    ],
    references: [
      { book: "Brown's Boundary Control and Legal Principles", chapter: 'Monument Priority' },
      { book: 'Evidence and Procedures for Boundary Location', chapter: 'Retracement' }
    ],
    severity: 'warning'
  }
}

export function getGuidanceForBoundaryOverlap(): LegalGuidance {
  return {
    scenario: 'Parcel Boundary Overlap',
    principles: [
      'Senior title holder has priority over junior',
      'Original survey controls over subsequent surveys',
      'Records take precedence over field measurements'
    ],
    recommendations: [
      'Verify original survey records for both parcels',
      'Compare coordinate systems used in each survey',
      'Check for possible coordinate transformation errors',
      'Review title deed descriptions for both parcels',
      'Consult with both property owners',
      'Consider application to land registry for correction'
    ],
    references: [
      { book: "Brown's Boundary Control and Legal Principles", chapter: 'Title Conflicts' },
      { book: 'Boundary Control and Legal Principles', chapter: 'Dispute Resolution' }
    ],
    severity: 'critical'
  }
}

export function getGuidanceForAreaDiscrepancy(registryArea: number, surveyArea: number): LegalGuidance {
  const percentageDiff = Math.abs(registryArea - surveyArea) / registryArea * 100
  const severity: 'info' | 'warning' | 'critical' = percentageDiff > 10 ? 'critical' : percentageDiff > 5 ? 'warning' : 'info'
  
  return {
    scenario: `Area Discrepancy (${percentageDiff.toFixed(1)}%)`,
    principles: [
      'Area in title deed is secondary to boundary location',
      'Original monuments define the true boundary',
      'Area calculations are derived from boundaries, not vice versa'
    ],
    recommendations: [
      'Verify both measurements use same unit system',
      'Check coordinate transformation between datums',
      'Review original survey methodology',
      'Consider historical survey methods may differ from modern',
      'If discrepancy significant, investigate subdivision history',
      'Area alone does not define boundary location'
    ],
    references: [
      { book: "Brown's Boundary Control and Legal Principles", chapter: 'Area vs. Boundary' },
      { book: 'Engineering Surveying', chapter: 'Boundary Computation' }
    ],
    severity
  }
}

export function getGuidanceForEncroachment(): LegalGuidance {
  return {
    scenario: 'Encroachment Detected',
    principles: [
      'Boundary location determined by original survey',
      'Encroachment does not confer rights unless adverse possession established',
      'Good faith improvement may create equity'
    ],
    recommendations: [
      'Document encroachment with photographs and measurements',
      'Verify original boundary location from records',
      'Notify affected property owner immediately',
      'Consider boundary agreement or easement',
      'Consult legal counsel for formal resolution',
      'Do not remove encroaching structure without due process'
    ],
    references: [
      { book: "Brown's Boundary Control and Legal Principles", chapter: 'Encroachments' },
      { book: 'Evidence and Procedures for Boundary Location', chapter: 'Disputes' }
    ],
    severity: 'warning'
  }
}

export function getGuidanceForCoordinateMismatch(): LegalGuidance {
  return {
    scenario: 'Coordinate System Mismatch',
    principles: [
      'Coordinates are derived from physical monuments',
      'Coordinate transformation may introduce errors',
      'Original monuments take precedence over coordinates'
    ],
    recommendations: [
      'Identify coordinate system used in each dataset',
      'Verify transformation parameters are correct',
      'Check for datum differences (WGS84 vs local)',
      'Compare transformed coordinates with monuments',
      'Use only validated control points for transformation',
      'Document transformation methodology in survey report'
    ],
    references: [
      { book: "Brown's Boundary Control and Legal Principles", chapter: 'Coordinate Boundaries' },
      { book: 'GPS Satellite Surveying', chapter: 'Coordinate Transformations' }
    ],
    severity: 'info'
  }
}

export function getGuidanceForSubdivision(): LegalGuidance {
  return {
    scenario: 'Subdivision Compliance',
    principles: [
      'Subdivision boundaries must follow original parcel boundaries',
      'Each subdivided parcel must have independent boundary definition',
      'Parent parcel boundary takes precedence for new boundaries'
    ],
    recommendations: [
      'Verify parent parcel boundary from original survey',
      'Ensure all new corners are properly monumented',
      'Check subdivision approval from relevant authority',
      'Register new parcels with land registry',
      'Obtain clearance from adjoining owners if required',
      'Update control network for subdivided area'
    ],
    references: [
      { book: "Brown's Boundary Control and Legal Principles", chapter: 'Subdivisions' },
      { book: 'Boundary Control and Legal Principles', chapter: 'Parcel Creation' }
    ],
    severity: 'info'
  }
}

export function analyzeBoundarySituation(
  situation: 'missing_monument' | 'overlap' | 'area_discrepancy' | 'encroachment' | 'coordinate_mismatch' | 'subdivision',
  params?: { registryArea?: number; surveyArea?: number }
): LegalGuidance {
  switch (situation) {
    case 'missing_monument':
      return getGuidanceForMissingMonument()
    case 'overlap':
      return getGuidanceForBoundaryOverlap()
    case 'area_discrepancy':
      return getGuidanceForAreaDiscrepancy(params?.registryArea || 0, params?.surveyArea || 0)
    case 'encroachment':
      return getGuidanceForEncroachment()
    case 'coordinate_mismatch':
      return getGuidanceForCoordinateMismatch()
    case 'subdivision':
      return getGuidanceForSubdivision()
    default:
      return {
        scenario: 'Unknown Situation',
        principles: [],
        recommendations: ['Consult with senior surveyor', 'Review relevant documentation'],
        references: [
          { book: "Brown's Boundary Control and Legal Principles", chapter: 'Introduction' }
        ],
        severity: 'info'
      }
  }
}

export function getEvidencePriority(type: string): number {
  const evidence = EVIDENCE_HIERARCHY.find((e: any) => e.type === type)
  return evidence?.priority || 99
}

export function getMonumentPrecedenceRules(): string[] {
  return [
    'Original monuments control over replacements',
    'Natural monuments control over artificial',
    'Senior rights control in case of conflict',
    'Recorded monuments control over unrecorded',
    'Monumentation controls over coordinates',
    'Physical evidence controls over documentary'
  ]
}
