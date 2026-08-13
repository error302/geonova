export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { z } from 'zod'
import { assembleSubmissionPackage } from '@/lib/submission/assembleSubmission'

const AssembleRequestSchema = z.object({
  projectId: z.string().uuid('Valid project ID is required'),
})

export const POST = apiHandler(
  { auth: true, schema: AssembleRequestSchema, audit: 'submission_assembled' , rateLimit: { max: 60, windowMs: 60000 } },
  async (req, ctx) => {
    const { projectId } = ctx.body as z.infer<typeof AssembleRequestSchema>

    const { zipBuffer, ref, qa } = await assembleSubmissionPackage(projectId)

    if (!qa.passed) {
      return NextResponse.json(
        {
          error: 'QA gate failed',
          blockers: qa.blockers.map(b => b.message),
          warnings: qa.warnings.map(w => w.message)
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
