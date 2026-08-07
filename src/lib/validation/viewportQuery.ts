/**
 * Shared viewport-query schema — single source of truth for the GeoJSON
 * feature collection returned by GET /api/spatial-index and consumed by
 * `useViewportQuery`.
 *
 * The client type (re-exported by src/app/map/hooks/useViewportQuery.ts) is
 * derived from these schemas via `z.infer`, and the route validates its own
 * response with the same schema before returning — so the server response and
 * the client viewport shape can never drift apart. This module is deliberately
 * free of any `'use client'` directive so the API route (server) and the map
 * hook (client) can both import it.
 */
import { z } from 'zod'

/**
 * GeoJSON position: [lon, lat] with optional elevation (and beyond). Any
 * number of ordinates is accepted — a 3D coordinate is still an array of
 * numbers, so real PostGIS output always passes.
 */
const viewportPositionSchema = z.array(z.number())

/**
 * GeoJSON geometry — the discriminated union covers every geometry type
 * `ST_AsGeoJSON` can emit (parcels are Polygons or MultiPolygons; beacons and
 * field records are Points). Extra GeoJSON keys such as `bbox` are tolerated
 * (no `.strict()`), since producers legitimately include them.
 */
export const viewportGeometrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Point'), coordinates: viewportPositionSchema }),
  z.object({ type: z.literal('LineString'), coordinates: z.array(viewportPositionSchema) }),
  z.object({ type: z.literal('Polygon'), coordinates: z.array(z.array(viewportPositionSchema)) }),
  z.object({ type: z.literal('MultiPoint'), coordinates: z.array(viewportPositionSchema) }),
  z.object({
    type: z.literal('MultiLineString'),
    coordinates: z.array(z.array(viewportPositionSchema)),
  }),
  z.object({
    type: z.literal('MultiPolygon'),
    coordinates: z.array(z.array(z.array(viewportPositionSchema))),
  }),
  z.object({ type: z.literal('GeometryCollection'), geometries: z.array(z.unknown()) }),
])

/**
 * A single spatial feature served by the viewport query. `.strict()` rejects
 * unknown keys so a future producer can't smuggle extra fields past the shared
 * shape — the client type and the server validation stay aligned.
 */
export const viewportFeatureSchema = z.object({
  id: z.string(),
  type: z.enum(['parcel', 'beacon', 'field_record', 'control_point']),
  geometry: viewportGeometrySchema,
  properties: z.record(z.string(), z.unknown()),
}).strict()

/**
 * The full viewport-query response envelope. Field order and arity mirror the
 * route's `apiSuccess({ type, features, count, bbox })` construction.
 */
export const viewportQueryResponseSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(viewportFeatureSchema),
  count: z.number(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
}).strict()

/** The client-facing feature type, derived from the schema above. */
export type ViewportFeature = z.infer<typeof viewportFeatureSchema>

/** The client-facing response type, derived from the schema above. */
export type ViewportQueryResponse = z.infer<typeof viewportQueryResponseSchema>
