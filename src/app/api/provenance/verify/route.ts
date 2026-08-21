export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { z } from 'zod'
import { verifyProvenance, type EngineType } from '@/lib/provenance/verifyProvenance'

const traverseInputSchema = z.object({
  startPoint: z.object({
    name: z.string(),
    easting: z.number(),
    northing: z.number(),
  }),
  legs: z.array(z.object({
    station: z.string(),
    bearing: z.number(),
    distance: z.number().positive(),
  })),
  closingPoint: z.object({
    easting: z.number(),
    northing: z.number(),
  }).optional(),
  method: z.enum(['bowditch', 'transit']),
})

const areaInputSchema = z.object({
  coordinates: z.array(z.object({
    easting: z.number(),
    northing: z.number(),
  })),
})

const gnssInputSchema = z.object({
  report: z.record(z.unknown()),
})

const verifySchema = z.object({
  /** The engine type — determines which re-run function to use. */
  engine: z.enum(['traverse', 'area', 'gnss-baseline']),
  /** The stored provenance record from the ledger. */
  record: z.object({
    artifact: z.string(),
    engine: z.string(),
    method: z.string(),
    engineVersion: z.string(),
    inputHash: z.string().regex(/^[0-9a-f]{64}$/),
    inputDescriptor: z.string().optional(),
    residuals: z.record(z.union([z.number(), z.string(), z.boolean(), z.null()])).optional(),
    timestamp: z.string(),
  }),
  /** The original engine input — will be hashed and compared to inputHash. */
  input: z.union([traverseInputSchema, areaInputSchema, gnssInputSchema]),
  /** Absolute tolerance for numeric residuals (metres, default 1e-6). */
  numericTolerance: z.number().positive().optional(),
  /** Relative tolerance for ratio residuals (default 1e-4). */
  ratioTolerance: z.number().positive().optional(),
})

/**
 * POST /api/provenance/verify
 *
 * Re-runs the engine on the original inputs and reports whether the
 * residuals still match the stored provenance record. This is the
 * reproducibility guarantee that makes the Phase 13 provenance ledger
 * legally defensible.
 *
 * The endpoint is auth-gated (ownership checked via apiHandler) so
 * only the project owner can verify their own provenance records.
 *
 * Rate-limited: 20 requests per minute (verification is compute-intensive).
 */
export const POST = apiHandler(
  { auth: true, schema: verifySchema, rateLimit: { max: 20, windowMs: 60000 } },
  async (req, ctx) => {
    const { engine, record, input, numericTolerance, ratioTolerance } = ctx.body as z.infer<typeof verifySchema>

    const result = await verifyProvenance({
      record,
      input,
      engine: engine as EngineType,
      numericTolerance,
      ratioTolerance,
    })

    return NextResponse.json(result)
  },
)

export const GET = apiHandler({ auth: true }, async () => {
  return NextResponse.json({
    endpoint: '/api/provenance/verify',
    description: 'Verify a provenance record by re-running the engine and comparing residuals',
    engines: ['traverse', 'area', 'gnss-baseline'],
    method: 'POST',
    body: {
      engine: 'traverse | area | gnss-baseline',
      record: 'EngineProvenanceRecord from the package ledger',
      input: 'Original engine input (will be hashed and compared)',
      numericTolerance: 'Optional: absolute tolerance for numeric residuals (default 1e-6)',
      ratioTolerance: 'Optional: relative tolerance for ratio residuals (default 1e-4)',
    },
  })
})
