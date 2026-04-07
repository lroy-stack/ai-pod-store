/**
 * PATCH /api/orders/[id]/tracking — Update tracking information
 * Body: { tracking_number: string, carrier?: string, tracking_url?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/rbac';
import { supabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

const trackingSchema = z.object({
  tracking_number: z.string().min(1),
  carrier: z.string().optional(),
  tracking_url: z.string().url().optional(),
});

export const PATCH = withPermission('orders', 'update', async (
  req: NextRequest,
  session,
  context?: { params: Promise<{ id: string }> }
) => {
  const { id } = await context!.params;

  try {
    const body = await req.json();
    const parsed = trackingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const { error } = await supabaseAdmin
      .from('orders')
      .update({
        tracking_number: parsed.data.tracking_number,
        carrier: parsed.data.carrier || null,
        tracking_url: parsed.data.tracking_url || null,
      })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: 'Failed to update tracking' }, { status: 500 });
    }

    return NextResponse.json({ status: 'updated', tracking: parsed.data });
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
});
