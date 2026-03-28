import { EasementGuidance, EasementType } from '@/types/landLaw'

export const EASEMENT_GUIDANCE: EasementGuidance[] = [
  {
    id: 'eas-001',
    easementType: 'RIGHT_OF_WAY',
    title: 'Right of Way Easements',
    description: 'A right of way is the most common easement, granting passage across another persons land. It may be for vehicles, pedestrians, or both.',
    creationMethods: [
      'Express grant in title deed',
      'Express grant by separate deed',
      'Prescription (20 years continuous use)',
      'Necessity (implied by law)',
      'Agreement between parties'
    ],
    terminationMethods: [
      'Agreement between parties',
      'Express release',
      'Merger (same owner of both parcels)',
      'Non-use for 20 years (prescriptive)',
      'Destruction of dominant tenement',
      'Court order'
    ],
    typicalDisputes: [
      'Width of right of way',
      'Location/route disputes',
      'Obstruction complaints',
      'Maintenance responsibilities',
      'Compensation for improvements'
    ],
    surveyorTasks: [
      'Survey and demarcate the right of way',
      'Prepare easement plan',
      'Verify dominant/servient tenement',
      'Coordinate with land registry',
      'Advise on width calculations'
    ],
    legalRequirements: [
      'Must have dominant tenement (benefited land)',
      'Must have servient tenement (burdened land)',
      'Grant must be registered',
      'Width defined in grant (or reasonable)',
      'Purpose must be specified'
    ],
    kenyaSpecific: 'Right of way easements in Kenya typically require registration under the Registered Land Act. Widths are usually 3m for pedestrian and 6m for vehicle access, unless otherwise specified in the grant.'
  },
  {
    id: 'eas-002',
    easementType: 'WATER_PIPE',
    title: 'Water Pipe Line Easements',
    description: 'Easements for water supply pipelines, including domestic connections, irrigation, and drainage pipes crossing neighbouring land.',
    creationMethods: [
      'Express grant by water authority',
      'Express grant by private agreement',
      'Necessity (for essential water supply)',
      'Prescription (20 years use)',
      'Statutory powers (Water Act 2016)'
    ],
    terminationMethods: [
      'Express release',
      'Abandonment (no use for 20 years)',
      'Merger of properties',
      'Court order',
      'Agreement'
    ],
    typicalDisputes: [
      'Pipe depth and location',
      'Access for maintenance',
      'Damage to pipes',
      'Obstruction claims',
      'Shared costs'
    ],
    surveyorTasks: [
      'Survey pipeline route',
      'Demarcate easement corridor',
      'Prepare utility easement plan',
      'Coordinate with water authority',
      'Document pipe specifications'
    ],
    legalRequirements: [
      'Easement width typically 3m (1.5m each side)',
      'Must not interfere with buildings',
      'Registration required',
      'May require approval from Water Resources Authority'
    ],
    kenyaSpecific: 'Under the Water Act 2016, water service providers have statutory powers to lay pipelines across private land with compensation. The easement width is typically 3 meters total.'
  },
  {
    id: 'eas-003',
    easementType: 'DRAINAGE',
    title: 'Drainage Easements',
    description: 'Rights to drain water through or across neighbouring land, including surface water drainage, stormwater, and sewerage.',
    creationMethods: [
      'Express grant',
      'Prescription (natural flow over 20 years)',
      'Necessity (for land to be usable)',
      'Statutory (Public Health Act)',
      'Court order'
    ],
    terminationMethods: [
      'Express release',
      'Merger',
      'Impossibility (no longer needed)',
      'Court order',
      'Agreement'
    ],
    typicalDisputes: [
      'Drainage volume increase',
      'Pollution/contamination',
      'Obstruction of natural flow',
      'Maintenance responsibilities',
      'Damage to land'
    ],
    surveyorTasks: [
      'Survey drainage path',
      'Map watershed and flow direction',
      'Document natural watercourse',
      'Prepare drainage easement plan',
      'Coordinate with relevant authorities'
    ],
    legalRequirements: [
      'Natural drainage rights arepreserved',
      'Cannot substantially alter flow',
      'May require NEMA approval',
      'Registration required for private easements'
    ],
    kenyaSpecific: 'Under the Public Health Act Cap 242, local authorities can require drainage easements for public health purposes. Natural watercourses cannot be blocked without approval from the Water Resources Authority.'
  },
  {
    id: 'eas-004',
    easementType: 'SUPPORT',
    title: 'Right of Support',
    description: 'The right of a building or land to have support from neighbouring land or structures. This is a natural easement that exists by law.',
    creationMethods: [
      'Natural easement (by law)',
      'Express grant',
      'Prescription (for buildings 20+ years)',
      'Implied grant (when building exists)'
    ],
    terminationMethods: [
      'Removal of building',
      'Merger',
      'Express release',
      'Court order'
    ],
    typicalDisputes: [
      'Excavation damage',
      'Underpinning requirements',
      'Structural support alterations',
      'Shallow foundations',
      'Compensation claims'
    ],
    surveyorTasks: [
      'Document existing structures',
      'Survey foundation depths',
      'Assess support requirements',
      'Coordinate with structural engineer',
      'Prepare support easement documentation'
    ],
    legalRequirements: [
      'Automatic right for existing buildings',
      'Cannot excavate within 45 degrees of neighbour',
      'Must give notice of excavation',
      'May need structural engineers report'
    ],
    kenyaSpecific: 'The right of support is recognized under common law in Kenya. Excavation within 9 meters of a neighbours structure without underpinning may be contested.'
  },
  {
    id: 'eas-005',
    easementType: 'LIGHT',
    title: 'Right of Light',
    description: 'The right to receive natural light through a defined aperture (window) to a building. Not commonly used in Kenya.',
    creationMethods: [
      'Express grant',
      'Prescription (20 years through defined aperture)',
      'Implied grant'
    ],
    terminationMethods: [
      'Express release',
      'Blocking of window',
      'Merger',
      'Agreement'
    ],
    typicalDisputes: [
      'New construction blocking light',
      'Extent of light required',
      'Window dimensions',
      'Compensation for loss'
    ],
    surveyorTasks: [
      'Survey light angles',
      'Document affected windows',
      'Calculate light reduction',
      'Prepare expert report',
      'Testify in court if needed'
    ],
    legalRequirements: [
      'Must be through defined aperture',
      'Minimum light standard',
      'Registration of easement',
      '45-degree rule applies'
    ],
    kenyaSpecific: 'Right of light is not commonly enforced in Kenya due to rapid urban development. Most disputes are resolved through planning regulations rather than easement law.'
  },
  {
    id: 'eas-006',
    easementType: 'AIR',
    title: 'Right of Air',
    description: 'The right to ensure air flow to a building is not unreasonably obstructed. Similar to right of light but less commonly enforced.',
    creationMethods: [
      'Express grant',
      'Prescription',
      'Implied grant'
    ],
    terminationMethods: [
      'Express release',
      'Merger',
      'Agreement',
      'Building removal'
    ],
    typicalDisputes: [
      'New construction blocking airflow',
      'Ventilation requirements',
      'Air quality impacts'
    ],
    surveyorTasks: [
      'Document airflow patterns',
      'Survey surrounding structures',
      'Prepare expert report'
    ],
    legalRequirements: [
      'Very limited in practice',
      'Would require express grant',
      'Registration'
    ],
    kenyaSpecific: 'Right of air is rarely enforced in Kenya. Building regulations and planning controls are the primary mechanisms for ensuring ventilation.'
  },
  {
    id: 'eas-007',
    easementType: 'TEMPORARY',
    title: 'Temporary Easements',
    description: 'Easements granted for a limited period, such as during construction or for temporary access.',
    creationMethods: [
      'Express grant (with term)',
      'License agreement',
      'Contract'
    ],
    terminationMethods: [
      'Expiration of term',
      'Purpose fulfilled',
      'Early termination by agreement',
      'Court order'
    ],
    typicalDisputes: [
      'Extension requests',
      'Damage during temporary use',
      'Restoration obligations',
      'Access timing'
    ],
    surveyorTasks: [
      'Survey temporary route',
      'Document pre-existing conditions',
      'Prepare restoration requirements',
      'Schedule of conditions'
    ],
    legalRequirements: [
      'Must have defined term',
      'Registration optional for short terms',
      'Restoration conditions',
      'Insurance requirements'
    ],
    kenyaSpecific: 'Temporary easements are useful for construction access in Kenya. They should clearly specify restoration obligations and timing.'
  },
  {
    id: 'eas-008',
    easementType: 'NECESSARY',
    title: 'Necessary Easements',
    description: 'Easements that arise by necessity when land would otherwise be unusable. These are implied easements.',
    creationMethods: [
      'Necessity (by law)',
      'Implication from circumstances',
      'Court declaration'
    ],
    terminationMethods: [
      'Necessity no longer exists',
      'Merger',
      'Alternative access created',
      'Court order'
    ],
    typicalDisputes: [
      'Whether necessity exists',
      'Scope of necessity',
      'Alternative access availability',
      'Compensation'
    ],
    surveyorTasks: [
      'Assess land usability',
      'Identify alternative options',
      'Survey minimum required access',
      'Document necessity'
    ],
    legalRequirements: [
      'Must be absolutely necessary',
      'No alternative access possible',
      'Only minimum necessary granted',
      'Registration required'
    ],
    kenyaSpecific: 'Necessary easements are recognized under Kenyan law. Courts will only grant the minimum necessary to make land usable.'
  },
  {
    id: 'eas-009',
    easementType: 'PRESCRIBED',
    title: 'Prescriptive Easements',
    description: 'Easements acquired through long-term continuous use (20 years) without the owners permission.',
    creationMethods: [
      '20 years continuous use',
      'Open and notorious use',
      'Hostile use (without permission)'
    ],
    terminationMethods: [
      'Non-use for 20 years',
      'Agreement',
      'Merger',
      'Court order'
    ],
    typicalDisputes: [
      'Continuity of use',
      'Permission vs hostility',
      'Openness of use',
      'Knowledge of owner'
    ],
    surveyorTasks: [
      'Document historical use',
      'Gather evidence of 20-year period',
      'Survey current use',
      'Prepare prescription evidence'
    ],
    legalRequirements: [
      '20 years continuous use',
      'Must be open and notorious',
      'Must be without permission',
      'Must be exclusive'
    ],
    kenyaSpecific: 'Prescriptive easements follow English common law principles as applied in Kenya. The 20-year period runs from independence (1963) for some cases.'
  },
  {
    id: 'eas-010',
    easementType: 'IMPLIED',
    title: 'Implied Easements',
    description: 'Easements created by implication from the circumstances, such as when land is divided and easements were previously used.',
    creationMethods: [
      'Implication from existing use',
      'Intention of parties',
      'Technical necessity',
      'Courts declaration'
    ],
    terminationMethods: [
      'Merger',
      'Agreement',
      'Impossibility',
      'Court order'
    ],
    typicalDisputes: [
      'Whether implied easement exists',
      'Scope of implied easement',
      'Intention at time of transfer',
      'Reasonable necessity'
    ],
    surveyorTasks: [
      'Trace historical use',
      'Document pre-existing arrangements',
      'Survey intended route',
      'Advise on registration'
    ],
    legalRequirements: [
      'Must have been used at time of division',
      'Reasonable necessity',
      'Apparent use',
      'Registration recommended'
    ],
    kenyaSpecific: 'Implied easements are commonly created when government allots plots from larger parcels. Surveyors should document any existing easements.'
  }
]

export function getEasementByType(type: EasementType): EasementGuidance | undefined {
  return EASEMENT_GUIDANCE.find(e => e.easementType === type)
}

export function getAllEasementTypes(): { type: EasementType; title: string }[] {
  return EASEMENT_GUIDANCE.map(e => ({
    type: e.easementType,
    title: e.title
  }))
}

export function searchEasements(query: string): EasementGuidance[] {
  const lowerQuery = query.toLowerCase()
  return EASEMENT_GUIDANCE.filter(
    e =>
      e.title.toLowerCase().includes(lowerQuery) ||
      e.description.toLowerCase().includes(lowerQuery) ||
      e.easementType.toLowerCase().includes(lowerQuery) ||
      e.typicalDisputes.some(d => d.toLowerCase().includes(lowerQuery))
  )
}
