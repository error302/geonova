/**
 * P2-1 Phase 13 Workstream 2: Surveyor Identity Unification
 *
 * Replaces all localStorage.getItem('surveyorName') / localStorage.getItem('registrationNo')
 * references with a single DB-backed profile lookup. Every official document
 * must source surveyor identity from this function only.
 *
 * @module submission/surveyorProfile
 */

import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SurveyorProfile } from '@/types/submission'

/**
 * Get the active surveyor profile for the current user.
 *
 * The profile is sourced from the `surveyor_profiles` table, NOT from
 * localStorage. This is the single source of truth for surveyor identity
 * in all official document generation, submission numbering, and deed
 * plan signing.
 *
 * Can be called with no arguments (derives userId from the NextAuth
 * session) or with an explicit userId (for API routes that already
 * have ctx.userId).
 *
 * Usage:
 *   // In a route handler with apiHandler:
 *   const profile = await getActiveSurveyorProfile(ctx.userId)
 *
 *   // In a server component or lib function without ctx:
 *   const profile = await getActiveSurveyorProfile()
 *
 * @param userId - Optional. If omitted, derives from the NextAuth session.
 * @returns The surveyor profile, or null if not configured
 */
export async function getActiveSurveyorProfile(userId?: string): Promise<SurveyorProfile | null> {
  // If userId not provided, derive from session
  if (!userId) {
    const session = await getServerSession(authOptions)
    const sessionUserId = (session?.user as { id?: string })?.id
    if (!sessionUserId) return null
    userId = sessionUserId
  }

  const { rows } = await db.query(
    `SELECT
       id, user_id, full_name, registration_number,
       firm_name, seal_url, signature_url
     FROM surveyor_profiles
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  )

  if (rows.length === 0) return null

  const row = rows[0]
  return {
    id: row.id,
    user_id: row.user_id,
    full_name: row.full_name,
    registration_number: row.registration_number,
    firm_name: row.firm_name ?? undefined,
    seal_url: row.seal_url ?? undefined,
    signature_url: row.signature_url ?? undefined,
  }
}

/**
 * Get the surveyor profile by profile ID (for submission record lookup).
 */
export async function getSurveyorProfileById(profileId: string): Promise<SurveyorProfile | null> {
  const { rows } = await db.query(
    `SELECT
       id, user_id, full_name, registration_number,
       firm_name, seal_url, signature_url
     FROM surveyor_profiles
     WHERE id = $1
     LIMIT 1`,
    [profileId],
  )

  if (rows.length === 0) return null

  const row = rows[0]
  return {
    id: row.id,
    user_id: row.user_id,
    full_name: row.full_name,
    registration_number: row.registration_number,
    firm_name: row.firm_name ?? undefined,
    seal_url: row.seal_url ?? undefined,
    signature_url: row.signature_url ?? undefined,
  }
}
