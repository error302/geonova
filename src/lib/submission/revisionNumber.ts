import { createClient } from '@/lib/api-client/server'
import { db } from '@/lib/db'
export async function generateSubmissionRef(
  projectId: string,
  iskNumber: string
): Promise<{ ref: string; revision: number; sequence: number }> {
  const dbClient = await createClient()
  const currentYear = new Date().getFullYear()

  const profRes = await dbClient
    .from('surveyor_profiles')
    .select('id')
    .eq('isk_number', iskNumber)
    .single()

  if (!profRes.data) {
    throw new Error('Surveyor profile not found')
  }

  const existRes = await dbClient
    .from('project_submissions')
    .select('revision_number')
    .eq('project_id', projectId)
    .order('revision_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  // ponytail: Phase 6 — existingSubmissions is Record<string, unknown> | null;
  // cast revision_number to number explicitly
  const rawRevision = (existRes.data as unknown as { revision_number?: number } | null)?.revision_number
  const revision = (rawRevision ?? -1) + 1
  const paddedRev = String(revision).padStart(2, '0')

  // Canonical atomic sequence increment (migration 047). Replaces the old
  // INSERT INTO submission_sequences (plural) upsert — that legacy table was
  // folded into submission_sequence and dropped in migration 048.
  const { rows } = await db.query<{ seq: number }>(
    `SELECT increment_submission_sequence($1, $2) AS seq`,
    [profRes.data.id, currentYear]
  )

  const sequence = rows[0]?.seq ?? 1
  const paddedSeq = String(sequence).padStart(3, '0')

  const ref = `${iskNumber}_${currentYear}_${paddedSeq}_R${paddedRev}`

  return { ref, revision, sequence }
}