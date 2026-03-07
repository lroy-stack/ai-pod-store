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
  updated_at?: string | null;
  pod_provider?: string | null;
  provider_product_id?: string | null;
  last_synced_at?: string | null;
  images?: Array<{ src: string; alt?: string }> | null;
}

interface ProductsResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface UseProductsOptions {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  search?: string;
}

export function useProducts(
  options: UseProductsOptions = {},
  queryOptions?: Omit<UseQueryOptions<ProductsResponse>, 'queryKey' | 'queryFn'>
) {
  const { page = 1, limit = 20, status, category, search } = options;

  return useQuery<ProductsResponse>({
    queryKey: ['products', { page, limit, status, category, search }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      if (status) params.append('status', status);
      if (category) params.append('category', category);
      if (search) params.append('search', search);

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
