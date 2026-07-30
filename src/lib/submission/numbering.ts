/**
 * P2-1 Phase 13 Workstream 3: SRVY2025-1 Submission Numbering
 *
 * Format: [RegNo]_[YYYY]_[###]_[R##]
 * Example: RS149_2025_002_R00
 *
 * The sequence is atomically incremented via the `increment_submission_sequence`
 * PL/pgSQL function (migration 047), which uses INSERT ... ON CONFLICT
 * DO UPDATE ... RETURNING for race-free concurrent numbering.
 *
 * @module submission/numbering
 */

import { db } from '@/lib/db'

export interface SubmissionNumberResult {
  submissionNumber: string   // e.g. "RS149_2025_002_R00"
  sequence: number           // e.g. 2
  year: number               // e.g. 2025
  revisionCode: string       // e.g. "R00"
}

/**
 * Generate a new submission number for a surveyor.
 *
 * Atomically increments the per-surveyor, per-year sequence via the
 * `increment_submission_sequence` PL/pgSQL function. The sequence is
 * guaranteed unique even under concurrent requests.
 *
 * @param surveyorProfileId - UUID from surveyor_profiles.id
 * @param registrationNo    - e.g. "RS149" (from surveyor_profiles.registration_number)
 * @returns The formatted submission number + components
 *
 * @example
 * const result = await generateSubmissionNumber(profile.id, profile.registration_number)
 * // result.submissionNumber = "RS149_2025_002_R00"
 */
export async function generateSubmissionNumber(
  surveyorProfileId: string,
  registrationNo: string,
): Promise<SubmissionNumberResult> {
  const year = new Date().getFullYear()

  // Atomically increment the sequence
  const { rows } = await db.query(
    `SELECT increment_submission_sequence($1, $2) AS seq`,
    [surveyorProfileId, year],
  )

  const seq = rows[0].seq as number
  const submissionNumber = `${registrationNo}_${year}_${String(seq).padStart(3, '0')}_R00`

  return {
    submissionNumber,
    sequence: seq,
    year,
    revisionCode: 'R00',
  }
}

/**
 * Increment the revision code of an existing submission number.
 *
 * RS149_2025_002_R00 → RS149_2025_002_R01
 * RS149_2025_002_R09 → RS149_2025_002_R10
 *
 * @param submissionNumber - The current submission number
 * @returns The submission number with incremented revision
 */
export function incrementRevision(submissionNumber: string): string {
  const parts = submissionNumber.split('_')
  if (parts.length < 4) {
    throw new Error(`Invalid submission number format: ${submissionNumber}`)
  }

  const revPart = parts[parts.length - 1]
  if (!revPart.startsWith('R')) {
    throw new Error(`Invalid revision code in submission number: ${revPart}`)
  }

  const revNum = parseInt(revPart.replace('R', ''), 10)
  parts[parts.length - 1] = `R${String(revNum + 1).padStart(2, '0')}`

  return parts.join('_')
}

/**
 * Parse a submission number into its components.
 *
 * @returns null if the format is invalid
 */
export function parseSubmissionNumber(submissionNumber: string): {
  registrationNo: string
  year: number
  sequence: number
  revision: number
} | null {
  const parts = submissionNumber.split('_')
  if (parts.length !== 4) return null

  const [regNo, yearStr, seqStr, revStr] = parts
  const year = parseInt(yearStr, 10)
  const seq = parseInt(seqStr, 10)
  const rev = parseInt(revStr.replace('R', ''), 10)

  if (isNaN(year) || isNaN(seq) || isNaN(rev)) return null
  if (!revStr.startsWith('R')) return null

  return {
    registrationNo: regNo,
    year,
    sequence: seq,
    revision: rev,
  }
}
