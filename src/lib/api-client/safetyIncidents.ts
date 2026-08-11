import { createClient, type BrowserSession } from '@/lib/api-client/client'
import type { SafetyIncident, SafetyReport } from '@/types/safety'

export async function createIncident(params: {
  project_id: string
  incident_type: string
  severity: string
  location?: unknown
  description: string
  evidence_images?: string[]
}) {
  const dbClient = createClient()
  const { data: { session } } = await dbClient.auth.getSession()
  const user = (session as BrowserSession | null)?.user ?? null
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await dbClient
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
  return data as unknown as SafetyIncident
}

export async function getIncidents(projectId: string) {
  const dbClient = createClient()
  const { data, error } = await dbClient
    .from('safety_incidents')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data as unknown as SafetyIncident[]
}

export async function updateIncidentStatus(id: string, status: string) {
  const dbClient = createClient()
  const { data, error } = await dbClient
    .from('safety_incidents')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as unknown as SafetyIncident
}
