export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/weekly-digest
 *
 * Monday-morning batch sender for the weekly digest email. Summarises each
 * opted-in user's project activity over the past 7 days and sends the
 * branded weeklyDigest template directly (no self-HTTP per-user calls).
 *
 * Recipients: users whose `profiles.notification_preferences->'email'->>'weekly_digest'`
 * is `true` (default from migration 022) AND who had activity in the window —
 * zero-activity users are skipped to avoid empty-digest noise.
 *
 * The per-user route (POST /api/emails/weekly-digest) remains for manual /
 * individual sends; this scheduler batches everyone in one invocation.
 *
 * Auth: Bearer API_ADMIN_KEY only.
 *
 * Designed to be called by a Monday-morning cron
 * (see .github/workflows/weekly-digest.yml).
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendTemplatedEmail } from '@/lib/email-templates'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://metardu.space'
// Cap the batch so a single run never hammers the mail service.
const MAX_BATCH = 200

interface DigestTotalsRow {
  user_id: string
  email: string
  full_name: string | null
  projects_active: number
  projects_completed: number
  points_collected: number
  documents_generated: number
  pending_submissions: number
}

interface DigestProjectRow {
  user_id: string
  project_id: string
  name: string
  status: string
  new_observations: number
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const serviceKey = process.env.API_ADMIN_KEY
  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const weekEnd = new Date().toISOString()

  // ── 1. Opted-in users + their 7-day activity totals (one pass per user) ──
  const { rows: totals } = await db.query<DigestTotalsRow>(
    `SELECT
       u.id::text AS user_id,
       u.email,
       u.full_name,
       COALESCE(m.projects_active, 0)::int    AS projects_active,
       COALESCE(m.projects_completed, 0)::int AS projects_completed,
       COALESCE(m.points_collected, 0)::int   AS points_collected,
       COALESCE(m.documents_generated, 0)::int AS documents_generated,
       COALESCE(m.pending_submissions, 0)::int AS pending_submissions
     FROM users u
     JOIN profiles p ON p.id = u.id
     LEFT JOIN LATERAL (
       SELECT
         COUNT(DISTINCT CASE
           WHEN pr.status = 'active'
            AND (pr.created_at >= $1 OR pr.updated_at >= $1 OR pr.last_fieldbook_update >= $1)
           THEN pr.id END)::int AS projects_active,
         COUNT(DISTINCT CASE
           WHEN pr.status = 'completed' AND pr.updated_at >= $1
           THEN pr.id END)::int AS projects_completed,
         COUNT(DISTINCT CASE WHEN sp.created_at >= $1 THEN sp.id END)::int AS points_collected,
         COUNT(DISTINCT CASE
           WHEN COALESCE(sr.generated_at, sr.created_at) >= $1
           THEN sr.id END)::int AS documents_generated,
         COUNT(DISTINCT CASE
           WHEN ps.package_status IN ('draft', 'incomplete')
           THEN ps.id END)::int AS pending_submissions
       FROM projects pr
       LEFT JOIN survey_points sp        ON sp.project_id = pr.id
       LEFT JOIN survey_reports sr       ON sr.project_id = pr.id
       LEFT JOIN project_submissions ps  ON ps.project_id = pr.id
       WHERE pr.user_id = u.id
     ) m ON true
     WHERE p.notification_preferences->'email'->>'weekly_digest' = 'true'
     ORDER BY u.id
     LIMIT $2`,
    [weekStart, MAX_BATCH]
  )

  // ── 2. Skip users with zero activity — an empty digest is just noise ──
  const activeUsers = totals.filter(
    (t: any) =>
      t.projects_active > 0 ||
      t.projects_completed > 0 ||
      t.points_collected > 0 ||
      t.documents_generated > 0 ||
      t.pending_submissions > 0
  )

  if (activeUsers.length === 0) {
    return NextResponse.json({ success: true, sent: 0, skipped: totals.length, failed: 0, failedDetails: [] })
  }

  // ── 3. Highlight projects: top 3 active projects per user by new activity ──
  const userIds = activeUsers.map((t: any) => t.user_id)
  const { rows: projectRows } = await db.query<DigestProjectRow>(
    `SELECT
       pr.user_id::text AS user_id,
       pr.id::text AS project_id,
       pr.name,
       pr.status,
       (
         (SELECT COUNT(*) FROM survey_points sp2 WHERE sp2.project_id = pr.id AND sp2.created_at >= $1)
         + (SELECT COUNT(*) FROM traverse_observations t2
              JOIN parcel_traverses pt ON pt.id = t2.traverse_id
              WHERE pt.project_id = pr.id AND t2.created_at >= $1)
         + (SELECT COUNT(*) FROM level_observations l2
              JOIN level_networks ln ON ln.id = l2.network_id
              WHERE ln.project_id = pr.id AND l2.created_at >= $1)
       )::int AS new_observations
     FROM projects pr
     WHERE pr.user_id = ANY($2::uuid[])
       AND pr.status = 'active'
       AND pr.id IN (
         SELECT sp3.project_id FROM survey_points sp3 WHERE sp3.created_at >= $1
         UNION
         SELECT pt.project_id FROM traverse_observations t3
           JOIN parcel_traverses pt ON pt.id = t3.traverse_id WHERE t3.created_at >= $1
         UNION
         SELECT ln.project_id FROM level_observations l3
           JOIN level_networks ln ON ln.id = l3.network_id WHERE l3.created_at >= $1
       )
     ORDER BY new_observations DESC
     LIMIT $3`,
    [weekStart, userIds, activeUsers.length * 3]
  )

  const highlightsByUser = new Map<string, DigestProjectRow[]>()
  for (const row of projectRows) {
    const list = highlightsByUser.get(row.user_id) ?? []
    if (list.length < 3) list.push(row)
    highlightsByUser.set(row.user_id, list)
  }

  // ── 4. Send + report ──
  let sent = 0
  let skipped = 0
  const failed: Array<{ email: string; error: string }> = []

  for (const user of activeUsers) {
    const highlights = (highlightsByUser.get(user.user_id) ?? []).map((h) => ({
      name: h.name,
      status: h.status as 'active' | 'completed' | 'archived',
      newObservations: h.new_observations,
      projectUrl: `${APP_URL}/project/${h.project_id}`,
    }))

    const result = await sendTemplatedEmail('weeklyDigest', {
      to: user.email,
      name: user.full_name || '',
      weekStart,
      weekEnd,
      projectsActive: user.projects_active,
      projectsCompleted: user.projects_completed,
      pointsCollected: user.points_collected,
      documentsGenerated: user.documents_generated,
      pendingSubmissions: user.pending_submissions,
      highlightedProjects: highlights,
    })

    if (result.success) {
      sent += 1
    } else if (result.error === 'Email service not configured') {
      // Not an error — mail service is off (e.g. dev/staging).
      skipped += 1
    } else {
      failed.push({ email: user.email, error: result.error || 'Send failed' })
    }
  }

  return NextResponse.json({
    success: true,
    sent,
    failed: failed.length,
    failedDetails: failed,
    skipped: skipped + (totals.length - activeUsers.length),
  })
}
