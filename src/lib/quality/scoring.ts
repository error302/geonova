/**
 * Quality Scoring — Per-Surveyor Metrics
 * ======================================
 *
 * Aggregates audit chain data + project outcomes into per-surveyor
 * quality metrics. Turns Metardu from a tool into a practice
 * management system: surveyors can see their closure rates,
 * ArdhiSasa rejection rates, and average precision — useful for
 * ISK/EBK compliance audits.
 *
 * What it computes
 * ----------------
 * - Total surveys completed (by survey type)
 * - Statutory gate pass rate (% of submissions that passed the gate
 *   without block violations)
 * - Average precision ratio achieved (e.g. 1:8234 across all traverses)
 * - ArdhiSasa rejection proxy (gate block count = would-have-been
 *   rejections)
 * - Activity over time (surveys per month, trend)
 *
 * Data sources
 * ------------
 * - audit_chain table — every document generation, gate run, and
 *   submission is logged with user + timestamp + payload
 * - projects table — survey type, status, dates
 * - statutory gate results — embedded in audit payload metadata
 *
 * The metrics are computed on-demand (not pre-aggregated) from the
 * audit chain. This keeps the source of truth append-only and lets
 * us recompute metrics retroactively when rules change.
 *
 * Usage
 * -----
 *   import { computeSurveyorMetrics } from '@/lib/quality/scoring'
 *
 *   const metrics = await computeSurveyorMetrics({
 *     userId: 'user-123',
 *     dateFrom: '2026-01-01',
 *     dateTo: '2026-07-01',
 *   })
 *
 *   console.log(`Pass rate: ${metrics.gatePassRate.toFixed(1)}%`)
 */

import { db } from '@/lib/db'
// ─── Types ──────────────────────────────────────────────────────────────

export interface SurveyorMetricsQuery {
  userId: string
  /** ISO date. If omitted, no lower bound. */
  dateFrom?: string
  /** ISO date. If omitted, no upper bound (now). */
  dateTo?: string
}

export interface SurveyorMetrics {
  userId: string
  dateRange: { from: string | null; to: string | null }

  /** Total surveys (projects) the surveyor has worked on in the range. */
  totalSurveys: number

  /** Breakdown by survey type. */
  surveysByType: Record<string, number>

  /** Total audit chain entries by the surveyor. */
  totalAuditEntries: number

  /** Audit entries broken down by action. */
  auditEntriesByAction: Record<string, number>

  /**
   * Statutory gate pass rate (0-100).
   * Computed from audit entries with action='validate' or 'generate'
   * where payload.metadata.gatePassed is true.
   * Returns null if no gate runs were logged.
   */
  gatePassRate: number | null

  /** Total gate runs (validate or generate actions with gate metadata). */
  totalGateRuns: number

  /** Gate runs that passed (no block violations). */
  gatePasses: number

  /** Gate runs that failed (≥1 block violation). */
  gateFailures: number

  /**
   * Average precision ratio across all traverses (e.g. 8234 means 1:8234).
   * Computed from audit entries where payload carries traverse metadata.
   * Returns null if no traverse data.
   */
  averagePrecisionRatio: number | null

  /**
   * ArdhiSasa rejection proxy — the count of gate failures that would
   * have resulted in ArdhiSasa rejections if submitted. Lower is better.
   */
  estimatedRejectionsAvoided: number

  /** First activity timestamp. */
  firstActivityAt: string | null

  /** Last activity timestamp. */
  lastActivityAt: string | null

  /** Surveyor's name (denormalized from the most recent audit entry). */
  surveyorName: string | null

  /** Time the metrics computation took, in milliseconds. */
  elapsedMs: number
}

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Compute quality metrics for a surveyor from the audit chain.
 *
 * This is a read-only aggregation — no writes, no side effects.
 * The computation scans the audit_chain table filtered by user_id
 * and date range, then aggregates the results in-memory.
 *
 * For large audit chains (>10k entries) this could be optimized with
 * materialized views or pre-aggregation. For now, on-demand is fine.
 */
