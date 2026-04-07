import { z } from 'zod';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { getSupabaseClient } from '../lib/supabase.js';

export const listNotificationsSchema = z.object({
  page: z.number().int().min(1).optional().default(1).describe('Page number (default 1)'),
  limit: z.number().int().min(1).max(50).optional().default(20).describe('Items per page (1-50, default 20)'),
});

export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>;

export interface ListNotificationsResult {
  success: boolean;
  error?: string;
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    is_read: boolean;
    data?: Record<string, any>;
    created_at: string;
  }>;
  unread_count: number;
  total: number;
  page: number;
  limit: number;
}

export async function listNotifications(
  input: ListNotificationsInput,
  authInfo?: AuthInfo
): Promise<ListNotificationsResult> {
  if (!authInfo || !authInfo.extra?.userId) {
    return { success: false, error: 'Authentication required', notifications: [], unread_count: 0, total: 0, page: 1, limit: 20 };
  }

  const userId = authInfo.extra.userId as string;

  try {
    const supabase = getSupabaseClient();
    const { page, limit } = input;
    const offset = (page - 1) * limit;

    // Fetch notifications with count
    const { data, error, count } = await supabase
      .from('notifications')
      .select('id, type, title, message, is_read, data, created_at', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[list_notifications] Database error:', error);
      return { success: false, error: 'Failed to fetch notifications', notifications: [], unread_count: 0, total: 0, page, limit };
    }

    // Count unread
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    return {
      success: true,
      notifications: (data || []).map((n) => ({
        id: n.id,
        type: n.type || 'general',
        title: n.title || '',
        message: n.message || '',
        is_read: n.is_read || false,
        data: n.data || undefined,
        created_at: n.created_at,
      })),
      unread_count: unreadCount || 0,
      total: count || 0,
      page,
      limit,
    };
  } catch (err) {
    console.error('[list_notifications] Unexpected error:', err);
    return { success: false, error: 'An unexpected error occurred', notifications: [], unread_count: 0, total: 0, page: 1, limit: 20 };
  }
}
