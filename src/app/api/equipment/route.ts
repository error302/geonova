import { NextResponse } from 'next/server'
import { apiHandler, apiSuccess } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth/session'
import { validateBody, equipmentSchema } from '@/lib/validation/apiValidation'

export const dynamic = 'force-dynamic'

/**
 * GET /api/equipment
 * List user's equipment with calibration status.
 * Query: ?include_calibration=true to include latest calibration info
 */
export const GET = apiHandler(
  { auth: true, rateLimit: { max: 120, windowMs: 60000 } },
  async (req, ctx) => {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const includeCal = url.searchParams.get('include_calibration') === 'true'
    const status = url.searchParams.get('status') || 'active'

    if (includeCal) {
      const result = await db.query(
        `SELECT e.*,
          c.calibration_date as last_calibrated,
          c.next_calibration_date as next_calibration,
          CASE
            WHEN c.next_calibration_date IS NULL THEN 'never'
            WHEN c.next_calibration_date < CURRENT_DATE THEN 'overdue'
            WHEN c.next_calibration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' THEN 'expiring'
            ELSE 'current'
          END as calibration_status,
          CASE
            WHEN c.next_calibration_date IS NULL THEN NULL
            ELSE (c.next_calibration_date - CURRENT_DATE)::INTEGER
          END as days_until_expiry
         FROM equipment e
         LEFT JOIN LATERAL (
           SELECT * FROM equipment_calibration
           WHERE equipment_id = e.id
           ORDER BY calibration_date DESC LIMIT 1
         ) c ON true
         WHERE e.user_id = $1 AND ($2 = 'all' OR e.status = $2)
         ORDER BY e.name ASC`,
        [user.id, status],
      )
      return apiSuccess({ equipment: result.rows })
    }

    const result = await db.query(
      `SELECT * FROM equipment WHERE user_id = $1 AND ($2 = 'all' OR status = $2) ORDER BY name ASC`,
      [user.id, status],
    )
    return apiSuccess({ equipment: result.rows })
  },
)

/**
 * POST /api/equipment
 * Add new equipment.
 */
export const POST = apiHandler(
  {
    auth: true,
    rateLimit: { max: 30, windowMs: 60000 },
    // P1-3 (2026-07-24): Equipment registration affects calibration
    // compliance — total stations with expired calibration produce
    // legally indefensible measurements. Audit chain proves who
    // registered what and when.
    auditChain: {
      entityType: 'system',
      action: 'create',
      reason: 'equipment registration',
    },
  },
  async (req, ctx) => {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = validateBody(ctx.body, equipmentSchema)
    const name = body.name
    const type = body.type

    if (!name || !type) {
      return NextResponse.json({ error: 'name and type are required' }, { status: 400 })
    }

    const result = await db.query(
      `INSERT INTO equipment (user_id, name, type, manufacturer, model, serial_number, purchase_date, purchase_cost, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        user.id, name, type,
        body.manufacturer || null, body.model || null, body.serialNumber || null,
        body.purchaseDate || null, body.purchaseCost || null,
        body.status || 'active', body.notes || null,
      ],
    )

    return apiSuccess({ equipment: result.rows[0], message: 'Equipment added' })
  },
)

/**
 * PATCH /api/equipment?id=<id>
 * Update equipment.
 */
export const PATCH = apiHandler(
  {
    auth: true,
    rateLimit: { max: 60, windowMs: 60000 },
    auditChain: {
      entityType: 'system',
      action: 'update',
      reason: 'equipment update',
    },
  },
  async (req, ctx) => {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const equipId = url.searchParams.get('id')
    if (!equipId) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const body = ctx.body as Record<string, unknown>
    const updates: string[] = []
    const params: unknown[] = []
    let idx = 1

    for (const field of ['name', 'type', 'manufacturer', 'model', 'serial_number', 'status', 'notes']) {
      const camelField = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
      if (body[camelField] !== undefined || body[field] !== undefined) {
        updates.push(`${field} = $${idx}`)
        params.push(body[camelField] ?? body[field])
        idx++
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push(`updated_at = NOW()`)
    params.push(equipId, user.id)

    const result = await db.query(
      `UPDATE equipment SET ${updates.join(', ')} WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`,
      params,
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 })
    }

    return apiSuccess({ equipment: result.rows[0] })
  },
)

/**
 * DELETE /api/equipment?id=<id>
 */
export const DELETE = apiHandler(
  {
    auth: true,
    rateLimit: { max: 30, windowMs: 60000 },
    auditChain: {
      entityType: 'system',
      action: 'delete',
      reason: 'equipment deletion',
    },
  },
  async (req, ctx) => {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const equipId = url.searchParams.get('id')
    if (!equipId) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    await db.query(`DELETE FROM equipment WHERE id = $1 AND user_id = $2`, [equipId, user.id])
    return apiSuccess({ id: equipId, deleted: true })
  },
)
