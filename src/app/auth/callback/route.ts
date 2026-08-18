import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth-v5'
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const type = requestUrl.searchParams.get('type')

  // Password recovery → redirect to reset page
  if (type === 'recovery') {
    const code = requestUrl.searchParams.get('code')
    return NextResponse.redirect(
      requestUrl.origin + '/auth/reset-password' + (code ? '?code=' + code : '')
    )
  }

  // Check if user is authenticated via NextAuth
  const session = await auth()

  if (session?.user) {
    // Authenticated → redirect to dashboard
    return NextResponse.redirect(requestUrl.origin + '/dashboard')
  }

  // Not authenticated → redirect to login
  return NextResponse.redirect(requestUrl.origin + '/login')
}
