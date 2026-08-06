export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { z } from 'zod'
import { mapExtentSchema, type MapExtent } from '@/lib/validation/mapExtent'

// ─── Tile count calculation (server-side) ─────────────────────────────────
// This is the server-side counterpart that validates input and calculates
// tile counts for the requested bounding box and zoom range.
// Actual tile fetching is done client-side.

interface ZoomBreakdown {
  zoom: number
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  tileCount: number
}

interface SourceTileInfo {
  id: string
  label: string
  url: string
  tileCount: number
  estimatedSizeBytes: number
  zoomBreakdown: ZoomBreakdown[]
}

const tileCountRequestSchema = z.object({
  sources: z.array(z.object({
    id: z.string().min(1),
    url: z.string().min(1),
    label: z.string().min(1),
  })).min(1),
  // Shared with the client: MapExtent type + validation both derive from
  // mapExtentSchema in @/lib/validation/mapExtent, so this can't drift.
  bounds: mapExtentSchema,
  minZoom: z.number().int().min(0).max(22),
  maxZoom: z.number().int().min(0).max(22),
}).refine(d => d.minZoom <= d.maxZoom, { message: 'minZoom must be <= maxZoom' })

function calculateTilesForBounds(
  bounds: MapExtent,
  minZoom: number,
  maxZoom: number,
): { total: number; breakdown: ZoomBreakdown[] } {
  const { minLat, minLon, maxLat, maxLon } = bounds
  let total = 0
  const breakdown: ZoomBreakdown[] = []

  for (let z = minZoom; z <= maxZoom; z++) {
    const n = Math.pow(2, z)

    // Clamp latitudes to valid Mercator range
    const clampedMinLat = Math.max(Math.min(minLat, 85.0511), -85.0511)
    const clampedMaxLat = Math.max(Math.min(maxLat, 85.0511), -85.0511)

    const xMin = Math.floor(((minLon + 180) / 360) * n)
    const xMax = Math.floor(((maxLon + 180) / 360) * n)

    const latRad1 = (clampedMaxLat * Math.PI) / 180
    const latRad2 = (clampedMinLat * Math.PI) / 180
    const yMin = Math.floor(((1 - Math.log(Math.tan(latRad1) + 1 / Math.cos(latRad1)) / Math.PI) / 2) * n)
    const yMax = Math.floor(((1 - Math.log(Math.tan(latRad2) + 1 / Math.cos(latRad2)) / Math.PI) / 2) * n)

    const xTiles = xMax - xMin + 1
    const yTiles = yMax - yMin + 1
    const tileCount = Math.max(0, xTiles * yTiles)

    breakdown.push({ zoom: z, xMin, xMax, yMin, yMax, tileCount })
    total += tileCount
  }

  return { total, breakdown }
}

function estimateTileSize(sourceId: string): number {
  // Average compressed tile sizes
  if (sourceId.includes('satellite') || sourceId.includes('esri')) return 30 * 1024
  if (sourceId.includes('osm') || sourceId.includes('openstreetmap')) return 15 * 1024
  return 20 * 1024 // default/custom
}

export const POST = apiHandler(
  { auth: true, schema: tileCountRequestSchema, rateLimit: { max: 30, windowMs: 60000 } },
  async (req, ctx) => {
    const body = ctx.body as z.infer<typeof tileCountRequestSchema>

    const minZoom = Math.max(0, Math.min(22, Math.floor(body.minZoom)))
    const maxZoom = Math.max(0, Math.min(22, Math.floor(body.maxZoom)))

    // ─── Calculate tile counts ──────────────────────────────────────────
    const { total, breakdown } = calculateTilesForBounds(body.bounds, minZoom, maxZoom)

    // Safety cap: warn if too many tiles
    const MAX_TILES = 500000
    const capped = total > MAX_TILES

    // Per-source info
    const sources: SourceTileInfo[] = body.sources.map((src) => {
      const avgTileSize = estimateTileSize(src.id)
      return {
        id: src.id,
        label: src.label,
        url: src.url,
        tileCount: total,
        estimatedSizeBytes: total * avgTileSize,
        zoomBreakdown: breakdown,
      }
    })

    // Total estimated size across all sources
    const totalEstimatedBytes = sources.reduce((sum, s) => sum + s.estimatedSizeBytes, 0)

    return NextResponse.json({
      totalTiles: total,
      sources,
      zoomBreakdown: breakdown,
      estimatedSizeBytes: totalEstimatedBytes,
      capped,
      maxTiles: MAX_TILES,
    })
  }
)
