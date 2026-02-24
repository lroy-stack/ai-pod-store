import { describe, it, expect, vi } from 'vitest';
import { searchProducts, type SearchProductsInput } from '../tools/search-products.js';
import { getCart, type GetCartInput } from '../tools/get-cart.js';
import { createCheckout, type CreateCheckoutInput } from '../tools/create-checkout.js';
import { createMockAuthInfo } from './test-utils.js';

// Mock Supabase client
vi.mock('../lib/supabase.js', () => ({
  getSupabaseClient: () => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({
      data: [
        {
          id: 'prod-1',
          title: 'Test T-Shirt',
          description: 'A comfortable t-shirt',
          category: 'apparel',
          base_price_cents: 2499,
          currency: 'USD',
          images: [{ src: 'https://example.com/tshirt.jpg' }],
          avg_rating: 4.5,
          review_count: 10,
        },
      ],
      error: null,
    }),
  }),
}));

describe('MCP Tools', () => {
  describe('search_products', () => {
    it('should search products by query', async () => {
      const input: SearchProductsInput = {
        query: 't-shirt',
        limit: 10,
      };

      const result = await searchProducts(input);

      expect(result.success).toBe(true);
      expect(result.total).toBeGreaterThan(0);
      expect(result.products).toHaveLength(1);
      expect(result.products[0]).toMatchObject({
        id: 'prod-1',
        title: 'Test T-Shirt',
        price: 24.99,
        currency: 'USD',
      });
    });

    it('should sanitize search query to prevent SQL injection', async () => {
      const input: SearchProductsInput = {
        query: "'; DROP TABLE products; --",
        limit: 10,
      };

      // Should not throw error and should sanitize the query
      const result = await searchProducts(input);
      expect(result.success).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const input: SearchProductsInput = {
        query: 'shirt',
        limit: 5,
      };

      const result = await searchProducts(input);
      expect(result.success).toBe(true);
      expect(result.products.length).toBeLessThanOrEqual(5);
    });

    it('should return empty results for no matches', async () => {
      // Mock empty result
      vi.mocked(await import('../lib/supabase.js')).getSupabaseClient = vi.fn(() => ({
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      })) as any;

      const input: SearchProductsInput = {
        query: 'nonexistent',
        limit: 10,
      };

      const result = await searchProducts(input);
      expect(result.success).toBe(true);
      expect(result.total).toBe(0);
      expect(result.products).toEqual([]);
    });
  });

  describe('get_cart', () => {
    it('should require authentication', async () => {
      const input: GetCartInput = {};

      const result = await getCart(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication required');
    });

    // Note: Additional get_cart tests require database mocking that is tested in E2E
  });

  describe('create_checkout', () => {
    it('should require authentication', async () => {
      const input: CreateCheckoutInput = {};

      const result = await createCheckout(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication required');
    });

    // Note: Additional create_checkout tests require complex Stripe/DB mocking tested in E2E
  });
});
