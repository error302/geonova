import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiHandler } from '@/lib/apiHandler'

export const dynamic = 'force-dynamic'

export const POST = apiHandler(
  {
    auth: true, rawBody: true, audit: 'csv_import', rateLimit: { max: 60, windowMs: 60000 },
    // T1.9 FIX (2026-07-09): Add audit chain for bulk parcel imports.
    // Bulk imports can create/modify many parcels at once — needs tamper-evident logging.
    auditChain: {
      entityType: 'parcel',
      action: 'import',
      reason: 'Bulk CSV parcel import',
    },
  },
  async (req, ctx) => {
    const formData = await req.formData()
    const projectId = formData.get('project_id')
    const blockId = formData.get('block_id')
    const csvFile = formData.get('file') as File | null

    if (!projectId || !blockId) {
      return NextResponse.json({ error: 'project_id and block_id are required' }, { status: 400 })
    }

    if (!csvFile) {
      return NextResponse.json({ error: 'No CSV file provided' }, { status: 400 })
    }

    const check = await db.query<{ id: string; project_id: string }>(
      `SELECT b.id, b.project_id FROM blocks b
      JOIN projects p ON p.id = b.project_id
      WHERE b.id = $1 AND p.user_id = $2`,
      [blockId, ctx.userId]
    )
    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 })
    }

    const csvText = await csvFile.text()
    const lines = csvText.trim().split(/\r?\n/)
    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV file is empty or has no data rows' }, { status: 400 })
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))

    const findCol = (names: string[]): number => {
      for (const name of names) {
        const idx = headers.indexOf(name)
        if (idx >= 0) return idx
      }
      return -1
    }

    const parcelNumCol = findCol(['parcel_number', 'parcel', 'parcel_no', 'plot_number', 'plot_no', 'number'])
    const lrCol = findCol(['lr_number_proposed', 'lr_number', 'lr_no', 'lr_proposed', 'lr', 'proposed_lr'])
    const areaCol = findCol(['area_ha', 'area', 'size_ha', 'hectares'])
    const notesCol = findCol(['notes', 'description', 'remarks', 'comment'])

    if (parcelNumCol === -1) {
      return NextResponse.json({
        error: 'Missing required column "parcel_number". Expected headers: parcel_number, lr_number_proposed, area_ha, notes',
      }, { status: 400 })
    }

    const results = { created: 0, skipped: 0, errors: [] as string[] }
    const maxParcels = 500

    // Wrap all inserts/updates in a single transaction so partial failures
    // don't leave half-imported parcels. CSV import must be atomic.
    await db.transaction(async (client) => {
      for (let i = 1; i < lines.length && results.created < maxParcels; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
        if (values.length <= 1) continue

        const parcelNumber = values[parcelNumCol]?.trim()
        if (!parcelNumber) {
          results.skipped++
          results.errors.push(`Row ${i + 1}: empty parcel number`)
          continue
        }

        const lrNumber = lrCol >= 0 ? (values[lrCol]?.trim() || null) : null
        const areaHa = areaCol >= 0 ? (parseFloat(values[areaCol]) || null) : null
        const notes = notesCol >= 0 ? (values[notesCol]?.trim() || null) : null

        const dupCheck = await client.query<{ id: string }>(
          'SELECT id FROM parcels WHERE block_id = $1 AND parcel_number = $2',
          [blockId, parcelNumber]
        )

        if (dupCheck.rows.length > 0) {
          await client.query<never>(
            `UPDATE parcels SET
              lr_number_proposed = $3, area_ha = $4, notes = $5, updated_at = NOW()
            WHERE block_id = $1 AND parcel_number = $2`,
            [blockId, parcelNumber, lrNumber, areaHa, notes]
          )
          results.skipped++
        } else {
          await client.query<never>(
            `INSERT INTO parcels (project_id, block_id, parcel_number, lr_number_proposed, area_ha, status, notes)
            VALUES ($1, $2, $3, $4, $5, 'pending', $6)`,
            [parseInt(projectId as string), parseInt(blockId as string), parcelNumber, lrNumber, areaHa, notes]
          )
          results.created++
        }
      }
    })

    return NextResponse.json({
      data: {
        total_rows: lines.length - 1,
        created: results.created,
        skipped: results.skipped,
        errors: results.errors.slice(0, 20),
      },
    })
  }
)
