import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { NextRequest, NextResponse } from 'next/server'

// Protected routes that require authentication
// Note: /cart and /checkout allow guest access for guest checkout feature
const protectedRoutes = [
  '/profile',
  '/orders',
  '/admin',
]

// Create the i18n middleware
const intlMiddleware = createMiddleware(routing)

export default function middleware(request: NextRequest) {
  // First, run the i18n middleware
  const response = intlMiddleware(request)

  // Get the pathname from the request
  const pathname = request.nextUrl.pathname

  // Check if this is a protected route
  const isProtectedRoute = protectedRoutes.some((route) => {
    // Check if pathname matches protected route (accounting for locale prefix)
    // e.g., /en/profile, /es/profile, /de/profile
    return pathname.match(new RegExp(`^/[a-z]{2}${route}(/|$)`))
  })

  if (isProtectedRoute) {
    // Check for authentication token in cookies
    const accessToken = request.cookies.get('sb-access-token')?.value

    if (!accessToken) {
      // Extract locale from pathname (e.g., /en/profile -> en)
      const localeMatch = pathname.match(/^\/([a-z]{2})/)
      const locale = localeMatch ? localeMatch[1] : 'en'

      // Redirect to login page with return URL
      const loginUrl = new URL(`/${locale}/auth/login`, request.url)
      loginUrl.searchParams.set('returnUrl', pathname)

      return NextResponse.redirect(loginUrl)
    }
  }

  return response
}

export const config = {
  matcher: ['/', '/(de|en|es)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
}
