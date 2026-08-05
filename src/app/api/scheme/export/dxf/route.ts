import { NextRequest, NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'

interface SchemeParcelRow {
  parcel_number: string
  lr_number_proposed: string | null
  area_ha: number | string | null
  status: string | null
  block_number: string
  station_name: string | null
  easting: number | string | null
  northing: number | string | null
  elevation: number | string | null
}

interface SchemeCoord {
  station: string | null
  x: number
  y: number
  z: number
}

export const dynamic = 'force-dynamic'

export const GET = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (req, ctx) => {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')
  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
  }

  // Fetch all parcels with coordinates
  const { rows: parcels } = await db.query(
    `SELECT p.parcel_number, p.lr_number_proposed, p.area_ha, p.status,
      b.block_number,
      tc.station_name, tc.easting, tc.northing, tc.elevation
     FROM parcels p
     JOIN blocks b ON b.id = p.block_id
     LEFT JOIN traverse_coordinates tc ON tc.traverse_id = (
       SELECT id FROM parcel_traverses WHERE parcel_id = p.id AND status IN ('computed', 'approved')
       ORDER BY computed_at DESC LIMIT 1
     )
     WHERE b.project_id = $1
     ORDER BY b.block_number, p.parcel_number`,
    [projectId]
  )

  // Group coordinates by parcel
  const parcelData = new Map<string, { info: SchemeParcelRow; coords: SchemeCoord[] }>()
  parcels.forEach((row: SchemeParcelRow) => {
    const key = `${row.block_number}-${row.parcel_number}`
    if (!parcelData.has(key)) {
      parcelData.set(key, {
        info: row,
        coords: [],
      })
    }
    if (row.easting !== null && row.northing !== null) {
      parcelData.get(key)!.coords.push({
        station: row.station_name,
        x: Number(row.easting),
        y: Number(row.northing),
        z: row.elevation ? Number(row.elevation) : 0,
      })
    }
  })

  // Generate DXF content
  const dxfLines: string[] = []

  // HEADER section
  dxfLines.push('0', 'SECTION', '2', 'HEADER')
  dxfLines.push('9', '$ACADVER', '1', 'AC1009') // AutoCAD R12
  dxfLines.push('9', '$INSUNITS', '70', '6') // Meters
  dxfLines.push('0', 'ENDSEC')

  // TABLES section with layers
  dxfLines.push('0', 'SECTION', '2', 'TABLES')
  dxfLines.push('0', 'TABLE', '2', 'LAYER', '70', String(parcelData.size + 3))

  // Define layers
  const layers = [
    { name: '0', color: 7 }, // White (default)
    { name: 'BOUNDARY', color: 1 }, // Red
    { name: 'POINTS', color: 3 }, // Green
    { name: 'TEXT', color: 7 }, // White
    ...Array.from(parcelData.entries()).map(([key, _]) => ({
      name: key.replace(/[^A-Za-z0-9_]/g, '_').substring(0, 31),
      color: 4, // Cyan
    }))
  ]

  layers.forEach(layer => {
    dxfLines.push('0', 'LAYER', '2', layer.name, '70', '0', '62', String(layer.color), '6', 'CONTINUOUS')
  })
  dxfLines.push('0', 'ENDTAB', '0', 'ENDSEC')

  // ENTITIES section
  dxfLines.push('0', 'SECTION', '2', 'ENTITIES')

  // Draw parcel boundaries
  parcelData.forEach((data, key) => {
    const coords = data.coords

    if (coords.length < 2) return

    // Draw boundary lines
    for (let i = 0; i < coords.length; i++) {
      const from = coords[i]
      const to = coords[(i + 1) % coords.length] // close polygon

      dxfLines.push('0', 'LINE', '8', 'BOUNDARY')
      dxfLines.push('10', String(from.x.toFixed(3)), '20', String(from.y.toFixed(3)), '30', '0')
      dxfLines.push('11', String(to.x.toFixed(3)), '21', String(to.y.toFixed(3)), '31', '0')
    }

    // Draw points
    coords.forEach(c => {
      dxfLines.push('0', 'POINT', '8', 'POINTS')
      dxfLines.push('10', String(c.x.toFixed(3)), '20', String(c.y.toFixed(3)), '30', String(c.z.toFixed(3)))
    })

    // Add parcel label at centroid
    if (coords.length > 0) {
      const cx = coords.reduce((s, c) => s + c.x, 0) / coords.length
      const cy = coords.reduce((s, c) => s + c.y, 0) / coords.length

      dxfLines.push('0', 'TEXT', '8', 'TEXT')
      dxfLines.push('10', String(cx.toFixed(3)), '20', String(cy.toFixed(3)), '30', '0')
      dxfLines.push('40', '5') // Text height 5m
      dxfLines.push('1', `${data.info.parcel_number}`)

      dxfLines.push('0', 'TEXT', '8', 'TEXT')
      dxfLines.push('10', String(cx.toFixed(3)), '20', String((cy - 8).toFixed(3)), '30', '0')
      dxfLines.push('40', '3') // Text height 3m
      dxfLines.push('1', `${data.info.area_ha ? Number(data.info.area_ha).toFixed(4) + ' ha' : ''}`)
    }
  })

  dxfLines.push('0', 'ENDSEC', '0', 'EOF')

  const dxfContent = dxfLines.join('\n')
  const project = await db.query('SELECT name, scheme_number FROM projects p LEFT JOIN scheme_details sd ON sd.project_id = p.id WHERE p.id = $1', [projectId])
  const projRow = project.rows[0] as { name?: string; scheme_number?: string } | undefined
  const fileName = `Scheme_${projRow?.scheme_number || projRow?.name || projectId}.dxf`

  return new NextResponse(dxfContent, {
    headers: {
      'Content-Type': 'application/dxf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
})
