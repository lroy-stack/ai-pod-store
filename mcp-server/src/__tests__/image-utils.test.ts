import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchThumbnail,
  extractImageItems,
  replaceImageUrls,
  buildImageBlocks,
  fetchResultThumbnails,
  buildThumbnailUrl,
  imageConfig,
  type ThumbnailResult,
} from '../lib/image-utils.js';

// ─── Mock Redis ─────────────────────────────────────────────────────────────

const redisStore = new Map<string, string>();

vi.mock('../lib/redis.js', () => ({
  getRedisClient: () => ({
    status: 'ready',
    get: vi.fn(async (key: string) => redisStore.get(key) ?? null),
    setex: vi.fn(async (key: string, _ttl: number, value: string) => {
      redisStore.set(key, value);
      return 'OK';
    }),
  }),
}));

// ─── Mock Logger ────────────────────────────────────────────────────────────

vi.mock('../lib/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

// ─── Mock fetch ─────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Helper to create a mock Response with image data
function createImageResponse(
  data: Buffer,
  mimeType = 'image/webp',
  status = 200,
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': mimeType }),
    arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
  } as unknown as Response;
}

// ─── Setup / Teardown ───────────────────────────────────────────────────────

beforeEach(() => {
  redisStore.clear();
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── buildThumbnailUrl ──────────────────────────────────────────────────────

describe('buildThumbnailUrl', () => {
  it('transforms Supabase storage URLs to imgproxy URLs', () => {
    const url = 'https://api.yourdomain.com/storage/v1/object/public/designs/mockups/test.png';
    const result = buildThumbnailUrl(url);

    expect(result).toContain('/render/image/public/');
    expect(result).toContain('width=');
    expect(result).toContain('height=');
    expect(result).toContain('resize=contain');
    expect(result).toContain('quality=');
    expect(result).not.toContain('/object/public/');
  });

  it('passes non-Supabase URLs through unchanged', () => {
    const url = 'https://external.com/image.png';
    expect(buildThumbnailUrl(url)).toBe(url);
  });

  it('uses & separator when URL already has query params', () => {
    const url = 'https://api.yourdomain.com/storage/v1/object/public/designs/test.png?v=1';
    const result = buildThumbnailUrl(url);
    expect(result).toContain('?v=1&width=');
  });
});

// ─── fetchThumbnail ─────────────────────────────────────────────────────────

describe('fetchThumbnail', () => {
  const testUrl = 'https://api.yourdomain.com/storage/v1/object/public/designs/test.png';
  const smallImage = Buffer.alloc(1024, 0xff); // 1KB fake image

  it('returns null for empty URL', async () => {
    expect(await fetchThumbnail('')).toBeNull();
  });

  it('fetches and returns base64 thumbnail', async () => {
    mockFetch.mockResolvedValueOnce(createImageResponse(smallImage, 'image/webp'));

    const result = await fetchThumbnail(testUrl);

    expect(result).not.toBeNull();
    expect(result!.base64).toBe(smallImage.toString('base64'));
    expect(result!.mimeType).toBe('image/webp');
    expect(result!.sizeBytes).toBe(1024);
  });

  it('returns null when fetch fails (non-200)', async () => {
    mockFetch.mockResolvedValueOnce(createImageResponse(Buffer.alloc(0), 'image/png', 404));
    expect(await fetchThumbnail(testUrl)).toBeNull();
  });

  it('returns null when image exceeds max bytes', async () => {
    const oversized = Buffer.alloc(imageConfig.maxImageBytes + 1, 0xff);
    mockFetch.mockResolvedValueOnce(createImageResponse(oversized));
    expect(await fetchThumbnail(testUrl)).toBeNull();
  });

  it('returns null for invalid MIME type', async () => {
    mockFetch.mockResolvedValueOnce(createImageResponse(smallImage, 'text/html'));
    expect(await fetchThumbnail(testUrl)).toBeNull();
  });

  it('returns null on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    expect(await fetchThumbnail(testUrl)).toBeNull();
  });

  it('uses Redis cache on second call', async () => {
    mockFetch.mockResolvedValueOnce(createImageResponse(smallImage, 'image/png'));

    // First call — cache miss, fetches from network
    const result1 = await fetchThumbnail(testUrl);
    expect(result1).not.toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second call — should use cache (no new fetch)
    const result2 = await fetchThumbnail(testUrl);
    expect(result2).not.toBeNull();
    expect(result2!.base64).toBe(result1!.base64);
    expect(mockFetch).toHaveBeenCalledTimes(1); // Still 1 — cache hit
  });

  it('accepts valid MIME types: png, jpeg, gif, webp', async () => {
    for (const mime of ['image/png', 'image/jpeg', 'image/gif', 'image/webp']) {
      mockFetch.mockResolvedValueOnce(createImageResponse(smallImage, mime));
      redisStore.clear(); // Reset cache between iterations
      const result = await fetchThumbnail(`${testUrl}?mime=${mime}`);
      expect(result).not.toBeNull();
      expect(result!.mimeType).toBe(mime);
    }
  });
});

// ─── extractImageItems ──────────────────────────────────────────────────────

describe('extractImageItems', () => {
  it('returns empty array for null/undefined', () => {
    expect(extractImageItems(null)).toEqual([]);
    expect(extractImageItems(undefined)).toEqual([]);
  });

  it('returns empty array for unsuccessful result', () => {
    expect(extractImageItems({ success: false, products: [{ id: '1', image: 'url' }] })).toEqual([]);
  });

  it('extracts from search_products shape (products[])', () => {
    const result = {
      success: true,
      products: [
        { id: 'p1', image: 'https://img1.png', title: 'Shirt' },
        { id: 'p2', image: 'https://img2.png', title: 'Hoodie' },
        { id: 'p3', image: '', title: 'No Image' }, // empty image — filtered
      ],
    };

    const items = extractImageItems(result);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ id: 'p1', imageUrl: 'https://img1.png' });
    expect(items[1]).toEqual({ id: 'p2', imageUrl: 'https://img2.png' });
  });

  it('extracts from get_product_details shape (product.images[])', () => {
    const result = {
      success: true,
      product: {
        id: 'p1',
        images: [{ src: 'https://img1.png', alt: 'Shirt' }],
      },
    };

    const items = extractImageItems(result);
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ id: 'p1', imageUrl: 'https://img1.png' });
  });

  it('extracts from get_cross_sell shape (recommendations[])', () => {
    const result = {
      success: true,
      recommendations: [
        { id: 'r1', image: 'https://rec1.png' },
        { id: 'r2', image: 'https://rec2.png' },
      ],
    };

    const items = extractImageItems(result);
    expect(items).toHaveLength(2);
  });

  it('extracts from get_cart shape (items[].image_url)', () => {
    const result = {
      success: true,
      items: [
        { product_id: 'p1', image_url: 'https://cart1.png', quantity: 2 },
        { product_id: 'p2', product_image: 'https://cart2.png', quantity: 1 },
      ],
    };

    const items = extractImageItems(result);
    expect(items).toHaveLength(2);
    expect(items[0].imageUrl).toBe('https://cart1.png');
    expect(items[1].imageUrl).toBe('https://cart2.png');
  });

  it('extracts from get_my_designs shape (designs[].image_url)', () => {
    const result = {
      success: true,
      designs: [
        { id: 'd1', image_url: 'https://design1.png', prompt: 'test' },
      ],
    };

    const items = extractImageItems(result);
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ id: 'd1', imageUrl: 'https://design1.png' });
  });

  it('extracts from wishlist shape (wishlist.items[])', () => {
    const result = {
      success: true,
      wishlist: {
        items: [
          { product_id: 'p1', image: 'https://wish1.png' },
        ],
      },
    };

    const items = extractImageItems(result);
    expect(items).toHaveLength(1);
  });
});

