import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { supabaseAdmin } from '@/lib/supabase';

interface AdminNote {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

/**
 * POST /api/orders/[id]/notes
 * Adds an admin note to an order
 */
export const POST = withAuth(async (req: NextRequest, session, context) => {
  try {
    const params = await context?.params;
    const orderId = params?.id as string;
    if (!orderId) {
      return NextResponse.json({ error: 'Missing order ID' }, { status: 400 });
    }

    const body = await req.json();
    const { text } = body;
    if (!text?.trim()) {
      return NextResponse.json({ error: 'Note text is required' }, { status: 400 });
    }

    // Fetch current notes
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('admin_notes')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const existingNotes: AdminNote[] = Array.isArray(order.admin_notes) ? order.admin_notes : [];
    const newNote: AdminNote = {
      id: crypto.randomUUID(),
      text: text.trim(),
      author: session.email || 'Admin',
      createdAt: new Date().toISOString(),
    };

    const updatedNotes = [...existingNotes, newNote];

    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ admin_notes: updatedNotes })
      .eq('id', orderId);

    if (updateError) {
      console.error('[POST /api/orders/[id]/notes] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to save note' }, { status: 500 });
    }

    return NextResponse.json({ note: newNote, notes: updatedNotes });
  } catch (err) {
    console.error('[POST /api/orders/[id]/notes] Unexpected error:', err);
    return NextResponse.json({ error: 'Failed to save note' }, { status: 500 });
  }
});
