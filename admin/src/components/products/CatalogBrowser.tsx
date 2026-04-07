'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminFetch } from '@/lib/admin-api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface CatalogProduct {
  id: number;
  title: string;
  image: string;
  type: string;
  type_name: string;
  description?: string;
}

interface Props {
  onSelect: (product: CatalogProduct) => void;
}

export function CatalogBrowser({ onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 24;

  const { data, isLoading } = useQuery({
    queryKey: ['printful-catalog', offset],
    queryFn: async () => {
      const res = await adminFetch(`/api/printful/catalog?offset=${offset}&limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch catalog');
      return res.json();
    },
    staleTime: 5 * 60_000,
  });

  const products: CatalogProduct[] = data?.products || [];
  const total = data?.paging?.total || 0;

  const filtered = search
    ? products.filter(p => p.title.toLowerCase().includes(search.toLowerCase()))
    : products;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search catalog products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary">{data?.paging?.total || 0} products</Badge>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="aspect-square bg-muted rounded-lg mb-3" />
                <div className="h-4 bg-muted rounded w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.length === 0 && !isLoading && (
            <div className="col-span-full py-12 text-center text-muted-foreground">No products match your search</div>
          )}
          {filtered.map((product) => (
            <Card
              key={product.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => onSelect(product)}
            >
              <CardContent className="p-4">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.title}
                    width={200}
                    height={200}
                    className="aspect-square object-contain rounded-lg mb-3 bg-muted"
                  />
                ) : (
                  <div className="aspect-square bg-muted rounded-lg mb-3 flex items-center justify-center text-muted-foreground text-xs">
                    No image
                  </div>
                )}
                <h3 className="font-medium text-sm line-clamp-2">{product.title}</h3>
                <Badge variant="outline" className="mt-2 text-xs">{product.type_name}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + limit >= total}
            onClick={() => setOffset(offset + limit)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
