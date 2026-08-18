export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { auth } from '@/lib/auth-v5'
import { setCurrentUserId } from '@/lib/db'
import { callPythonCompute } from '@/lib/compute/pythonService'
import { AutomatorReportSchema } from '@/lib/validation/apiSchemas'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  const userId = (session.user as { id?: string }).id
  if (userId) setCurrentUserId(String(userId))

  try {
    const rawBody: unknown = await request.json().catch(() => null)
    const parsed = AutomatorReportSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 422 }
      )
    }

    const { project_data, sections, style } = parsed.data

    const result = await callPythonCompute<unknown>(
      '/workflow/execute',
      {
        action: 'report',
        project_data,
        sections,
        style,
      },
      { timeoutMs: 60000 }
    )

    if (!result.ok) {
      const err = result as { ok: false; status: number; error: string }
      return NextResponse.json({ error: err.error }, { status: err.status })
    }

    return NextResponse.json(result.value)
  } catch (error) {
    logger.error('Report generation error:', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}