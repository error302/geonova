import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/lib/env'

export async function middleware(request: NextRequest) {
  // Create response that will be returned
  const response = NextResponse.next({ request })

  // Create supabase client that reads/writes cookies on the response
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options))
        },
      },
    }
  )

  // Refresh the session cookie on every request
  // This is required for getSession() to work in page components
  await supabase.auth.getSession()

  // Protected routes - redirect to login if no session
  const protectedPaths = [
    '/dashboard', '/project', '/fieldbook', '/deed-plan',
    '/tools/survey-report-builder', '/fieldguard', '/cadastra',
    '/minetwin', '/automator', '/hydrolive', '/usv', '/minescan',
    '/geofusion', '/equipment', '/cpd', '/jobs', '/peer-review',
    '/registry', '/analytics', '/audit-logs', '/white-label',
    '/university', '/organization', '/account', '/checkout',
    '/marketplace', '/community', '/land-law'
  ]

  const isProtected = protectedPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  )

  const isAuthRoute = ['/login', '/register'].some(route =>
    request.nextUrl.pathname.startsWith(route)
  )

  // Check if user is authenticated by reading the session cookie
  const { data: { session } } = await supabase.auth.getSession()

  if (isProtected && !session) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|manifest.webmanifest|sw.js|robots.txt|sitemap.xml|api/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
}
