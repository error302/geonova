import { createClient } from '@/lib/supabase/client'
import type {
  SurveyReportInput,
  SectionContent,
  SurveyReportSummary
} from '@/types/surveyReport'

interface SurveyReportDbRow {
  id: string
  project_id: string
  user_id: string
  report_number: string
  report_title: string
  revision: string
  status: 'draft' | 'review' | 'finalised'
  input_data: SurveyReportInput
  sections: SectionContent[]
  completeness: number
  created_at: string
  updated_at: string
}

export async function createSurveyReport(
  input: Partial<SurveyReportInput>,
  sections: SectionContent[],
  completeness: number,
  projectId: string
): Promise<string> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('survey_reports')
    .insert({
      project_id: projectId,
      user_id: user.id,
      report_number: input.reportNumber || `SR-${Date.now()}`,
      report_title: input.reportTitle || 'Survey Report',
      revision: input.revisionNumber || 'Rev 0',
      input_data: input,
      sections: sections,
      completeness: completeness,
      status: 'draft'
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function saveSurveyReport(
  id: string,
  input: Partial<SurveyReportInput>,
  sections: SectionContent[],
  completeness: number
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('survey_reports')
    .update({
      input_data: input,
      sections: sections,
      completeness: completeness,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
}

export async function getSurveyReportsByProject(
  projectId: string
): Promise<SurveyReportSummary[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('survey_reports')
    .select('id, report_number, report_title, revision, status, completeness, created_at, updated_at')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) throw error

  return (data || []).map((row: any) => ({
    id: row.id,
    reportNumber: row.report_number,
    reportTitle: row.report_title,
    revision: row.revision,
    status: row.status,
    completeness: row.completeness,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))
}

export async function getSurveyReportById(
  id: string
): Promise<(SurveyReportInput & { sections: SectionContent[]; completeness: number; status: string; reportNumber: string; reportTitle: string; revision: string }) | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('survey_reports')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  const row = data as SurveyReportDbRow
  return {
    ...row.input_data,
    sections: row.sections,
    completeness: row.completeness,
    status: row.status,
    reportNumber: row.report_number,
    reportTitle: row.report_title,
    revision: row.revision
  }
}

export async function updateReportStatus(
  id: string,
  status: 'draft' | 'review' | 'finalised'
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('survey_reports')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
}

export async function deleteSurveyReport(id: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('survey_reports')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
}
