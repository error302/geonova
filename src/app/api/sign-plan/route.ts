import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { projectId, hash } = await req.json()
    if (!projectId || !hash) return NextResponse.json({ error: 'Missing inputs' }, { status: 400 })

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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ 
      id: data.id, 
      signerName, 
      iskNumber,
      signedAt: data.signed_at 
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
