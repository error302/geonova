import { createClient, type BrowserSession } from '@/lib/api-client/client'
import type { DeedPlanInput, DeedPlanOutput, DeedPlanDocument } from '@/types/deedPlan'
import { computeArea } from '@/lib/compute/deedPlan'

export async function saveDeedPlan(
  projectId: string,
  input: DeedPlanInput,
  output: DeedPlanOutput
): Promise<DeedPlanDocument> {
  const dbClient = createClient()
  const authRes = await dbClient.auth.getSession()
  const session = authRes.data?.session
  const user = (session as unknown as BrowserSession | null)?.user ?? null
  if (!user) throw new Error('Not authenticated')

  const res = await dbClient
    .from('deed_plans')
    .insert({
      project_id: projectId,
      user_id: user.id,
      survey_number: input.surveyNumber,
      drawing_number: input.drawingNumber,
      parcel_number: input.parcelNumber,
      locality: input.locality,
      area_sqm: input.area || computeArea(input.boundaryPoints),
      scale: input.scale,
      datum: input.datum,
      input_data: input,
      svg_content: output.svg,
      closure_check: output.closureCheck,
      status: 'draft'
    })
    .select()
    .single()

  if (res.error) throw res.error
  return res.data as unknown as DeedPlanDocument
}

export async function getDeedPlansByProject(projectId: string): Promise<DeedPlanDocument[]> {
  const dbClient = createClient()
  const res = await dbClient
    .from('deed_plans')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (res.error) throw res.error
  return res.data as unknown as DeedPlanDocument[]
}

export async function getDeedPlanById(id: string): Promise<DeedPlanDocument | null> {
  const dbClient = createClient()
  const res = await dbClient
    .from('deed_plans')
    .select('*')
    .eq('id', id)
    .single()

  if (res.error) throw res.error
  return res.data as unknown as DeedPlanDocument
}

export async function updateDeedPlanStatus(
  id: string,
  status: 'draft' | 'finalised'
): Promise<DeedPlanDocument> {
  const dbClient = createClient()
  const res = await dbClient
    .from('deed_plans')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (res.error) throw res.error
  return res.data as unknown as DeedPlanDocument
}
