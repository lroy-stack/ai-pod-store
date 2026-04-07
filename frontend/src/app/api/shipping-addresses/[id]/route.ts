import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireAuth, authErrorResponse } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

// PUT /api/shipping-addresses/[id] - Update a shipping address
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
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

    // Verify ownership (IDOR protection)
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

    // If setting as default, unset all other defaults
    if (is_default) {
      await supabaseAdmin
        .from('shipping_addresses')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .neq('id', id);
    }

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
      return NextResponse.json({ error: 'Failed to update address' }, { status: 500 });
    }

    return NextResponse.json(updatedAddress);
  } catch (error) {
    if (error instanceof Error && 'status' in error) return authErrorResponse(error);
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
    const user = await requireAuth(request);

    // Verify ownership (IDOR protection)
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

    const { error } = await supabaseAdmin
      .from('shipping_addresses')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting shipping address:', error);
      return NextResponse.json({ error: 'Failed to delete address' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return authErrorResponse(error);
    console.error('Unexpected error deleting shipping address:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
