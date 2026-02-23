import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { adminFetch } from '@/lib/admin-api';

export interface Product {
  id: string;
  title: string;
  base_price_cents: number;
  currency: string;
  status: string;
  category: string;
  created_at: string;
}

interface ProductsResponse {
  products: Product[];
  total?: number;
}

interface UseProductsOptions {
  limit?: number;
  offset?: number;
  status?: string;
  category?: string;
}

export function useProducts(
  options: UseProductsOptions = {},
  queryOptions?: Omit<UseQueryOptions<ProductsResponse>, 'queryKey' | 'queryFn'>
) {
  const { limit = 50, offset = 0, status, category } = options;

  return useQuery<ProductsResponse>({
    queryKey: ['products', { limit, offset, status, category }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      if (offset) params.append('offset', offset.toString());
      if (status) params.append('status', status);
      if (category) params.append('category', category);

      const res = await adminFetch(`/api/products?${params.toString()}`);

      if (!res.ok) {
        throw new Error(`Failed to fetch products: ${res.status}`);
      }

      return res.json();
    },
    staleTime: 30000, // 30 seconds
    ...queryOptions,
  });
}
