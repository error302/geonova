import { apiHandler, apiSuccess } from '@/lib/apiHandler'
import { db } from '@/lib/db'

interface CountRow {
  count: number
}

interface StatusCountRow {
  status: string | null
  count: number
}

interface TotalRow {
  total: number
}

interface MonthTotalRow {
  month: string
  total: number
}

interface SignupRow {
  id: string
  email: string
  full_name: string | null
  role: string
  created_at: string | Date
  plan_id: string | null
}

interface PlanCountRow {
  plan_id: string | null
  count: number
}

interface IskQueueRow {
  id: string
  email: string
  full_name: string | null
  isk_number: string | null
  created_at: string | Date
}

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/dashboard
 *
 * Returns platform-wide stats for the admin dashboard.
 * Requires auth + admin role.
 */
export const GET = apiHandler(
  { auth: true, roles: ['super_admin', 'admin', 'org_admin'] , rateLimit: { max: 60, windowMs: 60000 } },
  async () => {
    const startTime = Date.now()

    // ── User stats ──
    const [totalUsersRes, newUsersRes, activeUsersRes] = await Promise.all([
      db.query<CountRow>('SELECT COUNT(*)::int AS count FROM users'),
      db.query<CountRow>(
        `SELECT COUNT(*)::int AS count FROM users
         WHERE created_at >= date_trunc('month', CURRENT_DATE)`,
      ),
      db.query<CountRow>(
        `SELECT COUNT(*)::int AS count FROM users
         WHERE updated_at >= NOW() - INTERVAL '30 days'`,
      ),
    ])

    const totalUsers = totalUsersRes.rows[0]?.count ?? 0
    const newUsersThisMonth = newUsersRes.rows[0]?.count ?? 0
    const activeUsers = activeUsersRes.rows[0]?.count ?? 0

    // ── Project stats ──
    const [totalProjectsRes, projectsByStatusRes] = await Promise.all([
      db.query<CountRow>('SELECT COUNT(*)::int AS count FROM projects'),
      db.query<StatusCountRow>(
        `SELECT status, COUNT(*)::int AS count FROM projects GROUP BY status`,
      ),
    ])

    const totalProjects = totalProjectsRes.rows[0]?.count ?? 0
    const projectsByStatus: Record<string, number> = {}
    for (const row of projectsByStatusRes.rows) {
      projectsByStatus[row.status || 'unknown'] = row.count
    }

    // ── Parcel & beacon counts ──
    // AUDIT FIX (H-004, 2026-07-27): there is no `beacons` table — the schema
    // uses `public_beacons` and `rim_beacons`. Use UNION ALL so the count
    // reflects all beacons regardless of subtype.
    const [totalParcelsRes, totalBeaconsRes] = await Promise.all([
      db.query<CountRow>('SELECT COUNT(*)::int AS count FROM parcels'),
      db.query<CountRow>(
        'SELECT (SELECT COUNT(*) FROM public_beacons) + (SELECT COUNT(*) FROM rim_beacons) AS count'
      ),
    ])

    const totalParcels = totalParcelsRes.rows[0]?.count ?? 0
    const totalBeacons = totalBeaconsRes.rows[0]?.count ?? 0

    // ── Revenue stats ──
    const [totalRevenueRes, revenueByMonthRes] = await Promise.all([
      db.query<TotalRow>(
        `SELECT COALESCE(SUM(amount), 0)::float AS total FROM payment_history WHERE status = 'completed'`,
      ),
      db.query<MonthTotalRow>(
        `SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COALESCE(SUM(amount), 0)::float AS total
         FROM payment_history
         WHERE status = 'completed'
         GROUP BY TO_CHAR(created_at, 'YYYY-MM')
         ORDER BY month DESC
         LIMIT 12`,
      ),
    ])

    const totalRevenue = totalRevenueRes.rows[0]?.total ?? 0
    const revenueByMonth = revenueByMonthRes.rows.map((row: any) => ({
      month: row.month,
      total: row.total,
    }))

    // ── Recent signups (last 10) ──
    const recentSignupsRes = await db.query<SignupRow>(
      `SELECT u.id, u.email, u.full_name, u.role, u.created_at,
              us.plan_id
       FROM users u
       LEFT JOIN user_subscriptions us ON us.user_id = u.id
       ORDER BY u.created_at DESC
       LIMIT 10`,
    )

    const recentSignups = recentSignupsRes.rows.map((row: any) => ({
      id: row.id,
      email: row.email,
      name: row.full_name || row.email?.split('@')[0],
      role: row.role,
      plan: row.plan_id || 'free',
      createdAt: row.created_at,
    }))

    // ── ISK Verification Queue ──
    const iskPendingRes = await db.query<CountRow>(
      `SELECT COUNT(*)::int AS count FROM users WHERE verified_isk = false AND isk_number IS NOT NULL`,
    )
    const iskPendingCount = iskPendingRes.rows[0]?.count ?? 0

    // ── Subscription breakdown ──
    const subCountsRes = await db.query<PlanCountRow>(
      `SELECT plan_id, COUNT(*)::int AS count FROM user_subscriptions GROUP BY plan_id`,
    )
    const activeSubscriptions: Record<string, number> = { free: 0, pro: 0, enterprise: 0 }
    for (const row of subCountsRes.rows) {
      const plan = row.plan_id || 'free'
      activeSubscriptions[plan] = (activeSubscriptions[plan] || 0) + row.count
    }

    // ── Submissions this month ──
    const submissionsRes = await db.query<CountRow>(
      `SELECT COUNT(*)::int AS count FROM submissions WHERE created_at >= date_trunc('month', CURRENT_DATE)`,
    )
    const submissionsThisMonth = submissionsRes.rows[0]?.count ?? 0

    // ── ISK pending users (for queue display) ──
    const iskQueueRes = await db.query<IskQueueRow>(
      `SELECT id, email, full_name, isk_number, created_at
       FROM users
       WHERE verified_isk = false AND isk_number IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 10`,
    )
    const iskQueue = iskQueueRes.rows.map((row: any) => ({
      id: row.id,
      email: row.email,
      name: row.full_name || row.email?.split('@')[0],
      iskNumber: row.isk_number,
      submittedAt: row.created_at,
    }))

    // ── System health ──
    let dbStatus = 'healthy'
    let dbLatencyMs = 0
    try {
      const healthStart = Date.now()
      await db.query<never>('SELECT 1')
      dbLatencyMs = Date.now() - healthStart
    } catch {
      dbStatus = 'unhealthy'
    }

    const uptime = process.uptime()
    const memoryUsage = process.memoryUsage()

    const responseTime = Date.now() - startTime

    return apiSuccess({
      users: {
        total: totalUsers,
        newThisMonth: newUsersThisMonth,
        active: activeUsers,
      },
      projects: {
        total: totalProjects,
        byStatus: projectsByStatus,
      },
      parcels: totalParcels,
      beacons: totalBeacons,
      revenue: {
        total: totalRevenue,
        byMonth: revenueByMonth,
      },
      recentSignups,
      iskPendingCount,
      iskQueue,
      activeSubscriptions,
      submissionsThisMonth,
      system: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
        },
        uptime: Math.floor(uptime),
        memory: {
          heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
        },
        responseTimeMs: responseTime,
      },
    })
  },
)
