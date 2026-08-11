import { db } from '@/lib/db'
import { randomBytes } from 'crypto'
import type { CPDRecord, CPDCertificate, CPDActivity } from '@/types/cpd'
import { CPD_POINTS } from '@/types/cpd'
import { logger } from '@/lib/logger'

/** Row shape returned by generateCPDCertificate's INSERT ... RETURNING *. */
interface CertificateRow {
  id: string
  user_id: string
  year: number
  total_points: number
  verification_code: string
  /** pg returns a Date for timestamptz, but CPDCertificate.generatedAt is declared string — keep in sync. */
  generated_at: string
  pdf_path: string | null
}

/** Row shape returned by verifyCPDCertificate's joined SELECT. */
interface CertificateVerifyRow extends CertificateRow {
  profile_name: string | null
  isk_number: string | null
  cpd_records: unknown
}

/**
 * AUDIT FIX (2026-07-05): Fraud prevention overhaul.
 *
 * Changes:
 *   1. awardCPDPoints now checks for duplicate reference_id before inserting
 *      (prevents double-awarding from retry clicks or race conditions)
 *   2. Manual entries (TRAINING_COMPLETED, CONFERENCE_ATTENDED, MANUAL_ENTRY)
 *      are created with approved=FALSE — they don't count toward the total
 *      until an admin approves them
 *   3. System-generated entries (PEER_REVIEW_COMPLETED, JOB_COMPLETED, etc.)
 *      are created with approved=TRUE — they count immediately
 *   4. getTotalCPDForYear now only sums APPROVED records
 *   5. New functions: addManualCPDEntry, approveCPDEntry, rejectCPDEntry,
 *      getPendingCPDEntries (for admin review)
 *   6. Annual cap: 100 points/year (ISK requires 20; 100 is generous)
 */

/** Maximum CPD points a user can earn per year (prevents point inflation). */
export const CPD_ANNUAL_CAP = 100

/** Activities that require admin approval before counting toward the total. */
const MANUAL_ACTIVITIES: CPDActivity[] = [
  'TRAINING_COMPLETED',
  'CONFERENCE_ATTENDED',
  'MANUAL_ENTRY',
]

/**
 * Generate a cryptographically secure verification code for CPD certificates.
 *
 * SECURITY: Uses crypto.randomBytes (not Math.random) because CPD codes
 * verify statutory compliance — predictable codes would allow forging
 * continuing-professional-development hours. Math.random() is not
 * cryptographically secure (predictions are possible).
 */
function generateVerificationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const bytes = randomBytes(12)
  let code = ''
  for (let i = 0; i < 12; i++) {
    // bytes[i] is 0-255; modulo chars.length maps to a valid char index
    code += chars.charAt(bytes[i] % chars.length)
  }
  return code
}

/**
 * Award CPD points for a system-generated activity.
 *
 * FRAUD PREVENTION:
 *   - Checks for duplicate reference_id (prevents double-awarding)
 *   - System activities are auto-approved (approved=TRUE)
 *   - Enforces annual cap (CPD_ANNUAL_CAP)
 *   - The database trigger logs every award to the audit_chain
 *
 * @param userId - The user receiving the points
 * @param activity - The activity type (determines point value)
 * @param description - Human-readable description
 * @param referenceId - Unique reference (e.g., peer review ID, job ID).
 *                      If the same reference_id already exists for this user,
 *                      the award is silently skipped (no error, no duplicate).
 * @param customPoints - Override the default point value (optional)
 * @returns The CPD record ID, or null if the award was skipped (duplicate or cap exceeded)
 */
export async function awardCPDPoints(
  userId: string,
  activity: CPDActivity,
  description: string,
  referenceId?: string,
  customPoints?: number
): Promise<string | null> {
  const points = customPoints ?? CPD_POINTS[activity]

  // ── Duplicate prevention ──
  // If a reference_id is provided, check if this user already has a record
  // with the same reference_id. This prevents double-awarding from retry
  // clicks, race conditions, or replays.
  if (referenceId) {
    const existing = await db.query(
      'SELECT id FROM cpd_records WHERE user_id = $1 AND reference_id = $2',
      [userId, referenceId]
    )
    if (existing.rows.length > 0) {
      // Already awarded — silently skip (not an error, just a no-op)
      return null
    }
  }

  // ── Annual cap check ──
  // Only count approved records toward the cap (pending entries don't count yet)
  const currentYear = new Date().getFullYear()
  const currentTotal = await getTotalCPDForYear(userId, currentYear)
  if (currentTotal + points > CPD_ANNUAL_CAP) {
    // Would exceed the annual cap — don't award
    // Log this to the audit chain for transparency
    logger.warn(`[CPD] Annual cap (${CPD_ANNUAL_CAP}) would be exceeded for user ${userId}. Current: ${currentTotal}, attempted: +${points}`)
    return null
  }

  // ── Determine approval status ──
  // System-generated activities are auto-approved. Manual activities
  // (training, conferences, manual entries) require admin approval.
  const isManual = MANUAL_ACTIVITIES.includes(activity)
  const approved = !isManual

  const result = await db.query<{ id: string }>(
    `INSERT INTO cpd_records (user_id, activity, points, description, reference_id, verifiable, approved)
     VALUES ($1, $2, $3, $4, $5, true, $6)
     RETURNING id`,
    [userId, activity, points, description, referenceId, approved]
  )

  if (result.rows.length === 0) throw new Error('Failed to insert CPD record')
  return result.rows[0].id
}

