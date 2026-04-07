/**
 * POST /api/tenants/create
 *
 * Creates a new tenant with optional branding and Stripe Connect config.
 *
 * Body:
 *   step1: { name, slug, domain? }
 *   step2: { logo_url?, primary_color?, secondary_color?, font_heading?, font_body? }
 *   step3: { stripe_connected_account_id? }
 *   step4: { plan: 'free' | 'starter' | 'pro' | 'enterprise' }
 *
 * Returns: { tenant_id, slug }
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withAuth } from '@/lib/auth-middleware'

const VALID_PLANS = ['free', 'starter', 'pro', 'enterprise'] as const

export const POST = withAuth(async (request: NextRequest, session: unknown) => {
  try {
    const body = await request.json()
    const { step1, step2, step3, step4 } = body

    // Validate required step 1 fields
    if (!step1?.name || !step1?.slug) {
      return NextResponse.json(
        { error: 'name and slug are required' },
        { status: 400 }
      )
    }

    const slug = step1.slug.toLowerCase().trim()
    const name = step1.name.trim()
    const domain = step1.domain?.trim() || null
    const plan = VALID_PLANS.includes(step4?.plan) ? step4.plan : 'free'

    // Validate slug format
    if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)) {
      return NextResponse.json(
        { error: 'Invalid slug format. Use lowercase letters, numbers, and hyphens.' },
        { status: 400 }
      )
    }

    // Check slug uniqueness
    const { data: existing } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Slug already taken' },
        { status: 409 }
      )
    }

    // Find the platform owner — use existing admin user as owner
    const { data: adminUser } = await supabaseAdmin
      .from('users')
      .select('id, auth_id')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const ownerId = adminUser?.auth_id ?? adminUser?.id ?? null

    if (!ownerId) {
      return NextResponse.json(
        { error: 'No owner user found. Create at least one user first.' },
        { status: 400 }
      )
    }

    // Create the tenant
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert({
        name,
        slug,
        domain,
        plan,
        status: 'active',
        owner_id: ownerId,
        settings: {},
      })
      .select('id, slug, name')
      .single()

    if (tenantError || !tenant) {
      console.error('[create tenant]', tenantError)
      return NextResponse.json(
        { error: 'Failed to create tenant' },
        { status: 500 }
      )
    }

    const tenantId = tenant.id

    // Seed branding config (step 2)
    const brandingEntries: Array<{ tenant_id: string; key: string; value: unknown }> = []

    if (step2?.logo_url) {
      brandingEntries.push({ tenant_id: tenantId, key: 'branding:logo_url', value: step2.logo_url })
    }
    if (step2?.primary_color) {
      brandingEntries.push({ tenant_id: tenantId, key: 'branding:primary_color', value: step2.primary_color })
    }
    if (step2?.secondary_color) {
      brandingEntries.push({ tenant_id: tenantId, key: 'branding:secondary_color', value: step2.secondary_color })
    }
    if (step2?.font_heading) {
      brandingEntries.push({ tenant_id: tenantId, key: 'branding:font_heading', value: step2.font_heading })
    }
    if (step2?.font_body) {
      brandingEntries.push({ tenant_id: tenantId, key: 'branding:font_body', value: step2.font_body })
    }
    if (step2?.store_name) {
      brandingEntries.push({ tenant_id: tenantId, key: 'branding:store_name', value: step2.store_name })
    }

    // Seed Stripe Connect config (step 3)
    if (step3?.stripe_connected_account_id) {
      brandingEntries.push({
        tenant_id: tenantId,
        key: 'stripe:connected_account_id',
        value: step3.stripe_connected_account_id,
      })
    }

    // Upsert all config entries
    if (brandingEntries.length > 0) {
      const { error: configError } = await supabaseAdmin
        .from('tenant_configs')
        .upsert(brandingEntries, { onConflict: 'tenant_id,key' })

      if (configError) {
        console.warn('[create tenant] Config seed warning:', configError)
        // Non-fatal — tenant was created, config seeding failed
      }
    }

    return NextResponse.json({
      success: true,
      tenant_id: tenantId,
      slug: tenant.slug,
      name: tenant.name,
      plan,
    })
  } catch (err) {
    console.error('[POST /api/tenants/create]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
