import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { adminFetch } from '@/lib/admin-api';

export interface Customer {
  id: string;
  email: string;
  name: string;
  created_at: string;
  avatar_url: string | null;
  account_status: string;
  tags: string[];
  order_count: number;
  total_spent_cents: number;
  currency: string;
  rfm_segment: string;
  clv_cents: number;
  avg_order_cents: number;
  last_order_at: string | null;
}

interface CustomersResponse {
  customers: Customer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface UseCustomersOptions {
  page?: number;
  limit?: number;
  search?: string;
  segment?: string;
  tag?: string;
}

export function useCustomers(
  options: UseCustomersOptions = {},
  queryOptions?: Omit<UseQueryOptions<CustomersResponse>, 'queryKey' | 'queryFn'>
) {
  const { page = 1, limit = 50, search, segment, tag } = options;

  return useQuery<CustomersResponse>({
    queryKey: ['customers', { page, limit, search, segment, tag }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      if (search) params.append('search', search);
      if (segment) params.append('segment', segment);
      if (tag) params.append('tag', tag);

      const res = await adminFetch(`/api/customers?${params.toString()}`);

      if (!res.ok) {
        throw new Error(`Failed to fetch customers: ${res.status}`);
      }

      return res.json();
    },
    staleTime: 30000,
    ...queryOptions,
  });
}
