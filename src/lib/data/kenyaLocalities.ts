export interface KenyaCounty {
  code: string
  name: string
  registrationSections: RegistrationSection[]
}

export interface RegistrationSection {
  code: string
  name: string
  county: string
  hasBlocks: boolean
  blocks?: Block[]
  utmZone: number
  hemisphere: 'N' | 'S'
}

export interface Block {
  number: number
  name?: string
}

export const KENYA_COUNTIES: KenyaCounty[] = [
  { code: 'NBI', name: 'Nairobi', registrationSections: [
    { code: 'NRBN', name: 'Nairobi', county: 'NBI', hasBlocks: true, utmZone: 37, hemisphere: 'S' },
    { code: 'WST', name: 'Westlands', county: 'NBI', hasBlocks: true, utmZone: 37, hemisphere: 'S' },
    { code: 'KAS', name: 'Kasarani', county: 'NBI', hasBlocks: true, utmZone: 37, hemisphere: 'S' },
    { code: 'RGR', name: 'Ruaraka', county: 'NBI', hasBlocks: true, utmZone: 37, hemisphere: 'S' },
    { code: 'DNL', name: 'Dagoretti', county: 'NBI', hasBlocks: true, utmZone: 37, hemisphere: 'S' },
    { code: 'EMB', name: 'Embakasi', county: 'NBI', hasBlocks: true, utmZone: 37, hemisphere: 'S' },
    { code: 'LGN', name: 'Langata', county: 'NBI', hasBlocks: true, utmZone: 37, hemisphere: 'S' },
    { code: 'MBS', name: 'Makadara', county: 'NBI', hasBlocks: true, utmZone: 37, hemisphere: 'S' },
  ]},

  { code: 'KBU', name: 'Kiambu', registrationSections: [
    { code: 'KBU', name: 'Kiambu', county: 'KBU', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'RRU', name: 'Ruiru', county: 'KBU', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'THK', name: 'Thika', county: 'KBU', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'LMR', name: 'Limuru', county: 'KBU', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'GTH', name: 'Githunguri', county: 'KBU', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'KJR', name: 'Kajiado', county: 'KBU', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
  ]},

  { code: 'MSA', name: 'Mombasa', registrationSections: [
    { code: 'MSA', name: 'Mombasa', county: 'MSA', hasBlocks: true, utmZone: 37, hemisphere: 'S' },
    { code: 'KWL', name: 'Kwale', county: 'MSA', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'MLF', name: 'Malindi', county: 'MSA', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'LMW', name: 'Lamu', county: 'MSA', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
  ]},

  { code: 'KSM', name: 'Kisumu', registrationSections: [
    { code: 'KSM', name: 'Kisumu', county: 'KSM', hasBlocks: false, utmZone: 36, hemisphere: 'N' },
    { code: 'KLM', name: 'Kakamega', county: 'KSM', hasBlocks: false, utmZone: 36, hemisphere: 'N' },
    { code: 'VHG', name: 'Vihiga', county: 'KSM', hasBlocks: false, utmZone: 36, hemisphere: 'N' },
    { code: 'SIA', name: 'Siaya', county: 'KSM', hasBlocks: false, utmZone: 36, hemisphere: 'N' },
    { code: 'HMB', name: 'Homa Bay', county: 'KSM', hasBlocks: false, utmZone: 36, hemisphere: 'S' },
    { code: 'MIG', name: 'Migori', county: 'KSM', hasBlocks: false, utmZone: 36, hemisphere: 'S' },
  ]},

  { code: 'NKR', name: 'Nakuru', registrationSections: [
    { code: 'NKR', name: 'Nakuru', county: 'NKR', hasBlocks: false, utmZone: 36, hemisphere: 'S' },
    { code: 'NVS', name: 'Naivasha', county: 'NKR', hasBlocks: false, utmZone: 36, hemisphere: 'S' },
    { code: 'ELM', name: 'Eldama Ravine', county: 'NKR', hasBlocks: false, utmZone: 36, hemisphere: 'S' },
    { code: 'MTR', name: 'Molo', county: 'NKR', hasBlocks: false, utmZone: 36, hemisphere: 'S' },
    { code: 'NJR', name: 'Njoro', county: 'NKR', hasBlocks: false, utmZone: 36, hemisphere: 'S' },
  ]},

  { code: 'ELD', name: 'Uasin Gishu', registrationSections: [
    { code: 'ELD', name: 'Eldoret', county: 'ELD', hasBlocks: false, utmZone: 36, hemisphere: 'N' },
    { code: 'BURN', name: 'Burnt Forest', county: 'ELD', hasBlocks: false, utmZone: 36, hemisphere: 'N' },
    { code: 'KAP', name: 'Kapseret', county: 'ELD', hasBlocks: false, utmZone: 36, hemisphere: 'N' },
    { code: 'TUL', name: 'Turbo', county: 'ELD', hasBlocks: false, utmZone: 36, hemisphere: 'N' },
  ]},

  { code: 'NYR', name: 'Nyeri', registrationSections: [
    { code: 'NYR', name: 'Nyeri', county: 'NYR', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'OTH', name: 'Othaya', county: 'NYR', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'MUR', name: 'Muranga', county: 'NYR', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'KGT', name: 'Kigumo', county: 'NYR', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
  ]},

  { code: 'MRU', name: 'Meru', registrationSections: [
    { code: 'MRU', name: 'Meru', county: 'MRU', hasBlocks: false, utmZone: 37, hemisphere: 'N' },
    { code: 'MTR', name: 'Mitunguu', county: 'MRU', hasBlocks: false, utmZone: 37, hemisphere: 'N' },
    { code: 'ITHR', name: 'Iten', county: 'MRU', hasBlocks: false, utmZone: 37, hemisphere: 'N' },
    { code: 'CHUK', name: 'Chuka', county: 'MRU', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
  ]},

  { code: 'KTI', name: 'Kitui', registrationSections: [
    { code: 'KTI', name: 'Kitui', county: 'KTI', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'MUT', name: 'Mutyangome', county: 'KTI', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'KYU', name: 'Kyuso', county: 'KTI', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
  ]},

  { code: 'MKS', name: 'Machakos', registrationSections: [
    { code: 'MKS', name: 'Machakos', county: 'MKS', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'KJD', name: 'Kangundo', county: 'MKS', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'KAT', name: 'Kathiani', county: 'MKS', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'MTH', name: 'Matuu', county: 'MKS', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
  ]},

  { code: 'KIS', name: 'Kisii', registrationSections: [
    { code: 'KIS', name: 'Kisii', county: 'KIS', hasBlocks: false, utmZone: 36, hemisphere: 'S' },
    { code: 'GUS', name: 'Gusii', county: 'KIS', hasBlocks: false, utmZone: 36, hemisphere: 'S' },
    { code: 'NYM', name: 'Nyamira', county: 'KIS', hasBlocks: false, utmZone: 36, hemisphere: 'S' },
  ]},

  { code: 'NDB', name: 'Nandi', registrationSections: [
    { code: 'KPT', name: 'Kapsabet', county: 'NDB', hasBlocks: false, utmZone: 36, hemisphere: 'N' },
    { code: 'NAND', name: 'Nandi', county: 'NDB', hasBlocks: false, utmZone: 36, hemisphere: 'N' },
  ]},

  { code: 'BGT', name: 'Baringo', registrationSections: [
    { code: 'KAB', name: 'Kabarnet', county: 'BGT', hasBlocks: false, utmZone: 36, hemisphere: 'N' },
    { code: 'BAR', name: 'Baringo', county: 'BGT', hasBlocks: false, utmZone: 36, hemisphere: 'N' },
  ]},

  { code: 'LKP', name: 'Laikipia', registrationSections: [
    { code: 'NANY', name: 'Nanyuki', county: 'LKP', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'LKP', name: 'Laikipia', county: 'LKP', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
  ]},

  { code: 'SMO', name: 'Samburu', registrationSections: [
    { code: 'MRR', name: 'Mararal', county: 'SMO', hasBlocks: false, utmZone: 37, hemisphere: 'N' },
    { code: 'SMB', name: 'Samburu', county: 'SMO', hasBlocks: false, utmZone: 37, hemisphere: 'N' },
  ]},

  { code: 'TRN', name: 'Turkana', registrationSections: [
    { code: 'LOD', name: 'Lodwar', county: 'TRN', hasBlocks: false, utmZone: 35, hemisphere: 'N' },
    { code: 'TUR', name: 'Turkana', county: 'TRN', hasBlocks: false, utmZone: 35, hemisphere: 'N' },
  ]},

  { code: 'PMG', name: 'Pokot', registrationSections: [
    { code: 'KAP', name: 'Kapenguria', county: 'PMG', hasBlocks: false, utmZone: 36, hemisphere: 'N' },
    { code: 'PKT', name: 'Pokot', county: 'PMG', hasBlocks: false, utmZone: 36, hemisphere: 'N' },
  ]},

  { code: 'WPK', name: 'West Pokot', registrationSections: [
    { code: 'KAP', name: 'Kapenguria', county: 'WPK', hasBlocks: false, utmZone: 36, hemisphere: 'N' },
    { code: 'WST', name: 'West Pokot', county: 'WPK', hasBlocks: false, utmZone: 36, hemisphere: 'N' },
  ]},

  { code: 'KAJI', name: 'Kajiado', registrationSections: [
    { code: 'KAJI', name: 'Kajiado', county: 'KAJI', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'NGONG', name: 'Ngong', county: 'KAJI', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'KISUR', name: 'Kiserian', county: 'KAJI', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
  ]},

  { code: 'KRN', name: 'Kericho', registrationSections: [
    { code: 'KRN', name: 'Kericho', county: 'KRN', hasBlocks: false, utmZone: 36, hemisphere: 'S' },
    { code: 'LITE', name: 'Litein', county: 'KRN', hasBlocks: false, utmZone: 36, hemisphere: 'S' },
  ]},

  { code: 'BKT', name: 'Bomet', registrationSections: [
    { code: 'BMT', name: 'Bomet', county: 'BKT', hasBlocks: false, utmZone: 36, hemisphere: 'S' },
    { code: 'SOT', name: 'Sotik', county: 'BKT', hasBlocks: false, utmZone: 36, hemisphere: 'S' },
  ]},

  { code: 'KAU', name: 'Kaura', registrationSections: [
    { code: 'MBSYA', name: 'Mbasya', county: 'KAU', hasBlocks: false, utmZone: 32, hemisphere: 'N' },
  ]},

  { code: 'KWE', name: 'Kwale', registrationSections: [
    { code: 'KWL', name: 'Kwale', county: 'KWE', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'MSAMB', name: 'Msambweni', county: 'KWE', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
  ]},

  { code: 'KIT', name: 'Kilifi', registrationSections: [
    { code: 'KLF', name: 'Kilifi', county: 'KIT', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'MLF', name: 'Malindi', county: 'KIT', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
  ]},

  { code: 'TAN', name: 'Tana River', registrationSections: [
    { code: 'HOLA', name: 'Hola', county: 'TAN', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'TNA', name: 'Tana River', county: 'TAN', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
  ]},

  { code: 'LAM', name: 'Lamu', registrationSections: [
    { code: 'LAM', name: 'Lamu', county: 'LAM', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'FULA', name: 'Fula', county: 'LAM', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
  ]},

  { code: 'TCT', name: 'Taita Taveta', registrationSections: [
    { code: 'VOT', name: 'Voi', county: 'TCT', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'WES', name: 'Wundanyi', county: 'TCT', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
  ]},

  { code: 'GAR', name: 'Garissa', registrationSections: [
    { code: 'GAR', name: 'Garissa', county: 'GAR', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'DADA', name: 'Dadaab', county: 'GAR', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
  ]},

  { code: 'WBR', name: 'Wajir', registrationSections: [
    { code: 'WJR', name: 'Wajir', county: 'WBR', hasBlocks: false, utmZone: 37, hemisphere: 'N' },
    { code: 'BUGA', name: 'Bugar', county: 'WBR', hasBlocks: false, utmZone: 37, hemisphere: 'N' },
  ]},

  { code: 'MDR', name: 'Mandera', registrationSections: [
    { code: 'MDR', name: 'Mandera', county: 'MDR', hasBlocks: false, utmZone: 37, hemisphere: 'N' },
    { code: 'LAF', name: 'Lafey', county: 'MDR', hasBlocks: false, utmZone: 37, hemisphere: 'N' },
  ]},

  { code: 'MRS', name: 'Marsabit', registrationSections: [
    { code: 'MRS', name: 'Marsabit', county: 'MRS', hasBlocks: false, utmZone: 37, hemisphere: 'N' },
    { code: 'MOY', name: 'Moyale', county: 'MRS', hasBlocks: false, utmZone: 37, hemisphere: 'N' },
  ]},

  { code: 'ISI', name: 'Isiolo', registrationSections: [
    { code: 'ISI', name: 'Isiolo', county: 'ISI', hasBlocks: false, utmZone: 37, hemisphere: 'N' },
    { code: 'GARBA', name: 'Garba Tulla', county: 'ISI', hasBlocks: false, utmZone: 37, hemisphere: 'N' },
  ]},

  { code: 'MBI', name: 'Meru South', registrationSections: [
    { code: 'CHUK', name: 'Chuka', county: 'MBI', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'MAARA', name: 'Maara', county: 'MBI', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
  ]},

  { code: 'THR', name: 'Tharaka', registrationSections: [
    { code: 'GAT', name: 'Gatunga', county: 'THR', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'THK', name: 'Tharaka', county: 'THR', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
  ]},

  { code: 'EMBU', name: 'Embu', registrationSections: [
    { code: 'EMBU', name: 'Embu', county: 'EMBU', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'MBE', name: 'Manyatta', county: 'EMBU', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
  ]},

  { code: 'KITUI', name: 'Kitui', registrationSections: [
    { code: 'KTI', name: 'Kitui', county: 'KITUI', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'MWALA', name: 'Mwingi', county: 'KITUI', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
  ]},

  { code: 'MAS', name: 'Makueni', registrationSections: [
    { code: 'MKN', name: 'Makueni', county: 'MAS', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'KIB', name: 'Kibwezi', county: 'MAS', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
  ]},

  { code: 'NGW', name: 'Nyandarua', registrationSections: [
    { code: 'OLK', name: 'Ol Kalou', county: 'NGW', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'NDUN', name: 'Ndarua', county: 'NGW', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
  ]},

  { code: 'KIR', name: 'Kirinyaga', registrationSections: [
    { code: 'KRG', name: 'Kerugoya', county: 'KIR', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'KUT', name: 'Kutus', county: 'KIR', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
  ]},

  { code: 'MUR', name: 'Muranga', registrationSections: [
    { code: 'MRG', name: 'Muranga', county: 'MUR', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
    { code: 'KGT', name: 'Kangema', county: 'MUR', hasBlocks: false, utmZone: 37, hemisphere: 'S' },
  ]},

  { code: 'NYE', name: 'Nyamira', registrationSections: [
    { code: 'NYE', name: 'Nyamira', county: 'NYE', hasBlocks: false, utmZone: 36, hemisphere: 'S' },
    { code: 'BOR', name: 'Borabu', county: 'NYE', hasBlocks: false, utmZone: 36, hemisphere: 'S' },
  ]},

  { code: 'BUN', name: 'Bungoma', registrationSections: [
    { code: 'BNG', name: 'Bungoma', county: 'BUN', hasBlocks: false, utmZone: 36, hemisphere: 'N' },
    { code: 'WEB', name: 'Webuye', county: 'BUN', hasBlocks: false, utmZone: 36, hemisphere: 'N' },
  ]},

  { code: 'BUS', name: 'Busia', registrationSections: [
    { code: 'BUS', name: 'Busia', county: 'BUS', hasBlocks: false, utmZone: 36, hemisphere: 'N' },
    { code: 'AK', name: 'AkTES', county: 'BUS', hasBlocks: false, utmZone: 36, hemisphere: 'N' },
  ]},

  { code: 'VIH', name: 'Vihiga', registrationSections: [
    { code: 'VIH', name: 'Vihiga', county: 'VIH', hasBlocks: false, utmZone: 36, hemisphere: 'N' },
    { code: 'LUDA', name: 'Lugari', county: 'VIH', hasBlocks: false, utmZone: 36, hemisphere: 'N' },
  ]},

  { code: 'SIA', name: 'Siaya', registrationSections: [
    { code: 'SIA', name: 'Siaya', county: 'SIA', hasBlocks: false, utmZone: 36, hemisphere: 'N' },
    { code: 'UGUN', name: 'Ugunja', county: 'SIA', hasBlocks: false, utmZone: 36, hemisphere: 'N' },
  ]},

  { code: 'HMB', name: 'Homa Bay', registrationSections: [
    { code: 'HMB', name: 'Homa Bay', county: 'HMB', hasBlocks: false, utmZone: 36, hemisphere: 'S' },
    { code: 'RODI', name: 'Rodi', county: 'HMB', hasBlocks: false, utmZone: 36, hemisphere: 'S' },
  ]},

  { code: 'MIG', name: 'Migori', registrationSections: [
    { code: 'MIG', name: 'Migori', county: 'MIG', hasBlocks: false, utmZone: 36, hemisphere: 'S' },
    { code: 'KEG', name: 'Kehancha', county: 'MIG', hasBlocks: false, utmZone: 36, hemisphere: 'S' },
  ]},

  { code: 'KCHR', name: 'Kisumu', registrationSections: [
    { code: 'KCHR', name: 'Kisumu', county: 'KCHR', hasBlocks: false, utmZone: 36, hemisphere: 'N' },
    { code: 'AWASI', name: 'Awasi', county: 'KCHR', hasBlocks: false, utmZone: 36, hemisphere: 'N' },
  ]},
]

export function getCountyByCode(code: string): KenyaCounty | undefined {
  return KENYA_COUNTIES.find((c: any) => c.code.toUpperCase() === code.toUpperCase())
}

export function getRegistrationSectionByCode(code: string): RegistrationSection | undefined {
  for (const county of KENYA_COUNTIES) {
    const section = county.registrationSections.find((s: any) => 
      s.code.toUpperCase() === code.toUpperCase()
    )
    if (section) return section
  }
  return undefined
}

export function getAllRegistrationSections(): RegistrationSection[] {
  return KENYA_COUNTIES.flatMap(c => c.registrationSections)
}
