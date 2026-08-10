// ============================================================
// CLA Form 9: Application for Community Land Lease
// Community Land Act No. 27 of 2016, Section 36
// (Exported via claForm7 module as per project conventions)
// ============================================================

import jsPDF from 'jspdf'

/**
 * Input interface for CLA Form 9 — Application for Community Land Lease.
 * Captures all required details for an individual or entity applying to
 * lease community land, as required under Section 36 of the Community
 * Land Act 2016.
 */
export interface ClaForm7Data {
  /** Lease application reference number */
  leaseNumber: string
  /** Registered name of the community */
  communityName: string
  /** County where the land is situated */
  county: string
  /** Sub-county where the land is situated */
  subCounty: string
  /** Ward where the land is situated */
  ward: string
  /** Parcel number of the community land */
  parcelNumber: string
  /** Full legal name of the lessee (applicant) */
  lesseeName: string
  /** National ID number or registration number of the lessee */
  lesseeIdNumber: string
  /** Physical or postal address of the lessee */
  lesseeAddress: string
  /** Telephone number of the lessee */
  lesseePhone: string
  /** Type of lease being applied for */
  leaseType: 'Agricultural' | 'Commercial' | 'Residential' | 'Industrial' | 'Pastoral' | 'Other'
  /** Duration of the proposed lease (e.g. "99 years") */
  leaseDuration: string
  /** Proposed lease commencement date (DD/MM/YYYY) */
  leaseStart: string
  /** Proposed annual rent in KES */
  annualRent: string
  /** Summary of the intended development plan */
  developmentPlan: string
  /** Land use restrictions applicable to the lease */
  landUseRestrictions: string
  /** Any special conditions attached to the lease */
  specialConditions: string
  /** Date the community committee approved the application (DD/MM/YYYY) */
  committeeApprovalDate: string
  /** Resolution number of the committee approval */
  committeeResolutionNumber: string
  /** Full name of the first witness */
  witness1Name: string
  /** ID number of the first witness */
  witness1Id: string
  /** Full name of the second witness */
  witness2Name: string
  /** ID number of the second witness */
  witness2Id: string
  /** Name of the person making the declaration */
  declarationName: string
  /** Date of the declaration (DD/MM/YYYY) */
  declarationDate: string
}

/**
 * Generates CLA Form 9: Application for Community Land Lease.
 *
 * Produces a structured application form covering lessee particulars,
 * land description, lease terms, development plans, community committee
 * approval, witness attestation, and the applicant's statutory declaration.
 *
 * @param data - Structured data conforming to {@link ClaForm7Data}
 * @returns PDF document as a Uint8Array
 */
