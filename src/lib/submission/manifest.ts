/**
 * P2-1 Phase 13 Milestone B: Package Manifest + Completeness Validator
 *
 * Maps the artifacts a submission has actually produced against the
 * benchmark-aligned 8-section order (SUBMISSION_SECTIONS in @/types/submission)
 * and reports, in benchmark order, which sections are ready and which required
 * sections are missing.
 *
 * This is the "package skeleton" deliverable: one project → one submission →
 * one manifest that can list the package as complete or incomplete with
 * explicit missing items, before any export is attempted.
 *
 * Pure module — no DB, no React, no file I/O. Unit-testable.
 *
 * @module submission/manifest
 */

import {
  SUBMISSION_SECTIONS,
  type SubmissionSection,
  type SubmissionSectionId,
  type SectionStatus,
} from '@/types/submission'

/**
 * Canonical mapping from a generated-artifact key (the `generated_artifacts`
 * JSON on the submission record) to the benchmark section(s) it satisfies.
 *
 * Keys here mirror the artifact names written by `assembleSubmission.ts` and
 * the per-document generators (`form-c22`, `traverse-computation-sheet`,
 * `area-computation`, `control-schedule`, `working-diagram`, …).
 */
export const ARTIFACT_TO_SECTION: Record<string, SubmissionSectionId> = {
  // Official narrative report
  surveyor_report: 'surveyor_report',
  'surveyor-report': 'surveyor_report',

  // Final coordinate list / control schedule
  coordinate_list: 'coordinate_list',
  'control-schedule': 'coordinate_list',

  // Working diagram (DXF or PDF)
  working_diagram: 'working_diagram',
  'working-diagram': 'working_diagram',

  // Theoretical computations (traverse sheet / Form C22)
  theoretical_comps: 'theoretical_comps',
  'form-c22': 'theoretical_comps',
  'traverse-computation-sheet': 'theoretical_comps',

  // RTK / field result bundle (optional section)
  rtk_result: 'rtk_result',
  rtk_raw: 'rtk_result',

  // Consistency checks
  consistency_checks: 'consistency_checks',
  'consistency-checks': 'consistency_checks',

  // Area computations
  area_computations: 'area_computations',
  'area-computation': 'area_computations',
}

export interface PackageManifestInput {
  /** section_id/artifact_key → storage path (from project_submissions.generated_artifacts) */
  generatedArtifacts?: Record<string, string>
  /** section_ids already known to be satisfied (e.g. computed in-session) */
  readySections?: SubmissionSectionId[]
}

export interface PackageSectionReport {
  section: SubmissionSection
  status: SectionStatus
}

export interface PackageCompleteness {
  /** True when every REQUIRED section is present/ready. */
  complete: boolean
  /** Sections in benchmark order, each with its resolved status. */
  sections: PackageSectionReport[]
  /** Explicit list of missing REQUIRED sections (id + label). */
  missingRequired: Array<{ id: SubmissionSectionId; label: string }>
  /** Explicit list of missing OPTIONAL sections (informational). */
  missingOptional: Array<{ id: SubmissionSectionId; label: string }>
  /** Resolved section_id → status map. */
  statusBySection: Record<SubmissionSectionId, SectionStatus>
}

/**
 * Resolve the status of each benchmark section given the artifacts available.
 *
 * A section is `ready` if it appears in `readySections` OR if any generated
 * artifact maps onto it (via ARTIFACT_TO_SECTION). Optional sections are never
 * counted toward completeness, but are still reported when absent.
 */
export function evaluatePackageCompleteness(
  input: PackageManifestInput = {},
): PackageCompleteness {
  const generatedArtifacts = input.generatedArtifacts ?? {}
  const readySections = new Set<SubmissionSectionId>(input.readySections ?? [])

  // Fold generated-artifact keys into the ready set via the canonical mapping.
  for (const key of Object.keys(generatedArtifacts)) {
    const sectionId = ARTIFACT_TO_SECTION[key]
    if (sectionId) readySections.add(sectionId)
  }

  const sections: PackageSectionReport[] = []
  const missingRequired: PackageCompleteness['missingRequired'] = []
  const missingOptional: PackageCompleteness['missingOptional'] = []
  const statusBySection = {} as Record<SubmissionSectionId, SectionStatus>

  for (const section of SUBMISSION_SECTIONS) {
    const status: SectionStatus = readySections.has(section.id) ? 'ready' : 'missing'
    statusBySection[section.id] = status
    sections.push({ section, status })

    if (status === 'missing') {
      if (section.required) {
        missingRequired.push({ id: section.id, label: section.label })
      } else {
        missingOptional.push({ id: section.id, label: section.label })
      }
    }
  }

  return {
    complete: missingRequired.length === 0,
    sections,
    missingRequired,
    missingOptional,
    statusBySection,
  }
}

/**
 * Build a manifest object suitable for writing to the submission record or
 * emitting as `manifest.json`. Returns the sections in benchmark order with a
 * summary of completeness and explicit missing items.
 */
export function buildPackageManifest(input: PackageManifestInput = {}): {
  sections: SubmissionSection[]
  completeness: PackageCompleteness
} {
  const completeness = evaluatePackageCompleteness(input)
  return {
    sections: SUBMISSION_SECTIONS.map((s) => ({
      ...s,
      status: completeness.statusBySection[s.id],
    })),
    completeness,
  }
}
