import { withAuth } from '@/lib/auth-middleware'
import { createClient } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/admin/themes
 * Returns list of all store themes
 */
export const GET = withAuth(async (req, session) => {
  try {
    const supabase = createClient();

    const { data: themes, error } = await supabase
      .from('store_themes')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching themes:', error);
      return NextResponse.json({ error: 'Failed to fetch themes' }, { status: 500 });
    }

    return NextResponse.json(themes || []);
  } catch (error) {
    console.error('Error in themes API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
})

/**
 * POST /api/admin/themes
 * Creates a new custom theme
 */
export const POST = withAuth(async (req, session) => {
  try {
    const body = await req.json();
    const supabase = createClient();

    // Required fields
    if (\!body.name || \!body.slug) {
      return NextResponse.json(
        { error: 'Missing required fields: name and slug are required' },
        { status: 400 }
      );
    }

    // Build theme object with defaults
    const newTheme: Record<string, any> = {
      name: body.name,
      slug: body.slug,
      description: body.description || '',
      category: body.category || 'custom',
      css_variables: body.css_variables || {},
      css_variables_dark: body.css_variables_dark || {},
      fonts: body.fonts || {
        heading: 'system-ui',
        body: 'system-ui',
        mono: 'ui-monospace',
      },
      border_radius: body.border_radius || 'medium',
      shadow_preset: body.shadow_preset || 'medium',
      is_custom: true, // Always true for user-created themes
      is_active: false, // New themes start inactive
      is_default: false, // New themes cannot be default
    };

    // Validate category
    const validCategories = ['light', 'dark', 'high_contrast', 'custom'];
    if (\!validCategories.includes(newTheme.category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate border_radius
    const validRadii = ['none', 'small', 'medium', 'large', 'full'];
    if (\!validRadii.includes(newTheme.border_radius)) {
      return NextResponse.json(
        { error: `Invalid border_radius. Must be one of: ${validRadii.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate shadow_preset
    const validPresets = ['none', 'small', 'medium', 'large', 'extra_large'];
    if (\!validPresets.includes(newTheme.shadow_preset)) {
      return NextResponse.json(
        { error: `Invalid shadow_preset. Must be one of: ${validPresets.join(', ')}` },
        { status: 400 }
      );
    }

    // Insert the new theme
    const { data: createdTheme, error: insertError } = await supabase
      .from('store_themes')
      .insert(newTheme)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating theme:', insertError);
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'A theme with this slug already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to create theme' },
        { status: 500 }
      );
    }

    return NextResponse.json(createdTheme, { status: 201 });
  } catch (error) {
    console.error('Error in themes POST API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
})
