// ============================================================
// CLA Form 2: Community Land Claim Form
// Community Land Act No. 27 of 2016, Section 13
// ============================================================

import jsPDF from 'jspdf'

// ── Page Constants ────────────────────────────────────────────
const PAGE_W = 210
const PAGE_H = 297
const MARGIN_L = 15
const MARGIN_R = 15
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R
const DARK_BLUE: [number, number, number] = [27, 58, 92]
const LIGHT_GREY: [number, number, number] = [240, 240, 240]

/**
 * Witness entry for the community land claim form.
 */
export interface WitnessEntry {
  /** Full name of the witness */
  name: string
  /** National ID number of the witness */
  idNumber: string
  /** Phone number of the witness */
  phone: string
}

/**
 * Input data interface for CLA Form 2 — Community Land Claim.
 * All fields correspond to data required under Section 13 of the Community Land Act 2016.
 */
export interface ClaForm2Data {
  /** Claim reference number */
  claimNumber: string
  /** Registered or recognized name of the community */
  communityName: string
  /** County where the community land is situated */
  county: string
  /** Sub-county within the county */
  subCounty: string
  /** Ward within the sub-county */
  ward: string
  /** Parcel or land reference number */
  parcelNumber: string
  /** Full name of the claimant */
  claimantName: string
  /** National ID number of the claimant */
  claimantIdNumber: string
  /** Phone number of the claimant */
  claimantPhone: string
  /** Type of claim being made */
  claimType: 'Historical' | 'Customary' | 'Transitional' | 'Other'
  /** Detailed description of the claim */
  claimDescription: string
  /** Description of historical occupation of the land */
  historicalOccupation: string
  /** Period of occupation (e.g., "Since 1963" or "Over 50 years") */
  periodOfOccupation: string
  /** Number of households residing on or using the land */
  numberOfHouseholds: string
  /** Approximate total area of the claimed land */
  approximateArea: string
  /** Array of witnesses supporting the claim */
  witnesses: WitnessEntry[]
  /** Name of the person making the declaration */
  declarationName: string
  /** Date of declaration (DD/MM/YYYY) */
  declarationDate: string
}

/**
 * Generates CLA Form 2: Community Land Claim.
 *
 * This form is used to lodge a claim for community land under Section 13 of the
 * Community Land Act 2016. It captures claim details, claimant information,
 * land description, the nature of the claim, supporting witnesses, and a declaration.
 *
 * @param data - Structured data conforming to {@link ClaForm2Data}
 * @returns PDF document as a Uint8Array
 */
