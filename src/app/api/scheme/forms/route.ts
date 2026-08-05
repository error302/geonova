import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiHandler } from '@/lib/apiHandler'

export const dynamic = 'force-dynamic'

interface ParcelRow {
  id: string
  parcel_number: string | null
  lr_number_proposed: string | null
  area_ha: string | number | null
  project_id: string
  block_id: string
  block_number: string | null
  block_name: string | null
  project_name: string | null
  location: string | null
  surveyor_name: string | null
  county: string | null
}

interface SchemeRow {
  scheme_number: string | null
  county: string | null
  sub_county: string | null
  ward: string | null
  adjudication_section: string | null
}

export const GET = apiHandler(
  { auth: true, audit: 'form_generated' , rateLimit: { max: 60, windowMs: 60000 } },
  async (req, ctx) => {
    const { searchParams } = new URL(req.url)
    const parcelId = searchParams.get('parcel_id')
    const formType = searchParams.get('type') || 'ppa2'

    if (!parcelId) {
      return NextResponse.json({ error: 'parcel_id is required' }, { status: 400 })
    }

    if (!['ppa2', 'mutation'].includes(formType)) {
      return NextResponse.json({ error: 'type must be ppa2 or mutation' }, { status: 400 })
    }

    const parcelCheck = await db.query<ParcelRow>(
      `SELECT p.id, p.parcel_number, p.lr_number_proposed, p.area_ha, p.project_id, p.block_id,
      b.block_number, b.block_name,
      pr.name as project_name, pr.location, pr.surveyor_name, pr.county
      FROM parcels p
      JOIN blocks b ON b.id = p.block_id
      JOIN projects pr ON pr.id = p.project_id
      WHERE p.id = $1 AND pr.user_id = $2`,
      [parcelId, ctx.userId]
    )

    if (parcelCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Parcel not found' }, { status: 404 })
    }

    const parcel = parcelCheck.rows[0]

    let scheme: Partial<SchemeRow> = {}
    try {
      const sd = await db.query<SchemeRow>('SELECT * FROM scheme_details WHERE project_id = $1', [parcel.project_id])
      if (sd.rows.length > 0) scheme = sd.rows[0]
    } catch {}

    if (formType === 'ppa2') {
      return await generatePPA2(parcel, scheme)
    }

    return await generateMutationForm(parcel, scheme)
  }
)

async function generatePPA2(parcel: ParcelRow, scheme: Partial<SchemeRow>) {
  const { generatePPA2Form } = await import('@/lib/submission/generators/ppa2Form')

  const area = parcel.area_ha ? parseFloat(String(parcel.area_ha)) : 0

  const pdfBuffer = generatePPA2Form({
    lrNumber: parcel.lr_number_proposed || `Proposed - ${parcel.parcel_number}`,
    parcelNumber: parcel.parcel_number || '',
    county: scheme.county || parcel.county || '',
    division: scheme.sub_county || '',
    district: scheme.ward || parcel.location || '',
    locality: parcel.location || scheme.ward || '',
    areaHa: area,
    surveyType: 'Cadastral Survey - Subdivision',
    applicantName: scheme.county ? `${scheme.county} County Government` : 'N/A',
    applicantAddress: '',
    applicantIdNumber: '',
    surveyorName: parcel.surveyor_name || '',
    iskNumber: '',
    firmName: '',
    surveyDate: new Date().toISOString(),
    referenceNumber: scheme.scheme_number || `${parcel.block_number}/${parcel.parcel_number}`,
  })

  return new NextResponse(Buffer.from(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="PPA2_${parcel.parcel_number}.pdf"`,
    },
  })
}

async function generateMutationForm(parcel: ParcelRow, scheme: Partial<SchemeRow>) {
  const jsPDF = (await import('jspdf')).default
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const margin = 20

  const area = parcel.area_ha ? parseFloat(String(parcel.area_ha)) : 0

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('REPUBLIC OF KENYA', W / 2, 20, { align: 'center' })
  doc.setFontSize(11)
  doc.text('LAND REGISTRATION ACT (CAP 300)', W / 2, 28, { align: 'center' })
  doc.setFontSize(10)
  doc.text('MUTATION FORM', W / 2, 35, { align: 'center' })

  doc.setLineWidth(0.5)
  doc.line(margin, 40, W - margin, 40)

  let y = 50
  const lineH = 7

  function field(label: string, value: string) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(label, margin, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(value || '\u2014', margin + 60, y)
    doc.setLineWidth(0.1)
    doc.line(margin + 60, y + 1, W - margin, y + 1)
    y += lineH
  }

  field('Reference No.:', scheme.scheme_number || `BLK/${parcel.block_number}`)
  field('Date:', new Date().toLocaleDateString('en-GB'))

  y += 4
  doc.setFillColor(27, 58, 92)
  doc.rect(margin, y, W - margin * 2, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text('SECTION I \u2014 PROPERTY DETAILS', margin + 3, y + 5)
  doc.setTextColor(0, 0, 0)
  y += 12

  field('LR Number:', parcel.lr_number_proposed || 'Pending')
  field('Parcel Number:', parcel.parcel_number || '')
  field('Block:', `${parcel.block_number} \u2014 ${parcel.block_name || 'N/A'}`)
  field('County:', scheme.county || parcel.county || '')
  field('Sub-County:', scheme.sub_county || '')
  field('Ward:', scheme.ward || '')
  field('Area (Ha):', area > 0 ? area.toFixed(4) : 'Pending Computation')
  field('Registration Section:', scheme.adjudication_section || '')

  y += 4
  doc.setFillColor(27, 58, 92)
  doc.rect(margin, y, W - margin * 2, 7, 'F')
  doc.setTextColor(255, 255, 255)
  doc.text('SECTION II \u2014 MUTATION PARTICULARS', margin + 3, y + 5)
  doc.setTextColor(0, 0, 0)
  y += 12

  field('Type of Mutation:', 'Subdivision / Amalgamation')
  field('Description:', `Scheme subdivision - Block ${parcel.block_number}, Parcel ${parcel.parcel_number}`)
  field('Number of Resulting Parcels:', '1')
  field('Resulting LR Number:', parcel.lr_number_proposed || 'To be assigned')

  y += 4
  doc.setFillColor(27, 58, 92)
  doc.rect(margin, y, W - margin * 2, 7, 'F')
  doc.setTextColor(255, 255, 255)
  doc.text('SECTION III \u2014 CERTIFICATION', margin + 3, y + 5)
  doc.setTextColor(0, 0, 0)
  y += 12

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text('I certify that the above mutation has been effected in accordance with the provisions of', margin, y)
  y += 6
  doc.text('the Land Registration Act (Cap 300) and all relevant regulations.', margin, y)
  y += 12

  field('Surveyor Name:', parcel.surveyor_name || '')
  field('Signature:', '')
  field('Date:', new Date().toLocaleDateString('en-GB'))
  y += 4

  field('Registrar:', '')
  field('Signature:', '')
  field('Stamp:', '')

  y += 8
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7)
  doc.setTextColor(100, 100, 100)
  doc.text('Generated by Metardu Survey Platform', W / 2, 285, { align: 'center' })

  const pdfBase64 = doc.output('datauristring').split(',')[1]

  return new NextResponse(Buffer.from(pdfBase64, 'base64'), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Mutation_${parcel.parcel_number}.pdf"`,
    },
  })
}
