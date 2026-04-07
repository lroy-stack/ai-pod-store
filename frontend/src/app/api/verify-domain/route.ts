/**
 * /api/verify-domain
 *
 * Used by Caddy's on_demand_tls ask directive to validate whether to issue
 * an automated TLS certificate for a custom domain.
 *
 * Caddy calls: GET /api/verify-domain?domain=example.com
 * - 200 OK   → valid custom domain, issue certificate
 * - 403      → unknown domain, refuse certificate
 *
 * Security: Only issues certificates for domains registered in our tenants table.
 * This prevents certificate issuance for arbitrary domains.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAnon } from '@/lib/supabase-anon'
import { getCached, setCached } from '@/lib/redis'

const CACHE_TTL_SECONDS = 300 // 5 minutes

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const domain = searchParams.get('domain')

  if (!domain) {
    return new NextResponse('Missing domain parameter', { status: 400 })
  }

  // Normalize domain (lowercase, no trailing dot)
  const normalizedDomain = domain.toLowerCase().replace(/\.$/, '').trim()

  // Check Redis cache first (5 min TTL)
  const cacheKey = `tenant:domain:${normalizedDomain}`
  const cached = await getCached(cacheKey)

  if (cached !== null) {
    // Cache hit
    return cached.valid
      ? new NextResponse('OK', { status: 200 })
      : new NextResponse('Domain not registered', { status: 403 })
  }

  // Query Supabase for tenant with this custom domain
  const { data: tenant, error } = await supabaseAnon
    .from('tenants')
    .select('id, status')
    .eq('domain', normalizedDomain)
    .eq('status', 'active')
    .single()

  if (error || !tenant) {
    // Cache negative result to avoid hammering DB on invalid domains
    await setCached(cacheKey, { valid: false, domain: normalizedDomain }, CACHE_TTL_SECONDS)
    return new NextResponse('Domain not registered', { status: 403 })
  }

  // Domain is valid — cache positive result
  await setCached(
    cacheKey,
    { valid: true, domain: normalizedDomain, tenant_id: tenant.id },
    CACHE_TTL_SECONDS
  )

  return new NextResponse('OK', { status: 200 })
}
