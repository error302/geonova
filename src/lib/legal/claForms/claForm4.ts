// ============================================================
// CLA Form 4: Community Land Committee Registration
// Community Land Act No. 27 of 2016
// ============================================================

import jsPDF from 'jspdf'

// ─── Data Interface ───────────────────────────────────────────

export interface ClaForm4Data {
  registrationNumber: string
  communityName: string
  county: string
  subCounty: string
  ward: string
  registeredMembers: string
  totalLandArea: string
  committeeName: string
  dateEstablished: string
  termExpiry: string
  chairman: { name: string; idNumber: string; phone: string; signature: string }
  secretary: { name: string; idNumber: string; phone: string }
  treasurer: { name: string; idNumber: string; phone: string }
  members: Array<{ name: string; idNumber: string; role: string }>
  meetingSchedule: string
  bankAccountName: string
  bankAccountNumber: string
  declarationName: string
  declarationDate: string
}

// ─── PDF Generation ──────────────────────────────────────────

export function generateClaForm4(data: ClaForm4Data): Uint8Array {
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
    doc.text(`CLA Form 4 — Community Land Committee Registration  |  Page ${pageNum}`, W / 2, 290, { align: 'center' })
    doc.setTextColor(0, 0, 0)
  }

  function newPage() {
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
    doc.text('CLA FORM 4 — Community Land Committee Registration', W / 2, y, { align: 'center' })
    y += 5

    // Registration number
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(`Registration No.: ${data.registrationNumber}`, M, y)
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

  function drawTableHeader(cols: Array<{ label: string; w: number }>, y: number): number {
    y = ensureSpace(10, y)
    let x = M
    doc.setFillColor(240, 240, 240)
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.2)
    const rowH = 7
    doc.rect(M, y, contentW, rowH, 'FD')
    cols.forEach((col) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text(col.label, x + 2, y + 5)
      x += col.w
    })
    y += rowH
    return y
  }

  function drawTableRow(cols: Array<{ text: string; w: number }>, y: number, rowH: number = 7): number {
    y = ensureSpace(rowH + 2, y)
    let x = M
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.1)
    doc.line(M, y, W - M, y)
    cols.forEach((col) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      const lines = doc.splitTextToSize(col.text || '—', col.w - 4) as string[]
      doc.text(lines[0], x + 2, y + 5)
      x += col.w
    })
    y += rowH
    return y
  }

  function drawTableRowBottom(y: number): number {
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.2)
    doc.line(M, y, W - M, y)
    return y
  }

  // ── Build PDF ───────────────────────────────────────────────

  let y = drawHeader(M + 10)

  // Section A: Community Details
  y = sectionHeader('SECTION A — COMMUNITY DETAILS', y)
  y = fieldRow('Community Name:', data.communityName, y)
  y = fieldRow('County:', data.county, y)
  y = fieldRow('Sub-County:', data.subCounty, y)
  y = fieldRow('Ward:', data.ward, y)
  y = fieldRow('Registered Members:', data.registeredMembers, y)
  y = fieldRow('Total Land Area:', data.totalLandArea, y)
  y += 2

  // Section B: Committee Information
  y = sectionHeader('SECTION B — COMMITTEE INFORMATION', y)
  y = fieldRow('Committee Name:', data.committeeName, y)
  y = fieldRow('Date Established:', data.dateEstablished, y)
  y = fieldRow('Term Expiry Date:', data.termExpiry, y)
  y += 2

  // Section C: Committee Officials Table
  y = sectionHeader('SECTION C — COMMITTEE OFFICIALS', y)

  const officialCols = [
    { label: 'Office', w: 35 },
    { label: 'Full Name', w: 60 },
    { label: 'ID Number', w: 35 },
    { label: 'Phone', w: 40 },
  ]

  y = drawTableHeader(officialCols, y)
  y = drawTableRow([
    { text: 'Chairman', w: 35 },
    { text: data.chairman.name, w: 60 },
    { text: data.chairman.idNumber, w: 35 },
    { text: data.chairman.phone, w: 40 },
  ], y)
  y = drawTableRow([
    { text: 'Secretary', w: 35 },
    { text: data.secretary.name, w: 60 },
    { text: data.secretary.idNumber, w: 35 },
    { text: data.secretary.phone, w: 40 },
  ], y)
  y = drawTableRow([
    { text: 'Treasurer', w: 35 },
    { text: data.treasurer.name, w: 60 },
    { text: data.treasurer.idNumber, w: 35 },
    { text: data.treasurer.phone, w: 40 },
  ], y)
  y = drawTableRowBottom(y)

  // Chairman signature line
  y += 3
  y = ensureSpace(12, y)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text("Chairman's Signature:", M, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(data.chairman.signature, M + 45, y)
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.15)
  doc.line(M + 45, y + 1, W - M, y + 1)
  y += 10

  // Section D: Committee Members Table
  y = sectionHeader('SECTION D — COMMITTEE MEMBERS', y)

  const memberCols = [
    { label: 'No.', w: 12 },
    { label: 'Full Name', w: 65 },
    { label: 'ID Number', w: 40 },
    { label: 'Role / Designation', w: contentW - 12 - 65 - 40 },
  ]

  y = drawTableHeader(memberCols, y)

  if (data.members.length === 0) {
    y = drawTableRow([
      { text: '', w: 12 },
      { text: 'No additional members listed.', w: 65 },
      { text: '', w: 40 },
      { text: '', w: contentW - 12 - 65 - 40 },
    ], y)
  } else {
    data.members.forEach((member, idx) => {
      y = drawTableRow([
        { text: `${idx + 1}.`, w: 12 },
        { text: member.name, w: 65 },
        { text: member.idNumber, w: 40 },
        { text: member.role, w: contentW - 12 - 65 - 40 },
      ], y)
    })
  }
  y = drawTableRowBottom(y)

  y += 4

  // Section E: Administrative Details
  y = sectionHeader('SECTION E — ADMINISTRATIVE DETAILS', y)
  y = fieldRow('Meeting Schedule:', data.meetingSchedule, y)
  y = fieldRow('Bank Account Name:', data.bankAccountName, y)
  y = fieldRow('Bank Account Number:', data.bankAccountNumber, y)
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
  const declText = 'I, the undersigned, hereby declare that the information provided in this form is true and correct to the best of my knowledge. The committee has been established in accordance with the Community Land Act, 2016 and the community has been duly consulted in the nomination and appointment of all committee members listed herein.'
  const declLines = doc.splitTextToSize(declText, contentW)
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
  y += 12

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
