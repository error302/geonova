export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { z } from 'zod'
import { assembleSubmissionPackage } from '@/lib/submission/assembleSubmission'

const AssembleRequestSchema = z.object({
  projectId: z.string().uuid('Valid project ID is required'),
  // Optional override for the GNSS session QC gate: required (non-empty)
  // when the stored observation report verdict is FAILED, so the surveyor
  // records why they are assembling anyway. The reason lands in the QA
  // result and the package manifest.
  gnssOverrideReason: z.string().trim().min(1).max(500).optional(),
})

export const POST = apiHandler(
  { auth: true, schema: AssembleRequestSchema, audit: 'submission_assembled' , rateLimit: { max: 60, windowMs: 60000 } },
  async (req, ctx) => {
    const { projectId, gnssOverrideReason } = ctx.body as z.infer<typeof AssembleRequestSchema>

    const { zipBuffer, ref, qa } = await assembleSubmissionPackage(
      projectId,
      { gnssOverrideReason }
    )

    if (!qa.passed) {
      return NextResponse.json(
        {
          error: 'QA gate failed',
          // Full blocker/warning objects (code + message) so the client can
          // detect the GNSS_QC_FAILED gate and offer the override flow.
          blockers: qa.blockers,
          warnings: qa.warnings
        },
        { status: 422 }
      )
    }

    return new NextResponse(zipBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${ref}.zip"`,
        'X-Submission-Ref': ref
      }
    })
  }
)
