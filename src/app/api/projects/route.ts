export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler, AppError } from '@/lib/api/handler'
import { db } from '@/lib/db'
import { z } from 'zod'

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  survey_type: z.string().min(1, 'Survey type is required'),
  location: z.string().optional().default(''),
  utm_zone: z.number().int().min(1).max(60).optional().default(37),
  hemisphere: z.enum(['N', 'S']).optional().default('S'),
  project_type: z.enum(['small', 'scheme']).optional().default('small'),
  client_name: z.string().optional(),
  surveyor_name: z.string().optional(),
  country: z.string().optional(),
  datum: z.string().optional(),
  scheme_number: z.string().optional(),
  county: z.string().optional(),
  sub_county: z.string().optional(),
  ward: z.string().optional(),
  planned_parcels: z.number().int().nonnegative().optional(),
  adjudication_section: z.string().optional(),
})

export const POST = apiHandler({
  requireAuth: true,
  schema: createProjectSchema,
  handler: async (ctx) => {
    const validated = ctx.input

    const projectResult = await db.query(
      `INSERT INTO projects (user_id, name, survey_type, location, utm_zone, hemisphere,
        project_type, client_name, surveyor_name, country, datum, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
       RETURNING id, name, survey_type, location, utm_zone, hemisphere, project_type, created_at`,
      [
        ctx.userId, validated.name, validated.survey_type, validated.location,
        validated.utm_zone, validated.hemisphere, validated.project_type,
        validated.client_name ?? null, validated.surveyor_name ?? null,
        validated.country ?? null, validated.datum ?? null,
      ]
    )

    if (projectResult.rows.length === 0) {
      throw new AppError('Failed to create project', 500, 'PROJECT_CREATE_FAILED')
    }

    const project = projectResult.rows[0] as Record<string, unknown>

    if (validated.project_type === 'scheme') {
      try {
        await db.query(
          `INSERT INTO scheme_details (project_id, scheme_number, county, sub_county, ward,
            planned_parcels, adjudication_section)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            project.id, validated.scheme_number ?? null, validated.county ?? null,
            validated.sub_county ?? null, validated.ward ?? null,
            validated.planned_parcels ?? 0, validated.adjudication_section ?? null,
          ]
        )
      } catch (schemeErr) {
        await db.query('DELETE FROM projects WHERE id = $1', [project.id])
        console.error('scheme_details insert failed:', schemeErr)
        throw new AppError('Failed to create scheme details', 500, 'SCHEME_CREATE_FAILED')
      }
    }

    return NextResponse.json({ data: project }, { status: 201 })
  },
})

export const GET = apiHandler({
  requireAuth: true,
  rateLimit: { max: 60, windowMs: 60000 },
  handler: async (ctx) => {
    // ByteByteGo audit fix: cursor-based pagination (avoids offset performance issues)
    const url = new URL(ctx.req.url)
    const cursor = url.searchParams.get('cursor')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200)

    let query: string
    let params: any[]

    if (cursor) {
      // Cursor is the created_at of the last item from the previous page
      query = `SELECT id, name, survey_type, location, utm_zone, hemisphere, project_type,
                      client_name, surveyor_name, country, datum, created_at
               FROM projects
               WHERE user_id = $1 AND created_at < $2
               ORDER BY created_at DESC
               LIMIT $3`
      params = [ctx.userId, cursor, limit + 1]
    } else {
      query = `SELECT id, name, survey_type, location, utm_zone, hemisphere, project_type,
                      client_name, surveyor_name, country, datum, created_at
               FROM projects
               WHERE user_id = $1
               ORDER BY created_at DESC
               LIMIT $2`
      params = [ctx.userId, limit + 1]
    }

    const result = await db.query(query, params)

    // Check if there are more results
    const hasMore = result.rows.length > limit
    const data = hasMore ? result.rows.slice(0, limit) : result.rows
    const nextCursor = hasMore ? data[data.length - 1]?.created_at : null

    return NextResponse.json({
      data,
      pagination: {
        limit,
        hasMore,
        nextCursor,
      },
    })
  },
})
