export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/lib/apiHandler'
import { db, setRlsContext } from '@/lib/db'
import { SaveVIPsSchema } from '@/lib/validation/apiSchemas'

interface VerticalIpsRow {
  id: string
  alignment_id: string
  chainage: number | string
  reduced_level: number | string
  k_value: number | string | null
  updated_at: string | Date
}

// POST: Save vertical intersection points for an alignment (upsert by chainage)
export const POST = apiHandler({ auth: true, schema: SaveVIPsSchema, rateLimit: { max: 60, windowMs: 60000 } }, async (req, ctx) => {
  const { alignment_id, vips } = ctx.body as z.infer<typeof SaveVIPsSchema>

  const client = await db.getClient()

  try {
    await client.query<never>('BEGIN')
    // Set RLS context for this client — CRITICAL for row-level security
    await setRlsContext(client)

    const insertedRows: VerticalIpsRow[] = []
    for (const vip of vips) {
      const { rows } = await client.query<VerticalIpsRow>(
        `INSERT INTO vertical_ips (alignment_id, chainage, reduced_level, k_value)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (alignment_id, chainage) DO UPDATE SET
          reduced_level = EXCLUDED.reduced_level,
          k_value = EXCLUDED.k_value,
          updated_at = NOW()
         RETURNING *`,
        [alignment_id, vip.chainage, vip.reduced_level, vip.k_value ?? null]
      )
      insertedRows.push(rows[0])
    }

    await client.query<never>('COMMIT')

    return NextResponse.json({ data: insertedRows })
  } catch (txErr) {
    await client.query<never>('ROLLBACK')
    throw txErr
  } finally {
    client.release()
  }
})
