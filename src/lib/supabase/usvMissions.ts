import { createClient } from '@/lib/supabase/client'
import type { USVMission, USVTelemetry, Waypoint } from '@/types/usv'

export async function createMission(params: {
  project_id: string
  mission_name: string
  usv_ids: string[]
  waypoints: Waypoint[]
  pattern_type?: string
  scheduled_start?: string
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('usv_missions')
    .insert({
      project_id: params.project_id,
      user_id: user.id,
      mission_name: params.mission_name,
      usv_ids: params.usv_ids,
      waypoints: params.waypoints,
      pattern_type: params.pattern_type || 'waypoint',
      scheduled_start: params.scheduled_start,
      status: 'draft'
    })
    .select()
    .single()
  
  if (error) throw error
  return data as USVMission
}

export async function getMissions(projectId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('usv_missions')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data as USVMission[]
}

export async function getTelemetry(missionId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('usv_telemetry')
    .select('*')
    .eq('mission_id', missionId)
    .order('recorded_at', { ascending: false })
    .limit(100)
  
  if (error) throw error
  return data as USVTelemetry[]
}

export async function updateMissionStatus(id: string, status: string) {
  const supabase = createClient()
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  
  if (status === 'running' && !updates.actual_start) {
    updates.actual_start = new Date().toISOString()
  }
  if (status === 'completed') {
    updates.actual_end = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('usv_missions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as USVMission
}
