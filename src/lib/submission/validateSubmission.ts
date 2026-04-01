import type { SurveyorProfile } from '@/types/submission'

export interface PackageValidation {
  ready: boolean
  blockers: string[]
  warnings: string[]
}

export function validateSubmissionPackage(
  submission: Record<string, any> | null,
  project: Record<string, any>,
  profile: SurveyorProfile | null
): PackageValidation {
  const blockers: string[] = []
  const warnings: string[] = []

  if (!profile) blockers.push('Surveyor profile not set — go to Account Settings')
  if (!profile?.registration_number) blockers.push('Registration number missing from surveyor profile')

  const bd = project.boundary_data as Record<string, any> | undefined
  if (!bd?.beacons?.length || (bd.beacons as unknown[]).length < 3)
    blockers.push('At least 3 beacons required')

  if (!project.lr_number) blockers.push('LR Number not set on project')
  if (!project.folio_number) warnings.push('Folio number not set — required for Form No. 4')
  if (!project.register_number) warnings.push('Register number not set')

  if (!submission?.supporting_attachments?.ppa2)
    blockers.push('Physical Planning Approval (PPA2) not uploaded')
  if (!submission?.supporting_attachments?.lcb_consent)
    blockers.push('Land Control Board Consent not uploaded')

  return { ready: blockers.length === 0, blockers, warnings }
}