/**
 * API: POST /api/survey/tls-adjustment
 *
 * Run a Total Least Squares (TLS) adjustment for errors-in-variables.
 *
 * Body:
 *   {
 *     "A": [[1, 0], [0, 1], [1, 1]],
 *     "l": [1.01, 2.02, 3.03],
 *     "l_weights": [1, 1, 1],   // optional
 *     "method": "standard" | "weighted"
 *   }
 *
 * Response:
 *   {
 *     "x": [...],
 *     "deltaA": [...],
 *     "deltal": [...],
 *     "residuals": [...],
 *     "sigmaZero": 0.01,
 *     "Qxx": [...],
 *     "method": "standard_tls",
 *     "iterations": 0
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { computeStandardTLS, computeWeightedTLS } from '@/lib/survey/totalLeastSquares'

const RequestSchema = z.object({
  A: z.array(z.array(z.number())).min(1),
  l: z.array(z.number()),
  l_weights: z.array(z.number().positive()).optional(),
  method: z.enum(['standard', 'weighted']).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = RequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { A, l, l_weights, method = 'standard' } = parsed.data

    if (A.length !== l.length) {
      return NextResponse.json(
        { error: 'A and l must have the same number of rows' },
        { status: 400 },
      )
    }

    const input = { A, l, l_weights }

    const result = method === 'weighted'
      ? computeWeightedTLS(input)
      : computeStandardTLS(input)

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to run TLS adjustment',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/survey/tls-adjustment',
    method: 'POST',
    description: 'Total Least Squares (TLS) adjustment for errors-in-variables (both A and l have errors)',
    methods: ['standard (SVD-based)', 'weighted (Schaffrin-Wieser iterative)'],
  })
}
