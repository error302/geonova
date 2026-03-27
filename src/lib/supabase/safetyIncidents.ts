import { createClient } from '@/lib/supabase/client'
import type { SafetyIncident, SafetyReport } from '@/types/safety'

export async function createIncident(params: {
  project_id: string
  incident_type: string
  severity: string
  location?: any
  description: string
  evidence_images?: string[]
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('safety_incidents')
    .insert({
      project_id: params.project_id,
      user_id: user.id,
      incident_type: params.incident_type,
      severity: params.severity,
      location: params.location,
      description: params.description,
      evidence_images: params.evidence_images || []
    })
    .select()
    .single()
  
  if (error) throw error
  return data as SafetyIncident
}

export async function getIncidents(projectId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('safety_incidents')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data as SafetyIncident[]
}

export async function updateIncidentStatus(id: string, status: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('safety_incidents')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as SafetyIncident
}
