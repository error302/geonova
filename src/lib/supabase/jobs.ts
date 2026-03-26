import { createClient } from '@/lib/supabase/client'

import { cookies } from 'next/headers'

export interface GeoNovaJob {
  id: string
  user_id: string
  name: string
  client?: string | null
  survey_type: 'boundary' | 'topographic' | 'leveling' | 'road' | 'construction' | 'control' | 'mining' | 'hydrographic' | 'drone' | 'gnss' | 'other'
  location?: { lat: number; lng: number } | null  // Simplified for frontend
  scheduled_date?: string | null
  crew_size?: number | null
  status: 'planned' | 'active' | 'completed' | 'cancelled'
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface EquipmentRecommendation {
  id: string
  survey_type: string
  equipment: string[]
}

export interface JobChecklist {
  id: string
  survey_type: string
  tasks: string[]
}

// Client-side functions
export async function getUserJobs(): Promise<GeoNovaJob[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('user_id', user.id)
    .order('scheduled_date', { ascending: true, nullsFirst: true })

  if (error) throw error
  return data || []
}

export async function createJob(job: Omit<GeoNovaJob, 'id' | 'created_at' | 'updated_at'>): Promise<GeoNovaJob> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('jobs')
    .insert({ ...job, user_id: user.id })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getJob(id: string): Promise<GeoNovaJob | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data || null
}

export async function updateJob(id: string, updates: Partial<GeoNovaJob>): Promise<GeoNovaJob> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('jobs')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteJob(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('jobs')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function getEquipmentByType(survey_type: string): Promise<string[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('equipment_recommendations')
    .select('equipment')
    .eq('survey_type', survey_type)
    .single()

  if (error || !data) return []
  return data.equipment || []
}

export async function getChecklistByType(survey_type: string): Promise<string[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('job_checklists')
    .select('tasks')
    .eq('survey_type', survey_type)
    .single()

  if (error || !data) return []
  return data.tasks || []
}

// Server-side (for SSR/pages)
export async function getUserJobsServer(): Promise<GeoNovaJob[]> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch (e) {}
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('user_id', user.id)
    .order('scheduled_date', { ascending: true, nullsFirst: true })

  if (error) throw error
  return data || []
}

