import { createClient } from '@/lib/supabase/client'
import type { ProjectSubmissionRecord, SubmissionPackageStatus } from '@/types/submission'

interface ProjectSubmissionRow {
  id: string
  project_id: string
  user_id: string
  surveyor_profile_user_id: string | null
  submission_year: number
  sequence_number: number | null
  revision_number: number
  submission_number: string | null
  package_status: SubmissionPackageStatus
  required_documents: unknown[] | null
  generated_artifacts: Record<string, unknown> | null
  supporting_attachments: Record<string, unknown> | null
  validation_results: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

function mapSubmissionRow(row: ProjectSubmissionRow): ProjectSubmissionRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    surveyorProfileUserId: row.surveyor_profile_user_id,
    submissionYear: row.submission_year,
    sequenceNumber: row.sequence_number,
    revisionNumber: row.revision_number,
    submissionNumber: row.submission_number,
    packageStatus: row.package_status,
    requiredDocuments: row.required_documents ?? [],
    generatedArtifacts: row.generated_artifacts ?? {},
    supportingAttachments: row.supporting_attachments ?? {},
    validationResults: row.validation_results ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getOrCreateProjectSubmission(projectId: string): Promise<ProjectSubmissionRecord> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data: existing, error: existingError } = await supabase
    .from('project_submissions')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .order('revision_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingError) {
    throw existingError
  }

  if (existing) {
    return mapSubmissionRow(existing as ProjectSubmissionRow)
  }

  const { data, error } = await supabase
    .from('project_submissions')
    .insert({
      project_id: projectId,
      user_id: user.id,
      surveyor_profile_user_id: user.id,
      submission_year: new Date().getFullYear(),
      revision_number: 0,
      package_status: 'draft',
      required_documents: [],
      generated_artifacts: {},
      supporting_attachments: {},
      validation_results: {},
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return mapSubmissionRow(data as ProjectSubmissionRow)
}

export async function updateProjectSubmission(
  id: string,
  updates: Partial<{
    surveyorProfileUserId: string | null
    packageStatus: SubmissionPackageStatus
    submissionNumber: string | null
    sequenceNumber: number | null
    revisionNumber: number
    requiredDocuments: unknown[]
    generatedArtifacts: Record<string, unknown>
    supportingAttachments: Record<string, unknown>
    validationResults: Record<string, unknown>
  }>
): Promise<ProjectSubmissionRecord> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const payload = {
    surveyor_profile_user_id: updates.surveyorProfileUserId,
    package_status: updates.packageStatus,
    submission_number: updates.submissionNumber,
    sequence_number: updates.sequenceNumber,
    revision_number: updates.revisionNumber,
    required_documents: updates.requiredDocuments,
    generated_artifacts: updates.generatedArtifacts,
    supporting_attachments: updates.supportingAttachments,
    validation_results: updates.validationResults,
  }

  const sanitized = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  )

  const { data, error } = await supabase
    .from('project_submissions')
    .update(sanitized)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return mapSubmissionRow(data as ProjectSubmissionRow)
}
