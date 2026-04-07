import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withValidation, brandConfigSchema } from '@/lib/validation';
import { withPermission } from '@/lib/rbac';
import { withAuth } from '@/lib/auth-middleware';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

/**
 * GET /api/admin/brand-config
 * Fetch the active brand configuration including personalization surcharge
 */
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from('brand_config')
      .select('*')
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Error fetching brand config:', error);
      return NextResponse.json(
        { error: 'Failed to fetch brand configuration' },
        { status: 500 }
      );
    }

    return NextResponse.json({ config: data });
  } catch (error) {
    console.error('Error in GET /api/admin/brand-config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/admin/brand-config
 * Update the brand configuration
 */
export const PUT = withPermission('settings', 'update', withValidation(brandConfigSchema, async (request: NextRequest, validatedData) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the current active config ID
    const { data: currentConfig } = await supabase
      .from('brand_config')
      .select('id')
      .eq('is_active', true)
      .single();

    if (!currentConfig) {
      return NextResponse.json(
        { error: 'No active brand configuration found' },
        { status: 404 }
      );
    }

    // Update fields (allow partial updates) - validation already done by schema
    const updateData: any = {
      updated_at: new Date().toISOString(),
      ...validatedData,
    };

    const { data, error } = await supabase
      .from('brand_config')
      .update(updateData)
      .eq('id', currentConfig.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating brand config:', error);
      return NextResponse.json(
        { error: 'Failed to update brand configuration' },
        { status: 500 }
      );
    }

    return NextResponse.json({ config: data });
  } catch (error) {
    console.error('Error in PUT /api/admin/brand-config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}));
