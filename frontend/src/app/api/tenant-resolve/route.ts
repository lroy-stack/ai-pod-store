/**
 * /api/tenant-resolve
 *
 * Resolves a custom domain to a tenant_id.
 * Used by middleware to populate x-tenant-id header on incoming requests.
 *
 * GET /api/tenant-resolve?domain=example.com
 * Response: { tenant_id: "uuid" } | { error: "not_found" }
 *
 * Caches results in Redis for 5 minutes to avoid hitting Supabase on every request.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAnon } from '@/lib/supabase-anon'
import { getCached, setCached } from '@/lib/redis'
import { PRIMARY_DOMAINS } from '@/lib/store-config'

const CACHE_TTL_SECONDS = 300 // 5-minute cache TTL

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const domain = searchParams.get('domain')

  if (!domain) {
    return NextResponse.json({ error: 'domain_required' }, { status: 400 })
  }

  // Normalize domain
  const normalizedDomain = domain.toLowerCase().replace(/\.$/, '').trim()

  // Skip primary domains — no tenant lookup needed
  if (PRIMARY_DOMAINS.some((d) => normalizedDomain === d || normalizedDomain.endsWith(`.${d}`))) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Check Redis cache (5 min TTL)
  const cacheKey = `tenant:resolve:${normalizedDomain}`
  const cached = await getCached(cacheKey)

  if (cached !== null) {
    if (cached.tenant_id) {
      return NextResponse.json({ tenant_id: cached.tenant_id, cached: true })
    }
    return NextResponse.json({ error: 'not_found', cached: true }, { status: 404 })
  }

  // Query Supabase
  const { data: tenant, error } = await supabaseAnon
    .from('tenants')
    .select('id, slug, status')
    .eq('domain', normalizedDomain)
    .eq('status', 'active')
    .single()

  if (error || !tenant) {
    // Cache negative result to prevent DB hammering
    await setCached(cacheKey, { tenant_id: null }, CACHE_TTL_SECONDS)
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Cache positive result
  await setCached(cacheKey, { tenant_id: tenant.id, slug: tenant.slug }, CACHE_TTL_SECONDS)

  return NextResponse.json({ tenant_id: tenant.id, slug: tenant.slug })
}
