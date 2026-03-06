import { withAuth } from '@/lib/auth-middleware'
import { withPermission } from '@/lib/rbac'
import { withValidation } from '@/lib/validation'
import { themeSchema } from '@/lib/schemas/extended'
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
export const POST = withPermission('themes', 'create', withValidation(themeSchema, async (req, validatedData, session) => {
  try {
    const supabase = createClient();

    // Build theme object with defaults
    const newTheme: Record<string, any> = {
      name: validatedData.name,
      slug: validatedData.slug,
      description: validatedData.description || '',
      category: validatedData.category || 'custom',
      css_variables: validatedData.css_variables || {},
      css_variables_dark: validatedData.css_variables_dark || {},
      fonts: validatedData.fonts || {
        heading: 'system-ui',
        body: 'system-ui',
        mono: 'ui-monospace',
      },
      border_radius: validatedData.border_radius || 'medium',
      shadow_preset: validatedData.shadow_preset || 'medium',
      is_custom: true, // Always true for user-created themes
      is_active: false, // New themes start inactive
      is_default: false, // New themes cannot be default
    };

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
}))
