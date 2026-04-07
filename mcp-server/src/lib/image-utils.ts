/**
 * Image utilities for MCP tool responses.
 *
 * Fetches product thumbnails via Supabase imgproxy, converts to base64,
 * and caches in Redis. Used for two purposes:
 *
 * 1. Data URI injection into TextContent JSON (CSP bypass for Claude widgets)
 * 2. MCP ImageContent blocks (native SDK image rendering)
 *
 * Single fetch per image — result reused for both purposes.
 *
 * MCP SDK ImageContent spec (v1.27.1):
 *   { type: "image", data: "<raw-base64>", mimeType: "image/webp" }
 */

import { createHash } from 'node:crypto';
import { getRedisClient } from './redis.js';
import { logger } from './logger.js';

// ─── Configuration (env-configurable with sensible defaults) ────────────────

export const imageConfig = {
  /** Thumbnail resize dimension (px) — keep small to minimize context usage */
  thumbnailSize: parseInt(process.env.MCP_IMAGE_THUMBNAIL_SIZE || '80', 10),
  /** Max images per tool response — aggressive limit to protect context window */
  maxImagesPerResponse: parseInt(process.env.MCP_IMAGE_MAX_PER_RESPONSE || '3', 10),
  /** Max bytes per single thumbnail */
  maxImageBytes: parseInt(process.env.MCP_IMAGE_MAX_BYTES || '20000', 10),
  /** Total byte budget for all images in one response */
  maxTotalImageBytes: parseInt(process.env.MCP_IMAGE_MAX_TOTAL_BYTES || '50000', 10),
  /** Fetch timeout per image (ms) */
  fetchTimeoutMs: parseInt(process.env.MCP_IMAGE_FETCH_TIMEOUT_MS || '5000', 10),
  /** Redis cache TTL (seconds). 0 = disabled */
  cacheTtlSeconds: parseInt(process.env.MCP_IMAGE_CACHE_TTL || '86400', 10),
  /** imgproxy quality parameter (1-100) — low to minimize size */
  quality: parseInt(process.env.MCP_IMAGE_QUALITY || '25', 10),
} as const;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ThumbnailResult {
  base64: string;
  mimeType: string;
  sizeBytes: number;
}

interface ImageItem {
  id: string;
  imageUrl: string;
}

interface ImageContentBlock {
  type: 'image';
  data: string;
  mimeType: string;
}

// ─── Cache ──────────────────────────────────────────────────────────────────

function cacheKey(imageUrl: string): string {
  const hash = createHash('sha256').update(imageUrl).digest('hex').slice(0, 16);
  return `img:thumb:${hash}`;
}

async function getCached(imageUrl: string): Promise<ThumbnailResult | null> {
  if (imageConfig.cacheTtlSeconds === 0) return null;

  try {
    const redis = getRedisClient();
    if (!redis || redis.status !== 'ready') return null;

    const cached = await redis.get(cacheKey(imageUrl));
    if (!cached) return null;

    const parsed = JSON.parse(cached) as ThumbnailResult;
    logger.debug('Image cache hit', { url: imageUrl.slice(0, 80) });
    return parsed;
  } catch {
    return null;
  }
}

async function setCache(imageUrl: string, result: ThumbnailResult): Promise<void> {
  if (imageConfig.cacheTtlSeconds === 0) return;

  try {
    const redis = getRedisClient();
    if (!redis || redis.status !== 'ready') return;

    const key = cacheKey(imageUrl);
    const value = JSON.stringify(result);
    await redis.setex(key, imageConfig.cacheTtlSeconds, value);
    logger.debug('Image cached', { url: imageUrl.slice(0, 80), sizeBytes: result.sizeBytes });
  } catch {
    // Cache write failure is non-fatal
  }
}

// ─── Core: Fetch Single Thumbnail ──────────────────────────────────────────

const VALID_MIME_RE = /^image\/(png|jpeg|gif|webp)/;

/**
 * Build the imgproxy URL for Supabase storage images.
 * Non-Supabase URLs are passed through unchanged.
 */
export function buildThumbnailUrl(imageUrl: string): string {
  if (!imageUrl.includes('/object/public/')) return imageUrl;

  const separator = imageUrl.includes('?') ? '&' : '?';
  return imageUrl.replace('/object/public/', '/render/image/public/')
    + separator
    + `width=${imageConfig.thumbnailSize}&height=${imageConfig.thumbnailSize}&resize=contain&quality=${imageConfig.quality}`;
}

