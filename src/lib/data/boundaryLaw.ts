import { BoundaryLawEntry, BoundaryIssueType } from '@/types/landLaw'

export const BOUNDARY_LAW_ENTRIES: BoundaryLawEntry[] = [
  {
    id: 'bl-001',
    issueType: 'BOUNDARY_DETERMINATION',
    title: 'Boundary Determination Principles',
    description: 'The general principles governing boundary determination in Kenya. Boundaries may be determined by: (a) registered title, (b) actual occupation, (c) acquiescence, (d) adverse possession, or (e) court judgment.',
    legalFramework: [
      'Registered Land Act Cap 300 Section 28',
      'Land Registration Act 2012 Section 24',
      'Survey Regulations 1994'
    ],
    relevantActs: [
      'Registered Land Act Cap 300',
      'Land Registration Act 2012',
      'Survey Act Cap 299',
      'Environment and Land Court Act 2011'
    ],
    caseLaw: [
      'Kenya Breweries Ltd v KAPI Ltd [1989] eKLR',
      'Njenga v Kimani [2003] eKLR',
      'Wambua v Katua [2015] eKLR'
    ],
    procedure: '1. Establish the title boundary from registry\n2. Compare with physical occupation\n3. Apply acquiescence if applicable\n4. Consider adverse possession claims\n5. Reference survey records',
    typicalEvidence: [
      'Title deed and registry extract',
      'Survey plan (deed plan)',
      'Occupation records',
      'Land rates receipts',
      'Witness statements',
      'Aerial photography'
    ],
    surveyorRole: 'Surveyor prepares boundary location reports, establishes monuments, and provides expert testimony on boundary location.',
    brownsPrinciple: 'Priority of boundaries: (1) Natural features, (2) Artificial marks, (3) Occupation lines, (4) Title deeds',
    commonPitfalls: [
      'Relying solely on title without physical verification',
      'Ignoring acquiescence cases',
      'Not considering prescription rights',
      'Insufficient monumentation'
    ]
  },
  {
    id: 'bl-002',
    issueType: 'MONUMENT_CONFLICT',
    title: 'Monument Conflict Resolution',
    description: 'When monuments (beacons, pillars) conflict with each other or with title boundaries. Browns Call establishes the hierarchy for resolving such conflicts.',
    legalFramework: [
      'Survey Regulations 1994 Regulation 47',
      'Survey Act Cap 299 Section 12',
      'RDM 1.1 Section 4.3'
    ],
    relevantActs: [
      'Survey Act Cap 299',
      'Registered Land Act Cap 300'
    ],
    caseLaw: [
      'Browns Call - Established hierarchy of boundary evidence',
      'Ochieng v Onyango [2004] eKLR',
      'Mbugua v Maina [2012] eKLR'
    ],
    procedure: '1. Apply Browns Call priority:\n   a) Natural boundaries (rivers, roads)\n   b) Artificial marks (beacons, pillars)\n   c) Occupation lines\n   d) Title deeds\n2. If beacons conflict, older beacon takes precedence\n3. If title conflicts with occupation, apply acquiescence',
    typicalEvidence: [
      'Original survey records',
      'Beacon certificates',
      'Historical plans',
      'GPS observations',
      'Neighbour acknowledgments'
    ],
    surveyorRole: 'Surveyor must re-establish original monuments, compare with records, and prepare a boundary location report with recommendation.',
    brownsPrinciple: 'Priority Order: (1) Natural features, (2) Artificial marks (oldest first), (3) Occupation, (4) Title',
    commonPitfalls: [
      'Placing new beacons without researching history',
      'Ignoring Browns Call hierarchy',
      'Not checking beacon age',
      'Missing original survey records'
    ]
  },
  {
    id: 'bl-003',
    issueType: 'DEED_vs_OCCUPATION',
    title: 'Deed vs Physical Occupation',
    description: 'When the boundary shown on the title deed differs from the actual physical occupation on the ground. This is one of the most common boundary disputes in Kenya.',
    legalFramework: [
      'Registered Land Act Cap 300 Section 28',
      'Land Registration Act 2012 Section 24',
      'Evidence Act Cap 80'
    ],
    relevantActs: [
      'Registered Land Act Cap 300',
      'Evidence Act Cap 80',
      'Civil Procedure Act Cap 21'
    ],
    caseLaw: [
      'Kibaki v Raila [2013] eKLR',
      'Oginga Odinga v Jaramogi [2008] eKLR',
      'Mburu v Republic [2002] eKLR'
    ],
    procedure: '1. Obtain registry extract showing title boundaries\n2. Conduct physical boundary identification\n3. Compare deed plan with occupation\n4. Document any acquiescence or agreement\n5. File reference to Land Disputes Tribunal if unresolved',
    typicalEvidence: [
      'Registry extract',
      'Current survey plan',
      'Photographs of occupation',
      'Neighbour acknowledgments',
      'Land rates clearance',
      'Utility bills'
    ],
    surveyorRole: 'Prepare detailed boundary location report showing deed vs occupation, with recommendation on boundary location.',
    brownsPrinciple: 'When deed conflicts with occupation, the boundary may be fixed by acquiescence if parties have long acted on the occupation line',
    commonPitfalls: [
      'Accepting title without physical verification',
      'Not documenting long occupation',
      'Missing neighbour agreements',
      'Incomplete boundary reports'
    ]
  },
  {
    id: 'bl-004',
    issueType: 'ACQUIESCENCE',
    title: 'Acquiescence in Boundary Disputes',
    description: 'When a landowner acquiesces (passively accepts) to an encroachment or boundary for a long period, they may lose the right to enforce the title boundary.',
    legalFramework: [
      'Registered Land Act Cap 300 Section 28(2)',
      'Limitation of Actions Act Cap 22',
      'Land Registration Act 2012 Section 24'
    ],
    relevantActs: [
      'Registered Land Act Cap 300',
      'Limitation of Actions Act Cap 22',
      'Evidence Act Cap 80'
    ],
    caseLaw: [
      'Miller v Lord [1974] EA 66',
      'Njeru v Municipal Council of Nairobi [1997] eKLR',
      'Gathogo v Karanja [2010] eKLR'
    ],
    procedure: '1. Establish the title boundary\n2. Identify the occupation line\n3. Prove the title owner knew of occupation\n4. Show title owner took no action for 12+ years\n5. The occupation line becomes the boundary',
    typicalEvidence: [
      '12+ years of occupation',
      'Title owner knowledge',
      'No objection on record',
      'Boundary agreements',
      'Rates payments by occupier',
      'Neighbour testimony'
    ],
    surveyorRole: 'Document the occupation history, prepare acquiescence analysis, and establish the boundary by agreement or reference.',
    brownsPrinciple: 'Acquiescence overrides title when: (1) Clear occupation line exists, (2) Title owner knew, (3) No action taken for statutory period',
    commonPitfalls: [
      'Not documenting full 12-year period',
      'Missing evidence of title owner knowledge',
      'Confusing with adverse possession',
      'Not recording neighbour agreements'
    ]
  },
  {
    id: 'bl-005',
    issueType: 'RIPARIAN_BOUNDARY',
    title: 'Riparian and River Boundaries',
    description: 'Boundaries along rivers, lakes, and other water bodies. The general rule is that riparian owners have rights to the water and the bed up to the median line.',
    legalFramework: [
      'Survey Act Cap 299 Section 18',
      'Water Act 2016',
      'Public Health Act Cap 242',
      'Navigation Act Cap 356'
    ],
    relevantActs: [
      'Survey Act Cap 299',
      'Water Act 2016',
      'Lake Basin Development Authority Act',
      'Marine Act Cap 371'
    ],
    caseLaw: [
      'Achieng v Odinga [1992] eKLR',
      'Kenya Marine and Fisheries Research Institute case',
      'Oduya v Wambua [2011] eKLR'
    ],
    procedure: '1. Identify the water body type (river, lake, ocean)\n2. Determine if navigable or non-navigable\n3. Apply relevant rule:\n   - Non-navigable: Medium thread (center line)\n   - Navigable: Ad medium filum aquae\n   - Lakes: Riparian owners share bed\n4. Survey to appropriate boundary\n5. Reference HWM or LWM as applicable',
    typicalEvidence: [
      'Aerial photographs',
      'Hydrographic surveys',
      'Historical maps',
      'Landsat imagery',
      'Water rights records'
    ],
    surveyorRole: 'Conduct hydrographic survey, establish water boundary, and prepare survey plan showing riparian boundary.',
    brownsPrinciple: 'Riparian rights: (1) Non-navigable rivers follow medium thread, (2) Navigable rivers follow high water mark, (3) Lakes divide equally among riparians',
    commonPitfalls: [
      'Ignoring water law requirements',
      'Not considering erosion/accretion',
      'Missing navigation rights',
      'Not consulting water authority'
    ]
  },
  {
    id: 'bl-006',
    issueType: 'ROAD_BOUNDARY',
    title: 'Road and Highway Boundaries',
    description: 'Boundaries along public roads, highways, and easements. Road reserves are defined and boundaries must consider road widening requirements.',
    legalFramework: [
      'Survey Act Cap 299 Section 17',
      'Public Roads and Roads Act 2007',
      'Physical Planning Act Cap 286',
      'Urban Areas and Cities Act 2011'
    ],
    relevantActs: [
      'Public Roads and Roads Act 2007',
      'Physical Planning Act Cap 286',
      'Survey Act Cap 299',
      'Kenya Roads Board Act 1999'
    ],
    caseLaw: [
      'Republic v Minister of Roads [2010] eKLR',
      'Nairobi City Council v Karan [2008] eKLR',
      'Kenya Railways v Kuria [2005] eKLR'
    ],
    procedure: '1. Obtain road reserve boundaries from Survey of Kenya\n2. Check for road widening schemes\n3. Identify access points and easements\n4. Survey actual road boundaries vs title\n5. Reference gazette reserves',
    typicalEvidence: [
      'Gazette notices',
      'Road reserve plans',
      'Survey of Kenya records',
      'Physical planning approvals',
      'Traffic impact assessments'
    ],
    surveyorRole: 'Establish road boundaries, verify reserve widths, and ensure compliance with road authority requirements.',
    brownsPrinciple: 'Road boundaries follow: (1) Gazette reserves, (2) Survey plans, (3) Physical occupation, (4) Planning approvals',
    commonPitfalls: [
      'Ignoring gazette reserves',
      'Not checking road widening plans',
      'Missing railway boundaries',
      'Not consulting road authorities'
    ]
  },
  {
    id: 'bl-007',
    issueType: 'SURVEY_ERROR',
    title: 'Survey Errors and Corrections',
    description: 'When survey plans contain mathematical or drafting errors. These may be corrected through administrative review or court proceedings.',
    legalFramework: [
      'Survey Act Cap 299 Sections 10-12',
      'Survey Regulations 1994',
      'Cadastral Survey Rules'
    ],
    relevantActs: [
      'Survey Act Cap 299',
      'Survey Regulations 1994',
      'Registered Land Act Cap 300'
    ],
    caseLaw: [
      'Surveyor General v Patel [1985] eKLR',
      'Mwaura v Ngugi [2001] eKLR',
      'Kariuki v Survey of Kenya [2015] eKLR'
    ],
    procedure: '1. Identify the error type (mathematical, drafting, monument)\n2. Obtain original survey records\n3. Calculate correct position\n4. Apply to Survey of Kenya for correction\n5. Update registry if approved',
    typicalEvidence: [
      'Original survey records',
      'Field notes',
      'Calculation sheets',
      'GPS data',
      'Historical plans'
    ],
    surveyorRole: 'Identify and document errors, prepare correction application, and re-survey if required.',
    brownsPrinciple: 'Survey errors corrected by: (1) Original field records, (2) Mathematical verification, (3) Physical evidence',
    commonPitfalls: [
      'Not checking original records',
      'Incorrect calculations',
      'Not applying through proper channels',
      'Missing monument verification'
    ]
  },
  {
    id: 'bl-008',
    issueType: 'REGISTRATION_EFFECT',
    title: 'Effect of Registration on Boundaries',
    description: 'Understanding what the land registry records show and their legal effect on boundary disputes.',
    legalFramework: [
      'Land Registration Act 2012 Section 24',
      'Registered Land Act Cap 300 Section 28',
      'Electronic Land Registries Act 2020'
    ],
    relevantActs: [
      'Land Registration Act 2012',
      'Registered Land Act Cap 300',
      'Electronic Land Registries Act 2020'
    ],
    caseLaw: [
      'Silverstein v Registrar of Titles [1949] 1 EA 206',
      'Tayebwa v Batungi [2008] 1 EA 220',
      'Kenya Airways v Commissioner of Lands [2014] eKLR'
    ],
    procedure: '1. Obtain registry extract\n2. Review title deed description\n3. Check for cautions or restrictions\n4. Verify parcel number and area\n5. Note any pending transactions',
    typicalEvidence: [
      'Registry extract',
      'Title deed',
      'Index map',
      'Cadastral sheet',
      'Search certificate'
    ],
    surveyorRole: 'Interpret registry documents, verify against physical boundaries, and advise on registration effects.',
    brownsPrinciple: 'Registration effect: Title is conclusive evidence but may be overridden by physical boundaries established through acquiescence or adverse possession',
    commonPitfalls: [
      'Assuming registry is always correct',
      'Not checking for cautions',
      'Ignoring pending transactions',
      'Not verifying parcel existence'
    ]
  },
  {
    id: 'bl-009',
    issueType: 'ADVERSE_POSSESSION',
    title: 'Adverse Possession Claims',
    description: 'When a person occupies land belonging to another for a continuous period without permission, they may acquire ownership rights.',
    legalFramework: [
      'Limitation of Actions Act Cap 22 Section 7',
      'Registered Land Act Cap 300 Section 28',
      'Land Registration Act 2012'
    ],
    relevantActs: [
      'Limitation of Actions Act Cap 22',
      'Registered Land Act Cap 300',
      'Civil Procedure Act Cap 21'
    ],
    caseLaw: [
      'Mwaura v Kenya Breweries [1985] eKLR',
      'Kituku v Kenya Airways [2012] eKLR',
      'Ndegwa v J[1999] eKLR'
    ],
    procedure: '1. Establish 12+ years continuous occupation\n2. Prove adverse nature (without permission)\n3. Show open and notorious possession\n4. Demonstrate exclusive possession\n5. File claim in Land Disputes Tribunal',
    typicalEvidence: [
      '12+ years occupation proof',
      'Land rates receipts',
      'Witness statements',
      'Photographs over time',
      'Survey plans',
      'Utility accounts'
    ],
    surveyorRole: 'Document occupation history, prepare adverse possession survey, and provide expert testimony.',
    brownsPrinciple: 'Adverse possession requires: (1) HOSTILE - without permission, (2) OPEN - not hidden, (3) NOTORIOUS - known to owner, (4) EXCLUSIVE - not shared, (5) CONTINUOUS - 12+ years',
    commonPitfalls: [
      'Not proving full 12 years',
      'Missing continuous occupation proof',
      'Not establishing adverse nature',
      'Not documenting owner knowledge'
    ]
  },
  {
    id: 'bl-010',
    issueType: 'EASEMENT',
    title: 'Easements and Rights of Way',
    description: 'Easements are rights one party has over another persons land. Common easements include right of way, water pipe, and drainage.',
    legalFramework: [
      'Registered Land Act Cap 300 Sections 60-65',
      'Land Registration Act 2012',
      'Easements Act 1902 (applied)'
    ],
    relevantActs: [
      'Registered Land Act Cap 300',
      'Easements Act 1902',
      'Water Act 2016'
    ],
    caseLaw: [
      'Kenyatta v Mwendwa [1975] eKLR',
      'Odinga v Oginga [2006] eKLR',
      'Mwangi v Kariuki [2013] eKLR'
    ],
    procedure: '1. Identify easement type needed\n2. Check if dominant/servient tenement exists\n3. Create by: express grant, prescription, or necessity\n4. Register at land registry\n5. Survey and demarcate easement',
    typicalEvidence: [
      'Title deeds of both parcels',
      'Grant documents',
      'Prescription evidence',
      'Survey plans',
      'Utility plans'
    ],
    surveyorRole: 'Survey easement location, prepare easement plan, and coordinate registration.',
    brownsPrinciple: 'Easements can be created by: (1) Express grant, (2) Prescription (20 years), (3) Necessity, (4) Implication',
    commonPitfalls: [
      'Not identifying dominant tenement',
      'Missing grant documentation',
      'Not registering easement',
      'Confusing with license'
    ]
  },
  {
    id: 'bl-011',
    issueType: 'COVENANT',
    title: 'Restrictive Covenants',
    description: 'Restrictions on land use that run with the land. Common covenants include building lines, use restrictions, and architectural controls.',
    legalFramework: [
      'Registered Land Act Cap 300 Section 66',
      'Land Registration Act 2012',
      'Urban Areas and Cities Act 2011'
    ],
    relevantActs: [
      'Registered Land Act Cap 300',
      'Physical Planning Act Cap 286',
      'County Government Act 2012'
    ],
    caseLaw: [
      'Tana and Athi River Catchment v Kenya Breweries [2010] eKLR',
      'Mombasa Golf Club v Colonial Secretary [1930]',
      'Syokau v Administrator General [2014] eKLR'
    ],
    procedure: '1. Review title for covenant provisions\n2. Identify covenantee and covenantor\n3. Determine if burden passes to successors\n4. Check if breach has occurred\n5. Seek enforcement through court',
    typicalEvidence: [
      'Title deed with covenant',
      'Deed of covenant',
      'Title search',
      'Physical planning approval',
      'Architectural guidelines'
    ],
    surveyorRole: 'Verify covenant compliance in surveys, identify building lines, and prepare reports on covenant adherence.',
    brownsPrinciple: 'Covenants must touch and concern land, and there must be dominant tenement for enforcement',
    commonPitfalls: [
      'Not checking title covenants',
      'Missing deed records',
      'Not understanding covenant scope',
      'Confusing with contract'
    ]
  },
  {
    id: 'bl-012',
    issueType: 'PARTITION',
    title: 'Partition of Contiguous Holdings',
    description: 'Division of land among co-owners. Can be done by agreement, arbitration, or court order.',
    legalFramework: [
      'Civil Procedure Act Cap 21 Order 36',
      'Registered Land Act Cap 300',
      'Law of Succession Act Cap 30'
    ],
    relevantActs: [
      'Civil Procedure Act Cap 21',
      'Law of Succession Act Cap 30',
      'Registered Land Act Cap 300'
    ],
    caseLaw: [
      'Onyango v Ochieng [2003] eKLR',
      'In re Estate of Ngari [2010] eKLR',
      'Mbugua v Mbugua [2015] eKLR'
    ],
    procedure: '1. Identify all co-owners\n2. Determine share proportions\n3. Agree on division or seek arbitration\n4. Survey new parcels\n5. Register new titles',
    typicalEvidence: [
      'Original title deed',
      'Family/owner agreements',
      'Share ratios',
      'Survey plans',
      'Mutation forms'
    ],
    surveyorRole: 'Prepare partition survey, coordinate with parties, and ensure each parcel is separately titled.',
    commonPitfalls: [
      'Not identifying all owners',
      'Missing succession documents',
      'Not verifying shares',
      'Incomplete registration'
    ]
  },
  {
    id: 'bl-013',
    issueType: 'MISTAKE',
    title: 'Mistake in Title or Survey',
    description: 'When errors in title documents or surveys affect boundary location. May be corrected through rectification or court proceedings.',
    legalFramework: [
      'Registered Land Act Cap 300 Section 80',
      'Land Registration Act 2012 Section 39',
      'Survey Act Cap 299'
    ],
    relevantActs: [
      'Registered Land Act Cap 300',
      'Land Registration Act 2012',
      'Survey Act Cap 299'
    ],
    caseLaw: [
      'Gibson v Standard Printing Co [1949] 1 EA 259',
      'Kariuki v Registered Trustees [2011] eKLR',
      'Patel v EA Cargo [1974] EA 123'
    ],
    procedure: '1. Identify the mistake\n2. Gather evidence of correct position\n3. Apply to registry for correction\n4. Or file suit for rectification\n5. Update survey records',
    typicalEvidence: [
      'Original documents',
      'Survey records',
      'Field notes',
      'Deeds of rectification',
      'Expert opinions'
    ],
    surveyorRole: 'Identify and document mistakes, provide expert evidence, and coordinate correction process.',
    commonPitfalls: [
      'Not gathering sufficient evidence',
      'Not applying through proper channels',
      'Missing statutory requirements',
      'Not updating all records'
    ]
  },
  {
    id: 'bl-014',
    issueType: 'TRESPASS',
    title: 'Trespass and Boundary Encroachment',
    description: 'Unauthorized entry or encroachment onto another persons land. Surveyors play a key role in identifying and documenting trespass.',
    legalFramework: [
      'Registered Land Act Cap 300',
      'Criminal Procedure Code Cap 75',
      'Civil Procedure Act Cap 21'
    ],
    relevantActs: [
      'Registered Land Act Cap 300',
      'Criminal Procedure Code Cap 75',
      'Tort Ordinance Cap 36'
    ],
    caseLaw: [
      'Wambua v Kenya Power [2014] eKLR',
      'Otieno v Oduya [2008] eKLR',
      'Karanja v Gatimu [2012] eKLR'
    ],
    procedure: '1. Establish correct boundary\n2. Document encroachment\n3. Attempt negotiation\n4. File suit for injunction\n5. Seek damages if applicable',
    typicalEvidence: [
      'Boundary survey',
      'Photographs',
      'Title documents',
      'Encroachment measurements',
      'Witness statements'
    ],
    surveyorRole: 'Accurately determine boundary, document encroachment extent, and provide survey evidence for legal proceedings.',
    commonPitfalls: [
      'Not establishing correct boundary',
      'Incomplete measurements',
      'Not documenting properly',
      'Not advising on legal process'
    ]
  },
  {
    id: 'bl-015',
    issueType: 'OTHER',
    title: 'Indigenous Land Rights',
    description: 'Recognition of customary land rights and community land, particularly relevant in pastoral and indigenous areas.',
    legalFramework: [
      'Community Land Act 2016',
      'Constitution of Kenya Article 61',
      'Land Registration Act 2012'
    ],
    relevantActs: [
      'Community Land Act 2016',
      'Environmental Management Act 1999',
      'Water Act 2016'
    ],
    caseLaw: [
      'Mbiti v AG [2015] eKLR',
      'Centre for Minority Rights Development v Kenya [2013]',
      'Petitioners v Cabinet Secretary [2017] eKLR'
    ],
    procedure: '1. Identify community/indigenous land\n2. Document traditional boundaries\n3. Apply for community land registration\n4. Survey and demarcate\n5. Register under Community Land Act',
    typicalEvidence: [
      'Community elders testimony',
      'Historical use records',
      'Traditional boundary markers',
      'Gazette notices',
      'Community meetings minutes'
    ],
    surveyorRole: 'Document traditional boundaries, consult community elders, and ensure proper registration process.',
    commonPitfalls: [
      'Not engaging community',
      'Ignoring traditional boundaries',
      'Not following Community Land Act',
      'Missing required notifications'
    ]
  }
]

