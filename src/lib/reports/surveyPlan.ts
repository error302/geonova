import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface SurveyPlanOptions {
  project: {
    name: string
    location: string
    utm_zone: number
    hemisphere: string
    client_name?: string
    surveyor_name?: string
    survey_type?: string
  }
  points: Array<{
    name: string
    easting: number
    northing: number
    elevation: number
    is_control: boolean
    control_order?: string
  }>
  parcel?: {
    boundaryPoints: string[]
    area_sqm: number
    perimeter_m: number
  }
  traverseLegs?: Array<{
    fromName: string
    toName: string
    bearing: number
    distance: number
  }>
  paperSize?: 'a4' | 'a3'
}

export function generateSurveyPlan(options: SurveyPlanOptions): void {
  const { project, points, parcel, traverseLegs } = options
  const paper = options.paperSize || 'a4'

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: paper
  })

  const pageW = paper === 'a3' ? 420 : 297
  const pageH = paper === 'a3' ? 297 : 210

  const amber: [number, number, number] = [232, 132, 26]
  const dark: [number, number, number] = [15, 15, 20]
  const white: [number, number, number] = [255, 255, 255]

  const titleBlockW = 65
  const margin = 10
  const drawingW = pageW - titleBlockW - margin * 2
  const drawingH = pageH - margin * 2 - 50

  const tbX = pageW - titleBlockW - margin
  const tbY = margin

  doc.setFillColor(...dark)
  doc.rect(tbX, tbY, titleBlockW, pageH - margin * 2, 'F')

  doc.setDrawColor(...amber)
  doc.setLineWidth(0.5)
  doc.rect(tbX, tbY, titleBlockW, pageH - margin * 2, 'S')

  doc.setTextColor(...amber)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('GEONOVA', tbX + titleBlockW / 2, tbY + 10, { align: 'center' })

  doc.setTextColor(...white)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text('Professional Surveying Platform', tbX + titleBlockW / 2, tbY + 15, { align: 'center' })

  doc.setDrawColor(...amber)
  doc.line(tbX + 3, tbY + 18, tbX + titleBlockW - 3, tbY + 18)

  const fields = [
    ['SURVEY PLAN', ''],
    ['Project:', project.name],
    ['Location:', project.location],
    ['Client:', project.client_name || '—'],
    ['Surveyor:', project.surveyor_name || '—'],
    ['Survey Type:', project.survey_type || '—'],
    ['Date:', new Date().toLocaleDateString('en-GB')],
    ['UTM Zone:', `${project.utm_zone}${project.hemisphere}`],
    ['Datum:', 'WGS84'],
    ['Scale:', '1:[auto]'],
    ['Drawing No:', `GN-${Date.now().toString().slice(-6)}`],
    ['Sheet:', '1 of 1']
  ]

  let fieldY = tbY + 24
  fields.forEach(([label, value]) => {
    if (!value) {
      doc.setTextColor(...amber)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text(label, tbX + titleBlockW / 2, fieldY, { align: 'center' })
    } else {
      doc.setTextColor(180, 180, 180)
      doc.setFontSize(6.5)
      doc.setFont('helvetica', 'bold')
      doc.text(label, tbX + 4, fieldY)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...white)
      const displayValue = value.length > 20 ? value.substring(0, 20) + '...' : value
      doc.text(displayValue, tbX + 4, fieldY + 4)
      fieldY += 3
    }
    fieldY += 7
  })

  doc.setDrawColor(...dark)
  doc.setLineWidth(1)
  doc.rect(margin, margin, drawingW, drawingH, 'S')

  doc.setDrawColor(...amber)
  doc.setLineWidth(0.3)
  doc.rect(margin + 1, margin + 1, drawingW - 2, drawingH - 2, 'S')

  const eastings = points.map(p => p.easting)
  const northings = points.map(p => p.northing)
  const minE = Math.min(...eastings)
  const maxE = Math.max(...eastings)
  const minN = Math.min(...northings)
  const maxN = Math.max(...northings)

  const rangeE = maxE - minE || 100
  const rangeN = maxN - minN || 100

  const drawPadding = 20
  const scaleE = (drawingW - drawPadding * 2) / rangeE
  const scaleN = (drawingH - drawPadding * 2) / rangeN
  const scale = Math.min(scaleE, scaleN)

  const rawScale = 1 / scale * 1000
  const niceScales = [100,200,250,500,1000,2000,2500,5000,10000,20000,50000]
  const niceScale = niceScales.find(s => s >= rawScale) || 50000

  function toDrawX(e: number): number {
    return margin + drawPadding + (e - minE) * scale
  }
  function toDrawY(n: number): number {
    return margin + drawingH - drawPadding - (n - minN) * scale
  }

  if (traverseLegs && traverseLegs.length > 0) {
    doc.setDrawColor(...amber)
    doc.setLineWidth(0.4)
    traverseLegs.forEach(leg => {
      const from = points.find(p => p.name === leg.fromName)
      const to = points.find(p => p.name === leg.toName)
      if (!from || !to) return
      doc.line(toDrawX(from.easting), toDrawY(from.northing),
               toDrawX(to.easting), toDrawY(to.northing))
    })
  }

  if (parcel && parcel.boundaryPoints.length >= 3) {
    const bPoints = parcel.boundaryPoints
      .map(name => points.find(p => p.name === name))
      .filter(Boolean) as typeof points

    if (bPoints.length >= 3) {
      doc.setDrawColor(0, 150, 0)
      doc.setLineWidth(0.6)

      for (let i = 0; i < bPoints.length; i++) {
        const from = bPoints[i]
        const to = bPoints[(i + 1) % bPoints.length]

        doc.line(
          toDrawX(from.easting), toDrawY(from.northing),
          toDrawX(to.easting), toDrawY(to.northing)
        )

        const midX = (toDrawX(from.easting) + toDrawX(to.easting)) / 2
        const midY = (toDrawY(from.northing) + toDrawY(to.northing)) / 2

        const dE = to.easting - from.easting
        const dN = to.northing - from.northing
        const dist = Math.sqrt(dE * dE + dN * dN)
        const bearingRad = Math.atan2(dE, dN)
        let bearingDeg = bearingRad * 180 / Math.PI
        if (bearingDeg < 0) bearingDeg += 360

        const deg = Math.floor(bearingDeg)
        const min = Math.floor((bearingDeg - deg) * 60)
        const sec = (((bearingDeg - deg) * 60) - min) * 60

        doc.setFontSize(5)
        doc.setTextColor(0, 100, 0)
        doc.text(
          `${deg}°${min}'${sec.toFixed(0)}" / ${dist.toFixed(3)}m`,
          midX, midY - 1,
          { align: 'center' }
        )
      }

      const centroidE = bPoints.reduce((s, p) => s + p.easting, 0) / bPoints.length
      const centroidN = bPoints.reduce((s, p) => s + p.northing, 0) / bPoints.length

      doc.setFontSize(7)
      doc.setTextColor(0, 120, 0)
      doc.setFont('helvetica', 'bold')
      doc.text(
        `Area: ${parcel.area_sqm.toFixed(4)} m²`,
        toDrawX(centroidE), toDrawY(centroidN),
        { align: 'center' }
      )
      doc.setFont('helvetica', 'normal')
      doc.text(
        `${(parcel.area_sqm / 10000).toFixed(6)} ha`,
        toDrawX(centroidE), toDrawY(centroidN) + 4,
        { align: 'center' }
      )
    }
  }

  points.forEach(point => {
    const x = toDrawX(point.easting)
    const y = toDrawY(point.northing)

    if (point.is_control) {
      doc.setFillColor(239, 68, 68)
      doc.triangle(x, y - 4, x - 3, y + 2, x + 3, y + 2, 'F')
    } else {
      doc.setFillColor(...amber)
      doc.circle(x, y, 1.5, 'F')
    }

    doc.setFontSize(5.5)
    doc.setTextColor(...dark)
    doc.setFont('helvetica', 'bold')
    doc.text(point.name, x + 2.5, y - 1)
  })

  const naX = margin + drawingW - 18
  const naY = margin + 12

  doc.setDrawColor(...dark)
  doc.setFillColor(...dark)
  doc.setLineWidth(0.5)
  doc.line(naX, naY + 8, naX, naY)
  doc.triangle(naX, naY - 2, naX - 2, naY + 3, naX + 2, naY + 3, 'F')

  doc.setFontSize(7)
  doc.setTextColor(...dark)
  doc.setFont('helvetica', 'bold')
  doc.text('N', naX - 1.5, naY - 4)

  const sbX = margin + 5
  const sbY = margin + drawingH - 8

  const barLengthMm = 30
  const barLengthM = Math.round((barLengthMm / 1000) * niceScale)

  doc.setFillColor(...dark)
  doc.rect(sbX, sbY, barLengthMm / 2, 2, 'F')
  doc.setFillColor(...white)
  doc.rect(sbX + barLengthMm / 2, sbY, barLengthMm / 2, 2, 'F')
  doc.setDrawColor(...dark)
  doc.rect(sbX, sbY, barLengthMm, 2, 'S')

  doc.setFontSize(5.5)
  doc.setTextColor(...dark)
  doc.text('0', sbX, sbY + 5)
  doc.text(`${barLengthM}m`, sbX + barLengthMm - 2, sbY + 5)
  doc.text(`Scale 1:${niceScale.toLocaleString()}`, sbX, sbY + 9)

  const tableY = margin + drawingH + 5

  doc.setFontSize(8)
  doc.setTextColor(...dark)
  doc.setFont('helvetica', 'bold')
  doc.text('COORDINATE LIST', margin, tableY)

  autoTable(doc, {
    startY: tableY + 3,
    head: [['Point', 'Easting (m)', 'Northing (m)', 'Elevation (m)', 'Type']],
    body: points.map(p => [
      p.name,
      p.easting.toFixed(4),
      p.northing.toFixed(4),
      p.elevation.toFixed(3),
      p.is_control
        ? (p.control_order || 'Control').charAt(0).toUpperCase() +
          (p.control_order || 'control').slice(1) + ' Control'
        : 'Survey Point'
    ]),
    headStyles: {
      fillColor: dark,
      textColor: amber,
      fontSize: 7,
      fontStyle: 'bold'
    },
    bodyStyles: { fontSize: 6.5 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: margin, right: titleBlockW + margin + 5 },
    tableWidth: drawingW - 5
  })

  doc.setFontSize(6)
  doc.setTextColor(150, 150, 150)
  doc.text(
    'Generated by GeoNova — Professional Surveying Platform — geonova.app',
    pageW / 2, pageH - 3,
    { align: 'center' }
  )

  const date = new Date().toISOString().slice(0, 10)
  const filename = `${project.name.replace(/\s+/g, '_')}_Survey_Plan_${date}.pdf`
  doc.save(filename)
}
