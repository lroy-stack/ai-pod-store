/**
 * GET /api/tenants
 *
 * Returns a list of all tenants with their plan, status, and usage summary.
 * Used by the admin tenants list page.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withAuth } from '@/lib/auth-middleware'

export const GET = withAuth(async (req: NextRequest, session: unknown) => {
  try {
    const { data: tenants, error } = await supabaseAdmin
      .from('tenants')
      .select('id, name, slug, plan, status, domain, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[/api/tenants GET]', error)
      return NextResponse.json({ error: 'Failed to fetch tenants' }, { status: 500 })
    }

    return NextResponse.json({ tenants: tenants ?? [] })
  } catch (err) {
    console.error('[/api/tenants]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
