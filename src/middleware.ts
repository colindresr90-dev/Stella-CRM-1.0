import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('sb-access-token')
  const { pathname } = request.nextUrl

  // Protected paths
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/forgot-password') || pathname.startsWith('/reset-password')
  
  // Static files or API routes should not be intercepted
  const isStaticFileOrApi = pathname.startsWith('/_next') || 
                            pathname.startsWith('/api') || 
                            pathname.includes('.')

  if (isStaticFileOrApi) {
    return NextResponse.next()
  }

  // Redirect to login if user is not authenticated and trying to access a protected page
  if (!token && !isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect to home if user is authenticated and trying to access an auth page (login/forgot-password)
  if (token && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  // Run middleware on all paths except static assets and API routes
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
