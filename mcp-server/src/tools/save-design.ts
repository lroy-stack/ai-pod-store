import { z } from 'zod';
import { getSupabaseClient } from '../lib/supabase.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { randomUUID } from 'node:crypto';
import dns from 'node:dns/promises';
import { requiredEnv } from '../lib/env.js';

const STORE_BASE_URL = requiredEnv('NEXT_PUBLIC_BASE_URL');

export const saveDesignSchema = z.object({
  imageUrl: z.string().url().describe('URL of the image to save as a design (can be ephemeral — will be persisted to storage)'),
  prompt: z.string().min(1).max(1000).describe('The prompt or description that generated this image'),
  style: z.string().max(100).optional().describe('Design style (e.g., "minimalist", "vintage", "bold")'),
  width: z.number().int().positive().optional().describe('Image width in pixels'),
  height: z.number().int().positive().optional().describe('Image height in pixels'),
});

type SaveDesignInput = z.infer<typeof saveDesignSchema>;

interface SaveDesignResult {
  success: boolean;
  design_id?: string;
  image_url?: string;
  gallery_url?: string;
  error?: string;
}

export async function saveDesign(input: SaveDesignInput, authInfo?: AuthInfo): Promise<SaveDesignResult> {
  const userId = (authInfo?.extra as Record<string, unknown>)?.userId as string;
  if (!userId) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    const supabase = getSupabaseClient();
    const { imageUrl, prompt, style, width, height } = input;

    // SSRF protection: validate URL before fetching
    const parsedUrl = new URL(imageUrl);
    if (parsedUrl.protocol !== 'https:') {
      return { success: false, error: 'Only HTTPS URLs are allowed' };
    }
    const hostname = parsedUrl.hostname;
    // Block private/internal IP ranges and Docker service hostnames
    const BLOCKED_PATTERNS = [
      /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|169\.254\.)/,
      /^localhost$/i,
      /^(redis|db|rembg|crawl4ai|caddy|frontend|admin|mcp-server|kong|auth|rest|realtime|storage|imgproxy|analytics|vector|podclaw|svg-renderer|supavisor|grafana|loki|promtail)$/i,
    ];
    if (BLOCKED_PATTERNS.some(p => p.test(hostname))) {
      return { success: false, error: 'URL points to a blocked address' };
    }

    // DNS rebinding protection: resolve hostname and validate resolved IP
    try {
      const { address } = await dns.lookup(hostname);
      if (BLOCKED_PATTERNS[0].test(address)) {
        return { success: false, error: 'URL resolves to a blocked address' };
      }
    } catch {
      return { success: false, error: 'Failed to resolve URL hostname' };
    }

    // Download image from ephemeral URL
    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) {
      return { success: false, error: `Failed to download image: HTTP ${response.status}` };
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const extension = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg'
      : contentType.includes('webp') ? 'webp'
      : 'png';

    const buffer = Buffer.from(await response.arrayBuffer());

    // Limit file size (10MB max)
    if (buffer.length > 10 * 1024 * 1024) {
      return { success: false, error: 'Image too large (max 10MB)' };
    }

    // Upload to Supabase Storage
    const fileName = `mcp/${userId}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from('designs')
      .upload(fileName, buffer, {
        contentType,
        cacheControl: '31536000',
        upsert: false,
      });

    if (uploadError) {
      return { success: false, error: 'Failed to upload design' };
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from('designs').getPublicUrl(fileName);
    const persistentUrl = urlData.publicUrl;

    // Create design record
    const { data: design, error: dbError } = await supabase
      .from('designs')
      .insert({
        user_id: userId,
        prompt,
        style: style || null,
        image_url: persistentUrl,
        width: width || null,
        height: height || null,
        source_type: 'mcp',
        moderation_status: 'pending',
        privacy_level: 'private',
      })
      .select('id')
      .single();

    if (dbError) {
      return { success: false, error: 'Failed to save design record' };
    }

    const storeUrl = STORE_BASE_URL;

    return {
      success: true,
      design_id: design.id,
      image_url: persistentUrl,
      gallery_url: `${storeUrl}/en/designs?id=${design.id}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save design',
    };
  }
}
