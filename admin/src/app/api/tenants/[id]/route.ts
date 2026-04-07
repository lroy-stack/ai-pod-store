/**
 * PATCH /api/tenants/[id]
 *
 * Updates a tenant's settings. Enforces plan-based feature gates:
 *   - Setting a custom domain requires Starter plan or higher.
 *
 * Body: { name?, domain?, plan?, status? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withAuth } from '@/lib/auth-middleware'
import { withPermission } from '@/lib/rbac'

// Plan feature config (mirrors plan-gates.ts in frontend)
const PLAN_CONFIG: Record<string, { custom_domain: boolean; max_products: number | null }> = {
  free: { custom_domain: false, max_products: 10 },
  starter: { custom_domain: true, max_products: 50 },
  pro: { custom_domain: true, max_products: 200 },
  enterprise: { custom_domain: true, max_products: null },
}

export const PATCH = withPermission('settings', 'update', async (
  request: NextRequest,
  session: unknown,
  context: { params: Promise<{ id: string }> }
) => {
  const { id: tenantId } = await context.params

  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id required' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const { name, domain, plan, status } = body

    // Fetch current tenant to check plan
    const { data: tenant, error: fetchError } = await supabaseAdmin
      .from('tenants')
      .select('id, plan, domain')
      .eq('id', tenantId)
      .single()

    if (fetchError || !tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const effectivePlan = plan ?? tenant.plan ?? 'free'
    const planConfig = PLAN_CONFIG[effectivePlan] ?? PLAN_CONFIG.free

    // Enforce: custom domain requires paid plan
    const newDomain = domain !== undefined ? domain : tenant.domain
    if (newDomain && !planConfig.custom_domain) {
      return NextResponse.json(
        {
          error: `Custom domains require Starter plan or higher. Current plan: ${effectivePlan}.`,
          code: 'PLAN_LIMIT_DOMAIN',
          plan: effectivePlan,
          upgrade_to: 'starter',
        },
        { status: 402 }  // Payment Required = plan upgrade needed
      )
    }

    // Build update payload (only include provided fields)
    const updatePayload: Record<string, unknown> = {}
    if (name !== undefined) {
      const trimmedName = (typeof name === 'string' ? name : '').trim()
      if (trimmedName.length === 0 || trimmedName.length > 100) {
        return NextResponse.json({ error: 'Name must be 1-100 characters' }, { status: 400 })
      }
      updatePayload.name = trimmedName
    }
    if (domain !== undefined) updatePayload.domain = domain?.trim() || null
    if (plan !== undefined) {
      if (!Object.keys(PLAN_CONFIG).includes(plan)) {
        return NextResponse.json({ error: `Invalid plan. Use: ${Object.keys(PLAN_CONFIG).join(', ')}` }, { status: 400 })
      }
      updatePayload.plan = plan
    }
    if (status !== undefined) {
      const VALID_STATUSES = ['active', 'suspended', 'pending']
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json({ error: `Invalid status. Use: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
      }
      updatePayload.status = status
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('tenants')
      .update(updatePayload)
      .eq('id', tenantId)
      .select('id, name, slug, plan, status, domain, updated_at')
      .single()

    if (updateError) {
      console.error('[PATCH /api/tenants/[id]]', updateError)
      return NextResponse.json({ error: 'Failed to update tenant' }, { status: 500 })
    }

    return NextResponse.json({ success: true, tenant: updated })
  } catch (err) {
    console.error('[PATCH /api/tenants/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const GET = withAuth(async (
  _request: NextRequest,
  session: unknown,
  context: { params: Promise<{ id: string }> }
) => {
  const { id: tenantId } = await context.params

  const { data: tenant, error } = await supabaseAdmin
    .from('tenants')
    .select('id, name, slug, plan, status, domain, created_at, updated_at')
    .eq('id', tenantId)
    .single()

  if (error || !tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  return NextResponse.json({ tenant })
})
