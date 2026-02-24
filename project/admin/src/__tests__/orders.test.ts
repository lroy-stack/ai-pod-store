import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/orders/route';
import { createMockRequest, createMockSupabaseClient, createMockAdminSession } from './test-utils';

// Mock dependencies - create a chainable mock object inline
vi.mock('@/lib/supabase', () => {
  const mock: any = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
  };
  // Make all methods return the mock itself for chaining
  Object.keys(mock).forEach(key => {
    mock[key].mockReturnValue(mock);
  });
  return { supabaseAdmin: mock };
});

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    authenticated: true,
    userId: 'admin-id',
  }),
}));

describe('Orders API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/orders', () => {
    it('should fetch orders with pagination', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase');

      const mockOrders = [
        {
          id: 'order-1',
          status: 'completed',
          total_amount: 5000,
          customer_email: 'customer@example.com',
          created_at: '2024-01-01',
        },
        {
          id: 'order-2',
          status: 'pending',
          total_amount: 3000,
          customer_email: 'customer2@example.com',
          created_at: '2024-01-02',
        },
      ];

      (supabaseAdmin.range as any).mockResolvedValue({
        data: mockOrders,
        error: null,
        count: 2,
      });

      const req = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3001/api/orders?page=1&limit=50',
      });

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.orders).toHaveLength(2);
      expect(data.total).toBe(2);
      expect(data.page).toBe(1);
    });


    it('should require authentication', async () => {
      const { requireAuth } = await import('@/lib/auth');

      // Mock auth failure
      (requireAuth as any).mockResolvedValue({
        authenticated: false,
        response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      });

      const req = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3001/api/orders',
      });

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });
});
