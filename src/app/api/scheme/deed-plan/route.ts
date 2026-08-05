import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiHandler } from '@/lib/apiHandler'

export const dynamic = 'force-dynamic'

// ─── DB Row Interfaces ───────────────────────────────────────────────────────

interface ParcelRow {
  id: string
  parcel_number: string
  lr_number_proposed: string | null
  area_ha: string | number | null
  project_id: string
  block_id: string
  block_number: string
  block_name: string | null
  project_name: string
  location: string | null
  surveyor_name: string | null
}

interface TraverseRow {
  traverse_id: string
  opening_station: string | null
  accuracy_order: string | null
  total_perimeter: string | number | null
  computed_area_ha: string | number | null
}

interface CoordRow {
  station: string
  easting: string | number
  northing: string | number
  rl: string | number | null
}

interface SchemeDetailsRow {
  scheme_number?: string | null
  county?: string | null
  [key: string]: unknown
}

export const GET = apiHandler(
  { auth: true, audit: 'deed_plan_generated' , rateLimit: { max: 60, windowMs: 60000 } },
  async (req, ctx) => {
    const { searchParams } = new URL(req.url)
    const parcelId = searchParams.get('parcel_id')

    if (!parcelId) {
      return NextResponse.json({ error: 'parcel_id is required' }, { status: 400 })
    }

    const parcelCheck = await db.query<ParcelRow>(
      `SELECT p.id, p.parcel_number, p.lr_number_proposed, p.area_ha, p.project_id, p.block_id,
      b.block_number, b.block_name,
      pr.name as project_name, pr.location, pr.surveyor_name
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

    const traverseCheck = await db.query<TraverseRow>(
      `SELECT pt.id as traverse_id, pt.opening_station, pt.accuracy_order,
      pt.total_perimeter, pt.computed_area_ha
      FROM parcel_traverses pt
      WHERE pt.parcel_id = $1`,
      [parcelId]
    )

    if (traverseCheck.rows.length === 0) {
      return NextResponse.json({ error: 'No traverse computed for this parcel. Run traverse computation first.' }, { status: 400 })
    }

    const traverse = traverseCheck.rows[0]
    const traverseId = traverse.traverse_id

    const coordsResult = await db.query<CoordRow>(
      `SELECT station, easting, northing, rl FROM traverse_coordinates WHERE traverse_id = $1 ORDER BY station`,
      [traverseId]
    )

    if (coordsResult.rows.length < 3) {
      return NextResponse.json({ error: 'Not enough points for a deed plan (minimum 3 required)' }, { status: 400 })
    }

    let schemeDetails: Partial<SchemeDetailsRow> = {}
    try {
      const sd = await db.query<SchemeDetailsRow>('SELECT * FROM scheme_details WHERE project_id = $1', [parcel.project_id])
      if (sd.rows.length > 0) schemeDetails = sd.rows[0]
    } catch {}

    const { jsPDF } = await import('jspdf')
    const { renderBoundaryPlan } = await import('@/lib/generators/deedPlanRenderer')

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()

    const stations = coordsResult.rows.map((c) => ({
      station: c.station,
      easting: parseFloat(String(c.easting)),
      northing: parseFloat(String(c.northing)),
      beaconNo: c.station,
      monument: 'psc found',
    }))

    const bearingSchedule: Array<{ bearing: string; distance: string }> = []
    for (let i = 0; i < stations.length; i++) {
      const from = stations[i]
      const to = stations[(i + 1) % stations.length]
      const dE = to.easting - from.easting
      const dN = to.northing - from.northing
      const dist = Math.sqrt(dE * dE + dN * dN)
      const wcbDeg = (Math.atan2(dE, dN) * 180 / Math.PI + 360) % 360
      const wcbD = Math.floor(wcbDeg)
      const wcbM = Math.floor((wcbDeg - wcbD) * 60)
      const wcbS = ((wcbDeg - wcbD) * 60 - wcbM) * 60
      bearingSchedule.push({
        bearing: `${String(wcbD).padStart(3, '0')}\u00B0${String(wcbM).padStart(2, '0')}'${wcbS.toFixed(1)}"`,
        distance: dist.toFixed(3),
      })
    }

    const geom = {
      stations, bearingSchedule,
      minE: Math.min(...stations.map((s) => s.easting)),
      maxE: Math.max(...stations.map((s) => s.easting)),
      minN: Math.min(...stations.map((s) => s.northing)),
      maxN: Math.max(...stations.map((s) => s.northing)),
    }

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('REPUBLIC OF KENYA', pageW / 2, 10, { align: 'center' })
    doc.setFontSize(9)
    doc.text('FORM NO. 4 \u2014 DEED PLAN', pageW / 2, 15, { align: 'center' })

    renderBoundaryPlan(doc, geom as Parameters<typeof renderBoundaryPlan>[1], { x: 10, y: 20, width: pageW - 20, height: pageH - 75 })

    const tableY = pageH - 52
    doc.setDrawColor(0)
    doc.setLineWidth(0.4)
    doc.rect(10, tableY, pageW - 20, 48)

    const col1X = 12
    const col2X = pageW / 2 + 5
    const rowH = 6
    const curY = tableY + 5

    const areaStr = parcel.area_ha
      ? `${parseFloat(String(parcel.area_ha)).toFixed(4)} Ha`
      : traverse.computed_area_ha
        ? `${parseFloat(String(traverse.computed_area_ha)).toFixed(4)} Ha`
        : '\u2014'

    const infoPairs = [
      ['PARCEL:', parcel.parcel_number],
      ['LR NO.:', parcel.lr_number_proposed || 'Pending'],
      ['AREA:', areaStr],
      ['BLOCK:', `${parcel.block_number} \u2014 ${parcel.block_name || 'N/A'}`],
      ['SCHEME:', schemeDetails.scheme_number || '\u2014'],
      ['LOCATION:', parcel.location || schemeDetails.county || '\u2014'],
      ['SURVEYOR:', parcel.surveyor_name || '\u2014'],
      ['ACCURACY:', traverse.accuracy_order || '\u2014'],
      ['PERIMETER:', traverse.total_perimeter ? `${parseFloat(String(traverse.total_perimeter)).toFixed(3)} m` : '\u2014'],
      ['DATE:', new Date().toLocaleDateString('en-GB')],
      ['DATUM:', 'ARC 1960'],
      ['PROJECTION:', 'UTM Zone 37S'],
    ]

    for (let i = 0; i < infoPairs.length; i++) {
      const col = i < 6 ? col1X : col2X
      const row = i < 6 ? i : i - 6
      const y = curY + row * rowH
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      doc.text(infoPairs[i][0], col, y)
      doc.setFont('helvetica', 'normal')
      doc.text(String(infoPairs[i][1]), col + 28, y)
    }

    const pdfBase64 = doc.output('datauristring').split(',')[1]

    return new NextResponse(
      Buffer.from(pdfBase64, 'base64'),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="DeedPlan_${parcel.parcel_number}_${(parcel.lr_number_proposed || 'PENDING').replace(/\//g, '-')}.pdf"`,
        },
      }
    )
  }
)
