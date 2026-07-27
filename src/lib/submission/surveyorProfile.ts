import { createClient } from '@/lib/api-client/server'
import type { SurveyorProfileSubmission } from '@/lib/api-client/community'

/**
 * AUDIT FIX (H-010, 2026-07-27): return null on missing profile instead of
 * throwing, so callers can decide between 404/redirect rather than 500.
 */
export async function getActiveSurveyorProfile(): Promise<SurveyorProfileSubmission | null> {
  try {
    const dbClient = await createClient()

    const { data: { session }, error: authError } = await dbClient.auth.getSession()
    const sessUser = (session as { user?: { id?: string; email?: string; name?: string } } | null)?.user
    if (authError || !sessUser) return null
    const user = sessUser as { id: string; email?: string; name?: string }

    const { data, error } = await dbClient
      .from('surveyor_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error || !data) {
      return null
    }

    // ponytail: Phase 6 — data is Record<string, unknown>; cast to expected shape
    const profile = data as Record<string, unknown>

    return {
      registrationNumber: (profile.isk_number as string) ?? '',
      iskNumber: (profile.isk_number as string) ?? '',
      verifiedIsk: (profile.verified_isk as boolean) ?? false,
      fullName: ((profile.full_name as string) ?? (profile.name as string)) ?? '',
      firmName: ((profile.firm_name as string) ?? (profile.company as string)) ?? '',
      isKMemberActive: (profile.verified_isk as boolean) ?? true
    }
  } catch {
    // Defensive: never let this throw to the caller.
    return null
  }
}
