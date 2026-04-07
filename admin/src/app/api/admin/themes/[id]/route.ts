import { withAuth } from '@/lib/auth-middleware'
import { withPermission } from '@/lib/rbac'
import { withValidation } from '@/lib/validation'
import { themeUpdateSchema } from '@/lib/schemas/extended'
import { createClient } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/admin/themes/[id]
 * Returns a single theme by ID
 */
export const GET = withAuth(async (req, session, context) => {
  try {
    const { id } = await context.params;
    const supabase = createClient();

    const { data: theme, error } = await supabase
      .from('store_themes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching theme:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Theme not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to fetch theme' }, { status: 500 });
    }

    return NextResponse.json(theme);
  } catch (error) {
    console.error('Error in theme GET API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
})

/**
 * PUT /api/admin/themes/[id]
 * Updates a theme
 */
export const PUT = withPermission('themes', 'update', withValidation(themeUpdateSchema, async (req, validatedData, session, context) => {
  try {
    const { id } = await context.params;
    const supabase = createClient();

    // Extract updatable fields from validatedData
    const updateData: Record<string, any> = {};
    const allowedFields = [
      'name', 'slug', 'description', 'category', 'css_variables',
      'css_variables_dark', 'fonts', 'border_radius', 'shadow_preset',
      'is_active', 'is_default',
    ];
    for (const field of allowedFields) {
      if (field in validatedData) {
        updateData[field] = (validatedData as any)[field];
      }
    }

    // If no fields to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Handle is_active flag - only one theme can be active at a time
    if (updateData.is_active === true) {
      // First, deactivate all other themes
      const { error: deactivateError } = await supabase
        .from('store_themes')
        .update({ is_active: false })
        .neq('id', id);

      if (deactivateError) {
        console.error('Error deactivating other themes:', deactivateError);
        return NextResponse.json(
          { error: 'Failed to deactivate other themes' },
          { status: 500 }
        );
      }
    }

    // Handle is_default flag - only one theme can be default
    if (updateData.is_default === true) {
      // First, remove default flag from all other themes
      const { error: undefaultError } = await supabase
        .from('store_themes')
        .update({ is_default: false })
        .neq('id', id);

      if (undefaultError) {
        console.error('Error removing default from other themes:', undefaultError);
        return NextResponse.json(
          { error: 'Failed to update default theme' },
          { status: 500 }
        );
      }
    }

    // Update the theme
    const { data: updatedTheme, error: updateError } = await supabase
      .from('store_themes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating theme:', updateError);
      if (updateError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Theme not found' }, { status: 404 });
      }
      if (updateError.code === '23505') {
        return NextResponse.json({ error: 'Theme slug already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to update theme' }, { status: 500 });
    }

    return NextResponse.json(updatedTheme);
  } catch (error) {
    console.error('Error in theme PUT API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}))
