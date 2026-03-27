// src/lib/supabase/workflows.ts

import { createClient } from '@supabase/supabase-js'
import type { Workflow, WorkflowNode, WorkflowEdge } from '@/types/workflow'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function createWorkflow(params: {
  project_id: string
  user_id: string
  name: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}) {
  const { data, error } = await supabase
    .from('workflows')
    .insert({
      project_id: params.project_id,
      user_id: params.user_id,
      name: params.name,
      nodes: params.nodes,
      edges: params.edges,
      status: 'draft'
    })
    .select()
    .single()
  
  if (error) throw error
  return data as Workflow
}

export async function getWorkflows(projectId: string) {
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data as Workflow[]
}

export async function getWorkflow(id: string) {
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data as Workflow
}

export async function updateWorkflow(id: string, updates: Partial<Workflow>) {
  const { data, error } = await supabase
    .from('workflows')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as Workflow
}