export function getBoundaryLawByType(type: BoundaryIssueType): BoundaryLawEntry[] {
  return BOUNDARY_LAW_ENTRIES.filter(entry => entry.issueType === type)
}

export function searchBoundaryLaw(query: string): BoundaryLawEntry[] {
  const lowerQuery = query.toLowerCase()
  return BOUNDARY_LAW_ENTRIES.filter(
    entry =>
      entry.title.toLowerCase().includes(lowerQuery) ||
      entry.description.toLowerCase().includes(lowerQuery) ||
      entry.issueType.toLowerCase().includes(lowerQuery) ||
      entry.relevantActs.some(act => act.toLowerCase().includes(lowerQuery)) ||
      entry.caseLaw.some(c => c.toLowerCase().includes(lowerQuery))
  )
}

export function getAllBoundaryLawTopics(): { type: BoundaryIssueType; title: string; count: number }[] {
  const topics = new Map<BoundaryIssueType, { type: BoundaryIssueType; title: string; count: number }>()
  
  for (const entry of BOUNDARY_LAW_ENTRIES) {
    const existing = topics.get(entry.issueType)
    if (existing) {
      existing.count++
    } else {
      topics.set(entry.issueType, {
        type: entry.issueType,
        title: entry.title,
        count: 1
      })
    }
  }
  
  return Array.from(topics.values())
}
