import { supabaseAnon } from '@/lib/supabase-anon';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/storefront/theme
 * Returns the active theme's CSS variables for the frontend.
 * This is a public endpoint (no authentication required).
 *
 * Per-tenant theme resolution order:
 *   1. Tenant-specific active theme (if x-tenant-id header present)
 *   2. Global active theme (tenant_id IS NULL)
 *   3. Global default theme
 *   4. Fallback slug 'ocean-blue'
 */
export async function GET(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id') || null

  try {
    // If tenant context, look for tenant-specific active theme first
    if (tenantId) {
      const { data: tenantTheme } = await supabaseAnon
        .from('store_themes')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .single()

      if (tenantTheme) {
        return NextResponse.json(
          {
            id: tenantTheme.id,
            name: tenantTheme.name,
            slug: tenantTheme.slug,
            category: tenantTheme.category,
            css_variables: tenantTheme.css_variables,
            css_variables_dark: tenantTheme.css_variables_dark,
            fonts: tenantTheme.fonts,
            border_radius: tenantTheme.border_radius,
            shadow_preset: tenantTheme.shadow_preset,
            tenant_id: tenantTheme.tenant_id,
          },
          { headers: { 'Cache-Control': 'public, max-age=300' } }
        )
      }
      // Fall through to global theme resolution
    }

    // Fetch the active theme (global)
    const { data: activeTheme, error } = await supabaseAnon
      .from('store_themes')
      .select('*')
      .eq('is_active', true)
      .is('tenant_id', null)
      .single();

    // If no active theme, return the default theme
    if (error || !activeTheme) {
      const { data: defaultTheme, error: defaultError } = await supabaseAnon
        .from('store_themes')
        .select('*')
        .eq('is_default', true)
        .single();

      if (defaultError || !defaultTheme) {
        // Fallback to Ocean Blue if neither active nor default theme exists
        const { data: fallbackTheme, error: fallbackError } = await supabaseAnon
          .from('store_themes')
          .select('*')
          .eq('slug', 'ocean-blue')
          .single();

        if (fallbackError || !fallbackTheme) {
          console.error('No themes found in database:', fallbackError);
          return NextResponse.json(
            { error: 'No theme configured' },
            {
              status: 500,
              headers: {
                'Cache-Control': 'public, max-age=300',
              }
            }
          );
        }

        return NextResponse.json(
          {
            id: fallbackTheme.id,
            name: fallbackTheme.name,
            slug: fallbackTheme.slug,
            category: fallbackTheme.category,
            css_variables: fallbackTheme.css_variables,
            css_variables_dark: fallbackTheme.css_variables_dark,
            fonts: fallbackTheme.fonts,
            border_radius: fallbackTheme.border_radius,
            shadow_preset: fallbackTheme.shadow_preset,
          },
          {
            headers: {
              'Cache-Control': 'public, max-age=300',
            }
          }
        );
      }

      return NextResponse.json(
        {
          id: defaultTheme.id,
          name: defaultTheme.name,
          slug: defaultTheme.slug,
          category: defaultTheme.category,
          css_variables: defaultTheme.css_variables,
          css_variables_dark: defaultTheme.css_variables_dark,
          fonts: defaultTheme.fonts,
          border_radius: defaultTheme.border_radius,
          shadow_preset: defaultTheme.shadow_preset,
        },
        {
          headers: {
            'Cache-Control': 'public, max-age=300',
          }
        }
      );
    }

    // Return the active theme
    return NextResponse.json(
      {
        id: activeTheme.id,
        name: activeTheme.name,
        slug: activeTheme.slug,
        category: activeTheme.category,
        css_variables: activeTheme.css_variables,
        css_variables_dark: activeTheme.css_variables_dark,
        fonts: activeTheme.fonts,
        border_radius: activeTheme.border_radius,
        shadow_preset: activeTheme.shadow_preset,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=300',
        }
      }
    );
  } catch (error) {
    console.error('Error fetching storefront theme:', error);
    return NextResponse.json(
      { error: 'Failed to fetch theme' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'public, max-age=300',
        }
      }
    );
  }
}
