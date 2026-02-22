import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withPermission } from '@/lib/rbac';

// PUT requires 'moderate' permission on 'designs' resource
export const PUT = withPermission('designs', 'moderate', async (
  request: NextRequest,
  session,
  context?: { params: Promise<{ id: string }> }
) => {
  try {
    if (!context) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { status, notes } = body;

    // Validate status
    if (!status || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "approved" or "rejected"' },
        { status: 400 }
      );
    }

    // Update the design moderation status
    const updateData: any = {
      moderation_status: status,
    };

    if (notes) {
      updateData.moderation_notes = notes;
    }

    const { data, error } = await supabaseAdmin
      .from('designs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to update design', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ design: data });
  } catch (error) {
    console.error('Error moderating design:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
