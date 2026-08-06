/**
 * Shared MapExtent schema — single source of truth for the geographic
 * bounding box used by the offline tile downloader.
 *
 * The client type (re-exported by @/app/map/MapReactContext) is derived from
 * this schema via `z.infer`, so the server-side bounds validation in
 * /api/offline/tiles can never drift from the client type: both sides read
 * the same definition. This module is deliberately free of any `'use client'`
 * directive so API routes (server) and map components (client) can both
 * import it.
 */
import { z } from 'zod'

/**
 * Geographic bounding box in WGS84 decimal degrees, shared by the offline-map
 * extent picker and getMapExtent(). Field order (min/max) and ranges mirror
 * the Web Mercator tile math in /api/offline/tiles. Latitudes allow the full
 * ±90 range even though tile math clamps to ±85.0511 (the Web Mercator
 * limit) — the route clamps silently, so real viewports always pass.
 *
 * `.strict()` rejects unknown keys, so a future consumer can't smuggle extra
 * fields past the shared shape — the client type and the server validation
 * stay byte-for-byte aligned.
 */
export const mapExtentSchema = z.object({
  minLat: z.number().min(-90).max(90),
  minLon: z.number().min(-180).max(180),
  maxLat: z.number().min(-90).max(90),
  maxLon: z.number().min(-180).max(180),
}).strict().refine((b) => b.minLat < b.maxLat, { message: 'minLat must be less than maxLat' })
  .refine((b) => b.minLon < b.maxLon, { message: 'minLon must be less than maxLon' })

/** The client-facing bounding-box type, derived from the schema above. */
export type MapExtent = z.infer<typeof mapExtentSchema>
