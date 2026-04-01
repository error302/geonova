import { createClient } from '@/lib/supabase/client'
import type { SurveyorProfile } from '@/types/submission'

export async function getActiveSurveyorProfile(): Promise<SurveyorProfile | null> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const { data } = await supabase
    .from('surveyor_profiles')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .maybeSingle()

  return data as SurveyorProfile | null
}

