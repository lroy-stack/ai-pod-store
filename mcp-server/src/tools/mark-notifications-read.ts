import { z } from 'zod';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { getSupabaseClient } from '../lib/supabase.js';

export const markNotificationsReadSchema = z.object({
  notification_id: z.string().uuid().optional().describe('Specific notification UUID to mark as read. If omitted, marks ALL unread notifications as read.'),
});

export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;

export interface MarkNotificationsReadResult {
  success: boolean;
  error?: string;
  message?: string;
  marked_count: number;
}

export async function markNotificationsRead(
  input: MarkNotificationsReadInput,
  authInfo?: AuthInfo
): Promise<MarkNotificationsReadResult> {
  if (!authInfo || !authInfo.extra?.userId) {
    return { success: false, error: 'Authentication required', marked_count: 0 };
  }

  const userId = authInfo.extra.userId as string;

  try {
    const supabase = getSupabaseClient();
    const { notification_id } = input;

    if (notification_id) {
      // Mark single notification as read
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('id', notification_id)
        .eq('user_id', userId)
        .eq('is_read', false)
        .select('id');

      if (error) {
        console.error('[mark_notifications_read] Database error:', error);
        return { success: false, error: 'Failed to mark notification as read', marked_count: 0 };
      }

      const count = data?.length || 0;
      return {
        success: true,
        message: count > 0 ? 'Notification marked as read' : 'Notification already read or not found',
        marked_count: count,
      };
    }

    // Mark all unread notifications as read
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false)
      .select('id');

    if (error) {
      console.error('[mark_notifications_read] Database error:', error);
      return { success: false, error: 'Failed to mark notifications as read', marked_count: 0 };
    }

    const count = data?.length || 0;
    return {
      success: true,
      message: count > 0 ? `Marked ${count} notification(s) as read` : 'No unread notifications',
      marked_count: count,
    };
  } catch (err) {
    console.error('[mark_notifications_read] Unexpected error:', err);
    return { success: false, error: 'An unexpected error occurred', marked_count: 0 };
  }
}
