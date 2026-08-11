import { createClient, type BrowserSession } from '@/lib/api-client/client'

export interface MetarduJob {
  id: string
  user_id: string
  name: string
  client?: string | null
  survey_type: 'boundary' | 'topographic' | 'leveling' | 'road' | 'construction' | 'control' | 'mining' | 'hydrographic' | 'drone' | 'gnss' | 'other'
  location?: { lat: number; lng: number } | null
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

export type CreateJobInput = Omit<MetarduJob, 'id' | 'created_at' | 'updated_at' | 'user_id'>

export async function getUserJobs(): Promise<MetarduJob[]> {
  const dbClient = createClient()
  const { data: { session } } = await dbClient.auth.getSession()
  const user = (session as BrowserSession | null)?.user ?? null
  if (!user) return []

  const { data, error } = await dbClient
    .from('jobs')
    .select('*')
    .eq('user_id', user.id)
    .order('scheduled_date', { ascending: true })

  if (error) throw error
  return (data ?? null) as unknown as MetarduJob[]
}

export async function createJob(job: CreateJobInput): Promise<MetarduJob> {
  const dbClient = createClient()
  const { data: { session } } = await dbClient.auth.getSession()
  const user = (session as BrowserSession | null)?.user ?? null
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await dbClient
    .from('jobs')
    .insert({ ...job, user_id: user.id })
    .select()
    .single()

  if (error) throw error
  return data as unknown as MetarduJob
}

export async function getJob(id: string): Promise<MetarduJob | null> {
  const dbClient = createClient()
  const { data, error } = await dbClient
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return (data ?? null) as unknown as MetarduJob | null
}

export async function updateJob(id: string, updates: Partial<MetarduJob>): Promise<MetarduJob> {
  const dbClient = createClient()
  const { data, error } = await dbClient
    .from('jobs')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as unknown as MetarduJob
}

export async function deleteJob(id: string): Promise<void> {
  const dbClient = createClient()
  const { error } = await dbClient
    .from('jobs')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function getEquipmentByType(survey_type: string): Promise<string[]> {
  const dbClient = createClient()
  const { data, error } = await dbClient
    .from('equipment_recommendations')
    .select('equipment')
    .eq('survey_type', survey_type)
    .single()

  if (error || !data) return []
  return (data as { equipment?: string[] }).equipment ?? []
}

export async function getChecklistByType(survey_type: string): Promise<string[]> {
  const dbClient = createClient()
  const { data, error } = await dbClient
    .from('job_checklists')
    .select('tasks')
    .eq('survey_type', survey_type)
    .single()

  if (error || !data) return []
  return (data as { tasks?: string[] }).tasks ?? []
}