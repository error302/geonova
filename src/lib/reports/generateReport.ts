import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { bearingToString } from '../engine/angles'
import type { Solution } from '@/lib/solution/schema'
import { appendSolutionToPdf } from '@/lib/reports/solutionToPdf'

interface ReportOptions {
  project: {
    name: string
    location: string
    utm_zone: number
    hemisphere: string
    created_at: string
    survey_type?: string
    client_name?: string | null
    surveyor_name?: string | null
  }
  points: Array<{
    name: string
    easting: number
    northing: number
    elevation: number
    is_control: boolean
  }>
  traverse?: {
    legs: Array<{
      fromName: string
      toName: string
      distance: number
      rawBearing: number
      rawDeltaE: number
      rawDeltaN: number
      adjustedDeltaE: number
      adjustedDeltaN: number
    }>
    closingErrorE: number
    closingErrorN: number
    linearError: number
    precisionRatio: number
    precisionGrade: string
    totalDistance: number
  }
  area?: {
    squareMeters: number
    hectares: number
    acres: number
    perimeter: number
  }
  solutions?: Solution[]
}

export function generateSurveyReport(options: ReportOptions, onBlob?: (blob: Blob, filename: string) => void): void {
  const { project, points, traverse, area, solutions } = options
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  
  const amber = [232, 132, 26] as [number, number, number]
  const dark = [15, 15, 20] as [number, number, number]
  const white = [255, 255, 255] as [number, number, number]
  const gray = [200, 200, 200] as [number, number, number]

  doc.setFillColor(...dark)
  doc.rect(0, 0, 210, 35, 'F')
  
  doc.setTextColor(...amber)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('GEONOVA', 15, 15)
  
  doc.setTextColor(...white)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Professional Surveying Platform', 15, 22)
  
  doc.setFontSize(9)
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { 
    day: '2-digit', month: 'long', year: 'numeric' 
  })}`, 15, 29)

  doc.setTextColor(...dark)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(project.name.toUpperCase(), 15, 48)
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text(`Location: ${project.location}`, 15, 55)
  doc.text(`UTM Zone: ${project.utm_zone}${project.hemisphere}`, 15, 61)
  doc.text(`Datum: WGS84`, 15, 67)
  
  let yPos = 75
  if (project.client_name || project.surveyor_name || project.survey_type) {
    doc.setFontSize(8)
    if (project.client_name) {
      doc.text(`Client: ${project.client_name}`, 15, yPos)
      yPos += 5
    }
    if (project.surveyor_name) {
      doc.text(`Surveyor: ${project.surveyor_name}`, 15, yPos)
      yPos += 5
    }
    if (project.survey_type) {
      doc.text(`Survey Type: ${project.survey_type}`, 15, yPos)
      yPos += 5
    }
  }

  doc.setDrawColor(...amber)
  doc.setLineWidth(0.8)
  doc.line(15, yPos, 195, yPos)

  yPos += 8

  doc.setTextColor(...dark)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('SURVEY COORDINATES', 15, yPos)
  yPos += 6

  autoTable(doc, {
    startY: yPos,
    head: [['Point', 'Easting (m)', 'Northing (m)', 'Elevation (m)', 'Type']],
    body: points.map(p => [
      p.name,
      p.easting.toFixed(4),
      p.northing.toFixed(4),
      p.elevation.toFixed(3),
      p.is_control ? 'Control' : 'Survey'
    ]),
    headStyles: {
      fillColor: dark,
      textColor: amber,
      fontStyle: 'bold',
      fontSize: 9
    },
    bodyStyles: { fontSize: 8, textColor: [30, 30, 30] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'center' }
    },
    margin: { left: 15, right: 15 }
  })

  yPos = (doc as any).lastAutoTable.finalY + 12

  if (traverse) {
    if (yPos > 230) { doc.addPage(); yPos = 20 }

    doc.setTextColor(...dark)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('TRAVERSE ADJUSTMENT — BOWDITCH METHOD', 15, yPos)
    yPos += 6

    autoTable(doc, {
      startY: yPos,
      head: [['Line', 'Dist (m)', 'Bearing', 'ΔN Raw', 'ΔE Raw', 'Corr N', 'Corr E', 'Adj ΔN', 'Adj ΔE']],
      body: traverse.legs.map(l => {
        return [
          `${l.fromName}→${l.toName}`,
          l.distance.toFixed(2),
          bearingToString(l.rawBearing),
          l.rawDeltaN.toFixed(4),
          l.rawDeltaE.toFixed(4),
          (l.adjustedDeltaN - l.rawDeltaN).toFixed(4),
          (l.adjustedDeltaE - l.rawDeltaE).toFixed(4),
          l.adjustedDeltaN.toFixed(4),
          l.adjustedDeltaE.toFixed(4)
        ]
      }),
      headStyles: {
        fillColor: dark,
        textColor: amber,
        fontStyle: 'bold',
        fontSize: 7
      },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 15, right: 15 }
    })

    yPos = (doc as any).lastAutoTable.finalY + 8

    doc.setFillColor(245, 245, 245)
    doc.rect(15, yPos, 180, 32, 'F')
    doc.setDrawColor(...amber)
    doc.rect(15, yPos, 180, 32, 'S')

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 30, 30)
    doc.text(`Total Distance: ${traverse.totalDistance.toFixed(2)} m`, 20, yPos + 7)
    doc.text(`Closing Error E: ${traverse.closingErrorE.toFixed(4)} m`, 20, yPos + 13)
    doc.text(`Closing Error N: ${traverse.closingErrorN.toFixed(4)} m`, 20, yPos + 19)
    doc.text(`Linear Misclosure: ${traverse.linearError.toFixed(4)} m`, 20, yPos + 25)
    
    doc.setFont('helvetica', 'bold')
    doc.text(`Precision Ratio: 1 : ${Math.round(traverse.precisionRatio).toLocaleString()}`, 110, yPos + 13)
    
    const gradeColor = traverse.precisionGrade === 'excellent' || traverse.precisionGrade === 'good' 
      ? [0, 150, 0] : [200, 0, 0]
    doc.setTextColor(...gradeColor as [number, number, number])
    doc.setFontSize(10)
    doc.text(`Grade: ${traverse.precisionGrade.toUpperCase()}`, 110, yPos + 22)
    
    yPos += 42
  }

  if (area) {
    if (yPos > 240) { doc.addPage(); yPos = 20 }

    doc.setTextColor(...dark)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('PARCEL AREA COMPUTATION', 15, yPos)
    yPos += 8

    doc.setFillColor(245, 245, 245)
    doc.rect(15, yPos, 180, 28, 'F')
    doc.setDrawColor(...amber)
    doc.rect(15, yPos, 180, 28, 'S')

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 30, 30)
    doc.text(`Area: ${area.squareMeters.toFixed(4)} m²`, 20, yPos + 8)
    doc.text(`Area: ${area.hectares.toFixed(6)} ha`, 20, yPos + 15)
    doc.text(`Area: ${area.acres.toFixed(4)} acres`, 20, yPos + 22)
    doc.setFont('helvetica', 'bold')
    doc.text(`Perimeter: ${area.perimeter.toFixed(4)} m`, 110, yPos + 15)
    yPos += 36
  }

  if (solutions && solutions.length > 0) {
    if (yPos > 220) {
      doc.addPage()
      yPos = 20
    }

    doc.setTextColor(...dark)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('CALCULATION WORKINGS', 15, yPos)
    yPos += 6

    for (const s of solutions) {
      yPos = appendSolutionToPdf(doc, s, yPos)
    }
  }

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFillColor(...dark)
    doc.rect(0, 282, 210, 15, 'F')
    doc.setTextColor(...gray)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text('Generated by METARDU — Professional Surveying Platform', 15, 290)
    doc.text(`Page ${i} of ${pageCount}`, 185, 290, { align: 'right' })
  }

  const date = new Date().toISOString().slice(0, 10)
  const filename = `${project.name.replace(/\s+/g, '_')}_${date}_Survey_Report.pdf`
  
  if (onBlob) {
    const blob = doc.output('blob')
    onBlob(blob, filename)
  }
  
  doc.save(filename)
}

interface SurveyPlanOptions {
  project: {
    name: string
    location: string
    utm_zone: number
    hemisphere: string
    created_at: string
  }
  points: Array<{
    name: string
    easting: number
    northing: number
    elevation?: number | null
    is_control: boolean
    control_order?: string
  }>
  parcel?: {
    name: string
    boundary_points: Array<{ name: string; easting: number; northing: number }>
    area_sqm: number
    area_ha: number
    area_acres: number
    perimeter_m: number
  } | null
  traverse?: {
    legs: Array<{ fromName: string; toName: string; distance: number; bearing: number }>
  }
}

export function generateSurveyPlan(options: SurveyPlanOptions, onBlob?: (blob: Blob, filename: string) => void): void {
  const { project, points, parcel, traverse } = options
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  
  const amber = [232, 132, 26] as [number, number, number]
  const dark = [15, 15, 20] as [number, number, number]
  const white = [255, 255, 255] as [number, number, number]
  const gray = [120, 120, 120] as [number, number, number]
  const lightGray = [230, 230, 230] as [number, number, number]

  const bounds = getBounds(points)

  // Layout (A4 landscape: 297×210mm)
  const margin = 10
  const titleBlockW = 70
  const titleBlockX = 297 - margin - titleBlockW
  const titleBlockY = margin
  const titleBlockH = 210 - margin * 2

  const frameGap = 6
  const drawingX = margin
  const drawingY = 28
  const drawingW = titleBlockX - drawingX - frameGap
  const drawingH = 115

  const frame = { x: drawingX, y: drawingY, w: drawingW, h: drawingH, padding: 10 }
  const transform = createPlanTransform(bounds, frame)

  // Header band
  doc.setFillColor(...dark)
  doc.rect(0, 0, 297, 20, 'F')

  doc.setTextColor(...amber)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('GEONOVA', 10, 14)

  doc.setTextColor(...white)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('SURVEY PLAN', 60, 14)

  doc.setTextColor(...dark)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(project.name.toUpperCase(), 10, 32)
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text(`Location: ${project.location || 'N/A'}`, 10, 38)
  doc.text(`UTM Zone: ${project.utm_zone}${project.hemisphere}`, 10, 43)
  doc.text(`Datum: WGS84`, 80, 38)
  doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, 80, 43)
  doc.text(`Scale: 1:${transform.ratio.toLocaleString()}`, 160, 38)

  doc.setDrawColor(...amber)
  doc.setLineWidth(0.5)
  doc.line(10, 47, 287, 47)

  // Title block
  drawTitleBlock(doc, {
    x: titleBlockX,
    y: titleBlockY,
    w: titleBlockW,
    h: titleBlockH,
    amber,
    dark,
    white,
    project: {
      name: project.name,
      location: project.location || 'N/A',
      utm: `${project.utm_zone}${project.hemisphere}`,
      datum: 'WGS84',
      date: new Date().toLocaleDateString('en-GB'),
      scale: `1:${transform.ratio.toLocaleString()}`,
      drawingNo: `GN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-4)}`,
    }
  })

  // Drawing frame + grid + plan content
  drawFrame(doc, frame, amber)
  drawGrid(doc, frame, transform, gray, lightGray)
  drawNorthArrow(doc, frame.x + frame.w - 20, frame.y + 18, amber)
  drawScaleBar(doc, frame.x + 8, frame.y + frame.h - 10, transform, dark, white)

  const pointMap = new Map(points.map(p => [p.name, p]))
  
  if (parcel?.boundary_points) {
    drawParcelBoundary(doc, parcel.boundary_points, transform, amber)
    drawParcelLabels(doc, parcel.boundary_points, transform, gray)
  } else if (traverse?.legs) {
    drawTraverseLines(doc, traverse.legs, pointMap, transform, amber)
  }

  drawPoints(doc, points, frame, transform, amber, dark)

  // Page 2: schedules (coordinates + parcel computations) for a clean, client-ready plan sheet.
  doc.addPage()
  let yPos = 18

  doc.setFillColor(...dark)
  doc.rect(0, 0, 297, 16, 'F')
  doc.setTextColor(...amber)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('SCHEDULES', 10, 11)

  yPos = 24
  doc.setFillColor(...dark)
  doc.rect(10, yPos, 277, 8, 'F')
  doc.setTextColor(...amber)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('COORDINATE LIST', 12, yPos + 5.5)

  autoTable(doc, {
    startY: yPos + 10,
    head: [['Point', 'Easting (m)', 'Northing (m)', 'Elevation (m)', 'Type']],
    body: points.map(p => [
      p.name,
      p.easting.toFixed(4),
      p.northing.toFixed(4),
      p.elevation?.toFixed(3) || '—',
      p.is_control ? (p.control_order === 'primary' ? 'Primary Control' : p.control_order === 'secondary' ? 'Secondary Control' : 'Control') : 'Survey Point'
    ]),
    headStyles: {
      fillColor: dark,
      textColor: amber,
      fontStyle: 'bold',
      fontSize: 8
    },
    bodyStyles: { fontSize: 7, textColor: [30, 30, 30] },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 15 },
      1: { halign: 'right', cellWidth: 35 },
      2: { halign: 'right', cellWidth: 35 },
      3: { halign: 'right', cellWidth: 25 },
      4: { halign: 'center', cellWidth: 35 }
    },
    margin: { left: 10, right: 10 },
    theme: 'grid'
  })

  if (parcel && parcel.boundary_points.length > 0) {
    yPos = (doc as any).lastAutoTable.finalY + 10
    
    if (yPos > 160) {
      doc.addPage()
      yPos = 20
    }

    doc.setFillColor(...dark)
    doc.rect(10, yPos, 277, 8, 'F')
    doc.setTextColor(...amber)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('PARCEL COMPUTATION', 12, yPos + 5.5)

    const lines: string[][] = []
    for (let i = 0; i < parcel.boundary_points.length; i++) {
      const from = parcel.boundary_points[i]
      const to = parcel.boundary_points[(i + 1) % parcel.boundary_points.length]
      const db = distanceBearingSimple(from, to)
      lines.push([
        `${from.name} → ${to.name}`,
        db.bearing,
        `${db.distance.toFixed(2)} m`
      ])
    }

    autoTable(doc, {
      startY: yPos + 10,
      head: [['Line', 'Bearing', 'Distance']],
      body: lines,
      headStyles: {
        fillColor: dark,
        textColor: amber,
        fontStyle: 'bold',
        fontSize: 8
      },
      bodyStyles: { fontSize: 7, textColor: [30, 30, 30] },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'center' },
        2: { halign: 'right' }
      },
      margin: { left: 10, right: 10 },
      theme: 'grid'
    })

    yPos = (doc as any).lastAutoTable.finalY + 8
    doc.setFillColor(248, 248, 248)
    doc.rect(10, yPos, 277, 20, 'F')
    doc.setDrawColor(...amber)
    doc.rect(10, yPos, 277, 20, 'S')
    
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text(`Area: ${parcel.area_sqm.toFixed(4)} m²`, 15, yPos + 8)
    doc.text(`${parcel.area_ha.toFixed(6)} ha`, 100, yPos + 8)
    doc.text(`${parcel.area_acres.toFixed(4)} acres`, 160, yPos + 8)
    doc.text(`Perimeter: ${parcel.perimeter_m.toFixed(2)} m`, 15, yPos + 16)
  }

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFillColor(...dark)
    doc.rect(0, 180, 297, 12, 'F')
    doc.setTextColor(...gray)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text('Generated by METARDU — Professional Surveying Platform', 10, 186)
    doc.text(`Page ${i} of ${pageCount}`, 280, 186, { align: 'right' })
  }

  const filename = `${project.name.replace(/\s+/g, '_')}_Survey_Plan.pdf`
  
  if (onBlob) {
    const blob = doc.output('blob')
    onBlob(blob, filename)
  }
  
  doc.save(filename)
}

type Bounds = { minE: number; maxE: number; minN: number; maxN: number }
type PlanFrame = { x: number; y: number; w: number; h: number; padding: number }
type PlanTransform = {
  bounds: Bounds
  ratio: number
  mmPerM: number
  originX: number
  originY: number
  contentW: number
  contentH: number
  toX: (easting: number) => number
  toY: (northing: number) => number
}

function getBounds(points: { easting: number; northing: number }[]): Bounds {
  let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity
  for (const p of points) {
    minE = Math.min(minE, p.easting)
    maxE = Math.max(maxE, p.easting)
    minN = Math.min(minN, p.northing)
    maxN = Math.max(maxN, p.northing)
  }
  return { minE, maxE, minN, maxN }
}

function pickNiceScaleRatio(raw: number) {
  const candidates = [50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000]
  for (const c of candidates) if (c >= raw) return c
  return candidates[candidates.length - 1]
}

function createPlanTransform(bounds: Bounds, frame: PlanFrame): PlanTransform {
  const rangeE = Math.max(0, bounds.maxE - bounds.minE)
  const rangeN = Math.max(0, bounds.maxN - bounds.minN)

  const innerW = Math.max(1, frame.w - frame.padding * 2)
  const innerH = Math.max(1, frame.h - frame.padding * 2)

  // raw 1:N required to fit extents inside the frame (units: mm on paper vs mm on ground)
  // N = (range(m) * 1000 mm/m) / paper(mm)
  const rawRatio = Math.max((rangeE * 1000) / innerW, (rangeN * 1000) / innerH, 1)
  const ratio = pickNiceScaleRatio(rawRatio)
  const mmPerM = 1000 / ratio

  const contentW = rangeE * mmPerM
  const contentH = rangeN * mmPerM

  const originX = frame.x + (frame.w - contentW) / 2
  const originY = frame.y + frame.h - (frame.h - contentH) / 2

  return {
    bounds,
    ratio,
    mmPerM,
    originX,
    originY,
    contentW,
    contentH,
    toX: (e) => originX + (e - bounds.minE) * mmPerM,
    toY: (n) => originY - (n - bounds.minN) * mmPerM,
  }
}

function drawFrame(doc: any, frame: PlanFrame, amber: [number, number, number]) {
  doc.setDrawColor(...amber)
  doc.setLineWidth(0.6)
  doc.rect(frame.x, frame.y, frame.w, frame.h, 'S')

  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.2)
  doc.rect(frame.x + 1, frame.y + 1, frame.w - 2, frame.h - 2, 'S')
}

function pickGridSpacingM(mmPerM: number) {
  const candidates = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]
  // Aim for ~15–30 mm between grid lines on paper
  for (const c of candidates) {
    const mm = c * mmPerM
    if (mm >= 12 && mm <= 30) return c
  }
  return candidates[candidates.length - 1]
}

function drawGrid(
  doc: any,
  frame: PlanFrame,
  transform: PlanTransform,
  gray: [number, number, number],
  lightGray: [number, number, number]
) {
  const spacingM = pickGridSpacingM(transform.mmPerM)
  const { bounds } = transform

  const startE = Math.floor(bounds.minE / spacingM) * spacingM
  const endE = Math.ceil(bounds.maxE / spacingM) * spacingM
  const startN = Math.floor(bounds.minN / spacingM) * spacingM
  const endN = Math.ceil(bounds.maxN / spacingM) * spacingM

  doc.setDrawColor(...lightGray)
  doc.setLineWidth(0.12)

  for (let e = startE; e <= endE; e += spacingM) {
    const x = transform.toX(e)
    if (x < frame.x || x > frame.x + frame.w) continue
    doc.line(x, frame.y, x, frame.y + frame.h)
  }

  for (let n = startN; n <= endN; n += spacingM) {
    const y = transform.toY(n)
    if (y < frame.y || y > frame.y + frame.h) continue
    doc.line(frame.x, y, frame.x + frame.w, y)
  }

  // Labels (lightweight, avoids clutter)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.5)
  doc.setTextColor(...gray)

  for (let e = startE; e <= endE; e += spacingM) {
    const x = transform.toX(e)
    if (x < frame.x || x > frame.x + frame.w) continue
    doc.text(String(Math.round(e)), x, frame.y + frame.h + 4, { align: 'center' })
  }

  for (let n = startN; n <= endN; n += spacingM) {
    const y = transform.toY(n)
    if (y < frame.y || y > frame.y + frame.h) continue
    doc.text(String(Math.round(n)), frame.x - 1.5, y + 1.5, { align: 'right' })
  }
}

function drawNorthArrow(doc: any, x: number, y: number, amber: [number, number, number]) {
  doc.setDrawColor(...amber)
  doc.setFillColor(...amber)
  doc.setTextColor(...amber)
  doc.setLineWidth(0.6)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('N', x + 3, y - 6, { align: 'center' })

  doc.line(x + 3, y + 10, x + 3, y - 2)
  doc.triangle(x + 3, y - 5, x + 1.5, y - 1.5, x + 4.5, y - 1.5, 'F')
}

function pickScaleBarLengthM(mmPerM: number) {
  const candidates = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]
  for (const c of candidates) {
    const mm = c * mmPerM
    if (mm >= 30 && mm <= 60) return c
  }
  return candidates[candidates.length - 1]
}

function drawScaleBar(
  doc: any,
  x: number,
  y: number,
  transform: PlanTransform,
  dark: [number, number, number],
  white: [number, number, number]
) {
  const lengthM = pickScaleBarLengthM(transform.mmPerM)
  const lengthMm = lengthM * transform.mmPerM
  const height = 3
  const half = lengthMm / 2

  doc.setDrawColor(...dark)
  doc.setLineWidth(0.3)

  doc.setFillColor(...dark)
  doc.rect(x, y, half, height, 'F')
  doc.setFillColor(...white)
  doc.rect(x + half, y, half, height, 'F')
  doc.rect(x, y, lengthMm, height, 'S')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.5)
  doc.setTextColor(...dark)

  doc.text('0', x, y + 7)
  doc.text(String(Math.round(lengthM / 2)), x + half, y + 7, { align: 'center' })
  doc.text(`${lengthM} m`, x + lengthMm, y + 7, { align: 'right' })
  doc.text(`Scale 1:${transform.ratio.toLocaleString()}`, x, y + 12)
}

function drawTitleBlock(
  doc: any,
  args: {
    x: number
    y: number
    w: number
    h: number
    amber: [number, number, number]
    dark: [number, number, number]
    white: [number, number, number]
    project: { name: string; location: string; utm: string; datum: string; date: string; scale: string; drawingNo: string }
  }
) {
  const { x, y, w, h, amber, dark, white, project } = args

  doc.setFillColor(...dark)
  doc.rect(x, y, w, h, 'F')

  doc.setDrawColor(...amber)
  doc.setLineWidth(0.6)
  doc.rect(x, y, w, h, 'S')

  doc.setTextColor(...amber)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('GEONOVA', x + w / 2, y + 10, { align: 'center' })

  doc.setTextColor(...white)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.text('Professional Surveying Platform', x + w / 2, y + 15, { align: 'center' })

  doc.setDrawColor(...amber)
  doc.setLineWidth(0.2)
  doc.line(x + 3, y + 18, x + w - 3, y + 18)

  const rows: Array<[string, string]> = [
    ['PROJECT', project.name],
    ['LOCATION', project.location],
    ['DATE', project.date],
    ['UTM', project.utm],
    ['DATUM', project.datum],
    ['SCALE', project.scale],
    ['DRAWING NO.', project.drawingNo],
  ]

  let cy = y + 26
  for (const [label, value] of rows) {
    doc.setTextColor(190, 190, 190)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.text(label, x + 4, cy)

    doc.setTextColor(...white)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    const v = value.length > 26 ? value.slice(0, 26) + '…' : value
    doc.text(v, x + 4, cy + 4)
    cy += 10
  }

  // Legend
  cy += 4
  doc.setDrawColor(...amber)
  doc.setLineWidth(0.2)
  doc.line(x + 3, cy, x + w - 3, cy)
  cy += 8

  doc.setTextColor(...amber)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('LEGEND', x + 4, cy)
  cy += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...white)

  // Control point symbol (triangle)
  doc.setFillColor(239, 68, 68)
  doc.triangle(x + 6, cy - 3, x + 4, cy + 1, x + 8, cy + 1, 'F')
  doc.text('Control Point', x + 12, cy)
  cy += 6

  // Survey point symbol (circle)
  doc.setFillColor(...amber)
  doc.circle(x + 6, cy - 1, 1.4, 'F')
  doc.text('Survey Point', x + 12, cy)

  // Sign-off box
  const signY = y + h - 36
  doc.setDrawColor(...amber)
  doc.setLineWidth(0.4)
  doc.rect(x + 3, signY, w - 6, 33, 'S')

  doc.setTextColor(...white)
  doc.setFontSize(6.5)
  doc.text('Surveyor:', x + 5, signY + 9)
  doc.text('Signature:', x + 5, signY + 18)
  doc.text('Date:', x + 5, signY + 27)

  doc.setDrawColor(120, 120, 120)
  doc.setLineWidth(0.2)
  doc.line(x + 22, signY + 9, x + w - 5, signY + 9)
  doc.line(x + 22, signY + 18, x + w - 5, signY + 18)
  doc.line(x + 22, signY + 27, x + w - 5, signY + 27)
}

function drawPoints(
  doc: any,
  points: { name: string; easting: number; northing: number; is_control: boolean }[],
  frame: PlanFrame,
  transform: PlanTransform,
  amber: [number, number, number],
  dark: [number, number, number]
) {
  for (const p of points) {
    const x = transform.toX(p.easting)
    const y = transform.toY(p.northing)

    if (x < frame.x || x > frame.x + frame.w || y < frame.y || y > frame.y + frame.h) continue

    if (p.is_control) {
      doc.setFillColor(239, 68, 68)
      doc.triangle(x, y - 3.2, x - 2.4, y + 2, x + 2.4, y + 2, 'F')
    } else {
      doc.setFillColor(...amber)
      doc.circle(x, y, 1.4, 'F')
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.setTextColor(...dark)
    doc.text(p.name, x + 2.2, y - 1.6)
  }
}

function drawParcelBoundary(doc: any, boundaryPoints: { name: string; easting: number; northing: number }[], transform: PlanTransform, amber: [number, number, number]) {
  doc.setDrawColor(...amber)
  doc.setLineWidth(0.7)

  for (let i = 0; i < boundaryPoints.length; i++) {
    const from = boundaryPoints[i]
    const to = boundaryPoints[(i + 1) % boundaryPoints.length]
    doc.line(transform.toX(from.easting), transform.toY(from.northing), transform.toX(to.easting), transform.toY(to.northing))
  }
}

function drawParcelLabels(
  doc: any,
  boundaryPoints: { name: string; easting: number; northing: number }[],
  transform: PlanTransform,
  gray: [number, number, number]
) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.5)
  doc.setTextColor(...gray)

  for (let i = 0; i < boundaryPoints.length; i++) {
    const from = boundaryPoints[i]
    const to = boundaryPoints[(i + 1) % boundaryPoints.length]

    const x1 = transform.toX(from.easting)
    const y1 = transform.toY(from.northing)
    const x2 = transform.toX(to.easting)
    const y2 = transform.toY(to.northing)

    const segMm = Math.hypot(x2 - x1, y2 - y1)
    if (segMm < 22) continue

    const midX = (x1 + x2) / 2
    const midY = (y1 + y2) / 2

    const db = distanceBearingSimple(from, to)
    doc.text(`${db.bearing} / ${db.distance.toFixed(2)} m`, midX, midY - 2, { align: 'center' })
  }
}

function drawTraverseLines(
  doc: any,
  legs: { fromName: string; toName: string; distance: number; bearing: number }[],
  pointMap: Map<string, { easting: number; northing: number }>,
  transform: PlanTransform,
  amber: [number, number, number]
) {
  doc.setDrawColor(...amber)
  doc.setLineWidth(0.5)

  for (const leg of legs) {
    const from = pointMap.get(leg.fromName)
    const to = pointMap.get(leg.toName)
    if (!from || !to) continue
    doc.line(transform.toX(from.easting), transform.toY(from.northing), transform.toX(to.easting), transform.toY(to.northing))
  }
}

function distanceBearingSimple(p1: { easting: number; northing: number }, p2: { easting: number; northing: number }) {
  const deltaE = p2.easting - p1.easting
  const deltaN = p2.northing - p1.northing
  const distance = Math.sqrt(deltaE * deltaE + deltaN * deltaN)
  
  let bearing = Math.atan2(deltaE, deltaN) * 180 / Math.PI
  if (bearing < 0) bearing += 360

  return {
    distance,
    bearing: bearingToString(bearing)
  }
}
