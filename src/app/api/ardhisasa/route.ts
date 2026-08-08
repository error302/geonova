import { NextRequest, NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { createArdhisasaClient, isArdhisasaConfigured, getArdhisasaStatus, type SurveySubmissionData, type RecordSearchQuery } from '@/lib/integrations/ardhisasaClient'

export const dynamic = 'force-dynamic'

export const GET = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (request, ctx) => {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  // Status check
  if (action === 'status') {
    return NextResponse.json({ success: true, data: getArdhisasaStatus() })
  }

  // Check configuration
  if (action === 'configured') {
    return NextResponse.json({ success: true, data: { configured: isArdhisasaConfigured() } })
  }

  // Get supported counties
  if (action === 'counties') {
    if (!isArdhisasaConfigured()) {
      return NextResponse.json({ error: 'ARDHISASA integration not configured.' }, { status: 400 })
    }
    const client = createArdhisasaClient()
    const counties = await client.getSupportedCounties()
    return NextResponse.json({ success: true, data: counties })
  }

  // Get plan types
  if (action === 'plan-types') {
    if (!isArdhisasaConfigured()) {
      return NextResponse.json({ error: 'ARDHISASA integration not configured.' }, { status: 400 })
    }
    const client = createArdhisasaClient()
    const planTypes = await client.getPlanTypes()
    return NextResponse.json({ success: true, data: planTypes })
  }

  // Get submission requirements
  if (action === 'requirements') {
    const planType = searchParams.get('planType')
    if (!planType) {
      return NextResponse.json({ error: 'Missing planType parameter.' }, { status: 400 })
    }
    if (!isArdhisasaConfigured()) {
      return NextResponse.json({ error: 'ARDHISASA integration not configured.' }, { status: 400 })
    }
    const client = createArdhisasaClient()
    const requirements = await client.getSubmissionRequirements(planType)
    return NextResponse.json({ success: true, data: requirements })
  }

  return NextResponse.json({ error: 'Unknown action. Use: status, configured, counties, plan-types, requirements' }, { status: 400 })
})

export const POST = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (request, ctx) => {
  if (!isArdhisasaConfigured()) {
    return NextResponse.json({ error: 'ARDHISASA integration not configured. Set ARDHISASA_API_KEY, ARDHISASA_CLIENT_ID, and ARDHISASA_CLIENT_SECRET environment variables.' }, { status: 400 })
  }

  const { action, data } = ctx.body as { action?: string; data?: Record<string, unknown> }
  const client = createArdhisasaClient()

  if (action === 'submit') {
    const result = await client.submitPlan((data || {}) as unknown as SurveySubmissionData)
    return NextResponse.json({ success: true, data: result })
  }

  if (action === 'search') {
    const results = await client.searchRecords((data || {}) as RecordSearchQuery)
    return NextResponse.json({ success: true, data: results })
  }

  if (action === 'validate') {
    const validation = await client.validateSubmission((data || {}) as unknown as SurveySubmissionData)
    return NextResponse.json({ success: true, data: validation })
  }

  if (action === 'status') {
    const { submissionId } = data || {}
    if (!submissionId) {
      return NextResponse.json({ error: 'Missing submissionId.' }, { status: 400 })
    }
    const result = await client.getSubmissionStatus(submissionId as string)
    return NextResponse.json({ success: true, data: result })
  }

  return NextResponse.json({ error: 'Unknown action. Use: submit, search, validate, status' }, { status: 400 })
})