export function generateClaForm2(data: ClaForm2Data): Uint8Array {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  let y = 0

  // ── Helper: draw a full-width horizontal rule ───────────────
  function rule(yPos: number, lineWidth = 0.4): void {
    doc.setLineWidth(lineWidth)
    doc.line(MARGIN_L, yPos, PAGE_W - MARGIN_R, yPos)
  }

  // ── Helper: draw a section header bar ───────────────────────
  function sectionHeader(title: string): void {
    if (y > 260) { doc.addPage(); addFooter(doc, doc.getNumberOfPages()); y = 20 }
    doc.setFillColor(...DARK_BLUE)
    doc.rect(MARGIN_L, y, CONTENT_W, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text(title, MARGIN_L + 3, y + 5.5)
    doc.setTextColor(0, 0, 0)
    y += 12
  }

  // ── Helper: draw a two-column table row ─────────────────────
  function tableRow(label: string, value: string, col2Label?: string, col2Value?: string): void {
    if (y > 272) { doc.addPage(); addFooter(doc, doc.getNumberOfPages()); y = 20 }
    const rowH = 8
    const colW = CONTENT_W / 2

    doc.setFillColor(...LIGHT_GREY)
    doc.rect(MARGIN_L, y, colW * 0.45, rowH, 'F')
    doc.rect(MARGIN_L + colW * 0.45, y, colW * 0.55, rowH, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(label, MARGIN_L + 2, y + 5.5)
    doc.setFont('helvetica', 'normal')
    doc.text(value || '\u2014', MARGIN_L + colW * 0.45 + 2, y + 5.5)

    if (col2Label !== undefined) {
      doc.rect(MARGIN_L + colW, y, colW * 0.45, rowH, 'F')
      doc.rect(MARGIN_L + colW + colW * 0.45, y, colW * 0.55, rowH, 'F')
      doc.setFont('helvetica', 'bold')
      doc.text(col2Label, MARGIN_L + colW + 2, y + 5.5)
      doc.setFont('helvetica', 'normal')
      doc.text(col2Value || '\u2014', MARGIN_L + colW + colW * 0.45 + 2, y + 5.5)
    }

    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.15)
    doc.rect(MARGIN_L, y, CONTENT_W, rowH, 'S')
    if (col2Label !== undefined) {
      doc.line(MARGIN_L + colW, y, MARGIN_L + colW, y + rowH)
    }
    doc.line(MARGIN_L + colW * 0.45, y, MARGIN_L + colW * 0.45, y + rowH)
    if (col2Label !== undefined) {
      doc.line(MARGIN_L + colW + colW * 0.45, y, MARGIN_L + colW + colW * 0.45, y + rowH)
    }
    doc.setDrawColor(0, 0, 0)

    y += rowH
  }

  // ── Helper: draw a full-width table row ─────────────────────
  function fullRow(label: string, value: string): void {
    if (y > 272) { doc.addPage(); addFooter(doc, doc.getNumberOfPages()); y = 20 }
    const rowH = 8
    const labelW = CONTENT_W * 0.4
    const valW = CONTENT_W * 0.6

    doc.setFillColor(...LIGHT_GREY)
    doc.rect(MARGIN_L, y, labelW, rowH, 'F')
    doc.rect(MARGIN_L + labelW, y, valW, rowH, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(label, MARGIN_L + 2, y + 5.5)
    doc.setFont('helvetica', 'normal')
    doc.text(value || '\u2014', MARGIN_L + labelW + 2, y + 5.5)

    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.15)
    doc.rect(MARGIN_L, y, CONTENT_W, rowH, 'S')
    doc.line(MARGIN_L + labelW, y, MARGIN_L + labelW, y + rowH)
    doc.setDrawColor(0, 0, 0)

    y += rowH
  }

  // ── Helper: multi-line text block ───────────────────────────
  function textBlock(label: string, text: string, minHeight = 16): void {
    if (y > 255) { doc.addPage(); addFooter(doc, doc.getNumberOfPages()); y = 20 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(label, MARGIN_L, y)
    y += 5

    const boxH = Math.max(minHeight, 8)
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.15)
    doc.rect(MARGIN_L, y, CONTENT_W, boxH, 'S')
    doc.setDrawColor(0, 0, 0)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const lines = doc.splitTextToSize(text || '\u2014', CONTENT_W - 4) as string[]
    lines.forEach((line, i: number) => {
      if (i < Math.floor(boxH / 4.5)) {
        doc.text(line, MARGIN_L + 2, y + 4 + i * 4.5)
      }
    })

    // If text overflows, extend the box
    const neededH = lines.length * 4.5 + 4
    if (neededH > boxH) {
      doc.setDrawColor(180, 180, 180)
      doc.rect(MARGIN_L, y, CONTENT_W, neededH, 'S')
      doc.setDrawColor(0, 0, 0)
      lines.forEach((line, i: number) => {
        if (y + 4 + i * 4.5 > 275) {
          doc.addPage()
          addFooter(doc, doc.getNumberOfPages())
          y = 20
        }
        doc.text(line, MARGIN_L + 2, y + 4 + i * 4.5)
      })
      y += neededH
    } else {
      y += boxH
    }
  }

  // ── Helper: add page number footer ──────────────────────────
  function addFooter(pdfDoc: jsPDF, pageNum: number): void {
    pdfDoc.setFont('helvetica', 'italic')
    pdfDoc.setFontSize(7.5)
    pdfDoc.setTextColor(120, 120, 120)
    pdfDoc.text(
      `Community Land Act 2016 — CLA Form 2  |  Page ${pageNum}`,
      PAGE_W / 2,
      PAGE_H - 10,
      { align: 'center' }
    )
    pdfDoc.setTextColor(0, 0, 0)
  }

  // ════════════════════════════════════════════════════════════
  // PAGE 1 — HEADER
  // ════════════════════════════════════════════════════════════
  y = 15

  // Coat of arms placeholder
  doc.setDrawColor(...DARK_BLUE)
  doc.setLineWidth(0.3)
  doc.rect(PAGE_W / 2 - 10, y, 20, 20, 'S')
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(6)
  doc.setTextColor(120, 120, 120)
  doc.text('COAT OF ARMS', PAGE_W / 2, y + 11, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  y += 24

  // Government header text
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('REPUBLIC OF KENYA', PAGE_W / 2, y, { align: 'center' })
  y += 7
  doc.setFontSize(11)
  doc.text('Ministry of Lands and Physical Planning', PAGE_W / 2, y, { align: 'center' })
  y += 6
  doc.setFontSize(10)
  doc.text('Community Land Act, 2016', PAGE_W / 2, y, { align: 'center' })
  y += 8

  rule(y, 0.6)
  y += 5

  // Form title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setFillColor(...DARK_BLUE)
  doc.rect(MARGIN_L, y, CONTENT_W, 10, 'F')
  doc.setTextColor(255, 255, 255)
  doc.text('CLA FORM 2 \u2014 Community Land Claim', PAGE_W / 2, y + 7, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  y += 14

  // Reference info
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text(`Claim No: ${data.claimNumber}`, MARGIN_L, y)
  y += 8

  rule(y, 0.2)
  y += 6

  // ════════════════════════════════════════════════════════════
  // SECTION A — CLAIM DETAILS
  // ════════════════════════════════════════════════════════════
  sectionHeader('SECTION A: CLAIM DETAILS')
  tableRow('Claim Number:', data.claimNumber, 'Claim Type:', data.claimType)
  tableRow('Community Name:', data.communityName, 'County:', data.county)
  tableRow('Sub-County:', data.subCounty, 'Ward:', data.ward)
  y += 4

  // ════════════════════════════════════════════════════════════
  // SECTION B — CLAIMANT INFORMATION
  // ════════════════════════════════════════════════════════════
  sectionHeader('SECTION B: CLAIMANT INFORMATION')
  tableRow('Claimant Name:', data.claimantName, 'ID Number:', data.claimantIdNumber)
  fullRow('Phone Number:', data.claimantPhone)
  y += 4

  // ════════════════════════════════════════════════════════════
  // SECTION C — LAND DESCRIPTION
  // ════════════════════════════════════════════════════════════
  sectionHeader('SECTION C: LAND DESCRIPTION')
  fullRow('Parcel Number:', data.parcelNumber)
  fullRow('Approximate Area:', data.approximateArea)
  y += 4

  // ════════════════════════════════════════════════════════════
  // SECTION D — NATURE OF CLAIM
  // ════════════════════════════════════════════════════════════
  sectionHeader('SECTION D: NATURE OF CLAIM')

  // Claim type indicator
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Type of Claim:', MARGIN_L, y)
  y += 5

  const claimTypes: Array<'Historical' | 'Customary' | 'Transitional' | 'Other'> = ['Historical', 'Customary', 'Transitional', 'Other']
  let xPos = MARGIN_L + 5
  claimTypes.forEach((ct) => {
    const isChecked = ct === data.claimType
    const marker = isChecked ? '\u2611' : '\u2610'
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const textW = doc.getTextWidth(`${marker}  ${ct}`)
    if (xPos + textW > PAGE_W - MARGIN_R) {
      xPos = MARGIN_L + 5
      y += 6
    }
    doc.text(`${marker}  ${ct}`, xPos, y)
    xPos += textW + 8
  })
  y += 8

  fullRow('Period of Occupation:', data.periodOfOccupation)
  fullRow('Number of Households:', data.numberOfHouseholds)
  y += 2

  textBlock('Historical Occupation:', data.historicalOccupation, 16)
  y += 2

  textBlock('Claim Description:', data.claimDescription, 20)
  y += 4

  // ════════════════════════════════════════════════════════════
  // SECTION E — WITNESSES TABLE
  // ════════════════════════════════════════════════════════════
  sectionHeader('SECTION E: WITNESSES')

  // Table header
  if (y > 260) { doc.addPage(); addFooter(doc, doc.getNumberOfPages()); y = 20 }
  const wCols = [MARGIN_L, MARGIN_L + 8, MARGIN_L + 75, MARGIN_L + 110, MARGIN_L + 145]
  const wHeaders = ['No.', 'Witness Name', 'ID Number', 'Phone']
  // Header row
  doc.setFillColor(...DARK_BLUE)
  doc.rect(MARGIN_L, y, CONTENT_W, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(255, 255, 255)
  wHeaders.forEach((h, i) => doc.text(h, wCols[i] + 2, y + 5))
  doc.setTextColor(0, 0, 0)
  y += 7

  // Data rows
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const witnesses = data.witnesses.length > 0 ? data.witnesses : []
  for (let i = 0; i < Math.max(witnesses.length, 3); i++) {
    if (y > 270) { doc.addPage(); addFooter(doc, doc.getNumberOfPages()); y = 20 }
    const rowH = 7

    // Alternate row shading
    if (i % 2 === 0) {
      doc.setFillColor(248, 248, 248)
      doc.rect(MARGIN_L, y, CONTENT_W, rowH, 'F')
    }

    const witness = witnesses[i]
    doc.text(`${i + 1}`, wCols[0] + 2, y + 5)
    doc.text(witness?.name || '', wCols[1] + 2, y + 5)
    doc.text(witness?.idNumber || '', wCols[2] + 2, y + 5)
    doc.text(witness?.phone || '', wCols[3] + 2, y + 5)

    // Row border
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.1)
    doc.rect(MARGIN_L, y, CONTENT_W, rowH, 'S')
    doc.setDrawColor(0, 0, 0)

    y += rowH
  }
  y += 4

  // ════════════════════════════════════════════════════════════
  // DECLARATION SECTION
  // ════════════════════════════════════════════════════════════
  if (y > 230) { doc.addPage(); addFooter(doc, doc.getNumberOfPages()); y = 20 }

  sectionHeader('DECLARATION')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const declLines = [
    'I, the undersigned, hereby declare that the information provided in this claim is true',
    'and correct to the best of my knowledge and belief. I understand that this claim is subject',
    'to verification by the County Land Management Board and that any false or misleading',
    'information may result in the rejection of this claim and may constitute an offence under',
    'the laws of Kenya.',
  ]
  declLines.forEach((line: string) => {
    if (y > 275) { doc.addPage(); addFooter(doc, doc.getNumberOfPages()); y = 20 }
    doc.text(line, MARGIN_L, y)
    y += 5
  })
  y += 4

  tableRow('Declaration By:', data.declarationName, 'Date:', data.declarationDate)
  y += 6

  // Signature block
  if (y > 260) { doc.addPage(); addFooter(doc, doc.getNumberOfPages()); y = 20 }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('Signature of Claimant:', MARGIN_L, y)
  doc.setLineWidth(0.1)
  doc.line(MARGIN_L + 38, y + 1, MARGIN_L + 100, y + 1)
  doc.text('Date:', MARGIN_L + 110, y)
  doc.line(MARGIN_L + 122, y + 1, PAGE_W - MARGIN_R, y + 1)
  y += 12

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text('(This space is reserved for the official use of the Ministry of Lands and Physical Planning)', MARGIN_L, y)
  y += 8

  // Official use section
  doc.setDrawColor(...DARK_BLUE)
  doc.setLineWidth(0.3)
  doc.rect(MARGIN_L, y, CONTENT_W, 20, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...DARK_BLUE)
  doc.text('FOR OFFICIAL USE ONLY', PAGE_W / 2, y + 6, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text('Received by: ________________________    Date: ________________    Stamp: ________________________', MARGIN_L + 5, y + 14)
  doc.setDrawColor(0, 0, 0)

  // ── Footer on every page ────────────────────────────────────
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    addFooter(doc, p)
  }

  return doc.output('arraybuffer') as unknown as Uint8Array
}
