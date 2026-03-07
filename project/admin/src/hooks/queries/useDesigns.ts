import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { adminFetch } from '@/lib/admin-api';

export interface Design {
  id: string;
  prompt: string;
  style: string | null;
  model: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  moderation_status: 'pending' | 'approved' | 'rejected';
  moderation_notes: string | null;
  created_at: string;
  user_id: string | null;
  product_id: string | null;
  source_type: string | null;
  source_url: string | null;
  bg_removed_url: string | null;
  provider_upload_id: string | null;
  quality_score: number | null;
  used_in_count: number;
  tags: string[];
}

interface DesignsResponse {
  designs: Design[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface UseDesignsOptions {
  page?: number;
  limit?: number;
  status?: 'pending' | 'approved' | 'rejected';
  search?: string;
}

export function useDesigns(
  options: UseDesignsOptions = {},
  queryOptions?: Omit<UseQueryOptions<DesignsResponse>, 'queryKey' | 'queryFn'>
) {
  const { page = 1, limit = 20, status, search } = options;

  return useQuery<DesignsResponse>({
    queryKey: ['designs', { page, limit, status, search }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      if (status) params.append('status', status);
      if (search) params.append('search', search);

      const res = await adminFetch(`/api/designs?${params.toString()}`);

      if (!res.ok) {
        throw new Error(`Failed to fetch designs: ${res.status}`);
      }

      return res.json();
    },
    staleTime: 30000, // 30 seconds
    ...queryOptions,
  });
}
