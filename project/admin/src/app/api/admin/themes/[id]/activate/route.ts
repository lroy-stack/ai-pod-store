import { withPermission } from '@/lib/rbac'
import { createClient } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/admin/themes/[id]/activate
 * Activates a theme (sets is_active to true) and deactivates all others
 */
export const POST = withPermission('themes', 'update', async (req, session, context) => {
  try {
    const { id } = await context.params;
    const supabase = createClient();

    // First, verify the theme exists
    const { data: theme, error: fetchError } = await supabase
      .from('store_themes')
      .select('id, name, slug')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching theme:', fetchError);
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Theme not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to fetch theme' }, { status: 500 });
    }

    // Deactivate all themes first
    const { error: deactivateError } = await supabase
      .from('store_themes')
      .update({ is_active: false })
      .neq('id', id);

    if (deactivateError) {
      console.error('Error deactivating themes:', deactivateError);
      return NextResponse.json(
        { error: 'Failed to deactivate other themes' },
        { status: 500 }
      );
    }

    // Activate the specified theme
    const { data: activatedTheme, error: activateError } = await supabase
      .from('store_themes')
      .update({ is_active: true })
      .eq('id', id)
      .select()
      .single();

    if (activateError) {
      console.error('Error activating theme:', activateError);
      return NextResponse.json(
        { error: 'Failed to activate theme' },
        { status: 500 }
      );
    }

    // Invalidate SSR theme cache on the frontend
    // Use REVALIDATION_SECRET (falls back to CRON_SECRET) — NOT the Supabase service key
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
    const revalidationSecret = process.env.REVALIDATION_SECRET || process.env.CRON_SECRET
    fetch(`${frontendUrl}/api/revalidate/theme`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${revalidationSecret}` },
    }).catch(() => {
      // Non-blocking — worst case, SSR cache refreshes in 5 minutes
    })

    return NextResponse.json({
      success: true,
      message: `Theme "${theme.name}" activated successfully`,
      theme: activatedTheme,
    });
  } catch (error) {
    console.error('Error in theme activate API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
})
