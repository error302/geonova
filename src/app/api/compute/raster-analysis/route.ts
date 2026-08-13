export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { computeRasterAnalysis, validateRasterRequest } from '@/lib/compute/rasterAnalysis'
import { callPythonCompute } from '@/lib/compute/pythonService'
import { apiSuccess, apiError } from '@/lib/api/response'

export async function POST(request: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  const body: unknown = await request.json().catch(() => null)

  // Try native TS processing first
  const validated = validateRasterRequest(body)
  if (validated) {
    try {
      const result = await computeRasterAnalysis({
        project_id: (body as Record<string, unknown>)?.project_id as string ?? 'unknown',
        ...validated,
      })
      return NextResponse.json(apiSuccess({
        ...result,
        python_required: false,
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Raster analysis failed'
      return NextResponse.json(apiError(message), { status: 500 })
    }
  }

  // Fallback to Python service for complex raster ops
  const python = await callPythonCompute<unknown>('/raster/analyze', body, { timeoutMs: 30000 })
  if (!python.ok) {
    const err = python as { ok: false; status: number; error: string; fallback?: boolean; details?: unknown }
    return NextResponse.json(
      apiError(err.error, { fallback: err.fallback ?? true, details: err.details, python_required: true }),
      { status: err.status }
    )
  }
  return NextResponse.json(python.value)
}

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  return NextResponse.json(apiSuccess({
    endpoint: '/api/compute/raster-analysis',
    description: 'Raster/DEM analysis (native TypeScript with Python fallback for advanced ops).',
    python_required: false,
    supported_types: ['hillshade', 'slope', 'aspect', 'contour', 'statistics'],
  }))
}
