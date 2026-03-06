import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { adminFetch } from '@/lib/admin-api';

export interface Order {
  id: string;
  user_id: string | null;
  status: string;
  total_cents: number;
  currency: string;
  created_at: string;
  customer_email?: string;
  pod_provider?: string | null;
  user?: {
    id: string;
    email: string;
    name: string | null;
  };
}

interface OrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface UseOrdersOptions {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export function useOrders(
  options: UseOrdersOptions = {},
  queryOptions?: Omit<UseQueryOptions<OrdersResponse>, 'queryKey' | 'queryFn'>
) {
  const { page = 1, limit = 20, status, search } = options;

  return useQuery<OrdersResponse>({
    queryKey: ['orders', { page, limit, status, search }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      if (status) params.append('status', status);
      if (search) params.append('search', search);

      const res = await adminFetch(`/api/orders?${params.toString()}`);

      if (!res.ok) {
        throw new Error(`Failed to fetch orders: ${res.status}`);
      }

      return res.json();
    },
    staleTime: 30000, // 30 seconds
    ...queryOptions,
  });
}
