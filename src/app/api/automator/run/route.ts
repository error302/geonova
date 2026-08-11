export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { setCurrentUserId } from '@/lib/db'
import { callPythonCompute } from '@/lib/compute/pythonService'
import { z } from 'zod'

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const AutomatorRunSchema = z.object({
  workflowId: z.string().uuid(),
  inputs: z.record(z.unknown()),
  nodes: z.array(z.record(z.unknown())).min(1).optional(),
  edges: z.array(z.record(z.unknown())).min(1).optional(),
})

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  const userId = (session.user as { id?: string }).id
  if (userId) setCurrentUserId(String(userId))

  try {
    const rawBody = await request.json()
    const parsed = AutomatorRunSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
    }

    const { workflowId, inputs, nodes, edges } = parsed.data

    if (!nodes && !edges) {
      return NextResponse.json({ error: 'Missing nodes or edges' }, { status: 400 })
    }
    
    const result = await callPythonCompute<Record<string, unknown>>(
      '/workflow/execute',
      { action: 'execute', workflowId, inputs, nodes, edges },
      { timeoutMs: 120000 }
    )
    
    if (!result.ok) {
      const err = result as { ok: false; status: number; error: string }
      return NextResponse.json({ error: err.error }, { status: err.status })
    }
    
    return NextResponse.json(result.value)
  } catch (error) {
    logger.error('Workflow execution error:', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
