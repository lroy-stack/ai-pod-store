import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminFetch } from '@/lib/admin-api';

interface BulkUpdatePayload {
  ids: string[];
  status: string;
}

export function useBulkUpdateProducts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: BulkUpdatePayload) => {
      const res = await adminFetch('/api/products/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Bulk update failed: ${res.status}`);
      }

      return res.json();
    },
    onSuccess: () => {
      // Invalidate products queries to refetch
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useArchiveProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      const res = await adminFetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      });

      if (!res.ok) {
        throw new Error(`Archive failed: ${res.status}`);
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
