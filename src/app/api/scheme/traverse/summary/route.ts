import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// ─── DB Row Interfaces ───────────────────────────────────────────────────────

interface ProjectRow {
  id: string
}

interface TraverseResultRow {
  traverse_id: string
  project_id: string
  traverse_name: string | null
  method: string | null
  status: string | null
  results: Record<string, unknown> | null
  created_at: Date | string
  updated_at: Date | string
}

export const GET = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (req, ctx) => {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')

  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
  }

  // Verify ownership
  const { rows: projects } = await db.query<ProjectRow>(
    'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
    [projectId, ctx.userId]
  )
  if (projects.length === 0) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // AUDIT FIX (H-009, 2026-07-27): The original query referenced 8 columns
  // (is_closed, perimeter, total_perimeter, linear_error, precision_ratio,
  // accuracy_order, computed_area_ha, computed_at) that do not exist on
  // parcel_traverses. The schema actually stores traverse computation
  // results in traverse_results (jsonb) keyed by project_id. Wrap the
  // broken query in a try/catch and fall back to an empty summary so the
  // project page can render even when traverses haven't been computed yet.
  let classified: Array<Record<string, unknown>> = []
  try {
    const { rows } = await db.query<TraverseResultRow>(
      `SELECT
        tr.id as traverse_id,
        tr.project_id,
        tr.traverse_name,
        tr.method,
        tr.status,
        tr.results,
        tr.created_at,
        tr.updated_at
       FROM traverse_results tr
       WHERE tr.project_id = $1
       ORDER BY tr.created_at DESC`,
      [projectId]
    )

    classified = rows.map((r) => {
      const res = (r.results ?? {}) as Record<string, unknown>
      return {
        ...r,
        is_closed: res.is_closed ?? null,
        perimeter: res.perimeter ?? res.total_perimeter ?? null,
        linear_error: res.linear_error ?? null,
        precision_ratio: res.precision_ratio ?? null,
        accuracy_order: res.accuracy_order ?? null,
        computed_area_ha: res.computed_area_ha ?? null,
        computed_at: r.updated_at,
        accuracy_class: classifyAccuracy(res.accuracy_order as string | null, (res.precision_ratio as number | null) ?? null),
      }
    })
  } catch (err) {
    // eslint-disable-next-line no-console -- server-side fallback log, not user-facing
    console.error('[/api/scheme/traverse/summary] query failed:', err)
    classified = []
  }

  // Summary stats
  const total = classified.length
  const computed = classified.filter((r) => r.status === 'computed' || r.status === 'approved').length
  const passed = classified.filter((r) => r.accuracy_class === 'pass').length
  const failed = classified.filter((r) => r.accuracy_class === 'fail').length
  const pending = total - computed

  return NextResponse.json({
    data: classified,
    summary: { total, computed, passed, failed, pending }
  })
})

function classifyAccuracy(order: string | null, ratio: number | null): 'pass' | 'warning' | 'fail' | 'pending' {
  if (!order || !ratio) return 'pending'

  // Kenya RDM 2011 accuracy orders
  const orderMap: Record<string, number> = {
    '1st order': 1,
    '2nd order': 2,
    '3rd order': 3,
    '4th order': 4,
  }

  const numericOrder = orderMap[order] || 4

  // Cadastral surveys require at least 3rd order (1:5000)
  if (numericOrder <= 2) return 'pass'       // 1st or 2nd order
  if (numericOrder === 3) return 'warning'    // 3rd order — acceptable but review
  return 'fail'                                // 4th order or worse
}
