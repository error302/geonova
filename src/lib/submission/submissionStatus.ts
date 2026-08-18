/**
 * Submission QA status view-model.
 *
 * Pure module — no DB, no React, no file I/O. Turns the persisted submission
 * record pieces (validation_results + stored GNSS observation report) into a
 * reviewer-facing status view so the GNSS QC override reason and the
 * underlying QC failures are visible on the submission page without opening
 * the assembled ZIP (the manifest's qaResult stays the court-grade source of
 * truth inside the package; this is its on-screen mirror).
 *
 * @module submission/submissionStatus
 */

import type { GNSSObservationReport, GNSSReportIssue } from './gnssObservationReport'

export interface SubmissionQAStatusInput {
  /** Summary of the latest project_submissions row (null when never assembled). */
  submission?: {
    submissionNumber?: string | null
    packageStatus?: string | null
    generatedAt?: string | null
  } | null
  /** Persisted QA gate result (project_submissions.validation_results JSON). */
  validationResults?: unknown
  /** Persisted structured GNSS observation report (generated_artifacts). */
  gnssReport?: GNSSObservationReport | null
}

export interface SubmissionQAStatusView {
  /** True when a submission package has been assembled for the project. */
  hasPackage: boolean
  submissionNumber?: string
  packageStatus?: string
  generatedAt?: string
  /** Stored GNSS session QC verdict ('pass' | 'warn' | 'fail'). */
  gnssVerdict?: 'pass' | 'warn' | 'fail'
  gnssReportId?: string
  /** Underlying QC failures from the stored report (level 'fail'). */
  gnssFailures: GNSSReportIssue[]
  /** QC warnings from the stored report (level 'warn'). */
  gnssWarnings: GNSSReportIssue[]
  /**
   * Verbatim override reason recorded against a FAILED GNSS session (from the
   * persisted QA result's GNSS_QC_OVERRIDE warning). Undefined when no
   * override was recorded.
   */
  gnssOverrideReason?: string
}

interface QAResultLike {
  warnings?: Array<{ code?: string; message?: string }>
}

/** Message format produced by validateSubmission's GNSS_QC_OVERRIDE warning:
 * `GNSS session QC FAILED but overridden: "<reason>" (report <id>).` */
const OVERRIDE_REASON_RE = /overridden:\s*"([^"]+)"/i

/**
 * Extract the verbatim override reason from a persisted QA result. The
 * reason is embedded in the GNSS_QC_OVERRIDE warning message; the regex
 * recovers it so the status page can quote it exactly as recorded.
 */
function extractOverrideReason(validationResults: unknown): string | undefined {
  if (!validationResults || typeof validationResults !== 'object') return undefined
  const warnings = (validationResults as QAResultLike).warnings
  if (!Array.isArray(warnings)) return undefined

  for (const warning of warnings) {
    if (warning?.code !== 'GNSS_QC_OVERRIDE') continue
    const message = warning.message ?? ''
    const match = OVERRIDE_REASON_RE.exec(message)
    return match?.[1] ?? message
  }
  return undefined
}

export function buildSubmissionQAStatus(
  input: SubmissionQAStatusInput = {},
): SubmissionQAStatusView {
  const { submission, validationResults, gnssReport } = input

  const view: SubmissionQAStatusView = {
    hasPackage: Boolean(submission?.submissionNumber),
    gnssFailures: [],
    gnssWarnings: [],
  }

  if (submission?.submissionNumber) {
    view.submissionNumber = submission.submissionNumber
    view.packageStatus = submission.packageStatus ?? undefined
    view.generatedAt = submission.generatedAt ?? undefined
  }

  if (gnssReport) {
    view.gnssVerdict = gnssReport.verdict
    view.gnssReportId = gnssReport.reportId
    view.gnssFailures = (gnssReport.issues ?? []).filter((i) => i.level === 'fail')
    view.gnssWarnings = (gnssReport.issues ?? []).filter((i) => i.level === 'warn')
  }

  const overrideReason = extractOverrideReason(validationResults)
  if (overrideReason) view.gnssOverrideReason = overrideReason

  return view
}