// ─── replaceImageUrls ───────────────────────────────────────────────────────

describe('replaceImageUrls', () => {
  const thumbMap = new Map<string, ThumbnailResult>([
    ['p1', { base64: 'AAAA', mimeType: 'image/png', sizeBytes: 100 }],
    ['p2', { base64: 'BBBB', mimeType: 'image/webp', sizeBytes: 200 }],
  ]);

  it('does nothing when thumbnails map is empty', () => {
    const result = { success: true, products: [{ id: 'p1', image: 'https://original.png' }] };
    replaceImageUrls(result, new Map());
    expect(result.products[0].image).toBe('https://original.png');
  });

  it('replaces products[].image with data URIs', () => {
    const result = {
      success: true,
      products: [
        { id: 'p1', image: 'https://old1.png', title: 'A' },
        { id: 'p2', image: 'https://old2.png', title: 'B' },
        { id: 'p3', image: 'https://old3.png', title: 'C' }, // no match — unchanged
      ],
    };

    replaceImageUrls(result, thumbMap);

    expect(result.products[0].image).toBe('data:image/png;base64,AAAA');
    expect(result.products[1].image).toBe('data:image/webp;base64,BBBB');
    expect(result.products[2].image).toBe('https://old3.png'); // unchanged
  });

  it('replaces product.images[0].src with data URI', () => {
    const result = {
      success: true,
      product: {
        id: 'p1',
        images: [{ src: 'https://old.png', alt: 'Test' }],
      },
    };

    replaceImageUrls(result, thumbMap);
    expect(result.product.images[0].src).toBe('data:image/png;base64,AAAA');
  });

  it('replaces recommendations[].image', () => {
    const result = {
      success: true,
      recommendations: [
        { id: 'p1', image: 'https://old.png' },
      ],
    };

    replaceImageUrls(result, thumbMap);
    expect(result.recommendations[0].image).toBe('data:image/png;base64,AAAA');
  });

  it('replaces items[].image_url (cart)', () => {
    const result = {
      success: true,
      items: [
        { product_id: 'p1', image_url: 'https://old.png' },
      ],
    };

    replaceImageUrls(result, thumbMap);
    expect(result.items[0].image_url).toBe('data:image/png;base64,AAAA');
  });

  it('replaces designs[].image_url', () => {
    const dMap = new Map<string, ThumbnailResult>([
      ['d1', { base64: 'DDDD', mimeType: 'image/jpeg', sizeBytes: 50 }],
    ]);

    const result = {
      success: true,
      designs: [
        { id: 'd1', image_url: 'https://old.png', prompt: 'test' },
      ],
    };

    replaceImageUrls(result, dMap);
    expect(result.designs[0].image_url).toBe('data:image/jpeg;base64,DDDD');
  });

  it('handles null/non-object result gracefully', () => {
    expect(() => replaceImageUrls(null, thumbMap)).not.toThrow();
    expect(() => replaceImageUrls('string', thumbMap)).not.toThrow();
    expect(() => replaceImageUrls(42, thumbMap)).not.toThrow();
  });
});

