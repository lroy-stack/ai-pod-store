/**
 * GET /api/storefront/branding
 *
 * Returns per-tenant branding settings stored in tenant_configs.
 *
 * Branding keys in tenant_configs use the prefix "branding:":
 *   branding:logo_url         — custom logo image URL
 *   branding:favicon_url      — custom favicon URL
 *   branding:store_name       — display store name override
 *   branding:tagline          — store tagline
 *   branding:primary_color    — CSS color override for --primary (OKLCH or hex)
 *   branding:secondary_color  — CSS color override for --secondary
 *   branding:accent_color     — CSS color override for --accent
 *   branding:font_heading     — Google Fonts heading family override
 *   branding:font_body        — Google Fonts body family override
 *   branding:css_overrides    — arbitrary CSS variable map (JSONB)
 *
 * Legal settings use the prefix "legal:":
 *   legal:privacy_policy_url
 *   legal:terms_of_service_url
 *   legal:refund_policy_url
 *   legal:company_name
 *   legal:contact_email
 *
 * If no x-tenant-id header is present, returns empty branding
 * (platform defaults from brand_config apply).
 *
 * Cache-Control: 5 minutes (same as /api/storefront/theme)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAnon } from '@/lib/supabase-anon'

export const dynamic = 'force-dynamic'

export interface TenantBranding {
  logo_url?: string
  favicon_url?: string
  store_name?: string
  tagline?: string
  primary_color?: string
  secondary_color?: string
  accent_color?: string
  font_heading?: string
  font_body?: string
  css_overrides?: Record<string, string>
}

export interface TenantLegal {
  privacy_policy_url?: string
  terms_of_service_url?: string
  refund_policy_url?: string
  company_name?: string
  contact_email?: string
}

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id')

  if (!tenantId) {
    // No tenant context — return empty branding (platform defaults apply)
    return NextResponse.json(
      { branding: {}, legal: {}, tenant_id: null },
      { headers: { 'Cache-Control': 'public, max-age=300' } }
    )
  }

  try {
    // Fetch all branding: and legal: keys for this tenant
    const { data: configs, error } = await supabaseAnon
      .from('tenant_configs')
      .select('key, value')
      .eq('tenant_id', tenantId)
      .or('key.like.branding:%,key.like.legal:%')

    if (error) {
      console.error('[/api/storefront/branding] Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch branding' },
        { status: 500 }
      )
    }

    const branding: TenantBranding = {}
    const legal: TenantLegal = {}

    for (const config of configs ?? []) {
      const value = config.value

      if (config.key.startsWith('branding:')) {
        const key = config.key.replace('branding:', '') as keyof TenantBranding
        // JSONB values may be wrapped in objects — unwrap scalar strings
        const scalar = typeof value === 'string' ? value : (value as { v?: string })?.v ?? value
        ;(branding as Record<string, unknown>)[key] = scalar
      } else if (config.key.startsWith('legal:')) {
        const key = config.key.replace('legal:', '') as keyof TenantLegal
        const scalar = typeof value === 'string' ? value : (value as { v?: string })?.v ?? value
        ;(legal as Record<string, unknown>)[key] = scalar
      }
    }

    return NextResponse.json(
      { branding, legal, tenant_id: tenantId },
      { headers: { 'Cache-Control': 'public, max-age=300' } }
    )
  } catch (err) {
    console.error('[/api/storefront/branding] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