/**
 * Fetch a single image thumbnail as base64.
 * Checks Redis cache first, falls back to HTTP fetch via imgproxy.
 * Returns null on any failure (graceful degradation — never throws).
 */
export async function fetchThumbnail(imageUrl: string): Promise<ThumbnailResult | null> {
  if (!imageUrl) return null;

  // 1. Check cache
  const cached = await getCached(imageUrl);
  if (cached) return cached;

  // 2. Fetch via imgproxy
  try {
    const thumbnailUrl = buildThumbnailUrl(imageUrl);

    const response = await fetch(thumbnailUrl, {
      signal: AbortSignal.timeout(imageConfig.fetchTimeoutMs),
      headers: { 'Accept': 'image/webp,image/*' },
    });

    if (!response.ok) {
      logger.debug('Image fetch failed', { url: imageUrl.slice(0, 80), status: response.status });
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > imageConfig.maxImageBytes) {
      logger.debug('Image too large', { url: imageUrl.slice(0, 80), sizeBytes: buffer.length, max: imageConfig.maxImageBytes });
      return null;
    }

    const mimeType = response.headers.get('content-type') || 'image/png';
    if (!VALID_MIME_RE.test(mimeType)) {
      logger.debug('Invalid image MIME', { url: imageUrl.slice(0, 80), mimeType });
      return null;
    }

    const result: ThumbnailResult = {
      base64: buffer.toString('base64'),
      mimeType,
      sizeBytes: buffer.length,
    };

    // 3. Cache for next time
    await setCache(imageUrl, result);

    return result;
  } catch (err) {
    logger.debug('Image fetch error', {
      url: imageUrl.slice(0, 80),
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ─── Extract Image Items from Tool Results ──────────────────────────────────

/**
 * Extract items with image URLs from any tool result.
 * Detects common response shapes across all tools.
 */
export function extractImageItems(result: unknown): ImageItem[] {
  if (!result || typeof result !== 'object') return [];
  const r = result as Record<string, unknown>;
  if (!r.success) return [];

  // search_products, get_trending_products: { products: [{id, image}] }
  if (Array.isArray(r.products)) {
    return (r.products as Array<Record<string, unknown>>)
      .filter(p => p.id && p.image)
      .map(p => ({ id: String(p.id), imageUrl: String(p.image) }));
  }

  // get_product_details: { product: { id, images: [{src}] } }
  if (r.product && typeof r.product === 'object') {
    const product = r.product as Record<string, unknown>;
    if (product.id && Array.isArray(product.images) && product.images.length > 0) {
      const firstImg = product.images[0] as Record<string, unknown>;
      const src = firstImg?.src || firstImg?.url;
      if (src) return [{ id: String(product.id), imageUrl: String(src) }];
    }
  }

  // get_cross_sell: { recommendations: [{id, image}] }
  if (Array.isArray(r.recommendations)) {
    return (r.recommendations as Array<Record<string, unknown>>)
      .filter(p => p.id && p.image)
      .map(p => ({ id: String(p.id), imageUrl: String(p.image) }));
  }

  // get_cart: { items: [{product_id, image_url}] }
  if (Array.isArray(r.items)) {
    return (r.items as Array<Record<string, unknown>>)
      .filter(i => i.product_id && (i.image_url || i.product_image || i.image))
      .map(i => ({
        id: String(i.product_id),
        imageUrl: String(i.image_url || i.product_image || i.image),
      }));
  }

  // list_wishlist (via wishlist.items): { wishlist: { items: [{product_id, image}] } }
  if (r.wishlist && typeof r.wishlist === 'object') {
    const wishlist = r.wishlist as Record<string, unknown>;
    if (Array.isArray(wishlist.items)) {
      return (wishlist.items as Array<Record<string, unknown>>)
        .filter(i => i.product_id && i.image)
        .map(i => ({ id: String(i.product_id), imageUrl: String(i.image) }));
    }
  }

  // get_my_designs: { designs: [{id, image_url}] }
  if (Array.isArray(r.designs)) {
    return (r.designs as Array<Record<string, unknown>>)
      .filter(d => d.id && d.image_url)
      .map(d => ({ id: String(d.id), imageUrl: String(d.image_url) }));
  }

  return [];
}

// ─── Batch Fetch All Thumbnails for a Result ────────────────────────────────

/**
 * Fetch thumbnails for all image items in a tool result.
 * Returns Map<itemId, ThumbnailResult>.
 * Respects maxImagesPerResponse limit.
 */
export async function fetchResultThumbnails(
  result: unknown,
): Promise<Map<string, ThumbnailResult>> {
  const items = extractImageItems(result);
  if (items.length === 0) return new Map();

  const toFetch = items.slice(0, imageConfig.maxImagesPerResponse);

  const results = await Promise.allSettled(
    toFetch.map(async (item) => {
      const thumb = await fetchThumbnail(item.imageUrl);
      return { id: item.id, thumb };
    }),
  );

  const thumbnails = new Map<string, ThumbnailResult>();
  let totalBytes = 0;

  for (const entry of results) {
    if (entry.status !== 'fulfilled' || !entry.value.thumb) continue;
    if (totalBytes + entry.value.thumb.sizeBytes > imageConfig.maxTotalImageBytes) break;

    thumbnails.set(entry.value.id, entry.value.thumb);
    totalBytes += entry.value.thumb.sizeBytes;
  }

  return thumbnails;
}

// ─── Replace Image URLs in Result with Data URIs ────────────────────────────

/**
 * Replace image URL fields in the result with data URIs (base64).
 * This ensures that when the TextContent JSON is rendered in a CSP-restricted
 * widget (e.g. Claude.ai HTML artifacts), images display without external fetches.
 *
 * Mutates the result object in place (called before JSON.stringify).
 */
export function replaceImageUrls(
  result: unknown,
  thumbnails: Map<string, ThumbnailResult>,
): void {
  if (thumbnails.size === 0) return;
  if (!result || typeof result !== 'object') return;
  const r = result as Record<string, unknown>;

  const toDataUri = (id: string): string | null => {
    const thumb = thumbnails.get(id);
    if (!thumb) return null;
    return `data:${thumb.mimeType};base64,${thumb.base64}`;
  };

  // search_products, get_trending_products: products[].image
  if (Array.isArray(r.products)) {
    for (const p of r.products as Array<Record<string, unknown>>) {
      const uri = toDataUri(String(p.id));
      if (uri) p.image = uri;
    }
  }

  // get_product_details: product.images[0].src
  if (r.product && typeof r.product === 'object') {
    const product = r.product as Record<string, unknown>;
    const uri = toDataUri(String(product.id));
    if (uri && Array.isArray(product.images) && product.images.length > 0) {
      (product.images[0] as Record<string, unknown>).src = uri;
    }
  }

  // get_cross_sell: recommendations[].image
  if (Array.isArray(r.recommendations)) {
    for (const rec of r.recommendations as Array<Record<string, unknown>>) {
      const uri = toDataUri(String(rec.id));
      if (uri) rec.image = uri;
    }
  }

  // get_cart: items[].image_url
  if (Array.isArray(r.items)) {
    for (const item of r.items as Array<Record<string, unknown>>) {
      const uri = toDataUri(String(item.product_id));
      if (uri) {
        if (item.image_url) item.image_url = uri;
        if (item.product_image) item.product_image = uri;
        if (item.image) item.image = uri;
      }
    }
  }

  // wishlist.items[].image / product_image
  if (r.wishlist && typeof r.wishlist === 'object') {
    const wishlist = r.wishlist as Record<string, unknown>;
    if (Array.isArray(wishlist.items)) {
      for (const item of wishlist.items as Array<Record<string, unknown>>) {
        const uri = toDataUri(String(item.product_id));
        if (uri) {
          if (item.image) item.image = uri;
          if (item.product_image) item.product_image = uri;
        }
      }
    }
  }

  // get_my_designs: designs[].image_url
  if (Array.isArray(r.designs)) {
    for (const d of r.designs as Array<Record<string, unknown>>) {
      const uri = toDataUri(String(d.id));
      if (uri) d.image_url = uri;
    }
  }
}

// ─── Build MCP ImageContent Blocks ──────────────────────────────────────────

/**
 * Build MCP ImageContent blocks from pre-fetched thumbnails.
 * Per MCP SDK spec: { type: 'image', data: '<raw-base64>', mimeType }
 */
export function buildImageBlocks(
  thumbnails: Map<string, ThumbnailResult>,
): ImageContentBlock[] {
  const blocks: ImageContentBlock[] = [];

  for (const [, thumb] of thumbnails) {
    blocks.push({
      type: 'image',
      data: thumb.base64,
      mimeType: thumb.mimeType,
    });
  }

  return blocks;
}
