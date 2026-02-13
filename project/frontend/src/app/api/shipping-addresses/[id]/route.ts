import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// PUT /api/shipping-addresses/[id] - Update a shipping address
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Get token from HTTP-only cookie
    const token = request.cookies.get('sb-access-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify token and get user
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Verify the address belongs to the current user
    const { data: existingAddress, error: fetchError } = await supabaseAdmin
      .from('shipping_addresses')
      .select('user_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingAddress) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    if (existingAddress.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // If this address is being set as default, unset all other defaults for this user
    if (is_default) {
      await supabaseAdmin
        .from('shipping_addresses')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .neq('id', id);
    }

    // Update the address
    const { data: updatedAddress, error } = await supabaseAdmin
      .from('shipping_addresses')
      .update({
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
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating shipping address:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(updatedAddress);
  } catch (error) {
    console.error('Unexpected error updating shipping address:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/shipping-addresses/[id] - Delete a shipping address
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Get token from HTTP-only cookie
    const token = request.cookies.get('sb-access-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify token and get user
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the address belongs to the current user
    const { data: existingAddress, error: fetchError } = await supabaseAdmin
      .from('shipping_addresses')
      .select('user_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingAddress) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    if (existingAddress.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the address
    const { error } = await supabaseAdmin
      .from('shipping_addresses')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting shipping address:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error deleting shipping address:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
