import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { rateLimit, getClientIdentifier } from '@/lib/security/rateLimit'

const API_RATE_LIMIT = 60
const API_RATE_WINDOW = 60000

const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // Apply security headers to every response
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    supabaseResponse.headers.set(key, value)
  })

  const isApiRoute = request.nextUrl.pathname.startsWith('/api/')

  if (isApiRoute) {
    const identifier = getClientIdentifier(request)
    const { allowed, remaining } = await rateLimit(identifier, API_RATE_LIMIT, API_RATE_WINDOW)

    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: Math.ceil(API_RATE_WINDOW / 1000) },
        { status: 429, headers: { 'X-RateLimit-Remaining': '0', 'Retry-After': String(Math.ceil(API_RATE_WINDOW / 1000)) } }
      )
    }

    supabaseResponse.headers.set('X-RateLimit-Remaining', String(remaining))
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          // Re-apply security headers after response is recreated
          Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value)
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  // SECURITY: Always verify the JWT with Supabase — never trust the cookie alone.
  // getUser() performs a network call to validate the token with the Supabase auth server.
  const { data: { user } } = await supabase.auth.getUser()

  const authRoutes = ['/login', '/register']
  const isAuthRoute = authRoutes.some(route => request.nextUrl.pathname.startsWith(route))
  
  let redirectResponse: NextResponse | null = null

  if (isAuthRoute && user) {
    redirectResponse = NextResponse.redirect(new URL('/dashboard', request.url))
  }

  const protectedRoutes = ['/dashboard', '/project', '/fieldbook', '/account', '/checkout']
  const isProtected = protectedRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route))

  if (isProtected && !user) {
    redirectResponse = NextResponse.redirect(new URL('/login', request.url))
  }

  if (redirectResponse) {
    // Preserve cookies and headers when redirecting
    supabaseResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'location' && key.toLowerCase() !== 'set-cookie') {
        redirectResponse!.headers.set(key, value)
      }
    })
    
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse!.cookies.set(cookie.name, cookie.value, cookie)
    })
    
    return redirectResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|tools|icons).*)'],
}
