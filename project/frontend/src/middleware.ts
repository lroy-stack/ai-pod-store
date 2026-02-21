import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

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

export default async function middleware(request: NextRequest) {
  // First, run the i18n middleware
  const response = intlMiddleware(request)

  // --- A/B Testing: Variant Assignment ---
  // Get or create visitor ID for deterministic variant assignment
  let visitorId = request.cookies.get('pod-visitor-id')?.value
  if (!visitorId) {
    visitorId = crypto.randomUUID()
    response.cookies.set('pod-visitor-id', visitorId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60,
      path: '/',
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
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60,
            path: '/',
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
    // SECURITY: Validate JWT token with Supabase (not just cookie presence)
    // This prevents unauthorized access with expired/forged tokens

    // Create Supabase client for middleware (edge-compatible)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => {
            return request.cookies.getAll()
          },
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              request.cookies.set(name, value)
            )
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // Validate JWT token by attempting to get user
    const { data: { user }, error } = await supabase.auth.getUser()

    if (!user || error) {
      // Token is invalid, expired, or missing
      // Extract locale from pathname (e.g., /en/profile -> en)
      const localeMatch = pathname.match(/^\/([a-z]{2})/)
      const locale = localeMatch ? localeMatch[1] : 'en'

      // Redirect to login page with return URL
      const loginUrl = new URL(`/${locale}/auth/login`, request.url)
      loginUrl.searchParams.set('returnUrl', pathname)

      return NextResponse.redirect(loginUrl)
    }

    // Token is valid, user is authenticated
    // Add user ID to headers for downstream API routes (optional optimization)
    response.headers.set('x-user-id', user.id)
  }

  return response
}

export const config = {
  matcher: ['/', '/(de|en|es)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
}
