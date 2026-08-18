export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import {
  buildGNSSObservationReport,
  GNSS_OBSERVATION_REPORT_ARTIFACT_KEY,
} from '@/lib/submission/gnssObservationReport'
import { buildPackageManifest } from '@/lib/submission/manifest'
import type { BaselineProcessResult, GNSSSessionQC } from '@/lib/online/gnssBaseline'

/**
 * POST /api/submission/gnss-observation-report
 *
 * Builds a GNSS observation report from a baseline-processing result + session
 * QC (the output of /api/gnss/baseline-process) and persists it into the
 * project's submission record (`project_submissions.generated_artifacts`) so
 * it lands in the submission package and marks the `rtk_result` section ready
 * in the package manifest.
 *
 * Request body:
 *   projectId:    string (uuid)
 *   baseline:     BaselineProcessResult from /api/gnss/baseline-process
 *   qc?:          GNSSSessionQC (optional — falls back to baseline.qc)
 *   options?:     { mode?, frequency?, elevationMask?, ambiguityResolution? }
 *   baseStation?: string (default 'BASE')
 *   roverStation?: string (default 'ROVER')
 *   surveyor?:    { name?, registrationNumber?, firmName? }
 *
 * Response:
 *   { report, text, verdict, manifest }
 * where `text` is the printable artifact for the package and `manifest` is the
 * updated package-completeness view (rtk_result → ready).
 */

const SOLUTION_QUALITIES = ['FIX', 'FLOAT', 'SBAS', 'DGPS', 'SINGLE', 'PPP', 'UNKNOWN'] as const

const BaselineSchema = z.object({
  rover_latitude: z.number(),
  rover_longitude: z.number(),
  rover_height: z.number(),
  sigma_north: z.number(),
  sigma_east: z.number(),
  sigma_up: z.number(),
  quality: z.enum(SOLUTION_QUALITIES),
  sat_count: z.number(),
  ratio: z.number(),
  raw_output: z.string(),
  epoch_solutions: z.record(z.string(), z.number()).optional(),
  solution_summary: z
    .object({
      final_solution: z.enum(SOLUTION_QUALITIES),
      epochs: z.number(),
      fixed_epochs: z.number(),
      float_epochs: z.number(),
      fix_pct: z.number(),
      ratio: z.number(),
    })
    .optional(),
  qc: z.record(z.unknown()).optional(),
})

const GNSSInputFileSchema = z.object({
  role: z.enum(['base', 'rover', 'nav']),
  fileName: z.string().max(255),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/, 'sha256 must be 64 lowercase hex chars'),
})

const GNSSObservationReportSchema = z.object({
  projectId: z.string().uuid('Valid project ID is required'),
  baseline: BaselineSchema,
  qc: z.record(z.unknown()).optional(),
  inputFiles: z.array(GNSSInputFileSchema).max(3).optional(),
  options: z
    .object({
      mode: z.enum(['static', 'kinematic']).optional(),
      frequency: z.enum(['l1', 'l2', 'l1+l2']).optional(),
      elevationMask: z.number().optional(),
      ambiguityResolution: z.enum(['fix', 'float', 'off']).optional(),
    })
    .optional(),
  baseStation: z.string().max(80).optional(),
  roverStation: z.string().max(80).optional(),
  surveyor: z
    .object({
      name: z.string().max(160).optional(),
      registrationNumber: z.string().max(40).optional(),
      firmName: z.string().max(160).optional(),
    })
    .optional(),
})

interface ProjectSubmissionRow {
  id: string
  generated_artifacts?: Record<string, unknown> | null
}

export const POST = apiHandler(
  {
    auth: true,
    schema: GNSSObservationReportSchema,
    audit: 'gnss_observation_report_saved',
    rateLimit: { max: 30, windowMs: 60000 },
  },
  async (_req, ctx) => {
    const body = ctx.body as z.infer<typeof GNSSObservationReportSchema>
    const baseline = body.baseline as BaselineProcessResult
    const qc = (body.qc ?? baseline.qc) as GNSSSessionQC | undefined

    const { report, text, verdict } = await buildGNSSObservationReport({
      baseline,
      qc,
      options: body.options,
      baseStation: body.baseStation,
      roverStation: body.roverStation,
      surveyor: body.surveyor,
      inputFiles: body.inputFiles,
    })

    const artifactsPatch = JSON.stringify({
      [GNSS_OBSERVATION_REPORT_ARTIFACT_KEY]: report,
    })

    const { rows: existing } = await db.query<ProjectSubmissionRow>(
      `SELECT id, generated_artifacts
       FROM project_submissions
       WHERE project_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [body.projectId]
    )

    if (existing[0]) {
      await db.query<never>(
        `UPDATE project_submissions
         SET generated_artifacts = generated_artifacts || $2::jsonb,
             updated_at = NOW()
         WHERE id = $1`,
        [existing[0].id, artifactsPatch]
      )
    } else {
      // No submission record yet — create a draft so the report is persisted
      // and the package manifest can track the rtk_result section.
      await db.query<never>(
        `INSERT INTO project_submissions (
           project_id, user_id, revision_code, revision_number,
           submission_year, package_status, generated_artifacts
         ) VALUES ($1, $2, 'R00', 0, $3, 'draft', $4::jsonb)`,
        [body.projectId, ctx.userId, new Date().getFullYear(), artifactsPatch]
      )
    }

    const manifest = buildPackageManifest({
      generatedArtifacts: {
        [GNSS_OBSERVATION_REPORT_ARTIFACT_KEY]: 'gnss_observation_report.txt',
      },
    })

    return NextResponse.json({ report, text, verdict, manifest })
  }
)
