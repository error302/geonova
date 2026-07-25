/**
 * POST /api/rim/overlap-check
 *
 * Check a new parcel's boundary against existing RIM parcels for
 * boundary overlaps. ArdhiSasa rejects overlapping parcels; this
 * route catches them in-office before submission.
 *
 * Request body:
 *   {
 *     newParcel: { parcelNumber, vertices: [{easting, northing}] },
 *     existingParcels: [{ parcelNumber, vertices: [...] }, ...]
 *   }
 *
 * Response:
 *   { hasOverlaps, overlaps, newParcelAreaSqm, elapsedMs, checkedCount }
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler, apiSuccess } from '@/lib/apiHandler'
import { detectOverlaps, formatOverlapResult } from '@/lib/rim/overlapDetection'

const VertexSchema = z.object({
  easting: z.number(),
  northing: z.number(),
  name: z.string().optional(),
})

const ParcelSchema = z.object({
  parcelNumber: z.string(),
  vertices: z.array(VertexSchema).min(1),
})

const OverlapCheckSchema = z.object({
  newParcel: ParcelSchema,
  existingParcels: z.array(ParcelSchema),
})

export const POST = apiHandler(
  { auth: true, schema: OverlapCheckSchema, rateLimit: { max: 30, windowMs: 60000 } },
  async (req, ctx) => {
    const { newParcel, existingParcels } = ctx.body as z.infer<typeof OverlapCheckSchema>

    const result = await detectOverlaps({ newParcel, existingParcels })

    return apiSuccess({
      ...result,
      formatted: formatOverlapResult(result),
    })
  }
)
