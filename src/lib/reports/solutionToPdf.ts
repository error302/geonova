import type jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

import type { Solution } from '@/lib/solution/schema'

const MARGIN_X = 15

function nextY(doc: jsPDF, fallback: number) {
  const last = (doc as any).lastAutoTable?.finalY
  return typeof last === 'number' ? last : fallback
}

function ensurePageRoom(doc: jsPDF, y: number, neededMm: number) {
  const pageHeight = doc.internal.pageSize.getHeight()
  const bottom = pageHeight - 15
  if (y + neededMm > bottom) {
    doc.addPage()
    return 20
  }
  return y
}

export function appendSolutionToPdf(doc: jsPDF, solution: Solution, startY: number): number {
  let y = ensurePageRoom(doc, startY, 16)

  doc.setTextColor(20, 20, 25)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(solution.title || 'Solution', MARGIN_X, y)
  y += 4

  // Given
  autoTable(doc, {
    startY: y,
    head: [['Given', 'Value']],
    body: solution.given.map((g: any) => [g.label, g.value]),
    margin: { left: MARGIN_X, right: MARGIN_X },
    styles: { fontSize: 8, cellPadding: 1.6, overflow: 'linebreak' },
    headStyles: { fillColor: [15, 15, 20], textColor: [232, 132, 26], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 'auto' } },
  })
  y = nextY(doc, y) + 2

  // To Find
  autoTable(doc, {
    startY: y,
    head: [['To Find']],
    body: solution.toFind.map((t: any) => [t]),
    margin: { left: MARGIN_X, right: MARGIN_X },
    styles: { fontSize: 8, cellPadding: 1.6, overflow: 'linebreak' },
    headStyles: { fillColor: [15, 15, 20], textColor: [232, 132, 26], fontStyle: 'bold' },
  })
  y = nextY(doc, y) + 2

  // Solution steps
  autoTable(doc, {
    startY: y,
    head: [['Step', 'Formula', 'Substitution', 'Computation', 'Result']],
    body: solution.solution.map((s, i) => [
      s.title || `Step ${i + 1}`,
      s.formula || '',
      s.substitution || '',
      s.computation || '',
      s.result || '',
    ]),
    margin: { left: MARGIN_X, right: MARGIN_X },
    styles: { fontSize: 7, cellPadding: 1.4, overflow: 'linebreak' },
    headStyles: { fillColor: [15, 15, 20], textColor: [232, 132, 26], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: 'bold' },
      1: { cellWidth: 36 },
      2: { cellWidth: 44 },
      3: { cellWidth: 44 },
      4: { cellWidth: 24, fontStyle: 'bold' },
    },
  })
  y = nextY(doc, y) + 2

  // Check (optional)
  if (solution.check && solution.check.length > 0) {
    y = ensurePageRoom(doc, y, 12)
    autoTable(doc, {
      startY: y,
      head: [['Check', 'Value']],
      body: solution.check.map((c: any) => [c.label, c.value]),
      margin: { left: MARGIN_X, right: MARGIN_X },
      styles: { fontSize: 8, cellPadding: 1.6, overflow: 'linebreak' },
      headStyles: { fillColor: [15, 15, 20], textColor: [232, 132, 26], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 'auto' } },
    })
    y = nextY(doc, y) + 2
  }

  // Result
  y = ensurePageRoom(doc, y, 12)
  autoTable(doc, {
    startY: y,
    head: [['Result', 'Value']],
    body: solution.result.map((r: any) => [r.label, r.value]),
    margin: { left: MARGIN_X, right: MARGIN_X },
    styles: { fontSize: 8, cellPadding: 1.6, overflow: 'linebreak' },
    headStyles: { fillColor: [15, 15, 20], textColor: [232, 132, 26], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 'auto' } },
  })

  return nextY(doc, y) + 6
}

