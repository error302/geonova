// ============================================================
// METARDU — RIM PDF Generator (Resurvey and Index Map)
// Professional A3 Landscape output for Kenya cadastral use
// Survey Act Cap 299, Survey Regulations L.N. 168/1994
//
// Uses A3 Landscape (420mm × 297mm) as a close substitute for
// A1/A0 RIM sheets. jsPDF has limited large-format support;
// A3 landscape provides sufficient space for RIM content while
// remaining printable on standard large-format plotters.
//
// Styling aligns with CLA form patterns:
//   - Dark navy section headers: rgb(27, 58, 92)
//   - 15mm margins
//   - Professional border framing
// ============================================================

import jsPDF from 'jspdf'
import type { RimSection, RimParcel, RimBeacon } from './db'

// A3 Landscape dimensions in mm (420 × 297)
const PAGE_W = 420
const PAGE_H = 297
const MARGIN = 15

// Navy colour used across CLA forms and RIM headers
const NAVY: [number, number, number] = [27, 58, 92]

export function generateRimPdf(
  section: RimSection,
  parcels: RimParcel[],
  beacons: RimBeacon[],
): Uint8Array {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a3',
  })

  const contentW = PAGE_W - MARGIN * 2
  let y = MARGIN

  // ── Outer & inner border ────────────────────────────────────
  doc.setDrawColor(0)
  doc.setLineWidth(0.6)
  doc.rect(MARGIN, MARGIN, contentW, PAGE_H - MARGIN * 2)
  doc.setLineWidth(0.25)
  doc.rect(MARGIN + 1.5, MARGIN + 1.5, contentW - 3, PAGE_H - MARGIN * 2 - 3)

  const left = MARGIN + 4
  const right = PAGE_W - MARGIN - 4
  const innerW = right - left

  // ────────────────────────────────────────────────────────────
  // 1. HEADER BLOCK
  // ────────────────────────────────────────────────────────────

  y = MARGIN + 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(0, 0, 0)
  doc.text('REPUBLIC OF KENYA', PAGE_W / 2, y, { align: 'center' })

  y += 7
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('Ministry of Lands and Physical Planning', PAGE_W / 2, y, { align: 'center' })

  y += 7
  doc.setDrawColor(0)
  doc.setLineWidth(0.4)
  doc.line(left, y, right, y)

  y += 7
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...NAVY)
  doc.text('RESURVEY AND INDEX MAP', PAGE_W / 2, y, { align: 'center' })

  // Reset text colour
  doc.setTextColor(0, 0, 0)

  y += 9
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(`Section: ${section.section_name || '\u2014'}`, left, y)
  doc.text(`Registry: ${section.registry || '\u2014'}`, left + 130, y)
  doc.text(`District / County: ${section.district || '\u2014'}`, left + 230, y)

  y += 6
  doc.text(`Map Sheet No: ${section.map_sheet_number || '\u2014'}`, left, y)
  doc.text(`Scale: ${section.scale || '\u2014'}`, left + 130, y)
  doc.text(`Datum: ${section.datum || '\u2014'}`, left + 230, y)

  y += 6
  doc.text(`Projection: ${section.projection || '\u2014'}`, left, y)
  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
  doc.text(`Date: ${today}`, left + 130, y)
  doc.text(`Total Area: ${section.total_area.toFixed(4)} Ha`, left + 230, y)

  y += 3
  doc.setDrawColor(...NAVY)
  doc.setLineWidth(0.5)
  doc.line(left, y, right, y)

  // ────────────────────────────────────────────────────────────
  // 2. PARCEL REGISTER TABLE
  // ────────────────────────────────────────────────────────────

  y += 6
  sectionHeader(doc, 'PARCEL REGISTER', left, y, innerW)
  y += 10

  if (parcels.length > 0) {
    const head = [['No.', 'Parcel Number', 'Area (Ha)', 'Land Use', 'Owner', 'Beacons']]

    const body: string[][] = parcels.map((p, i) => [
      String(i + 1),
      p.parcel_number,
      p.area.toFixed(4),
      p.land_use || '\u2014',
      p.owner_name || '\u2014',
      String(p.beacon_count),
    ])

    // Total row
    const totalArea = parcels.reduce((sum, p) => sum + p.area, 0)
    const totalBeacons = parcels.reduce((sum, p) => sum + p.beacon_count, 0)
    body.push(['', 'TOTAL', totalArea.toFixed(4), '', '', String(totalBeacons)])

    // Column widths (total = innerW ≈ 386mm)
    const colW = [12, 80, 45, 70, 110, 25] // remainder fills last column

    drawTable(doc, {
      head,
      body,
      startY: y,
      columnWidths: colW,
      fontSize: 8,
      headerBg: NAVY,
      alternateRowColor: [240, 244, 248] as [number, number, number],
      highlightLastRow: true,
    })

    // Get final Y position after table
    const tableEnd = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
    y = tableEnd ? tableEnd + 6 : y + parcels.length * 7 + 10
  } else {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text('No parcels recorded for this RIM section.', left + 4, y)
    doc.setTextColor(0)
    y += 10
  }

  // ────────────────────────────────────────────────────────────
  // 3. BEACON SCHEDULE
  // ────────────────────────────────────────────────────────────

  // Check if there's enough space; if not, add new page
  if (y > PAGE_H - MARGIN - 80) {
    doc.addPage()
    y = MARGIN + 10
  }

  sectionHeader(doc, 'BEACON SCHEDULE', left, y, innerW)
  y += 10

  if (beacons.length > 0) {
    const head = [['No.', 'Beacon No.', 'Easting', 'Northing', 'Type', 'Description', 'Status']]

    const body: string[][] = beacons.map((b, i) => [
      String(i + 1),
      b.beacon_number,
      b.easting.toFixed(3),
      b.northing.toFixed(3),
      b.type || 'Pillar',
      b.description || '\u2014',
      b.survey_status || 'Original',
    ])

    const colW = [12, 45, 55, 55, 35, 110, 50]

    drawTable(doc, {
      head,
      body,
      startY: y,
      columnWidths: colW,
      fontSize: 7.5,
      headerBg: NAVY,
      alternateRowColor: [240, 244, 248] as [number, number, number],
      // Highlight beacons with "Not Found" or "Replaced" status
      statusHighlight: {
        column: 6,
        values: ['Not Found', 'Replaced'],
        color: [255, 230, 230] as [number, number, number],
      },
    })

    const tableEnd = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
    y = tableEnd ? tableEnd + 6 : y + beacons.length * 7 + 10
  } else {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text('No beacons recorded for this RIM section.', left + 4, y)
    doc.setTextColor(0)
    y += 10
  }

  // ────────────────────────────────────────────────────────────
  // 4. NOTES SECTION
  // ────────────────────────────────────────────────────────────

  if (y > PAGE_H - MARGIN - 65) {
    doc.addPage()
    y = MARGIN + 10
  }

  sectionHeader(doc, 'NOTES AND REMARKS', left, y, innerW)
  y += 10

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(40)

  const notes = section.notes || 'No additional notes for this RIM section.'
  const notesLines = doc.splitTextToSize(notes, innerW - 8) as string[]
  notesLines.forEach((line: string) => {
    if (y > PAGE_H - MARGIN - 55) {
      doc.addPage()
      y = MARGIN + 10
    }
    doc.text(line, left + 4, y)
    y += 5
  })

  doc.setTextColor(0)

  // ────────────────────────────────────────────────────────────
  // 5. FOOTER
  // ────────────────────────────────────────────────────────────

  // Position footer at fixed location near page bottom
  const footerY = PAGE_H - MARGIN - 40

  // Separator line
  doc.setDrawColor(...NAVY)
  doc.setLineWidth(0.4)
  doc.line(left, footerY, right, footerY)

  // Surveyor certification block
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('SURVEYOR CERTIFICATION', left, footerY + 7)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')

  // Name and ISK fields
  const certY = footerY + 14
  doc.text('Name: ____________________________', left, certY)
  doc.text('ISK Registration No: ____________________________', left + 180, certY)

  const sigY = certY + 10
  doc.text('Signature: ____________________________', left, sigY)
  doc.text('Date: ____________________________', left + 180, sigY)

  // Watermark / generated-by line
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7)
  doc.setTextColor(130)
  doc.text(
    'This RIM has been prepared using METARDU',
    PAGE_W / 2,
    PAGE_H - MARGIN - 6,
    { align: 'center' },
  )

  // Page number
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(100)
    doc.text(`Page ${i} of ${totalPages}`, right, PAGE_H - MARGIN - 6, { align: 'right' })
  }

  return doc.output('arraybuffer') as unknown as Uint8Array
}

