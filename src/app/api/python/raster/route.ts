export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth-v5'
import { setCurrentUserId } from '@/lib/db'
import { callPythonCompute } from '@/lib/compute/pythonService'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  const userId = session.user.id
  if (userId) setCurrentUserId(String(userId))

  try {
    const body: unknown = await req.json()
    const result = await callPythonCompute('raster', body)
    if (result.ok) {
      return NextResponse.json(result.value)
    } else {
      const err = result as { ok: false; status: number; error: string }
      return NextResponse.json({ error: err.error }, { status: err.status })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
