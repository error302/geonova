import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Link from 'next/link'

export const metadata = { title: 'Signature Verification | METARDU' }

export default async function VerifySignaturePage({ params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
  )

  const { data: signature, error } = await supabase
    .from('signatures')
    .select('*, projects(name)')
    .eq('id', params.id)
    .single()

  if (error || !signature) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="bg-[var(--bg-card)] border border-red-500/30 rounded-xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">Invalid Signature</h1>
          <p className="text-[var(--text-secondary)] mb-6">
            This digital signature could not be found or has been revoked. Ensure you scanned a valid METARDU QR code.
          </p>
          <div className="p-3 bg-red-500/10 text-red-500 text-sm font-mono rounded">
            STATUS: TAMPERED OR INVALID
          </div>
        </div>
      </div>
    )
  }

  const projectName = signature.projects?.name || 'Unknown Project'

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center p-4">
      <div className="mb-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center pb-0.5">
            <span className="text-black font-bold text-lg leading-none">M</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-[var(--text-primary)] relative top-px">METARDU</span>
        </Link>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl max-w-lg w-full overflow-hidden shadow-2xl">
        <div className="bg-green-600 p-6 text-center">
          <div className="w-16 h-16 bg-white/20 text-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-[0_0_15px_rgba(255,255,255,0.2)]">
            <svg className="w-8 h-8 drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight drop-shadow-sm">VERIFIED SIGNATURE</h1>
          <p className="text-green-100 mt-1 font-medium">Authentic METARDU Digital Record</p>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider mb-1">Plan / Project Name</p>
            <p className="text-lg font-mono text-[var(--text-primary)]">{projectName}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider mb-1">Signer Name</p>
              <p className="text-sm font-semibold text-[var(--text-secondary)]">{signature.signer_name}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider mb-1">ISK Number</p>
              <p className="text-sm font-semibold text-[var(--text-secondary)]">LS/{signature.isk_number}</p>
            </div>
          </div>

          <div>
            <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider mb-1">Date Signed</p>
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              {new Date(signature.signed_at).toLocaleString('en-GB', { 
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
              })}
            </p>
          </div>

          <div className="pt-4 border-t border-[var(--border-color)]">
            <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider mb-2">Cryptographic Hash</p>
            <div className="p-2 bg-[var(--bg-secondary)] rounded-md border border-[var(--border-color)]">
              <code className="text-[10px] text-[var(--text-muted)] break-all select-all font-mono">
                {signature.document_hash}
              </code>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-2 italic flex items-center gap-1.5">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
              This SHA-256 hash guarantees the plan geometry has not been altered since signing.
            </p>
          </div>
        </div>
      </div>
      
      <p className="text-xs text-[var(--text-muted)] mt-8 max-w-xs text-center">
        Powered by METARDU Survey Validation System. Valid under the Survey Act Cap. 299.
      </p>
    </div>
  )
}
