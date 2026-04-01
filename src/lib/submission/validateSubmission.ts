import type { 
  ProjectSubmission, 
  PackageValidation, 
  SurveyorProfile 
} from '@/types/submission'
import type { MetarduProject } from '@/types/metardu' // Assume exists
import { getRequiredAttachmentsStatus } from './checklist'

export function validateSubmissionPackage(
  submission: ProjectSubmission,
  project: MetarduProject,
  profile: SurveyorProfile | null
): PackageValidation {
  const blockers: string[] = []
  const warnings: string[] = []

  // 1. Surveyor identity
  if (!profile) {
    blockers.push('Surveyor profile not configured — visit Account Settings')
  } else if (!profile.registration_number) {
    blockers.push('Registration number missing from surveyor profile')
  }

  // 2. Core project data
  const bd = project.boundary_data as any
  if (!bd?.beacons?.length || bd.beacons.length < 3) {
    blockers.push('Minimum 3 beacons required for boundary definition')
  }

  if (!project.lr_number) {
    blockers.push('LR Number required on project')
  }
  if (!project.folio_number) {
    warnings.push('Folio number recommended for Form No. 4 title block')
  }
  if (!project.register_number) {
    warnings.push('Register number recommended')
  }

  // 3. Submission sections
  const missingSections = submission.required_sections.filter(s => s.required && s.status !== 'ready')
  if (missingSections.length > 0) {
    blockers.push(`${missingSections.length} required sections incomplete: ${missingSections.map(s => s.label).join(', ')}`)
  }

  // 4. Attachments
  const { missing: missingAttachments } = getRequiredAttachmentsStatus(submission.supporting_attachments)
  if (missingAttachments.length > 0) {
    blockers.push(`Missing attachments: ${missingAttachments.join(', ')}`)
  }

  // 5. Validation results
  const failedValidations = submission.validation_results.filter(v => !v.passed)
  if (failedValidations.length > 0) {
    blockers.push(`${failedValidations.length} computations failed validation`)
  }

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
  }
}

