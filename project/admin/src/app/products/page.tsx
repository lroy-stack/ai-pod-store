'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Archive, Eye } from 'lucide-react';

interface Product {
  id: string;
  title: string;
  base_price_cents: number;
  currency: string;
  status: string;
  category: string;
  created_at: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      const res = await fetch('/api/products?limit=50');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(id: string) {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  }

  async function bulkPublish() {
    if (selectedIds.size === 0) return;

    try {
      const res = await fetch('/api/products/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          status: 'active',
        }),
      });

      if (res.ok) {
        await fetchProducts();
        setSelectedIds(new Set());
      }
    } catch (error) {
      console.error('Bulk publish failed:', error);
    }
  }

  async function archiveProduct(id: string) {
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      });

      if (res.ok) {
        await fetchProducts();
      }
    } catch (error) {
      console.error('Archive failed:', error);
    }
  }

  return (
    <DashboardLayout>
      <main className="min-h-screen p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Products</h1>
          <Button asChild>
            <a href="/products/new">
              <Plus className="h-4 w-4 mr-2" />
              Create Product
            </a>
          </Button>
        </div>

        {selectedIds.size > 0 && (
          <div className="mb-4 flex gap-2">
            <Button onClick={bulkPublish} variant="default">
              Publish Selected ({selectedIds.size})
            </Button>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>All Products</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No products found</p>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <input type="checkbox" className="rounded" />
                        </TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell>
                            <input
                              type="checkbox"
                              className="rounded"
                              checked={selectedIds.has(product.id)}
                              onChange={() => toggleSelect(product.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{product.title}</TableCell>
                          <TableCell className="capitalize">{product.category}</TableCell>
                          <TableCell>
                            {product.currency === 'eur' ? '€' : '$'}
                            {(product.base_price_cents / 100).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
                              {product.status === 'active' ? 'Active' : 'Archived'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                asChild
                              >
                                <a href={`/products/${product.id}`}>
                                  <Pencil className="h-4 w-4" />
                                </a>
                              </Button>
                              {product.status === 'active' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => archiveProduct(product.id)}
                                >
                                  <Archive className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="block md:hidden space-y-4">
                  {products.map((product) => (
                    <div key={product.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="rounded mt-1"
                          checked={selectedIds.has(product.id)}
                          onChange={() => toggleSelect(product.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-base leading-tight mb-1 break-words">
                            {product.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <span className="capitalize">{product.category}</span>
                            <span>•</span>
                            <span className="font-medium">
                              {product.currency === 'eur' ? '€' : '$'}
                              {(product.base_price_cents / 100).toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
                          {product.status === 'active' ? 'Active' : 'Archived'}
                        </Badge>
                      </div>
                      <div className="flex gap-2 pt-2 border-t">
                        <Button
                          variant="outline"
                          size="default"
                          asChild
                          className="flex-1 min-h-[44px]"
                        >
                          <a href={`/products/${product.id}`}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </a>
                        </Button>
                        {product.status === 'active' && (
                          <Button
                            variant="outline"
                            size="default"
                            onClick={() => archiveProduct(product.id)}
                            className="flex-1 min-h-[44px]"
                          >
                            <Archive className="h-4 w-4 mr-2" />
                            Archive
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </DashboardLayout>
  );
}