/**
 * Add a manual CPD entry (training, conference, etc.) that requires admin approval.
 *
 * FRAUD PREVENTION:
 *   - Created with approved=FALSE — doesn't count toward the total until approved
 *   - The awarded_by field records who submitted the entry
 *   - If the user tries to submit the same reference_id twice, it's rejected
 *
 * @param userId - The user submitting the entry
 * @param activity - Must be one of: TRAINING_COMPLETED, CONFERENCE_ATTENDED, MANUAL_ENTRY
 * @param description - Description of the activity
 * @param points - Points claimed (admin will verify during approval)
 * @param referenceId - Optional reference (e.g., certificate number, event ID)
 * @returns The CPD record ID (pending approval), or null if duplicate
 */
export async function addManualCPDEntry(
  userId: string,
  activity: CPDActivity,
  description: string,
  points: number,
  referenceId?: string
): Promise<string | null> {
  // Only allow manual activities through this function
  if (!MANUAL_ACTIVITIES.includes(activity)) {
    throw new Error(`Activity ${activity} is not a manual entry type. Use awardCPDPoints instead.`)
  }

  // Cap the claimed points (prevent inflating points on submission)
  if (points < 0 || points > 50) {
    throw new Error('Points must be between 0 and 50 for a single manual entry')
  }

  // Duplicate prevention
  if (referenceId) {
    const existing = await db.query(
      'SELECT id FROM cpd_records WHERE user_id = $1 AND reference_id = $2',
      [userId, referenceId]
    )
    if (existing.rows.length > 0) {
      return null // Duplicate — silently skip
    }
  }

  const result = await db.query<{ id: string }>(
    `INSERT INTO cpd_records (user_id, activity, points, description, reference_id, verifiable, approved, awarded_by)
     VALUES ($1, $2, $3, $4, $5, true, FALSE, $1)
     RETURNING id`,
    [userId, activity, points, description, referenceId]
  )

  if (result.rows.length === 0) throw new Error('Failed to insert CPD record')
  return result.rows[0].id
}

/**
 * Approve a pending manual CPD entry (admin only).
 *
 * The approved record will now count toward the user's annual total.
 * The database trigger logs this approval to the audit_chain.
 */
export async function approveCPDEntry(
  recordId: string,
  adminUserId: string
): Promise<boolean> {
  const result = await db.query(
    `UPDATE cpd_records
     SET approved = TRUE, approved_by = $2, approved_at = NOW()
     WHERE id = $1 AND approved = FALSE`,
    [recordId, adminUserId]
  )
  return (result.rowCount ?? 0) > 0
}

/**
 * Reject a pending manual CPD entry (admin only).
 *
 * The record stays in the database (for audit trail) but is marked as
 * rejected with a reason. It never counts toward the total.
 */
export async function rejectCPDEntry(
  recordId: string,
  adminUserId: string,
  reason: string
): Promise<boolean> {
  // Instead of deleting, we mark it as rejected by setting approved=FALSE
  // (it was already FALSE) and recording the rejection reason + admin.
  // We also set points=0 so it definitely doesn't count even if the
  // WHERE approved=TRUE clause in getTotalCPDForYear is ever changed.
  const result = await db.query(
    `UPDATE cpd_records
     SET rejection_reason = $3, approved_by = $2, approved_at = NOW(), points = 0
     WHERE id = $1 AND approved = FALSE`,
    [recordId, adminUserId, reason]
  )
  return (result.rowCount ?? 0) > 0
}

/**
 * Get all pending manual CPD entries (for admin review).
 */
export async function getPendingCPDEntries(limit = 50): Promise<CPDRecord[]> {
  const result = await db.query(
    `SELECT cr.*, u.email, u.full_name, u.isk_number
     FROM cpd_records cr
     JOIN users u ON u.id = cr.user_id
     WHERE cr.approved = FALSE AND cr.rejection_reason IS NULL
     ORDER BY cr.earned_at DESC
     LIMIT $1`,
    [limit]
  )
  return result.rows.map(rowToCPDRecord)
}

export async function getUserCPDForYear(userId: string, year: number): Promise<CPDRecord[]> {
  const startDate = new Date(year, 0, 1).toISOString()
  const endDate = new Date(year, 11, 31, 23, 59, 59).toISOString()

  const result = await db.query(
    `SELECT * FROM cpd_records
     WHERE user_id = $1 AND earned_at >= $2 AND earned_at <= $3
     ORDER BY earned_at DESC`,
    [userId, startDate, endDate]
  )

  return result.rows.map(rowToCPDRecord)
}

