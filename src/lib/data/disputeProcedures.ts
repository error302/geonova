import { DisputeProcedure, DisputeType, DisputeStage } from '@/types/landLaw'

export const DISPUTE_PROCEDURES: DisputeProcedure[] = [
  {
    id: 'dp-001',
    disputeType: 'BOUNDARY_DISPUTE',
    title: 'Boundary Dispute Resolution',
    description: 'Procedures for resolving disputes over the location of boundaries between adjacent parcels of land.',
    stages: [
      'OUT_OF_COURT_NEGOTIATION',
      'MEDIATION',
      'ARBITRATION',
      'LAND_DISPUTES_TRIBUNAL',
      'MAGISTRATE_COURET'
    ],
    jurisdiction: 'Chief Magistrate to Land Disputes Tribunal',
    timeframe: '3-18 months depending on complexity',
    estimatedCost: 'KES 50,000 - 500,000',
    requiredDocuments: [
      'Title deeds of both parcels',
      'Survey plans',
      'Boundary location report',
      'Evidence of occupation',
      'Registry extracts',
      'Witness statements'
    ],
    mediationSteps: [
      '1. Parties exchange documents',
      '2. Joint site visit with surveyors',
      '3. Mediation session with agreed boundary',
      '4. Draw minutes of agreement',
      '5. Register boundary correction if needed'
    ],
    courtProcedure: '1. File Plaint with Supporting Documents\n2. Serve Defendant\n3. Written Statements of Claim/Defense\n4. Inspection by Court\n5. Hearing\n6. Judgment\n7. Decree',
    precedentCases: [
      'Kenya Breweries Ltd v KAPI Ltd [1989] eKLR',
      'Njenga v Kimani [2003] eKLR',
      'Browns Call principle established in multiple cases'
    ]
  },
  {
    id: 'dp-002',
    disputeType: 'TITLE_DISPUTE',
    title: 'Land Title Dispute Procedures',
    description: 'Disputes over the ownership of land, including conflicting titles, fraudulent registrations, and succession issues.',
    stages: [
      'OUT_OF_COURT_NEGOTIATION',
      'LAND_DISPUTES_TRIBUNAL',
      'MAGISTRATE_COURET',
      'HIGH_COURET',
      'COURT_OF_APPEAL'
    ],
    jurisdiction: 'Environment and Land Court to Court of Appeal',
    timeframe: '6 months - 5 years',
    estimatedCost: 'KES 100,000 - 2,000,000',
    requiredDocuments: [
      'All title documents',
      'Registry searches',
      'Succession documents (if applicable)',
      'Transfer deeds',
      'Valuation reports',
      'Survey records'
    ],
    courtProcedure: '1. File suit for declaration of title\n2. Join all interested parties\n3. Comprehensive hearing\n4. Possible reference to Survey of Kenya\n5. Judgment\n6. Appeal if dissatisfied',
    precedentCases: [
      'Silverstein v Registrar of Titles [1949] 1 EA 206',
      'Tayebwa v Batungi [2008] 1 EA 220',
      'Kenya Airways v Commissioner of Lands [2014] eKLR'
    ]
  },
  {
    id: 'dp-003',
    disputeType: 'EASEMENT_DISPUTE',
    title: 'Easement and Right of Way Disputes',
    description: 'Disputes regarding easements, rights of way, and other burdens on land.',
    stages: [
      'OUT_OF_COURT_NEGOTIATION',
      'MEDIATION',
      'ARBITRATION',
      'LAND_DISPUTES_TRIBUNAL',
      'MAGISTRATE_COURET'
    ],
    jurisdiction: 'Magistrate Court to Land Disputes Tribunal',
    timeframe: '3-12 months',
    estimatedCost: 'KES 30,000 - 300,000',
    requiredDocuments: [
      'Title deeds of dominant and servient tenement',
      'Easement grant documents',
      'Survey plans showing easement',
      'Evidence of use',
      'Notice to cease (if applicable)'
    ],
    mediationSteps: [
      '1. Identify easement type and terms',
      '2. Discuss alternative routes',
      '3. Agree on compensation if applicable',
      '4. Draw settlement agreement',
      '5. Register if required'
    ],
    precedentCases: [
      'Kenyatta v Mwendwa [1975] eKLR',
      'Odinga v Oginga [2006] eKLR',
      'Mwangi v Kariuki [2013] eKLR'
    ]
  },
  {
    id: 'dp-004',
    disputeType: 'TRESPASS',
    title: 'Trespass and Encroachment Procedures',
    description: 'Legal procedures to address unauthorized entry or encroachment onto land.',
    stages: [
      'OUT_OF_COURT_NEGOTIATION',
      'MEDIATION',
      'MAGISTRATE_COURET',
      'HIGH_COURET'
    ],
    jurisdiction: 'Magistrate Court',
    timeframe: '1-6 months for criminal; 3-12 months for civil',
    estimatedCost: 'KES 20,000 - 200,000',
    requiredDocuments: [
      'Title deed proving ownership',
      'Survey plan showing encroachment',
      'Photographic evidence',
      'Police abstract (if criminal trespass)',
      'Demand letter',
      'Witness statements'
    ],
    courtProcedure: '1. Send demand letter\n2. File complaint/pleadings\n3. Site inspection\n4. Hearing\n5. Judgment\n6. Order for removal/injunction',
    precedentCases: [
      'Wambua v Kenya Power [2014] eKLR',
      'Otieno v Oduya [2008] eKLR',
      'Karanja v Gatimu [2012] eKLR'
    ]
  },
  {
    id: 'dp-005',
    disputeType: 'COVENANT_BREACH',
    title: 'Breach of Restrictive Covenant',
    description: 'When a landowner violates restrictions registered on their title, such as building lines or use restrictions.',
    stages: [
      'OUT_OF_COURT_NEGOTIATION',
      'MEDIATION',
      'MAGISTRATE_COURET',
      'HIGH_COURET'
    ],
    jurisdiction: 'Magistrate Court',
    timeframe: '2-9 months',
    estimatedCost: 'KES 30,000 - 250,000',
    requiredDocuments: [
      'Title deed showing covenant',
      'Deed of covenant',
      'Evidence of breach',
      'Architectural plans (if building)',
      'Correspondence with violator'
    ],
    courtProcedure: '1. Identify covenant from title\n2. Document breach\n3. Send notice\n4. File suit for injunction\n5. Seek demolition or compliance',
    precedentCases: [
      'Tana and Athi River Catchment v Kenya Breweries [2010] eKLR',
      'Mombasa Golf Club v Colonial Secretary [1930]',
      'Syokau v Administrator General [2014] eKLR'
    ]
  },
  {
    id: 'dp-006',
    disputeType: 'PARTITION_SUIT',
    title: 'Partition of Land Among Co-Owners',
    description: 'When co-owners cannot agree on division of land, any party can seek court-ordered partition.',
    stages: [
      'OUT_OF_COURT_NEGOTIATION',
      'MEDIATION',
      'MAGISTRATE_COURET',
      'HIGH_COURET'
    ],
    jurisdiction: 'Magistrate Court',
    timeframe: '6-18 months',
    estimatedCost: 'KES 50,000 - 500,000',
    requiredDocuments: [
      'Original title deed showing co-ownership',
      'Share ratios or inheritance documents',
      'Valuation report',
      'Survey plan',
      'List of all co-owners',
      'Evidence of attempts to agree'
    ],
    courtProcedure: '1. File partition suit\n2. Join all co-owners\n3. Court appoints surveyor if needed\n4. Hearing on division\n5. Order for physical partition\n6. New titles issued',
    precedentCases: [
      'Onyango v Ochieng [2003] eKLR',
      'In re Estate of Ngari [2010] eKLR',
      'Mbugua v Mbugua [2015] eKLR'
    ]
  },
  {
    id: 'dp-007',
    disputeType: 'JUDICIAL_REVIEW',
    title: 'Judicial Review of Administrative Decisions',
    description: 'Challenging decisions by government agencies related to land, such as land allocation or compulsory acquisition.',
    stages: [
      'ADMINISTRATIVE_APPEAL',
      'HIGH_COURET',
      'COURT_OF_APPEAL',
      'SUPREME_COURET'
    ],
    jurisdiction: 'High Court, Court of Appeal, Supreme Court',
    timeframe: '6 months - 3 years',
    estimatedCost: 'KES 100,000 - 1,000,000',
    requiredDocuments: [
      'Decision being challenged',
      'Grounds for review',
      'Affidavit of facts',
      'Relevant government notices',
      'Evidence of injustice'
    ],
    courtProcedure: '1. File Application for Review\n2. Obtain Stay of Decision (if urgent)\n3. Hearing\n4. Judgment\n5. Orders\n6. Appeal if dissatisfied',
    precedentCases: [
      'Republic v Minister of Roads [2010] eKLR',
      'Kenya Airways v Commissioner of Lands [2014] eKLR',
      'Mbiti v AG [2015] eKLR'
    ]
  },
  {
    id: 'dp-008',
    disputeType: 'ADMINISTRATIVE_APPEAL',
    title: 'Administrative Appeals for Land Decisions',
    description: 'Appealing decisions by land registries, Survey of Kenya, and other land administrative bodies.',
    stages: [
      'OUT_OF_COURT_NEGOTIATION',
      'ADMINISTRATIVE_APPEAL',
      'LAND_DISPUTES_TRIBUNAL',
      'MAGISTRATE_COURET'
    ],
    jurisdiction: 'Relevant Government Agency to Tribunal',
    timeframe: '1-6 months for administrative; 3-12 months for tribunal',
    estimatedCost: 'KES 10,000 - 200,000',
    requiredDocuments: [
      'Decision being appealed',
      ' Grounds of appeal',
      'Supporting documents',
      'Identity documents',
      'Land registry search'
    ],
    mediationSteps: [
      '1. Review decision grounds',
      '2. Gather supporting evidence',
      '3. File appeal within timeframe',
      '4. Attend hearing',
      '5. Receive decision'
    ],
    precedentCases: [
      'Kariuki v Survey of Kenya [2015] eKLR',
      'Mwaura v Ngugi [2001] eKLR',
      'Surveyor General v Patel [1985] eKLR'
    ]
  }
]

export function getDisputeProcedureByType(type: DisputeType): DisputeProcedure | undefined {
  return DISPUTE_PROCEDURES.find((proc: any) => proc.disputeType === type)
}

export function getAllDisputeTypes(): { type: DisputeType; title: string }[] {
  return DISPUTE_PROCEDURES.map((proc: any) => ({
    type: proc.disputeType,
    title: proc.title
  }))
}
