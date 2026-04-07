// Copyright (c) 2026 L.LÖWE <maintainer@example.com>
// SPDX-License-Identifier: MIT

import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  generateCSRFToken,
  validateCSRFToken,
  requiresCSRFProtection,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  CSRF_COOKIE_OPTIONS,
} from './lib/csrf'
import { PRIMARY_DOMAINS } from './lib/store-config'

// Protected routes that require authentication
// Note: /cart and /checkout allow guest access for guest checkout feature
const protectedRoutes = [
  '/profile',
  '/orders',
  '/wishlist',
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

// PRIMARY_DOMAINS imported from @/lib/store-config (canonical source)

// Internal paths that must skip tenant resolution to avoid infinite loops
const SKIP_TENANT_PATHS = ['/api/tenant-resolve', '/api/verify-domain']

export default async function middleware(request: NextRequest) {
  // Get the pathname early for routing decisions
  const pathname = request.nextUrl.pathname
  const hostname = request.nextUrl.hostname

  // --- Tenant Resolution (custom domain → tenant_id) ---
  // Edge-compatible: calls /api/tenant-resolve (server route with Redis cache)
  // so we avoid ioredis (Node-only) in the Edge runtime.
  const requestHeaders = new Headers(request.headers)

  const isPrimaryDomain = PRIMARY_DOMAINS.some(
    (d) => hostname === d || hostname.endsWith(`.${d}`)
  )
  const skipTenantResolution = SKIP_TENANT_PATHS.some((p) => pathname.startsWith(p))

  // Check cookie cache first to avoid HTTP roundtrip on every request
  const cachedTenantId = request.cookies.get('x-tenant-id')?.value
  if (cachedTenantId) {
    requestHeaders.set('x-tenant-id', cachedTenantId)
  } else if (!isPrimaryDomain && !skipTenantResolution) {
    try {
      const resolveUrl = new URL(
        `/api/tenant-resolve?domain=${encodeURIComponent(hostname)}`,
        request.url
      )
      const tenantRes = await fetch(resolveUrl.toString())
      if (tenantRes.ok) {
        const data = await tenantRes.json()
        if (data.tenant_id) {
          requestHeaders.set('x-tenant-id', data.tenant_id)
        }
      }
    } catch {
      // Tenant resolution failed — continue without tenant isolation
    }
  }
  // --- End Tenant Resolution ---

  // Skip i18n middleware for API routes (they don't have locale prefixes)
  const isApiRoute = pathname.startsWith('/api')

  // Build response — API routes get modified request headers forwarded downstream;
  // page routes go through i18n middleware and receive tenant header via response headers.
  let response: NextResponse
  if (isApiRoute) {
    // Forward modified request headers to API route handlers
    response = NextResponse.next({ request: { headers: requestHeaders } })
  } else {
    response = intlMiddleware(request) as NextResponse
    // Propagate tenant ID for Server Components (Next.js forwards response headers)
    const tenantId = requestHeaders.get('x-tenant-id')
    if (tenantId) {
      response.headers.set('x-tenant-id', tenantId)
      // Cache tenant resolution in cookie (5 min TTL) to skip HTTP fetch on next request
      if (!cachedTenantId) {
        response.cookies.set('x-tenant-id', tenantId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 300,
          path: '/',
        })
      }
    }
  }

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

  // --- CSRF Protection ---
  // Generate CSRF token if it doesn't exist
  let csrfToken = request.cookies.get(CSRF_COOKIE_NAME)?.value
  if (!csrfToken) {
    csrfToken = generateCSRFToken()
    response.cookies.set(CSRF_COOKIE_NAME, csrfToken, CSRF_COOKIE_OPTIONS)
  }

  // Validate CSRF token for mutation requests to API routes
  // Skip CSRF for webhooks, admin, and cron routes (they have their own auth mechanisms)
  const isWebhook = pathname.startsWith('/api/webhooks/')
  const isAdminOrCron = pathname.startsWith('/api/admin/') || pathname.startsWith('/api/cron/')
  const isAuthSession = pathname === '/api/auth/set-session' || pathname === '/api/auth/welcome'
  if (pathname.startsWith('/api') && requiresCSRFProtection(request.method) && !isWebhook && !isAdminOrCron && !isAuthSession) {
    const headerToken = request.headers.get(CSRF_HEADER_NAME)
    const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value

    if (!validateCSRFToken(cookieToken, headerToken)) {
      return NextResponse.json(
        {
          error: 'CSRF token validation failed',
          message: 'Invalid or missing CSRF token. Please refresh the page and try again.',
        },
        { status: 403 }
      )
    }
  }
  // --- End CSRF Protection ---

  // Public shared routes — bypass auth even if parent path is protected
  const isPublicSharedRoute = pathname.match(/^\/[a-z]{2}\/wishlist\/shared\//)
  if (isPublicSharedRoute) {
    return response
  }

  // Check if this is a protected route
  const isProtectedRoute = protectedRoutes.some((route) => {
    // Check if pathname matches protected route (accounting for locale prefix)
    // e.g., /en/profile, /es/profile, /de/profile
    return pathname.match(new RegExp(`^/[a-z]{2}${route}(/|$)`))
  })

  if (isProtectedRoute) {
    // SECURITY: Validate JWT token with Supabase (not just cookie presence)
    // Read custom auth cookies (set by /api/auth/login)
    const accessToken = request.cookies.get('sb-access-token')?.value

    let authenticated = false
    if (accessToken) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } }
        )
        const { data: { user }, error } = await supabase.auth.getUser(accessToken)
        if (user && !error) {
          authenticated = true
          response.headers.set('x-user-id', user.id)
        }
      } catch {
        // Token verification failed
      }
    }

    if (!authenticated) {
      const localeMatch = pathname.match(/^\/([a-z]{2})/)
      const locale = localeMatch ? localeMatch[1] : 'en'
      const loginUrl = new URL(`/${locale}/auth/login`, request.url)
      loginUrl.searchParams.set('returnUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return response
}

export const config = {
  // Include /api routes for CSRF protection, exclude _next, _vercel, and static files
  matcher: ['/', '/api/:path*', '/(de|en|es)/:path*', '/((?!_next|_vercel|.*\\..*).*)'],
}
