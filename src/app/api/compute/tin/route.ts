import { NextRequest, NextResponse } from 'next/server'

import { callPythonCompute } from '@/lib/compute/pythonService'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const python = await callPythonCompute<any>('/surface/tin', body, { timeoutMs: 15000 })
  if (!python.ok) {
    return NextResponse.json(
      { error: python.error, fallback: python.fallback ?? true, details: python.details, python_required: true },
      { status: python.status }
    )
  }
  return NextResponse.json(python.value)
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/compute/tin',
    description: 'Triangulated Irregular Network generation (Python compute service).',
    python_required: true,
  })
}

