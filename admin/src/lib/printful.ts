/**
 * Printful API client for admin panel.
 * Lightweight fetch wrapper — no caching, no retry (admin is interactive).
 */

import { requiredEnv, optionalEnv } from '@/lib/env';

const PRINTFUL_API_TOKEN = requiredEnv('PRINTFUL_API_TOKEN');
const PRINTFUL_STORE_ID = requiredEnv('PRINTFUL_STORE_ID');

interface PrintfulEnvelope<T = unknown> {
  code: number;
  result: T;
  paging?: { total: number; offset: number; limit: number };
  error?: { reason: string; message: string };
}

export async function printfulFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T; paging?: { total: number; offset: number; limit: number } }> {
  const url = `https://api.printful.com${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${PRINTFUL_API_TOKEN}`,
      'X-PF-Store-Id': PRINTFUL_STORE_ID,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const envelope: PrintfulEnvelope<T> = await res.json();

  if (envelope.code !== 200) {
    throw new Error(envelope.error?.message || `Printful API error: ${envelope.code}`);
  }

  return { data: envelope.result, paging: envelope.paging };
}

export interface PrintfulSyncProduct {
  id: number;
  external_id: string;
  name: string;
  variants: number;
  synced: number;
  thumbnail_url: string;
  is_ignored: boolean;
}

export interface PrintfulSyncVariant {
  id: number;
  external_id: string;
  sync_product_id: number;
  name: string;
  synced: boolean;
  variant_id: number;
  retail_price: string;
  currency: string;
  product: {
    variant_id: number;
    product_id: number;
    image: string;
    name: string;
  };
  files: Array<{
    id: number;
    type: string;
    preview_url: string;
    thumbnail_url: string;
    filename: string;
    status: string;
  }>;
  options: Array<{ id: string; value: unknown }>;
  is_ignored: boolean;
}

export interface PrintfulProductDetail {
  sync_product: PrintfulSyncProduct;
  sync_variants: PrintfulSyncVariant[];
}