// ─── buildImageBlocks ───────────────────────────────────────────────────────

describe('buildImageBlocks', () => {
  it('returns empty array for empty thumbnails', () => {
    expect(buildImageBlocks(new Map())).toEqual([]);
  });

  it('builds MCP ImageContent blocks from thumbnails', () => {
    const thumbMap = new Map<string, ThumbnailResult>([
      ['p1', { base64: 'AAAA', mimeType: 'image/png', sizeBytes: 100 }],
      ['p2', { base64: 'BBBB', mimeType: 'image/webp', sizeBytes: 200 }],
    ]);

    const blocks = buildImageBlocks(thumbMap);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ type: 'image', data: 'AAAA', mimeType: 'image/png' });
    expect(blocks[1]).toEqual({ type: 'image', data: 'BBBB', mimeType: 'image/webp' });
  });
});

// ─── fetchResultThumbnails (integration) ────────────────────────────────────

describe('fetchResultThumbnails', () => {
  const smallImage = Buffer.alloc(512, 0xab);

  it('returns empty map for result without images', async () => {
    const result = { success: true, products: [] };
    const thumbnails = await fetchResultThumbnails(result);
    expect(thumbnails.size).toBe(0);
  });

  it('fetches thumbnails for products in result', async () => {
    mockFetch.mockResolvedValue(createImageResponse(smallImage, 'image/webp'));

    const result = {
      success: true,
      products: [
        { id: 'p1', image: 'https://api.yourdomain.com/storage/v1/object/public/designs/img1.png' },
        { id: 'p2', image: 'https://api.yourdomain.com/storage/v1/object/public/designs/img2.png' },
      ],
    };

    const thumbnails = await fetchResultThumbnails(result);

    expect(thumbnails.size).toBe(2);
    expect(thumbnails.has('p1')).toBe(true);
    expect(thumbnails.has('p2')).toBe(true);
    expect(thumbnails.get('p1')!.mimeType).toBe('image/webp');
  });

  it('respects maxImagesPerResponse limit', async () => {
    mockFetch.mockResolvedValue(createImageResponse(smallImage, 'image/png'));

    const products = Array.from({ length: 20 }, (_, i) => ({
      id: `p${i}`,
      image: `https://img${i}.png`,
    }));

    const result = { success: true, products };
    const thumbnails = await fetchResultThumbnails(result);

    expect(thumbnails.size).toBeLessThanOrEqual(imageConfig.maxImagesPerResponse);
  });

  it('respects total byte budget', async () => {
    // Each image ~90KB, budget 600KB → max ~6 images
    const largeImage = Buffer.alloc(90_000, 0xcd);
    mockFetch.mockResolvedValue(createImageResponse(largeImage, 'image/png'));

    const products = Array.from({ length: 10 }, (_, i) => ({
      id: `p${i}`,
      image: `https://img${i}.png`,
    }));

    const result = { success: true, products };
    const thumbnails = await fetchResultThumbnails(result);

    const totalBytes = [...thumbnails.values()].reduce((sum, t) => sum + t.sizeBytes, 0);
    expect(totalBytes).toBeLessThanOrEqual(imageConfig.maxTotalImageBytes);
  });

  it('handles mixed success/failure fetches gracefully', async () => {
    mockFetch
      .mockResolvedValueOnce(createImageResponse(smallImage, 'image/png')) // p1 success
      .mockRejectedValueOnce(new Error('timeout'))                         // p2 fail
      .mockResolvedValueOnce(createImageResponse(smallImage, 'image/webp')); // p3 success

    const result = {
      success: true,
      products: [
        { id: 'p1', image: 'https://img1.png' },
        { id: 'p2', image: 'https://img2.png' },
        { id: 'p3', image: 'https://img3.png' },
      ],
    };

    const thumbnails = await fetchResultThumbnails(result);

    expect(thumbnails.has('p1')).toBe(true);
    expect(thumbnails.has('p2')).toBe(false); // failed
    expect(thumbnails.has('p3')).toBe(true);
  });
});
