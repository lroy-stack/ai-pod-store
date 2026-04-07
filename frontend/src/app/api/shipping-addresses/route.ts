import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireAuth, authErrorResponse } from '@/lib/auth-guard';

// GET /api/shipping-addresses - Get all shipping addresses for the current user
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const tenantId = request.headers.get('x-tenant-id');
    let query = supabaseAdmin
      .from('shipping_addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data: addresses, error } = await query;

    if (error) {
      console.error('Error fetching shipping addresses:', error);
      return NextResponse.json({ error: 'Failed to fetch addresses' }, { status: 500 });
    }

    return NextResponse.json(addresses);
  } catch (error) {
    if (error instanceof Error && 'status' in error) return authErrorResponse(error);
    console.error('Unexpected error fetching shipping addresses:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/shipping-addresses - Create a new shipping address
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const body = await request.json();
    const {
      label,
      full_name,
      street_line1,
      street_line2,
      city,
      state,
      postal_code,
      country_code,
      phone,
      is_default
    } = body;

    if (!street_line1 || !city || !postal_code || !country_code) {
      return NextResponse.json(
        { error: 'Missing required fields: street_line1, city, postal_code, country_code' },
        { status: 400 }
      );
    }

    // If setting as default, unset all other defaults for this user
    if (is_default) {
      await supabaseAdmin
        .from('shipping_addresses')
        .update({ is_default: false })
        .eq('user_id', user.id);
    }

    const { data: newAddress, error } = await supabaseAdmin
      .from('shipping_addresses')
      .insert({
        user_id: user.id,
        label,
        full_name,
        street_line1,
        street_line2,
        city,
        state,
        postal_code,
        country_code,
        phone,
        is_default: is_default || false
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating shipping address:', error);
      return NextResponse.json({ error: 'Failed to create address' }, { status: 500 });
    }

    return NextResponse.json(newAddress, { status: 201 });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return authErrorResponse(error);
    console.error('Unexpected error creating shipping address:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