export async function computeSurveyorMetrics(
  query: SurveyorMetricsQuery
): Promise<SurveyorMetrics> {
  const startTime = Date.now()
  const { userId, dateFrom, dateTo } = query

  // Build the date filter
  const dateConditions: string[] = []
  const params: unknown[] = [userId]
  let paramIdx = 2
  if (dateFrom) {
    dateConditions.push(`created_at >= $${paramIdx++}`)
    params.push(dateFrom)
  }
  if (dateTo) {
    dateConditions.push(`created_at <= $${paramIdx++}`)
    params.push(dateTo)
  }
  const dateClause = dateConditions.length > 0
    ? 'AND ' + dateConditions.join(' AND ')
    : ''

  // Fetch all audit entries for this user in the date range
  const auditResult = await db.query(
    `SELECT * FROM audit_chain WHERE user_id = $1 ${dateClause} ORDER BY created_at ASC`,
    params
  )
  const auditEntries = auditResult.rows

  // Fetch projects this user worked on
  const projectsResult = await db.query(
    `SELECT survey_type, created_at FROM projects WHERE user_id = $1 ${dateClause}`,
    params
  )
  const projects = projectsResult.rows

  // Aggregate
  const surveysByType: Record<string, number> = {}
  for (const p of projects) {
    const st = String(p.survey_type ?? 'unknown')
    surveysByType[st] = (surveysByType[st] ?? 0) + 1
  }

  const auditEntriesByAction: Record<string, number> = {}
  let gatePasses = 0
  let gateFailures = 0
  let totalGateRuns = 0
  let precisionSum = 0
  let precisionCount = 0
  let surveyorName: string | null = null

  for (const entry of auditEntries) {
    const action = String(entry.action)
    auditEntriesByAction[action] = (auditEntriesByAction[action] ?? 0) + 1

    if (entry.user_name && !surveyorName) {
      surveyorName = String(entry.user_name)
    }

    // Parse payload (JSONB comes back as object in pg, but be defensive)
    let payload: any = entry.payload
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload) } catch { payload = {} }
    }

    // Gate pass/fail tracking
    const metadata = payload?.metadata
    if (metadata && typeof metadata.gatePassed === 'boolean') {
      totalGateRuns++
      if (metadata.gatePassed) {
        gatePasses++
      } else {
        gateFailures++
      }
    }

    // Precision ratio tracking (from traverse adjustments)
    if (action === 'adjust' && payload?.new?.precisionRatio) {
      const ratio = Number(payload.new.precisionRatio)
      if (!Number.isNaN(ratio) && ratio > 0) {
        precisionSum += ratio
        precisionCount++
      }
    }
  }

  const gatePassRate = totalGateRuns > 0
    ? (gatePasses / totalGateRuns) * 100
    : null

  const averagePrecisionRatio = precisionCount > 0
    ? precisionSum / precisionCount
    : null

  const firstEntry = auditEntries[0]
  const lastEntry = auditEntries[auditEntries.length - 1]
  const toIso = (v: any): string | null => {
    if (!v) return null
    if (v instanceof Date) return v.toISOString()
    return String(v)
  }

  return {
    userId,
    dateRange: { from: dateFrom ?? null, to: dateTo ?? null },
    totalSurveys: projects.length,
    surveysByType,
    totalAuditEntries: auditEntries.length,
    auditEntriesByAction,
    gatePassRate,
    totalGateRuns,
    gatePasses,
    gateFailures,
    averagePrecisionRatio,
    estimatedRejectionsAvoided: gateFailures,
    firstActivityAt: toIso(firstEntry?.created_at),
    lastActivityAt: toIso(lastEntry?.created_at),
    surveyorName,
    elapsedMs: Date.now() - startTime,
  }
}

/**
 * Format surveyor metrics as a human-readable summary.
 * Useful for display in a dashboard or a compliance audit report.
 */
export function formatSurveyorMetrics(metrics: SurveyorMetrics): string {
  const lines: string[] = [
    `Surveyor: ${metrics.surveyorName ?? metrics.userId}`,
    `Date range: ${metrics.dateRange.from ?? 'beginning'} to ${metrics.dateRange.to ?? 'now'}`,
    `Computed in ${metrics.elapsedMs}ms`,
    '',
    `Total surveys: ${metrics.totalSurveys}`,
    `Survey breakdown: ${Object.entries(metrics.surveysByType).map(([t, n]) => `${t}=${n}`).join(', ') || 'none'}`,
    '',
    `Audit entries: ${metrics.totalAuditEntries}`,
    `Action breakdown: ${Object.entries(metrics.auditEntriesByAction).map(([a, n]) => `${a}=${n}`).join(', ') || 'none'}`,
    '',
    `Statutory gate pass rate: ${metrics.gatePassRate !== null ? metrics.gatePassRate.toFixed(1) + '%' : 'no data'}`,
    `  Total gate runs: ${metrics.totalGateRuns}`,
    `  Passes: ${metrics.gatePasses}`,
    `  Failures: ${metrics.gateFailures}`,
    `  Estimated rejections avoided: ${metrics.estimatedRejectionsAvoided}`,
    '',
    `Average precision ratio: ${metrics.averagePrecisionRatio !== null ? '1:' + Math.round(metrics.averagePrecisionRatio) : 'no data'}`,
    '',
    `First activity: ${metrics.firstActivityAt ?? 'none'}`,
    `Last activity: ${metrics.lastActivityAt ?? 'none'}`,
  ]
  return lines.join('\n')
}

/**
 * Compute a simple quality score (0-100) from the metrics.
 *
 * Weighting:
 *   - 50% gate pass rate (higher is better)
 *   - 30% precision ratio (1:10000+ = 100, 1:5000 = 50, 1:1000 = 10)
 *   - 20% activity volume (log-scaled)
 *
 * Returns null if insufficient data (no gate runs AND no precision data).
 */
export function computeQualityScore(metrics: SurveyorMetrics): number | null {
  let gateScore: number | null = null
  if (metrics.gatePassRate !== null) {
    gateScore = metrics.gatePassRate
  }

  let precisionScore: number | null = null
  if (metrics.averagePrecisionRatio !== null) {
    precisionScore = Math.min(100, (metrics.averagePrecisionRatio / 10000) * 100)
  }

  let activityScore: number | null = null
  if (metrics.totalSurveys > 0) {
    activityScore = Math.min(100, 25 + 25 * Math.log10(metrics.totalSurveys + 1))
  }

  if (gateScore === null && precisionScore === null) return null

  let total = 0
  let weight = 0
  if (gateScore !== null) { total += gateScore * 0.5; weight += 0.5 }
  if (precisionScore !== null) { total += precisionScore * 0.3; weight += 0.3 }
  if (activityScore !== null) { total += activityScore * 0.2; weight += 0.2 }

  return weight > 0 ? Math.round(total / weight) : null
}
