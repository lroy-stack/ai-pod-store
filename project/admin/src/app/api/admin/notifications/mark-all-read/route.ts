import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

function checkAdminAuth(req: NextRequest): boolean {
  const sessionCookie = req.cookies.get('admin-session');
  if (!sessionCookie) return false;

  try {
    const sessionData = JSON.parse(sessionCookie.value);
    return sessionData.role === 'admin';
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  // Check authentication
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
