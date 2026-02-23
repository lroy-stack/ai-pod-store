import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { adminFetch } from '@/lib/admin-api';

export interface Customer {
  email: string;
  name: string;
  orderCount: number;
  totalSpent: number;
  currency: string;
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
}

export function useCustomers(
  options: UseCustomersOptions = {},
  queryOptions?: Omit<UseQueryOptions<CustomersResponse>, 'queryKey' | 'queryFn'>
) {
  const { page = 1, limit = 20, search } = options;

  return useQuery<CustomersResponse>({
    queryKey: ['customers', { page, limit, search }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      if (search) params.append('search', search);

      const res = await adminFetch(`/api/customers?${params.toString()}`);

      if (!res.ok) {
        throw new Error(`Failed to fetch customers: ${res.status}`);
      }

      return res.json();
    },
    staleTime: 30000, // 30 seconds
    ...queryOptions,
  });
}
