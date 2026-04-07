import { z } from 'zod';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { getSupabaseClient } from '../lib/supabase.js';

/**
 * MCP Tool: update_my_profile
 *
 * Update the authenticated user's profile information.
 * Uses context injection — userId is extracted from authInfo, NOT from parameters.
 *
 * This is a PROTECTED tool — authentication required.
 * This is a DESTRUCTIVE tool — modifies user data.
 */

export const updateMyProfileSchema = z.object({
  name: z.string().optional().describe('User display name'),
  locale: z.enum(['en', 'es', 'de']).optional().describe('User preferred locale'),
  // NOTE: userId is NOT a parameter — it comes from authInfo (context injection)
});

export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;

export interface UpdateMyProfileResult {
  success: boolean;
  error?: string;
  profile?: {
    id: string;
    email: string;
    name: string;
    locale: string;
    currency: string;
  };
}

export async function updateMyProfile(
  input: UpdateMyProfileInput,
  authInfo?: AuthInfo
): Promise<UpdateMyProfileResult> {
  // Check authentication
  if (!authInfo || !authInfo.extra?.userId) {
    return {
      success: false,
      error: 'Authentication required. Please provide a valid Bearer token.',
    };
  }

  const userId = authInfo.extra.userId as string;

  // Validate input
  if (!input.name && !input.locale) {
    return {
      success: false,
      error: 'At least one field (name or locale) must be provided',
    };
  }

  try {
    const supabase = getSupabaseClient();

    // Build update object
    const updates: { name?: string; locale?: string; updated_at?: string } = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) {
      updates.name = input.name;
    }

    if (input.locale !== undefined) {
      updates.locale = input.locale;
    }

    // Update user profile
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('id, email, name, locale, currency')
      .single();

    if (error) {
      console.error('[update_my_profile] Database error:', error);
      return {
        success: false,
        error: 'Failed to update user profile',
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
      },
    };
  } catch (err) {
    console.error('[update_my_profile] Unexpected error:', err);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}
