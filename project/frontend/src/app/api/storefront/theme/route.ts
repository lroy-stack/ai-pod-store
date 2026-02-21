import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

/**
 * GET /api/storefront/theme
 * Returns the active theme's CSS variables for the frontend
 * This is a public endpoint (no authentication required)
 */
export async function GET() {
  try {

    // Fetch the active theme
    const { data: activeTheme, error } = await supabaseAdmin
      .from('store_themes')
      .select('*')
      .eq('is_active', true)
      .single();

    // If no active theme, return the default theme
    if (error || !activeTheme) {
      const { data: defaultTheme, error: defaultError } = await supabaseAdmin
        .from('store_themes')
        .select('*')
        .eq('is_default', true)
        .single();

      if (defaultError || !defaultTheme) {
        // Fallback to Ocean Blue if neither active nor default theme exists
        const { data: fallbackTheme, error: fallbackError } = await supabaseAdmin
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
