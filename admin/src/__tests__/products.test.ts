import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/products/route';
import { GET as GET_BY_ID, PATCH } from '@/app/api/products/[id]/route';
import { createMockRequest, createMockSupabaseClient, createMockAdminSession, createMockContext } from './test-utils';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn(),
  },
}));

vi.mock('@/lib/rbac', () => ({
  withPermission: (resource: string, action: string, handler: any) => handler,
  getAdminSession: vi.fn().mockResolvedValue({
    userId: 'test-admin-id',
    email: 'admin@example.com',
    role: 'admin',
    name: 'Test Admin',
  }),
}));

vi.mock('@/lib/audit', () => ({
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/validation', () => ({
  withValidation: (schema: any, handler: any) => async (req: any, session: any, context: any) => {
    const body = await req.json();
    return handler(req, body, session, context);
  },
  productSchema: {},
}));

describe('Products CRUD API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/products', () => {
    it('should fetch products with pagination', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase');

      // Mock Supabase response
      const mockProducts = [
        { id: '1', title: 'Product 1', base_price_cents: 2000, created_at: '2024-01-01' },
        { id: '2', title: 'Product 2', base_price_cents: 3000, created_at: '2024-01-02' },
      ];

      (supabaseAdmin.range as any).mockResolvedValue({
        data: mockProducts,
        error: null,
        count: 2,
      });

      const req = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3001/api/products?page=1&limit=20',
      });

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.products).toHaveLength(2);
      expect(data.total).toBe(2);
      expect(data.page).toBe(1);
      expect(data.totalPages).toBe(1);
    });

    it('should filter products by search query', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase');

      const mockProducts = [
        { id: '1', title: 'T-Shirt Blue', base_price_cents: 2000 },
      ];

      (supabaseAdmin.range as any).mockResolvedValue({
        data: mockProducts,
        error: null,
        count: 1,
      });

      const req = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3001/api/products?search=blue',
      });

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.products).toHaveLength(1);
      expect(supabaseAdmin.or).toHaveBeenCalledWith('title.ilike.%blue%,category.ilike.%blue%');
    });
  });

  describe('POST /api/products', () => {
    it('should create a new product', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase');
      const { logCreate } = await import('@/lib/audit');

      const newProduct = {
        title: 'New Product',
        description: 'Test product',
        base_price_cents: 2500,
        currency: 'eur',
        category: 'apparel',
      };

      (supabaseAdmin.single as any).mockResolvedValue({
        data: { id: 'new-product-id', ...newProduct },
        error: null,
      });

      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/products',
        body: newProduct,
      });

      const mockSession = createMockAdminSession();
      const response = await POST(req, mockSession);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.product.title).toBe('New Product');
      expect(logCreate).toHaveBeenCalledWith(
        mockSession.userId,
        'products',
        'new-product-id',
        expect.objectContaining({ title: 'New Product' })
      );
    });
  });

  describe('GET /api/products/[id]', () => {
    it('should fetch a single product by ID', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase');

      const mockProduct = {
        id: 'product-id',
        title: 'Test Product',
        base_price_cents: 2000,
      };

      (supabaseAdmin.single as any).mockResolvedValue({
        data: mockProduct,
        error: null,
      });

      const req = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3001/api/products/product-id',
      });

      const mockSession = createMockAdminSession();
      const context = createMockContext({ id: 'product-id' });

      const response = await GET_BY_ID(req, mockSession, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.product.id).toBe('product-id');
      expect(data.product.title).toBe('Test Product');
    });

    it('should return 404 for non-existent product', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase');

      (supabaseAdmin.single as any).mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      const req = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3001/api/products/non-existent-id',
      });

      const mockSession = createMockAdminSession();
      const context = createMockContext({ id: 'non-existent-id' });

      const response = await GET_BY_ID(req, mockSession, context);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Product not found');
    });
  });

  describe('PATCH /api/products/[id]', () => {
    it('should update a product', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase');
      const { logUpdate } = await import('@/lib/audit');

      const beforeProduct = {
        id: 'product-id',
        title: 'Old Title',
        base_price_cents: 2000,
      };

      const updatedProduct = {
        id: 'product-id',
        title: 'New Title',
        base_price_cents: 2500,
      };

      // First call returns before state, second call returns updated state
      (supabaseAdmin.single as any)
        .mockResolvedValueOnce({
          data: beforeProduct,
          error: null,
        })
        .mockResolvedValueOnce({
          data: updatedProduct,
          error: null,
        });

      const req = createMockRequest({
        method: 'PATCH',
        url: 'http://localhost:3001/api/products/product-id',
        body: { title: 'New Title', base_price_cents: 2500 },
      });

      const mockSession = createMockAdminSession();
      const context = createMockContext({ id: 'product-id' });

      const response = await PATCH(req, mockSession, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.product.title).toBe('New Title');
      expect(logUpdate).toHaveBeenCalledWith(
        mockSession.userId,
        'product',
        'product-id',
        beforeProduct,
        updatedProduct,
        mockSession.email
      );
    });
  });
});
