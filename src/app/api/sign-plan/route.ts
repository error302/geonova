import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api/response'
import { Logger } from '@/lib/logger'
import { env } from '@/lib/env'

const logger = new Logger('SignPlanAPI')

export async function POST(req: Request) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json(apiError('Unauthorized'), { status: 401 })

  try {
    const { projectId, hash } = await req.json()
    if (!projectId || !hash) return NextResponse.json(apiError('Missing inputs'), { status: 400 })

    const { data: profile } = await supabase.from('profiles').select('full_name, license_number').eq('id', user.id).single()

    const signerName = profile?.full_name || user.email || 'Unknown Surveyor'
    const iskNumber = profile?.license_number || 'Unknown LS'

    const { data, error } = await supabase.from('signatures').insert({
      user_id: user.id,
      project_id: projectId,
      document_hash: hash,
      signer_name: signerName,
      isk_number: iskNumber,
    }).select('id, signed_at').single()

    if (error) {
      logger.error('Failed to insert digital signature into database', error, { user_id: user.id, project_id: projectId })
      return NextResponse.json(apiError('Failed to sign plan'), { status: 500 })
    }

    return NextResponse.json(apiSuccess({ 
      id: data.id, 
      signerName, 
      iskNumber,
      signedAt: data.signed_at 
    }))
  } catch (err: any) {
    logger.error('Unhandled exception during plan signing', err)
    return NextResponse.json(apiError('Failed to process signing request'), { status: 500 })
  }
}
