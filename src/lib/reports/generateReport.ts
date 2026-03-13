import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface ReportOptions {
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
}

export function generateSurveyReport(options: ReportOptions, onBlob?: (blob: Blob, filename: string) => void): void {
  const { project, points, traverse, area } = options
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

  doc.setDrawColor(...amber)
  doc.setLineWidth(0.8)
  doc.line(15, 72, 195, 72)

  let yPos = 80

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
        const deg = Math.floor(l.rawBearing)
        const min = Math.floor((l.rawBearing - deg) * 60)
        const sec = (((l.rawBearing - deg) * 60) - min) * 60
        return [
          `${l.fromName}→${l.toName}`,
          l.distance.toFixed(3),
          `${deg}°${min}'${sec.toFixed(1)}"`,
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
    doc.text(`Total Distance: ${traverse.totalDistance.toFixed(3)} m`, 20, yPos + 7)
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

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFillColor(...dark)
    doc.rect(0, 282, 210, 15, 'F')
    doc.setTextColor(...gray)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text('Generated by GeoNova — Professional Surveying Platform', 15, 290)
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
