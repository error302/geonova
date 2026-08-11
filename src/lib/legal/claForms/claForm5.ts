// ============================================================
// CLA Form 5: Customary Rights Recognition
// Community Land Act No. 27 of 2016
// ============================================================

import jsPDF from 'jspdf'

// ─── Data Interface ───────────────────────────────────────────

export interface ClaForm5Data {
  referenceNumber: string
  communityName: string
  county: string
  subCounty: string
  ward: string
  areaDescription: string
  totalArea: string
  customaryRights: string[]
  historicalPeriod: string
  generationalCount: string
  populationReliant: string
  householdsCount: string
  eldersTestimony: string
  neighboringCommunities: string
  ecologicalFeatures: string
  threatsToRights: string
  applicantName: string
  applicantRole: string
  applicantIdNumber: string
  declarationName: string
  declarationDate: string
}

// ─── PDF Generation ──────────────────────────────────────────

export function generateClaForm5(data: ClaForm5Data): Uint8Array {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const M = 15 // margins
  const contentW = W - M * 2
  const pageBottom = 280

  // Track page number
  let pageNum = 1

  // ── Helpers ──────────────────────────────────────────────────

  function addPageFooter() {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7)
    doc.setTextColor(120, 120, 120)
    doc.text(`CLA Form 5 — Application for Recognition of Customary Land Rights  |  Page ${pageNum}`, W / 2, 290, { align: 'center' })
    doc.setTextColor(0, 0, 0)
  }

  function newPage(): number {
    doc.addPage()
    pageNum++
    const y = 18
    return y
  }

  function ensureSpace(needed: number, y: number): number {
    if (y + needed > pageBottom) {
      y = newPage()
    }
    return y
  }

  function drawHeader(y: number): number {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('REPUBLIC OF KENYA', W / 2, y, { align: 'center' })
    y += 6

    doc.setFontSize(9)
    doc.text('Ministry of Lands and Physical Planning', W / 2, y, { align: 'center' })
    y += 5

    doc.setFontSize(9)
    doc.text('Community Land Act, 2016', W / 2, y, { align: 'center' })
    y += 7

    // Form title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('CLA FORM 5 — Application for Recognition of Customary Land Rights', W / 2, y, { align: 'center' })
    y += 5

    // Reference number
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(`Reference No.: ${data.referenceNumber}`, M, y)
    y += 6

    // Divider
    doc.setDrawColor(27, 58, 92)
    doc.setLineWidth(0.6)
    doc.line(M, y, W - M, y)
    y += 6

    return y
  }

  function sectionHeader(title: string, y: number): number {
    y = ensureSpace(12, y)
    doc.setFillColor(27, 58, 92)
    doc.rect(M, y, contentW, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text(title, M + 3, y + 5)
    doc.setTextColor(0, 0, 0)
    y += 10
    return y
  }

  function fieldRow(label: string, value: string, y: number, labelW: number = 42): number {
    y = ensureSpace(7, y)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.text(label, M, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.text(value || '—', M + labelW, y)
    // underline
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.15)
    doc.line(M + labelW, y + 1, W - M, y + 1)
    y += 7
    return y
  }

  function multiLineField(label: string, value: string, y: number, minHeight: number = 14): number {
    y = ensureSpace(minHeight + 7, y)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.text(label, M, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    const lines = doc.splitTextToSize(value || '—', contentW) as string[]
    lines.forEach((line: string) => {
      y = ensureSpace(5, y)
      doc.text(line, M, y)
      y += 5
    })
    // underline
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.15)
    doc.line(M, y + 1, W - M, y + 1)
    y += 4
    return y
  }

  // ── Build PDF ───────────────────────────────────────────────

  let y = drawHeader(M + 10)

  // Section A: Community and Location Details
  y = sectionHeader('SECTION A — COMMUNITY AND LOCATION DETAILS', y)
  y = fieldRow('Community Name:', data.communityName, y)
  y = fieldRow('County:', data.county, y)
  y = fieldRow('Sub-County:', data.subCounty, y)
  y = fieldRow('Ward:', data.ward, y)
  y += 2

  // Section B: Area Description
  y = sectionHeader('SECTION B — AREA DESCRIPTION', y)
  y = multiLineField('Description of Area:', data.areaDescription, y, 14)
  y = fieldRow('Total Area:', data.totalArea, y)
  y += 2

  // Section C: Customary Rights Schedule
  y = sectionHeader('SECTION C — CUSTOMARY RIGHTS SCHEDULE', y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text('The following customary rights are claimed by the community over the described area:', M, y)
  y += 7

  // Table header for rights
  y = ensureSpace(9, y)
  doc.setFillColor(240, 240, 240)
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.2)
  doc.rect(M, y, contentW, 7, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('No.', M + 3, y + 5)
  doc.text('Description of Customary Right', M + 15, y + 5)
  y += 7

  if (data.customaryRights.length === 0) {
    y = ensureSpace(8, y)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.text('No customary rights listed.', M + 3, y + 5)
    y += 7
  } else {
    data.customaryRights.forEach((right, idx) => {
      // Calculate row height based on text length
      const rightLines = doc.splitTextToSize(right, contentW - 20) as string[]
      const rowH = Math.max(7, rightLines.length * 4.5 + 3)

      y = ensureSpace(rowH + 1, y)
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.1)
      doc.line(M, y, W - M, y)

      // Row background (alternating)
      if (idx % 2 === 0) {
        doc.setFillColor(250, 250, 255)
        doc.rect(M, y, contentW, rowH, 'F')
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text(`${idx + 1}.`, M + 3, y + 5)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      const clampedLines = rightLines.slice(0, 3) // limit for single row
      doc.text(clampedLines.join(' '), M + 15, y + 5)

      y += rowH
    })
  }

  // Table bottom border
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.2)
  doc.line(M, y, W - M, y)
  y += 4

  // Section D: Historical Basis
  y = sectionHeader('SECTION D — HISTORICAL BASIS', y)
  y = fieldRow('Historical Period:', data.historicalPeriod, y)
  y = fieldRow('Generational Count:', data.generationalCount, y)
  y = fieldRow('Population Reliant:', data.populationReliant, y)
  y = fieldRow('Households Count:', data.householdsCount, y)
  y += 2

  // Section E: Environmental and Social Context
  y = sectionHeader('SECTION E — ENVIRONMENTAL AND SOCIAL CONTEXT', y)
  y = multiLineField("Elders' Testimony:", data.eldersTestimony, y, 14)
  y = fieldRow('Neighboring Communities:', data.neighboringCommunities, y)
  y = multiLineField('Ecological Features:', data.ecologicalFeatures, y, 14)
  y = multiLineField('Threats to Rights:', data.threatsToRights, y, 14)
  y += 2

  // Section F: Applicant Details
  y = sectionHeader('SECTION F — APPLICANT DETAILS', y)
  y = fieldRow('Applicant Name:', data.applicantName, y)
  y = fieldRow('Applicant Role:', data.applicantRole, y)
  y = fieldRow('Applicant ID Number:', data.applicantIdNumber, y)
  y += 4

  // ── Declaration ─────────────────────────────────────────────
  y = ensureSpace(40, y)
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.3)
  doc.line(M, y, W - M, y)
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('DECLARATION', M, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  const declText = 'I, the undersigned, hereby declare that the information provided in this application is true and accurate to the best of my knowledge and belief. The customary rights described herein have been exercised by the community for the period stated and are recognized by the community through its traditions, customs, and practices. I understand that any false declaration may lead to the rejection of this application or prosecution under the law.'
  const declLines = doc.splitTextToSize(declText, contentW) as string[]
  declLines.forEach((line: string) => {
    y = ensureSpace(6, y)
    doc.text(line, M, y)
    y += 5
  })
  y += 8

  // Signature block
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('Declared By:', M, y)
  doc.setFont('helvetica', 'normal')
  doc.text(data.declarationName, M + 30, y)
  y += 8

  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.15)
  doc.line(M, y, M + 90, y)
  doc.text('Signature', M, y + 4)
  doc.line(M + 105, y, W - M, y)
  doc.text('Date', M + 105, y + 4)
  doc.text(data.declarationDate, M + 105, y - 3)
  y += 14

  // Witness block
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('Witnessed By:', M, y)
  y += 8

  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.15)
  doc.line(M, y, M + 90, y)
  doc.text('Name & Signature of Witness', M, y + 4)
  doc.line(M + 105, y, W - M, y)
  doc.text('Date', M + 105, y + 4)
  y += 14

  // Stamp box
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.2)
  doc.rect(M, y, 50, 20)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7)
  doc.text('Official Stamp / Seal', M + 5, y + 11)

  // ── Page footer ─────────────────────────────────────────────
  addPageFooter()

  return doc.output('arraybuffer') as unknown as Uint8Array
}
