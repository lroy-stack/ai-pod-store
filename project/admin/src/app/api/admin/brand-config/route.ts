import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

/**
 * GET /api/admin/brand-config
 * Fetch the active brand configuration including personalization surcharge
 */
export async function GET(request: NextRequest) {
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
}

/**
 * PUT /api/admin/brand-config
 * Update the brand configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
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

    // Update fields (allow partial updates)
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.personalization_surcharge_amount !== undefined) {
      // Validate surcharge amount
      const surcharge = body.personalization_surcharge_amount;
      if (surcharge !== null) {
        if (typeof surcharge !== 'number' || surcharge < 0 || surcharge > 1000) {
          return NextResponse.json(
            { error: 'Surcharge must be a number between 0 and 1000' },
            { status: 400 }
          );
        }
      }
      updateData.personalization_surcharge_amount = surcharge;
    }

    if (body.brand_color_primary) updateData.brand_color_primary = body.brand_color_primary;
    if (body.brand_color_secondary) updateData.brand_color_secondary = body.brand_color_secondary;
    if (body.brand_font) updateData.brand_font = body.brand_font;
    if (body.packaging_insert_enabled !== undefined) updateData.packaging_insert_enabled = body.packaging_insert_enabled;
    if (body.packaging_insert_text !== undefined) updateData.packaging_insert_text = body.packaging_insert_text;
    if (body.gift_messages_enabled !== undefined) updateData.gift_messages_enabled = body.gift_messages_enabled;

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
}
