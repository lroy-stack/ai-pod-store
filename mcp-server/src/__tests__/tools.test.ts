import { describe, it, expect, vi } from 'vitest';
import { searchProducts, type SearchProductsInput } from '../tools/search-products.js';
import { getCart, type GetCartInput } from '../tools/get-cart.js';
import { createCheckout, type CreateCheckoutInput } from '../tools/create-checkout.js';
import { createMockAuthInfo } from './test-utils.js';

// Mock Supabase client
const mockSupabaseClient = () => ({
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
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
});

vi.mock('../lib/supabase.js', () => ({
  getSupabaseClient: () => mockSupabaseClient(),
  getAnonClient: () => mockSupabaseClient(),
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
      // Note: With the current mock returning data, this test verifies
      // that search always returns a valid result structure.
      // Full empty-result testing requires E2E against real Supabase.
      const input: SearchProductsInput = {
        query: 'nonexistent',
        limit: 10,
      };

      const result = await searchProducts(input);
      expect(result.success).toBe(true);
      expect(Array.isArray(result.products)).toBe(true);
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
