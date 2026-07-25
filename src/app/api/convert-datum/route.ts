/**
 * /api/convert-datum
 *
 * POST — Convert coordinates between datums (WGS84 ↔ Arc 1960 ↔ UTM).
 *
 * AUDIT FIX (2026-07-03): The coordinateConverter lib (used by the
 * reports module) POSTed to this endpoint but no route existed.
 *
 * Body:
 *   {
 *     coords:   Array<{ id?, easting, northing }>,
 *     fromDatum: 'WGS84' | 'ARC1960',
 *     toDatum:   'WGS84' | 'ARC1960',
 *     utmZone?:  number  (default 37, ignored for WGS84 geographic)
 *   }
 *
 * Response (200):
 *   {
 *     data: Array<{ id?, easting, northing, datum, epsg }>,
 *     fromDatum, toDatum, count
 *   }
 *
 * This is a thin wrapper around the existing /api/geo/transform
 * logic — it maps datum names to CRS codes and delegates to
 * `transformCoordinates` from `@/lib/geo/transform`.
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/lib/apiHandler'
import { transformCoordinates, TransformInput } from '@/lib/geo/transform'

const ConvertDatumSchema = z.object({
  coords: z.array(
    z.object({
      id: z.string().optional(),
      easting: z.number(),
      northing: z.number(),
    }),
  ).min(1).max(5000),
  fromDatum: z.enum(['WGS84', 'ARC1960', 'WGS84UTM', 'ARC1960UTM']).default('WGS84'),
  toDatum:   z.enum(['WGS84', 'ARC1960', 'WGS84UTM', 'ARC1960UTM']).default('ARC1960'),
  utmZone: z.number().int().min(1).max(60).optional().default(37),
  hemisphere: z.enum(['N', 'S']).optional().default('S'),
})

// Map (datum, kind) → CRS code understood by transformCoordinates
function datumToCRS(datum: string, utmZone: number, hemisphere: 'N' | 'S'): string {
  const epsg =
    datum === 'ARC1960' || datum === 'ARC1960UTM'
      ? hemisphere === 'N' ? 21036 + (utmZone - 36) : 21037 + (utmZone - 37)
      : hemisphere === 'N' ? 32600 + utmZone : 32700 + utmZone
  return `EPSG:${epsg}`
}

export const POST = apiHandler(
  { auth: true, schema: ConvertDatumSchema, rateLimit: { max: 60, windowMs: 60000 } },
  async (_req, ctx) => {
    const body = ctx.body as z.infer<typeof ConvertDatumSchema>
    const { coords, fromDatum, toDatum, utmZone, hemisphere } = body

    // Pick CRS codes. For geographic datums (WGS84, ARC1960 without
    // UTM suffix), use the geographic EPSG code.
    const fromCRS =
      fromDatum === 'WGS84' ? 'EPSG:4326'
      : fromDatum === 'ARC1960' ? 'EPSG:4210'  // Arc 1960 geographic
      : datumToCRS(fromDatum, utmZone, hemisphere)

    const toCRS =
      toDatum === 'WGS84' ? 'EPSG:4326'
      : toDatum === 'ARC1960' ? 'EPSG:4210'
      : datumToCRS(toDatum, utmZone, hemisphere)

    const transformInput: TransformInput = {
      fromCRS,
      toCRS,
      points: coords.map((c, i) => ({
        id: c.id ?? String(i),
        x: c.easting,
        y: c.northing,
      })),
    }

    const result = transformCoordinates(transformInput)

    const data = (result.points ?? []).map((p: { id?: string; x: number; y: number }) => {
      const epsgMatch = toCRS.match(/\d+/)
      return {
        id: p.id,
        easting: p.x,
        northing: p.y,
        datum: toDatum,
        epsg:
          toDatum === 'WGS84' ? 4326
          : toDatum === 'ARC1960' ? 4210
          : (epsgMatch ? parseInt(epsgMatch[0], 10) : 21037),
      }
    })

    return NextResponse.json({
      data,
      fromDatum,
      toDatum,
      fromCRS,
      toCRS,
      count: data.length,
    })
  },
)
