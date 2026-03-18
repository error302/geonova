import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { rateLimit, getClientIdentifier } from '@/lib/security/rateLimit'

const API_RATE_LIMIT = 60
const API_RATE_WINDOW = 60000

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const isApiRoute = request.nextUrl.pathname.startsWith('/api/')
  
  if (isApiRoute) {
    const identifier = getClientIdentifier(request)
    const { allowed, remaining } = rateLimit(identifier, API_RATE_LIMIT, API_RATE_WINDOW)
    
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
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  // Prefer session from cookies to avoid false negatives when the edge runtime
  // cannot reach Supabase for `getUser()` (which performs a network call).
  const { data: { session } } = await supabase.auth.getSession()
  const sessionUser = session?.user ?? null

  // Fallback to validating the token with Supabase when possible.
  const { data: { user } } = sessionUser
    ? { data: { user: sessionUser } }
    : await supabase.auth.getUser()

  const authRoutes = ['/login', '/register']
  const isAuthRoute = authRoutes.some(route => request.nextUrl.pathname.startsWith(route))
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  const protectedRoutes = ['/dashboard', '/project', '/fieldbook', '/account', '/checkout']
  const isProtected = protectedRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route))

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|tools|icons).*)'],
}
