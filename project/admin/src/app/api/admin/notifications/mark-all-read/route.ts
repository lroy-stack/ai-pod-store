import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/auth-middleware';

async function handler(req: NextRequest) {
  try {
    // Mark all admin notifications as read
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ read: true })
      .eq('recipient_type', 'admin')
      .eq('read', false);

    if (error) {
      console.error('Failed to mark notifications as read:', error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to mark notifications as read:', error);
    return NextResponse.json({ success: true }); // Return success anyway
  }
}

export const POST = withAuth(handler);
