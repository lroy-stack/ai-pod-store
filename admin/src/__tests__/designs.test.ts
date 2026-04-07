import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/designs/route';
import { createMockRequest, createMockSupabaseClient } from './test-utils';

// Mock createClient from @supabase/supabase-js
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => createMockSupabaseClient()),
}));

vi.mock('@/lib/rbac', () => ({
  getAdminSession: vi.fn().mockResolvedValue({
    userId: 'admin-id',
    email: 'admin@example.com',
    role: 'admin',
  }),
}));

describe('Designs API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  });

  describe('GET /api/designs', () => {
    it('should fetch designs with pagination', async () => {
      const { createClient } = await import('@supabase/supabase-js');
      const mockSupabase = createMockSupabaseClient();

      const mockDesigns = [
        {
          id: 'design-1',
          prompt: 'Cool t-shirt design',
          style: 'minimalist',
          moderation_status: 'approved',
          created_at: '2024-01-01',
        },
        {
          id: 'design-2',
          prompt: 'Funny mug design',
          style: 'cartoon',
          moderation_status: 'pending',
          created_at: '2024-01-02',
        },
      ];

      (mockSupabase.range as any).mockResolvedValue({
        data: mockDesigns,
        error: null,
        count: 2,
      });

      (createClient as any).mockReturnValue(mockSupabase);

      const req = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3001/api/designs?page=1&limit=20',
      });

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.designs).toHaveLength(2);
      expect(data.total).toBe(2);
      expect(data.page).toBe(1);
    });

    it('should filter designs by moderation status', async () => {
      const { createClient } = await import('@supabase/supabase-js');
      const mockSupabase = createMockSupabaseClient();

      const mockDesigns = [
        {
          id: 'design-1',
          prompt: 'Cool design',
          style: 'minimalist',
          moderation_status: 'approved',
        },
      ];

      (mockSupabase.range as any).mockResolvedValue({
        data: mockDesigns,
        error: null,
        count: 1,
      });

      (createClient as any).mockReturnValue(mockSupabase);

      const req = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3001/api/designs?status=approved',
      });

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.designs).toHaveLength(1);
      expect(mockSupabase.eq).toHaveBeenCalledWith('moderation_status', 'approved');
    });

    it('should filter designs by search query', async () => {
      const { createClient } = await import('@supabase/supabase-js');
      const mockSupabase = createMockSupabaseClient();

      const mockDesigns = [
        {
          id: 'design-1',
          prompt: 'Minimalist t-shirt',
          style: 'minimalist',
          moderation_status: 'approved',
        },
      ];

      (mockSupabase.range as any).mockResolvedValue({
        data: mockDesigns,
        error: null,
        count: 1,
      });

      (createClient as any).mockReturnValue(mockSupabase);

      const req = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3001/api/designs?search=minimalist',
      });

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.designs).toHaveLength(1);
      expect(mockSupabase.or).toHaveBeenCalledWith('prompt.ilike.%minimalist%,style.ilike.%minimalist%');
    });

    it('should require admin authentication', async () => {
      const { getAdminSession } = await import('@/lib/rbac');

      // Mock auth failure
      (getAdminSession as any).mockResolvedValue(null);

      const req = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3001/api/designs',
      });

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });
});
