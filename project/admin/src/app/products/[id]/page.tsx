'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { adminFetch } from '@/lib/admin-api';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Product {
  id: string;
  title: string;
  description: string;
  base_price_cents: number;
  currency: string;
  category: string;
  status: string;
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);

  useEffect(() => {
    fetchProduct();
  }, []);

  async function fetchProduct() {
    try {
      const res = await adminFetch(`/api/products/${id}`);
      if (res.ok) {
        const data = await res.json();
        setProduct(data.product);
      }
    } catch (error) {
      console.error('Failed to fetch product:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;

    setSaving(true);

    try {
      const res = await adminFetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: product.title,
          description: product.description,
          base_price_cents: product.base_price_cents,
          currency: product.currency,
          category: product.category,
        }),
      });

      if (res.ok) {
        router.push('/products');
      } else {
        alert('Failed to update product');
      }
    } catch (error) {
      console.error('Update product error:', error);
      alert('Failed to update product');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <main className="min-h-screen p-8">
          <div className="max-w-2xl">
            <div className="h-8 w-48 bg-muted rounded animate-pulse mb-6" />
            <Card>
              <CardHeader>
                <div className="h-6 w-32 bg-muted rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-10 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </DashboardLayout>
    );
  }

  if (!product) {
    return (
      <DashboardLayout>
        <main className="min-h-screen p-8">
          <p>Product not found</p>
        </main>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <main className="min-h-screen p-8">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold mb-6">Edit Product</h1>

          <Card>
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={product.title}
                    onChange={(e) => setProduct({ ...product, title: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={product.description}
                    onChange={(e) => setProduct({ ...product, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price">Price (cents)</Label>
                    <Input
                      id="price"
                      type="number"
                      value={product.base_price_cents}
                      onChange={(e) => setProduct({ ...product, base_price_cents: parseInt(e.target.value) })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="currency">Currency</Label>
                    <select
                      id="currency"
                      value={product.currency}
                      onChange={(e) => setProduct({ ...product, currency: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    value={product.category}
                    onChange={(e) => setProduct({ ...product, category: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="apparel">Apparel</option>
                    <option value="home">Home</option>
                    <option value="accessories">Accessories</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/products')}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </DashboardLayout>
  );
}
