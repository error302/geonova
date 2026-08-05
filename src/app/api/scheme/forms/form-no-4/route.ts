import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { jsPDF } from 'jspdf'

export const dynamic = 'force-dynamic'

// ─── DB Row Interfaces ───────────────────────────────────────────────────────

interface ProjectForm4Row {
  name: string
  scheme_number: string | null
  county: string | null
  sub_county: string | null
  ward: string | null
  adjudication_section: string | null
  planned_parcels: number | null
  survey_type: string | null
  datum: string | null
  utm_zone: string | null
}

interface ParcelForm4Row {
  parcel_number: string
  lr_number_proposed: string | null
  area_ha: string | number | null
  status: string | null
  block_number: string
}

export const GET = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (req, ctx) => {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')

  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
  }

  // Fetch project and scheme details
  const { rows: projects } = await db.query<ProjectForm4Row>(
    `SELECT p.*, sd.scheme_number, sd.county, sd.sub_county, sd.ward, 
            sd.adjudication_section, sd.planned_parcels
     FROM projects p
     LEFT JOIN scheme_details sd ON sd.project_id = p.id
     WHERE p.id = $1`,
    [projectId]
  )

  if (projects.length === 0) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const project = projects[0]
  const { rows: parcels } = await db.query<ParcelForm4Row>(
    `SELECT p.*, b.block_number
     FROM parcels p
     JOIN blocks b ON b.id = p.block_id
     WHERE b.project_id = $1
     ORDER BY b.block_number, p.parcel_number`,
    [projectId]
  )

  // Generate Form No. 4 PDF
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15

  // Title
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('FORM NO. 4 — SURVEY PLAN', pageWidth / 2, 25, { align: 'center' })
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('(Regulation 13(1) of the Survey Act, Cap 299)', pageWidth / 2, 32, { align: 'center' })

  // Scheme info table
  let y = 45
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('PARTICULARS OF THE SURVEY', margin, y)
  y += 8

  const info = [
    ['Scheme Number', project.scheme_number || '-'],
    ['County', project.county || '-'],
    ['Sub-County', project.sub_county || '-'],
    ['Ward', project.ward || '-'],
    ['Adjudication Section', project.adjudication_section || '-'],
    ['Total Parcels', String(project.planned_parcels || parcels.length)],
    ['Project Name', project.name],
    ['Survey Type', project.survey_type || '-'],
    ['Datum', project.datum || 'ARC 1960'],
    ['UTM Zone', `${project.utm_zone || '37S'}`],
  ]

  doc.setFontSize(9)
  info.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold')
    doc.text(`${label}:`, margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(value, margin + 60, y)
    y += 6
  })

  // Parcel summary table
  y += 5
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('PARCEL SUMMARY', margin, y)
  y += 8

  doc.setFontSize(8)
  const tableHeaders = ['Block', 'Parcel No.', 'LR No.', 'Area (ha)', 'Status']
  const colWidths = [25, 30, 40, 30, 30]
  let x = margin

  // Header row
  doc.setFillColor(50, 50, 50)
  doc.rect(x, y - 4, colWidths.reduce((a, b) => a + b, 0), 7, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  tableHeaders.forEach((h, i) => {
    doc.text(h, x + 2, y)
    x += colWidths[i]
  })
  doc.setTextColor(0, 0, 0)
  y += 7

  // Data rows
  doc.setFont('helvetica', 'normal')
  parcels.forEach((p) => {
    if (y > pageHeight - 30) {
      doc.addPage()
      y = 20
    }
    x = margin
    const row = [p.block_number, p.parcel_number, p.lr_number_proposed || '-', 
                 p.area_ha ? Number(p.area_ha).toFixed(4) : '-', p.status || 'pending']
    row.forEach((val, i) => {
      doc.text(String(val), x + 2, y)
      x += colWidths[i]
    })
    y += 5
  })

  // Certificate section
  y += 15
  if (y > pageHeight - 60) {
    doc.addPage()
    y = 20
  }

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('CERTIFICATE', margin, y)
  y += 10
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('I certify that the survey described above has been carried out by me in accordance', margin, y)
  y += 5
  doc.text('with the Survey Act (Cap 299) and the Regulations made thereunder, and that all', margin, y)
  y += 5
  doc.text('particulars shown on this plan are correct to the best of my knowledge and belief.', margin, y)

  y += 20
  doc.text('.....................................................', margin + 20, y)
  doc.text('.....................................................', margin + 180, y)
  y += 5
  doc.text('Licensed Surveyor', margin + 20, y)
  doc.text('Date', margin + 180, y)
  y += 5
  const sessionUser = ctx.session?.user as { name?: string; isk_number?: string } | undefined
  doc.text(`Name: ${sessionUser?.name || 'Surveyor'}`, margin + 20, y)
  y += 5
  doc.text(`ISK No: ${sessionUser?.isk_number || '...................'}`, margin + 20, y)

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Form_4_${project.scheme_number || project.name}.pdf"`,
    },
  })
})
