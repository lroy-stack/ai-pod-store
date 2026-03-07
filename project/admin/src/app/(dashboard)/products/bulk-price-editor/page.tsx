'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface BulkProduct {
  id: string;
  title: string;
  base_price_cents: number;
  currency: string;
  status: string;
  pod_provider: string | null;
  avg_cost_cents: number | null;
}

interface RowEdit {
  newPrice: string; // EUR string, e.g. "29.99"
  dirty: boolean;
}

const STRIPE_RATE = 0.029;
const STRIPE_FIXED = 25; // cents
const LOW_MARGIN_THRESHOLD = 35; // %

function computeMargin(priceCents: number, costCents: number | null): number | null {
  if (!costCents || costCents <= 0) return null;
  const stripeFee = Math.round(priceCents * STRIPE_RATE + STRIPE_FIXED);
  const profit = priceCents - costCents - stripeFee;
  return Math.round((profit / priceCents) * 100);
}

function MarginBadge({ margin }: { margin: number | null }) {
  if (margin === null)
    return <span className="text-muted-foreground text-xs">N/A</span>;
  if (margin < LOW_MARGIN_THRESHOLD)
    return (
      <Badge variant="destructive" className="text-xs">
        {margin}% — Low
      </Badge>
    );
  return (
    <Badge variant="default" className="bg-success/10 text-success dark:bg-success/20 dark:text-success border-0 text-xs">
      {margin}%
    </Badge>
  );
}

export default function BulkPriceEditorPage() {
  const [products, setProducts] = useState<BulkProduct[]>([]);
  const [edits, setEdits] = useState<Record<string, RowEdit>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ updated: number; failed: number } | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/products/bulk-price');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handlePriceChange = (id: string, value: string) => {
    setEdits((prev) => ({
      ...prev,
      [id]: { newPrice: value, dirty: true },
    }));
  };

  const getDirtyUpdates = () => {
    return Object.entries(edits)
      .filter(([, edit]) => edit.dirty && edit.newPrice.trim() !== '')
      .map(([id, edit]) => ({
        id,
        base_price_cents: Math.round(parseFloat(edit.newPrice) * 100),
      }))
      .filter((u) => !isNaN(u.base_price_cents) && u.base_price_cents > 0);
  };

  const handleSaveAll = async () => {
    const updates = getDirtyUpdates();
    if (updates.length === 0) {
      toast.info('No changes to save');
      return;
    }

    setSaving(true);
    setSaveResult(null);
    try {
      const res = await adminFetch('/api/products/bulk-price', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      if (res.ok) {
        const data = await res.json();
        setSaveResult({ updated: data.updated, failed: data.failed });
        if (data.failed === 0) {
          toast.success(`Saved ${data.updated} price${data.updated !== 1 ? 's' : ''}`);
          // Re-fetch to get updated data
          await fetchProducts();
          setEdits({});
        } else {
          toast.error(`${data.failed} update(s) failed`);
        }
      } else {
        toast.error('Failed to save prices');
      }
    } finally {
      setSaving(false);
    }
  };

  const dirtyCount = getDirtyUpdates().length;
  const lowMarginCount = products.filter((p) => {
    const edit = edits[p.id];
    const priceCents = edit?.dirty && edit.newPrice
      ? Math.round(parseFloat(edit.newPrice) * 100)
      : p.base_price_cents;
    const margin = computeMargin(priceCents, p.avg_cost_cents);
    return margin !== null && margin < LOW_MARGIN_THRESHOLD;
  }).length;

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <a href="/products">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </a>
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Bulk Price Editor</h1>
              <p className="text-sm text-muted-foreground">
                Edit prices for all active products at once
              </p>
            </div>
          </div>
          <Button
            onClick={handleSaveAll}
            disabled={saving || dirtyCount === 0}
            className="min-h-[44px]"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving…' : `Save All${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
          </Button>
        </div>

        {/* Warnings */}
        {lowMarginCount > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {lowMarginCount} product{lowMarginCount !== 1 ? 's' : ''} will have a margin below {LOW_MARGIN_THRESHOLD}%. Review before saving.
            </AlertDescription>
          </Alert>
        )}

        {saveResult && saveResult.failed === 0 && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Successfully updated {saveResult.updated} product price{saveResult.updated !== 1 ? 's' : ''}.
            </AlertDescription>
          </Alert>
        )}

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Product Prices</CardTitle>
            <CardDescription>
              Edit the &quot;New Price&quot; column. Margin previews update in real time.
              Stripe fee: 2.9% + €0.25.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-10 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">No active products found.</p>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40%]">Product Name</TableHead>
                        <TableHead>Current Price</TableHead>
                        <TableHead>New Price (€)</TableHead>
                        <TableHead>Current Margin</TableHead>
                        <TableHead>New Margin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((product) => {
                        const edit = edits[product.id];
                        const currentMargin = computeMargin(product.base_price_cents, product.avg_cost_cents);
                        const newPriceCents =
                          edit?.dirty && edit.newPrice.trim() !== ''
                            ? Math.round(parseFloat(edit.newPrice) * 100)
                            : null;
                        const newMargin =
                          newPriceCents !== null && !isNaN(newPriceCents)
                            ? computeMargin(newPriceCents, product.avg_cost_cents)
                            : null;

                        return (
                          <TableRow key={product.id} className={edit?.dirty ? 'bg-muted/30' : ''}>
                            <TableCell className="font-medium">
                              <Link
                                href={`/products/${product.id}`}
                                className="hover:underline text-primary"
                              >
                                {product.title}
                              </Link>
                            </TableCell>
                            <TableCell className="font-mono">
                              €{(product.base_price_cents / 100).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                placeholder={`${(product.base_price_cents / 100).toFixed(2)}`}
                                value={edit?.newPrice ?? ''}
                                onChange={(e) => handlePriceChange(product.id, e.target.value)}
                                className="w-28 font-mono h-8 text-sm"
                              />
                            </TableCell>
                            <TableCell>
                              <MarginBadge margin={currentMargin} />
                            </TableCell>
                            <TableCell>
                              {edit?.dirty && newPriceCents && !isNaN(newPriceCents) ? (
                                <MarginBadge margin={newMargin} />
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile card view */}
                <div className="block md:hidden divide-y">
                  {products.map((product) => {
                    const edit = edits[product.id];
                    const currentMargin = computeMargin(product.base_price_cents, product.avg_cost_cents);
                    const newPriceCents =
                      edit?.dirty && edit.newPrice.trim() !== ''
                        ? Math.round(parseFloat(edit.newPrice) * 100)
                        : null;
                    const newMargin =
                      newPriceCents !== null && !isNaN(newPriceCents)
                        ? computeMargin(newPriceCents, product.avg_cost_cents)
                        : null;

                    return (
                      <div key={product.id} className={`p-4 space-y-3 ${edit?.dirty ? 'bg-muted/30' : ''}`}>
                        <p className="font-medium text-sm line-clamp-2">{product.title}</p>
                        <div className="flex items-center gap-3 flex-wrap">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Current</p>
                            <span className="font-mono text-sm">€{(product.base_price_cents / 100).toFixed(2)}</span>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">New Price (€)</p>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              placeholder={`${(product.base_price_cents / 100).toFixed(2)}`}
                              value={edit?.newPrice ?? ''}
                              onChange={(e) => handlePriceChange(product.id, e.target.value)}
                              className="w-28 font-mono h-9 text-sm"
                            />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Margin</p>
                            {edit?.dirty && newPriceCents && !isNaN(newPriceCents) ? (
                              <MarginBadge margin={newMargin} />
                            ) : (
                              <MarginBadge margin={currentMargin} />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
