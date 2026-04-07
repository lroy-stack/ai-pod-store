import { z } from 'zod';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { getSupabaseClient } from '../lib/supabase.js';

/**
 * MCP Tool: get_my_profile
 *
 * Get the authenticated user's profile information.
 *
 * This is a PROTECTED tool — authentication required.
 * Returns 401 error if no valid Bearer token provided.
 */

export const getMyProfileSchema = z.object({
  // No parameters needed — uses auth token
});

export type GetMyProfileInput = z.infer<typeof getMyProfileSchema>;

export interface GetMyProfileResult {
  success: boolean;
  error?: string;
  profile?: {
    id: string;
    email: string;
    name: string;
    locale: string;
    currency: string;
    created_at: string;
  };
}

export async function getMyProfile(
  _input: GetMyProfileInput,
  authInfo?: AuthInfo
): Promise<GetMyProfileResult> {
  // Check authentication
  if (!authInfo || !authInfo.extra?.userId) {
    return {
      success: false,
      error: 'Authentication required. Please provide a valid Bearer token.',
    };
  }

  const userId = authInfo.extra.userId as string;

  try {
    const supabase = getSupabaseClient();

    // Fetch user profile from database
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, locale, currency, created_at')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[get_my_profile] Database error:', error);
      return {
        success: false,
        error: 'Failed to fetch user profile',
      };
    }

    if (!data) {
      return {
        success: false,
        error: 'User profile not found',
      };
    }

    return {
      success: true,
      profile: {
        id: data.id,
        email: data.email,
        name: data.name || 'User',
        locale: data.locale || 'en',
        currency: data.currency || 'EUR',
        created_at: data.created_at,
      },
    };
  } catch (err) {
    console.error('[get_my_profile] Unexpected error:', err);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}