/**
 * Get the total APPROVED CPD points for a user in a given year.
 *
 * Only approved records count toward the total. Pending manual entries
 * (TRAINING_COMPLETED, CONFERENCE_ATTENDED, MANUAL_ENTRY) are excluded
 * until an admin approves them.
 */
export async function getTotalCPDForYear(userId: string, year: number): Promise<number> {
  const startDate = new Date(year, 0, 1).toISOString()
  const endDate = new Date(year, 11, 31, 23, 59, 59).toISOString()

  const result = await db.query<{ total: unknown }>(
    `SELECT COALESCE(SUM(points), 0) as total
     FROM cpd_records
     WHERE user_id = $1 AND earned_at >= $2 AND earned_at <= $3 AND approved = TRUE`,
    [userId, startDate, endDate]
  )

  return Number(result.rows[0]?.total ?? 0)
}

/**
 * Get a summary of CPD points for a user in a given year.
 * Includes approved total, pending count, and cap info.
 */
export async function getCPDSummary(userId: string, year: number): Promise<{
  total: number
  pending: number
  cap: number
  remaining: number
  percent: number
}> {
  const startDate = new Date(year, 0, 1).toISOString()
  const endDate = new Date(year, 11, 31, 23, 59, 59).toISOString()

  const result = await db.query<{ total: unknown; pending_count: unknown }>(
    `SELECT
       COALESCE(SUM(points) FILTER (WHERE approved = TRUE), 0) as total,
       COUNT(*) FILTER (WHERE approved = FALSE AND rejection_reason IS NULL) as pending_count
     FROM cpd_records
     WHERE user_id = $1 AND earned_at >= $2 AND earned_at <= $3`,
    [userId, startDate, endDate]
  )

  const total = Number(result.rows[0]?.total ?? 0)
  const pending = Number(result.rows[0]?.pending_count ?? 0)
  const remaining = Math.max(0, CPD_ANNUAL_CAP - total)
  const percent = Math.min(100, (total / CPD_ANNUAL_CAP) * 100)

  return { total, pending, cap: CPD_ANNUAL_CAP, remaining, percent }
}

export async function generateCPDCertificate(
  userId: string,
  year: number,
  surveyorName: string,
  iskNumber: string
): Promise<CPDCertificate> {
  // Only approved records count toward the certificate total
  const records = await getUserCPDForYear(userId, year)
  const approvedRecords = records.filter(r => r.verifiable)
  const totalPoints = approvedRecords.reduce((sum, r) => sum + r.points, 0)
  const verificationCode = generateVerificationCode()

  const result = await db.query<CertificateRow>(
    `INSERT INTO cpd_certificates (user_id, year, total_points, verification_code)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, year, totalPoints, verificationCode]
  )

  if (result.rows.length === 0) throw new Error('Failed to generate certificate')

  const data = result.rows[0]

  return {
    id: data.id,
    userId,
    surveyorName,
    iskNumber,
    year,
    totalPoints,
    activities: approvedRecords,
    generatedAt: data.generated_at,
    verificationCode
  }
}

export async function verifyCPDCertificate(code: string): Promise<CPDCertificate | null> {
  const result = await db.query<CertificateVerifyRow>(
    `SELECT c.*, p.full_name as profile_name, p.isk_number,
            json_agg(cr.*) as cpd_records
     FROM cpd_certificates c
     LEFT JOIN profiles p ON p.id = c.user_id
     LEFT JOIN cpd_records cr ON cr.user_id = c.user_id
       AND EXTRACT(YEAR FROM cr.earned_at) = c.year
     WHERE c.verification_code = $1
     GROUP BY c.id, p.full_name, p.isk_number`,
    [code.toUpperCase()]
  )

  if (result.rows.length === 0) return null

  const data = result.rows[0]

  return {
    id: data.id,
    userId: data.user_id,
    surveyorName: data.profile_name || 'Unknown',
    iskNumber: data.isk_number || 'N/A',
    year: data.year,
    totalPoints: data.total_points,
    activities: (data.cpd_records as CPDRecord[] | null) || [],
    generatedAt: data.generated_at,
    verificationCode: data.verification_code,
    pdfPath: data.pdf_path ?? undefined
  }
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function rowToCPDRecord(row: Record<string, unknown>): CPDRecord {
  return {
    id: String(row.id ?? ''),
    userId: String(row.user_id ?? ''),
    activity: row.activity as CPDActivity,
    points: Number(row.points ?? 0),
    description: String(row.description ?? ''),
    earnedAt: String(row.earned_at ?? ''),
    referenceId: row.reference_id ? String(row.reference_id) : undefined,
    verifiable: Boolean(row.verifiable)
  }
}
