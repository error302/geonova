// ============================================================
// CLA Form 6: Community Land Interests / Entry in Register
// Community Land Act No. 27 of 2016
// ============================================================

import jsPDF from 'jspdf'

/**
 * Input interface for CLA Form 6 — Community Land Interests / Entry in Register.
 * Records the registration of interests (customary, leasehold, freehold,
 * easements, restrictions) against community land parcels as required
 * under the Community Land Act 2016.
 */
export interface ClaForm6Data {
  /** Unique sequential entry number in the register */
  entryNumber: string
  /** Page number in the register where this entry is recorded */
  registerPage: string
  /** Registered name of the community */
  communityName: string
  /** County where the land is situated */
  county: string
  /** Sub-county where the land is situated */
  subCounty: string
  /** Ward where the land is situated */
  ward: string
  /** Parcel number assigned to the land */
  parcelNumber: string
  /** Type of interest being registered */
  interestType: 'Customary' | 'Leasehold' | 'Freehold' | 'Easement' | 'Restriction'
  /** Name of the interest holder */
  interestHolder: string
  /** National ID or registration number of the interest holder */
  interestHolderId: string
  /** Description of the nature and scope of the interest */
  natureOfInterest: string
  /** Date the interest was created or recognized (DD/MM/YYYY) */
  dateCreated: string
  /** Monetary consideration amount (if applicable) */
  considerationAmount: string
  /** Survey plan number referenced in the entry */
  surveyPlanNumber: string
  /** Previous register entry number (for amendments) */
  previousEntry: string
  /** Details of any amendments to the entry */
  amendmentDetails: string
  /** Name of the authorizing officer */
  authorizedOfficer: string
  /** Title/designation of the authorizing officer */
  officerTitle: string
  /** Date the entry was recorded in the register (DD/MM/YYYY) */
  entryDate: string
}

/**
 * Generates CLA Form 6: Community Land Interests / Entry in Register.
 *
 * Produces an official register entry form documenting an interest in
 * community land, including register details, interest particulars,
 * land description, financial information, previous registration references,
 * and officer certification.
 *
 * @param data - Structured data conforming to {@link ClaForm6Data}
 * @returns PDF document as a Uint8Array
 */
export function generateClaForm6(data: ClaForm6Data): Uint8Array {
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
      `CLA Form 6 — Page ${pageCount.value} of {total}`,
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
  doc.text('CLA FORM 6', W / 2, 44, { align: 'center' })
  doc.setFontSize(10)
  doc.text('Community Land Interests / Entry in Register', W / 2, 51, { align: 'center' })

  doc.setLineWidth(0.3)
  doc.line(margin, 55, W - margin, 55)

  // Reference row
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(`Entry No: ${data.entryNumber}`, margin, 61)
  doc.text(`Date of Entry: ${data.entryDate}`, W - margin, 61, { align: 'right' })

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
    const boxHeight = Math.max(20, (doc.splitTextToSize(value || ' ', contentWidth) as string[]).length * 4.5 + 4)
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
    if (y < 15 + boxHeight) y = 15 + boxHeight // ensure full box
    y += 4
    doc.setDrawColor(0, 0, 0)
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

  // ── Section A: Register Details ─────────────────────────────
  sectionHeader('SECTION A: REGISTER DETAILS')
  fieldRow('Entry Number:', data.entryNumber, 'Register Page:', data.registerPage)
  fieldFull('Parcel Number:', data.parcelNumber, 35)
  y += 2

  // ── Section B: Interest Details ─────────────────────────────
  sectionHeader('SECTION B: INTEREST DETAILS')
  fieldRow('Interest Type:', data.interestType, 'Date Created:', data.dateCreated)
  fieldFull('Interest Holder:', data.interestHolder, 35)
  fieldFull('Interest Holder ID:', data.interestHolderId, 35)
  textBlock('Nature of Interest:', data.natureOfInterest)
  y += 2

  // ── Section C: Land Details ─────────────────────────────────
  sectionHeader('SECTION C: LAND DETAILS')
  fieldRow('Community Name:', data.communityName, 'County:', data.county)
  fieldRow('Sub-County:', data.subCounty, 'Ward:', data.ward)
  fieldFull('Survey Plan Number:', data.surveyPlanNumber, 35)
  y += 2

  // ── Section D: Financial Details ────────────────────────────
  sectionHeader('SECTION D: FINANCIAL DETAILS')
  fieldFull('Consideration Amount:', data.considerationAmount || 'None', 35)
  y += 2

  // ── Section E: Previous Registration ────────────────────────
  sectionHeader('SECTION E: PREVIOUS REGISTRATION (IF AMENDMENT)')
  fieldFull('Previous Entry No:', data.previousEntry || 'N/A', 35)
  textBlock('Amendment Details:', data.amendmentDetails || 'N/A — Original entry')
  y += 2

  // ── Section F: Authorized Officer Certification ─────────────
  sectionHeader('SECTION F: AUTHORIZED OFFICER CERTIFICATION')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const certText =
    'I, the undersigned Authorized Officer, hereby certify that the interest described ' +
    'in this form has been duly entered in the Community Land Register in accordance ' +
    'with the Community Land Act 2016 and the regulations thereunder. The particulars ' +
    'recorded herein are true and accurate to the best of my knowledge and belief.'

  const certLines = doc.splitTextToSize(certText, contentWidth) as string[]
  certLines.forEach((line) => {
    if (y > 275) {
      addPageFooter()
      doc.addPage()
      pageCount.value++
      y = 15
    }
    doc.text(line, margin, y)
    y += 4.5
  })
  y += 6

  fieldRow('Officer Name:', data.authorizedOfficer, 'Title:', data.officerTitle)

  // Signature lines
  signatureLine('Authorized Officer Signature:')

  // ── Final footer ────────────────────────────────────────────
  addPageFooter()

  // Resolve total page count placeholder
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(100, 100, 100)
    // Overwrite the placeholder line
    doc.setFillColor(255, 255, 255)
    doc.rect(margin, 287, contentWidth, 5, 'F')
    doc.text(
      `CLA Form 6 — Community Land Interests / Entry in Register  |  Page ${p} of ${totalPages}`,
      W / 2,
      291,
      { align: 'center' },
    )
    doc.setTextColor(0, 0, 0)
  }

  return doc.output('arraybuffer') as unknown as Uint8Array
}
