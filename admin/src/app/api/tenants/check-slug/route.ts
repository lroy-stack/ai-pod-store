/**
 * GET /api/tenants/check-slug?slug=xxx
 *
 * Returns { available: boolean } — used by the tenant wizard to validate slugs.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withAuth } from '@/lib/auth-middleware'

export const GET = withAuth(async (request: NextRequest, session: unknown) => {
  const slug = request.nextUrl.searchParams.get('slug')?.toLowerCase().trim()

  if (!slug) {
    return NextResponse.json({ error: 'slug required' }, { status: 400 })
  }

  // Validate slug format: lowercase alphanumeric + hyphens, 3-50 chars
  if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)) {
    return NextResponse.json({ available: false, reason: 'invalid_format' })
  }

  const { data } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  return NextResponse.json({ available: !data })
})
