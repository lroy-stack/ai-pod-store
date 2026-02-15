import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { NextRequest, NextResponse } from 'next/server'

// Protected routes that require authentication
// Note: /cart and /checkout allow guest access for guest checkout feature
const protectedRoutes = [
  '/profile',
  '/orders',
]

// Create the i18n middleware
const intlMiddleware = createMiddleware(routing)

// Simple string hash for deterministic A/B variant assignment
function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // Convert to 32-bit integer
  }
  return hash
}

export default function middleware(request: NextRequest) {
  // First, run the i18n middleware
  const response = intlMiddleware(request)

  // --- A/B Testing: Variant Assignment ---
  // Get or create visitor ID for deterministic variant assignment
  let visitorId = request.cookies.get('pod-visitor-id')?.value
  if (!visitorId) {
    visitorId = crypto.randomUUID()
    response.cookies.set('pod-visitor-id', visitorId, {
      maxAge: 365 * 24 * 60 * 60,
      path: '/',
      sameSite: 'lax',
    })
  }

  // Read A/B config from cookie (set by admin when experiments are started)
  const abConfigRaw = request.cookies.get('__ab_config')?.value
  const activeVariants: Record<string, string> = {}

  if (abConfigRaw) {
    try {
      const experiments: Array<{ id: string; variants: string[] }> = JSON.parse(abConfigRaw)
      for (const exp of experiments) {
        const cookieName = `ab-variant-${exp.id}`
        // Check if variant already assigned
        let variant = request.cookies.get(cookieName)?.value

        if (!variant && exp.variants.length > 0) {
          // Deterministic hash: simple string hash of visitorId + experimentId
          const hash = simpleHash(visitorId + exp.id)
          const variantIndex = Math.abs(hash) % exp.variants.length
          variant = exp.variants[variantIndex]
          response.cookies.set(cookieName, variant, {
            maxAge: 30 * 24 * 60 * 60,
            path: '/',
            sameSite: 'lax',
          })
        }

        // Track active variants for header
        if (variant) {
          activeVariants[exp.id] = variant
        }
      }
    } catch {
      // Invalid config cookie, ignore
    }
  }

  // Set x-ab-variant header with active variants
  if (Object.keys(activeVariants).length > 0) {
    response.headers.set('x-ab-variant', JSON.stringify(activeVariants))
  }
  // --- End A/B Testing ---

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
