import { z } from 'zod';
import { getSupabaseClient } from '../lib/supabase.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

export const getMyDesignsSchema = z.object({
  limit: z.number().int().min(1).max(50).default(20).describe('Maximum number of designs to return'),
  offset: z.number().int().min(0).default(0).describe('Number of designs to skip (for pagination)'),
});

type GetMyDesignsInput = z.infer<typeof getMyDesignsSchema>;

interface DesignSummary {
  id: string;
  prompt: string;
  style: string | null;
  image_url: string | null;
  width: number | null;
  height: number | null;
  source_type: string;
  moderation_status: string;
  created_at: string;
}

interface GetMyDesignsResult {
  success: boolean;
  designs?: DesignSummary[];
  total?: number;
  limit?: number;
  offset?: number;
  error?: string;
}

export async function getMyDesigns(input: GetMyDesignsInput, authInfo?: AuthInfo): Promise<GetMyDesignsResult> {
  const userId = (authInfo?.extra as Record<string, unknown>)?.userId as string;
  if (!userId) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    const supabase = getSupabaseClient();
    const { limit, offset } = input;

    const { data, error, count } = await supabase
      .from('designs')
      .select('id, prompt, style, image_url, width, height, source_type, moderation_status, created_at', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return { success: false, error: 'Failed to fetch designs' };
    }

    return {
      success: true,
      designs: data || [],
      total: count || 0,
      limit,
      offset,
    };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to fetch designs',
    };
  }
}
