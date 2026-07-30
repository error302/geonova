export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { z } from 'zod'

/**
 * GET /api/corridor-networks
 *   ?corridor_name=A8    — filter by corridor
 *   ?active=true          — only active versions
 *   ?with_points=true     — include control points in response
 *
 * POST /api/corridor-networks
 *   Create a new corridor control network (version 1 or a new version of existing)
 */

export const GET = apiHandler(
  { auth: true, rateLimit: { max: 60, windowMs: 60000 } },
  async (req, _ctx) => {
    const { searchParams } = new URL(req.url)
    const corridorName = searchParams.get('corridor_name')
    const activeOnly = searchParams.get('active') === 'true'
    const withPoints = searchParams.get('with_points') === 'true'

    let sql = `SELECT * FROM corridor_control_networks WHERE 1=1`
    const params: unknown[] = []
    let idx = 1

    if (corridorName) {
      sql += ` AND corridor_name ILIKE $${idx++}`
      params.push(`%${corridorName}%`)
    }
    if (activeOnly) {
      sql += ` AND is_active = TRUE`
    }
    sql += ` ORDER BY corridor_name, version DESC`

    const { rows: networks } = await db.query(sql, params)

    // Optionally load control points for each network
    if (withPoints && networks.length > 0) {
      const networkIds = networks.map(n => n.id)
      const { rows: points } = await db.query(
        `SELECT * FROM corridor_control_points WHERE network_id = ANY($1::uuid[]) ORDER BY chainage`,
        [networkIds],
      )
      // Group points by network_id
      const pointsByNetwork = new Map<string, typeof points>()
      for (const p of points) {
        if (!pointsByNetwork.has(p.network_id)) {
          pointsByNetwork.set(p.network_id, [])
        }
        pointsByNetwork.get(p.network_id)!.push(p)
      }
      // Attach points to networks
      for (const n of networks) {
        n.control_points = pointsByNetwork.get(n.id) || []
      }
    }

    return NextResponse.json({ data: networks, count: networks.length })
  },
)

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  corridor_name: z.string().optional(),
  start_chainage: z.number().optional(),
  end_chainage: z.number().optional(),
  utm_zone: z.number().int().min(1).max(60).default(37),
  hemisphere: z.string().default('S'),
  datum: z.string().default('Arc 1960'),
  epsg_code: z.string().default('EPSG:21037'),
  established_by: z.string().optional(),
  control_points: z.array(z.object({
    point_name: z.string(),
    point_type: z.string().default('traverse'),
    easting: z.number(),
    northing: z.number(),
    elevation: z.number().optional(),
    chainage: z.number().optional(),
    offset: z.number().default(0),
    sigma_e: z.number().optional(),
    sigma_n: z.number().optional(),
    sigma_h: z.number().optional(),
    order: z.string().optional(),
    epoch_year: z.number().int().optional(),
    observation_date: z.string().optional(),
    description: z.string().optional(),
  })).optional(),
})

export const POST = apiHandler(
  {
    auth: true,
    schema: createSchema,
    rateLimit: { max: 20, windowMs: 60000 },
    auditChain: {
      entityType: 'document',
      action: 'create',
      reason: 'Corridor control network created',
    },
  },
  async (_req, ctx) => {
    const body = ctx.body as z.infer<typeof createSchema>

    // Check if a network with this name already exists → create new version
    const { rows: existing } = await db.query(
      `SELECT id, version FROM corridor_control_networks WHERE name = $1 ORDER BY version DESC LIMIT 1`,
      [body.name],
    )

    const newVersion = existing.length > 0 ? existing[0].version + 1 : 1
    const parentId = existing.length > 0 ? existing[0].id : null

    // Deactivate old version
    if (parentId) {
      await db.query(
        `UPDATE corridor_control_networks SET is_active = FALSE WHERE id = $1`,
        [parentId],
      )
    }

    // Create new network
    const { rows: networkRows } = await db.query(
      `INSERT INTO corridor_control_networks
        (name, description, corridor_name, start_chainage, end_chainage,
         version, parent_version_id, is_active,
         utm_zone, hemisphere, datum, epsg_code, established_by, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, $9, $10, $11, $12, 'draft', $13)
       RETURNING *`,
      [
        body.name, body.description, body.corridor_name,
        body.start_chainage, body.end_chainage,
        newVersion, parentId,
        body.utm_zone, body.hemisphere, body.datum, body.epsg_code,
        body.established_by, ctx.userId,
      ],
    )

    const network = networkRows[0]

    // Insert control points if provided
    if (body.control_points && body.control_points.length > 0) {
      for (const cp of body.control_points) {
        await db.query(
          `INSERT INTO corridor_control_points
            (network_id, point_name, point_type, easting, northing, elevation,
             chainage, offset, sigma_e, sigma_n, sigma_h, "order", epoch_year,
             observation_date, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            network.id, cp.point_name, cp.point_type, cp.easting, cp.northing,
            cp.elevation, cp.chainage, cp.offset,
            cp.sigma_e, cp.sigma_n, cp.sigma_h, cp.order,
            cp.epoch_year, cp.observation_date, cp.description,
          ],
        )
      }
    }

    return NextResponse.json({ data: network }, { status: 201 })
  },
)
