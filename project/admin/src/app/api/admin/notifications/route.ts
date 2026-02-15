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

export async function GET(req: NextRequest) {
  // Check authentication
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch recent notifications from database
    // In production, this would query a notifications table
    // For now, return sample data
    const { data: notifications, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('recipient_type', 'admin')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      // If notifications table doesn't exist yet, return empty array
      return NextResponse.json({
        notifications: [],
        unread_count: 0,
      });
    }

    const unreadCount = notifications?.filter((n) => !n.read).length || 0;

    return NextResponse.json({
      notifications: notifications || [],
      unread_count: unreadCount,
    });
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    return NextResponse.json({
      notifications: [],
      unread_count: 0,
    });
  }
}
