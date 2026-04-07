import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

/**
 * GET /api/storefront/personalization-surcharge
 * Public endpoint to fetch personalization surcharge amount
 * Returns null if no surcharge is configured
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data, error } = await supabase
      .from('brand_config')
      .select('personalization_surcharge_amount')
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Error fetching personalization surcharge:', error);
      return NextResponse.json(
        { error: 'Failed to fetch personalization surcharge' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        surcharge: data.personalization_surcharge_amount,
        has_surcharge: data.personalization_surcharge_amount !== null && data.personalization_surcharge_amount > 0,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        },
      }
    );
  } catch (error) {
    console.error('Error in GET /api/storefront/personalization-surcharge:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
