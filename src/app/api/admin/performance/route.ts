import { apiHandler, apiSuccess } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/performance
 *
 * Stores client-side Web Vitals metrics for the admin performance monitor.
 * AUDIT FIX (H-005, 2026-07-27): the route did not exist — `PerformanceMonitor.tsx`
 * POSTs to /api/admin/performance and was getting 404s. Persist to audit_logs
 * so admins can inspect latency trends from the platform DB.
 */

const VitalsSchema = z.object({
  vitals: z
    .array(
      z.object({
        name: z.string().min(1).max(40),
        value: z.number().finite(),
      }),
    )
    .min(1)
    .max(20),
  url: z.string().max(2048).optional(),
  timestamp: z.number().int().nonnegative(),
})

export const POST = apiHandler(
  {
    auth: true,
    roles: ['super_admin', 'admin', 'org_admin'],
    schema: VitalsSchema,
    rateLimit: { max: 60, windowMs: 60000 },
  },
  async (_req, ctx) => {
    const { vitals, url, timestamp } = ctx.body as z.infer<typeof VitalsSchema>

    await db.query(
      `INSERT INTO audit_logs (action, details, user_id, table_name)
       VALUES ($1, $2, $3, $4)`,
      [
        'web_vitals',
        JSON.stringify({ vitals, url: url ?? '', timestamp }),
        ctx.userId,
        'performance_metrics',
      ],
    )

    return apiSuccess({ stored: vitals.length })
  },
)
