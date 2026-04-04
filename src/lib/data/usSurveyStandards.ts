// US Survey Standards Reference Data
// Based on: US Fish & Wildlife Service Land Survey Handbook (May 2015)
// BLM Manual of Surveying Instructions

export interface USLandStatus {
  type: string
  description: string
}

export interface LegalDescriptionType {
  name: string
  description: string
  use: string
}

export interface SurveyStep {
  step: string
  description: string
}

export interface MonumentType {
  name: string
  description: string
}

// Land Status Types
export const LAND_STATUS_TYPES: USLandStatus[] = [
  { type: 'Fee Simple', description: 'Complete ownership of land and minerals' },
  { type: 'Easement', description: 'Right to use land for specific purpose' },
  { type: 'Permit', description: 'Permission to use land for specific activities' },
  { type: 'Right-of-Way', description: 'Access corridor across property' },
  { type: 'Lease', description: 'Temporary possession for defined period' },
]

// Types of Legal Descriptions
export const LEGAL_DESCRIPTION_TYPES: LegalDescriptionType[] = [
  { 
    name: 'Metes-and-Bounds', 
    description: 'Series of lines around perimeter with bearings and distances',
    use: 'Irregular shaped parcels, narrative descriptions'
  },
  { 
    name: 'Adjoiners', 
    description: 'Boundary references only to adjoining owners deeds',
    use: 'Along existing boundaries with metes-and-bounds'
  },
  { 
    name: 'Government Lot', 
    description: 'Lot within a township and range section',
    use: 'Public land system parcels'
  },
  { 
    name: 'Fractional Section', 
    description: 'Portion of section described by aliquot parts',
    use: 'Public land system with natural boundaries'
  },
  { 
    name: 'Strip Description', 
    description: 'Linear parcel with width and centerline',
    use: 'Rights-of-way, easements, corridors'
  },
]

// Cadastral Survey Steps
export const CADASTRAL_SURVEY_STEPS: SurveyStep[] = [
  { step: 'A', description: 'Determine if Survey is Needed' },
  { step: 'B', description: 'Request for Survey' },
  { step: 'C', description: 'Request Received - Review and Estimate' },
  { step: 'D', description: 'Project Instructions (Scope of Work)' },
  { step: 'E', description: 'Assignment Instructions' },
  { step: 'F', description: 'Additional Research' },
  { step: 'G', description: 'Control Survey' },
  { step: 'H', description: 'Field Survey' },
  { step: 'I', description: 'Monumentation' },
  { step: 'J', description: 'Prepare Survey Returns' },
  { step: 'K', description: 'Survey Review and Plat Signing' },
  { step: 'L', description: 'Filing' },
]

// Monument Types
export const MONUMENT_TYPES: MonumentType[] = [
  { name: 'Regulation Post', description: 'Standard federal monument per Service Manual' },
  { name: 'Plastic-Encased Magnet', description: 'Memorial marker at base of each monument' },
  { name: 'Reference Monument', description: 'Additional monument set for future recovery' },
  { name: 'Witness Point', description: 'Point referenced from inaccessible corner' },
  { name: 'Witness Corner', description: 'Corner monument offset from original position' },
  { name: 'Accepted Local Corner', description: 'Existing monument accepted as controlling' },
]

// Encumbrance Types
export const ENCUMBRANCE_TYPES = {
  titleExceptions: [
    'Rights of parties in possession',
    'Easements revealed by survey',
    'Recorded instruments (easements, mortgages)',
    'Public roads and rights-of-way',
    'Tax liens',
    'Riparian claims (water boundaries)',
  ],
  generalExceptions: [
    'Standard exceptions applying to all properties',
    'Rights discoverable by physical inspection',
    'Future recorded instruments',
  ],
  specialExceptions: [
    'Specific to tract under review',
    'Lien of taxes',
    'Recorded agreements',
    'Erosion, accretion, avulsion effects',
    'State navigability claims',
    'Public trust easement',
  ],
}

// Survey Standards
export const US_SURVEY_STANDARDS = {
  control: {
    method: 'GPS (Global Positioning System)',
    accuracy: 'Survey grade receivers',
    datum: 'National Geodetic Reference System (NGRS)',
  },
  fieldNotes: {
    requirements: [
      'All measurements recorded on paper or digitally',
      'Digital data collector files must be submitted',
      'No erasures - rule out errors',
      'Original notes only - no copies',
      'Three digital photos per controlling corner',
      'Photos: close-up, eye-level, horizontal view',
    ],
  },
  monumentation: {
    requirements: [
      'All corners monumented per Service Manual',
      'Plastic-encased magnet at base',
      'Remonument accepted local corners if substantial',
      'Reference monuments where required',
      'Witness points for inaccessible corners',
    ],
  },
}

// Title Standards (DOJ 2001)
export const DOJ_TITLE_STANDARDS = {
  requiredForAcquisition: [
    'Improvements to land are contemplated',
    'Acquisition involves part of larger property',
    'New boundaries being created',
  ],
  requiredBeforeAcquisition: [
    'Current legal description unacceptable',
    'Occupational conflict on/near boundary',
    'Area determination needed',
    'Borders non-Service land without active project',
    'State/local law requirement',
  ],
}

// Tract Numbering (Roman Numerals)
export const TRACT_NUMBERING = {
  purpose: 'Alphanumeric symbols for Service land ownership database',
  romanNumerals: 'Used for segregated portions or unique title situations',
  example: 'Tract (10) bisected by road → Tract (10) and Tract (10-I)',
  usage: 'Only land surveyors can create Roman numeral tracts',
}

export function getLandStatusDescription(type: string): string {
  const status = LAND_STATUS_TYPES.find((s: any) => s.type === type)
  return status?.description || ''
}

export function getLegalDescriptionInfo(name: string): LegalDescriptionType | undefined {
  return LEGAL_DESCRIPTION_TYPES.find((t: any) => t.name.toLowerCase().includes(name.toLowerCase()))
}
