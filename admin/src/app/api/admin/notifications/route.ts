import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/auth-middleware';
import { ADMIN_EMAIL } from '@/lib/store-defaults';

async function handler(req: NextRequest) {
  try {
    // Fetch admin user to get notifications for admin user_id
    const { data: adminUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', ADMIN_EMAIL)
      .single();

    if (!adminUser) {
      return NextResponse.json({
        notifications: [],
        unread_count: 0,
      });
    }

    // Fetch recent notifications for admin user
    const { data: rawNotifications, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', adminUser.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Failed to fetch notifications:', error);
      return NextResponse.json({
        notifications: [],
        unread_count: 0,
      });
    }

    // Transform to match TopBar expected format
    const notifications = (rawNotifications || []).map((n: any) => ({
      id: n.id,
      title: n.title,
      message: n.body || '',
      timestamp: n.created_at,
      read: n.is_read,
      type: n.type || 'info',
    }));

    const unreadCount = notifications.filter((n) => !n.read).length;

    return NextResponse.json({
      notifications,
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

export const GET = withAuth(handler);