// ────────────────────────────────────────────────────────────
// Helper: Navy section header bar
// ────────────────────────────────────────────────────────────

function sectionHeader(
  doc: jsPDF,
  title: string,
  x: number,
  y: number,
  w: number,
) {
  doc.setFillColor(...NAVY)
  doc.rect(x, y, w, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text(title, x + 3, y + 5)
  doc.setTextColor(0, 0, 0)
}

// ────────────────────────────────────────────────────────────
// Helper: Draw a styled table with optional features
//
// NOTE: This is a manual table renderer to avoid requiring
// jspdf-autotable as a dependency. If autotable is available,
// this can be swapped out for autoTable() calls.
// ────────────────────────────────────────────────────────────

interface TableOptions {
  head: string[][]
  body: string[][]
  startY: number
  columnWidths: number[]
  fontSize: number
  headerBg: [number, number, number]
  alternateRowColor: [number, number, number]
  highlightLastRow?: boolean
  statusHighlight?: {
    column: number
    values: string[]
    color: [number, number, number]
  }
}

function drawTable(doc: jsPDF, opts: TableOptions) {
  const { head, body, startY, columnWidths, fontSize, headerBg, alternateRowColor } = opts
  const x = MARGIN + 4 // left edge of content
  const rowH = 6.5
  const headerH = 7
  let currentY = startY

  // ── Header row ────────────────────────────────────────────
  doc.setFillColor(...headerBg)
  doc.rect(x, currentY, columnWidths.reduce((a, b) => a + b, 0), headerH, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(fontSize)
  doc.setTextColor(255, 255, 255)

  let colX = x
  head[0].forEach((cell, ci) => {
    const w = columnWidths[ci] || 40
    doc.text(cell, colX + 2, currentY + headerH - 2)
    colX += w
  })

  doc.setTextColor(0, 0, 0)
  currentY += headerH

  // ── Body rows ─────────────────────────────────────────────
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(fontSize)

  body.forEach((row, ri) => {
    const isLast = opts.highlightLastRow && ri === body.length - 1
    const isAlternate = ri % 2 === 1

    // Row background
    if (isLast) {
      doc.setFillColor(220, 230, 241)
      doc.rect(x, currentY, columnWidths.reduce((a, b) => a + b, 0), rowH, 'F')
      doc.setFont('helvetica', 'bold')
    } else if (isAlternate) {
      doc.setFillColor(...alternateRowColor)
      doc.rect(x, currentY, columnWidths.reduce((a, b) => a + b, 0), rowH, 'F')
    }

    // Check for status highlight
    const statusCol = opts.statusHighlight?.column
    if (statusCol !== undefined && opts.statusHighlight) {
      const cellVal = row[statusCol]
      if (cellVal && opts.statusHighlight.values.includes(cellVal)) {
        // Calculate position of the status column cell
        let cellX = x
        for (let c = 0; c < statusCol; c++) {
          cellX += columnWidths[c] || 40
        }
        const cellW = columnWidths[statusCol] || 40
        doc.setFillColor(...opts.statusHighlight.color)
        doc.rect(cellX, currentY, cellW, rowH, 'F')
      }
    }

    // Row text
    colX = x
    row.forEach((cell, ci) => {
      const w = columnWidths[ci] || 40
      const isFirstCol = ci === 0
      const isNumericCol = ci === 2 || ci === 3 || ci === 5 // area, northing, beacons
      doc.text(cell, colX + (isFirstCol ? 2 : 2), currentY + rowH - 2, {
        align: isFirstCol || isNumericCol ? 'center' : 'left',
      })
      colX += w
    })

    // Row border
    doc.setDrawColor(200)
    doc.setLineWidth(0.15)
    doc.line(x, currentY + rowH, x + columnWidths.reduce((a, b) => a + b, 0), currentY + rowH)

    if (isLast) {
      doc.setFont('helvetica', 'normal')
    }

    currentY += rowH
  })

  // Outer table border
  doc.setDrawColor(0)
  doc.setLineWidth(0.3)
  const tableH = headerH + body.length * rowH
  const tableW = columnWidths.reduce((a, b) => a + b, 0)
  doc.rect(x, startY, tableW, tableH)

  // Store final Y for caller reference
  ;(doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable = { finalY: currentY + 2 }
}