export function generateClaForm7(data: ClaForm7Data): Uint8Array {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const margin = 15
  const contentWidth = W - margin * 2
  const pageCount = { value: 1 }

  // ── Helper: add page footer with page number ────────────────
  function addPageFooter() {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(100, 100, 100)
    doc.text(
      `CLA Form 9 — Page ${pageCount.value} of {total}`,
      W / 2,
      290,
      { align: 'center' }
    )
    doc.setTextColor(0, 0, 0)
  }

  // ── Government Header ────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('REPUBLIC OF KENYA', W / 2, 18, { align: 'center' })

  doc.setFontSize(10)
  doc.text('Ministry of Lands and Physical Planning', W / 2, 26, { align: 'center' })

  doc.setFontSize(9)
  doc.text('Community Land Act 2016', W / 2, 33, { align: 'center' })

  // Form title
  doc.setLineWidth(0.6)
  doc.line(margin, 37, W - margin, 37)

  doc.setFontSize(12)
  doc.text('CLA FORM 9', W / 2, 44, { align: 'center' })
  doc.setFontSize(10)
  doc.text('Application for Community Land Lease', W / 2, 51, { align: 'center' })

  doc.setLineWidth(0.3)
  doc.line(margin, 55, W - margin, 55)

  // Reference row
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(`Lease No: ${data.leaseNumber}`, margin, 61)
  doc.text(`Declaration Date: ${data.declarationDate}`, W - margin, 61, { align: 'right' })

  let y = 68
  const lineH = 7

  // ── Helper functions ────────────────────────────────────────
  function sectionHeader(title: string) {
    if (y > 255) {
      addPageFooter()
      doc.addPage()
      pageCount.value++
      y = 15
    }
    doc.setFillColor(27, 58, 92)
    doc.rect(margin, y, contentWidth, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text(title, margin + 3, y + 5)
    doc.setTextColor(0, 0, 0)
    y += 9.5
  }

  function fieldRow(
    label1: string,
    value1: string,
    label2: string,
    value2: string,
    labelW = 35,
  ) {
    if (y > 275) {
      addPageFooter()
      doc.addPage()
      pageCount.value++
      y = 15
    }
    const colWidth = contentWidth / 2
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(label1, margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(value1 || '\u2014', margin + labelW, y)
    doc.setLineWidth(0.1)
    doc.line(margin + labelW, y + 1, margin + colWidth - 3, y + 1)

    doc.setFont('helvetica', 'bold')
    doc.text(label2, margin + colWidth, y)
    doc.setFont('helvetica', 'normal')
    doc.text(value2 || '\u2014', margin + colWidth + labelW, y)
    doc.line(margin + colWidth + labelW, y + 1, W - margin, y + 1)
    y += lineH
  }

  function fieldFull(label: string, value: string, labelW = 35) {
    if (y > 275) {
      addPageFooter()
      doc.addPage()
      pageCount.value++
      y = 15
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(label, margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(value || '\u2014', margin + labelW, y)
    doc.setLineWidth(0.1)
    doc.line(margin + labelW, y + 1, W - margin, y + 1)
    y += lineH
  }

  function textBlock(label: string, value: string) {
    if (y > 265) {
      addPageFooter()
      doc.addPage()
      pageCount.value++
      y = 15
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(label, margin, y)
    y += 5

    // Draw text area box
    const boxHeight = Math.max(18, (doc.splitTextToSize(value || ' ', contentWidth) as string[]).length * 4.5 + 4)
    doc.setDrawColor(150, 150, 150)
    doc.setLineWidth(0.15)
    doc.rect(margin, y, contentWidth, boxHeight)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const lines = doc.splitTextToSize(value || '\u2014', contentWidth - 6) as string[]
    lines.forEach((line) => {
      if (y > 275) {
        addPageFooter()
        doc.addPage()
        pageCount.value++
        y = 15
      }
      doc.text(line, margin + 3, y + 4)
      y += 4.5
    })
    if (y < 15 + boxHeight) y = 15 + boxHeight
    y += 4
    doc.setDrawColor(0, 0, 0)
  }

  function witnessBlock(label: string, name: string, id: string) {
    if (y > 265) {
      addPageFooter()
      doc.addPage()
      pageCount.value++
      y = 15
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(label, margin, y)
    y += lineH
    fieldRow('Full Name:', name, 'ID Number:', id)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setLineWidth(0.15)
    doc.line(margin, y, margin + 80, y)
    doc.text('Signature', margin, y + 4)
    doc.line(margin + 95, y, W - margin, y)
    doc.text('Date', margin + 95, y + 4)
    y += 12
  }

  function signatureLine(label: string) {
    if (y > 265) {
      addPageFooter()
      doc.addPage()
      pageCount.value++
      y = 15
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(label, margin, y)
    y += 6

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setLineWidth(0.15)
    doc.line(margin, y, margin + 80, y)
    doc.text('Signature', margin, y + 4)

    doc.line(margin + 95, y, margin + 140, y)
    doc.text('Date', margin + 95, y + 4)

    doc.line(margin + 155, y, W - margin, y)
    doc.text('Stamp / Seal', margin + 155, y + 4)
    y += 12
  }

  // ── Section A: Lessee Information ───────────────────────────
  sectionHeader('SECTION A: LESSEE INFORMATION')
  fieldFull('Lessee Name:', data.lesseeName, 35)
  fieldRow('ID Number:', data.lesseeIdNumber, 'Phone:', data.lesseePhone)
  fieldFull('Address:', data.lesseeAddress, 35)
  y += 2

  // ── Section B: Land Description ─────────────────────────────
  sectionHeader('SECTION B: LAND DESCRIPTION')
  fieldRow('Community:', data.communityName, 'County:', data.county)
  fieldRow('Sub-County:', data.subCounty, 'Ward:', data.ward)
  fieldFull('Parcel Number:', data.parcelNumber, 35)
  y += 2

  // ── Section C: Lease Terms ──────────────────────────────────
  sectionHeader('SECTION C: LEASE TERMS')
  fieldRow('Lease Type:', data.leaseType, 'Duration:', data.leaseDuration)
  fieldRow('Start Date:', data.leaseStart, 'Annual Rent (KES):', data.annualRent)
  y += 2

  // ── Section D: Development and Restrictions ─────────────────
  sectionHeader('SECTION D: DEVELOPMENT AND RESTRICTIONS')
  textBlock('Development Plan:', data.developmentPlan)
  textBlock('Land Use Restrictions:', data.landUseRestrictions)
  textBlock('Special Conditions:', data.specialConditions)
  y += 2

  // ── Section E: Community Approval ───────────────────────────
  sectionHeader('SECTION E: COMMUNITY COMMITTEE APPROVAL')
  fieldRow(
    'Approval Date:',
    data.committeeApprovalDate,
    'Resolution No:',
    data.committeeResolutionNumber,
  )

  // Certification statement
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  y += 3
  const approvalText =
    'I certify that the Community Land Management Committee has considered this ' +
    'application in accordance with Section 36 of the Community Land Act 2016 ' +
    'and the applicant has met all requirements for the proposed lease.'
  const approvalLines = doc.splitTextToSize(approvalText, contentWidth) as string[]
  approvalLines.forEach((line) => {
    if (y > 275) {
      addPageFooter()
      doc.addPage()
      pageCount.value++
      y = 15
    }
    doc.text(line, margin, y)
    y += 4.5
  })
  y += 4

  signatureLine('Committee Chairperson:')
  signatureLine('County Land Officer:')
  y += 2

  // ── Section F: Witnesses ────────────────────────────────────
  sectionHeader('SECTION F: WITNESSES')
  witnessBlock('Witness 1:', data.witness1Name, data.witness1Id)
  witnessBlock('Witness 2:', data.witness2Name, data.witness2Id)
  y += 2

  // ── Declaration ─────────────────────────────────────────────
  sectionHeader('DECLARATION')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const declarationText =
    'I, ' +
    data.declarationName +
    ', do hereby solemnly and sincerely declare that the information ' +
    'provided in this application is true and correct to the best of my knowledge ' +
    'and belief. I understand that any false or misleading statement may result in ' +
    'the rejection of this application or the cancellation of any lease granted ' +
    'pursuant to this application, and may constitute an offence under the laws of Kenya.'
  const declLines = doc.splitTextToSize(declarationText, contentWidth) as string[]
  declLines.forEach((line) => {
    if (y > 275) {
      addPageFooter()
      doc.addPage()
      pageCount.value++
      y = 15
    }
    doc.text(line, margin, y)
    y += 4.5
  })
  y += 4

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(`Declared by: ${data.declarationName}`, margin, y)
  y += lineH
  doc.text(`Date: ${data.declarationDate}`, margin, y)
  y += 10

  signatureLine('Declarant Signature:')

  // ── Final footer ────────────────────────────────────────────
  addPageFooter()

  // Resolve total page count placeholder
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(100, 100, 100)
    doc.setFillColor(255, 255, 255)
    doc.rect(margin, 287, contentWidth, 5, 'F')
    doc.text(
      `CLA Form 9 — Application for Community Land Lease  |  Page ${p} of ${totalPages}`,
      W / 2,
      291,
      { align: 'center' },
    )
    doc.setTextColor(0, 0, 0)
  }

  return doc.output('arraybuffer') as unknown as Uint8Array
}
