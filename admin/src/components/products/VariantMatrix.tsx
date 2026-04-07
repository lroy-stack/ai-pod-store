'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { adminFetch } from '@/lib/admin-api';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductVariant {
  id: string;
  product_id: string;
  size: string;
  color: string;
  price_cents: number;
  cost_cents: number | null;
  is_enabled: boolean;
  is_available: boolean;
  sku: string | null;
  image_url: string | null;
  color_hex: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', 'One Size'];

function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const ai = SIZE_ORDER.indexOf(a);
    const bi = SIZE_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function formatPrice(cents: number, currency = 'EUR'): string {
  return (cents / 100).toFixed(2);
}

// ─── Editable Price Cell ──────────────────────────────────────────────────────

interface PriceCellProps {
  variant: ProductVariant;
  currency: string;
  onSave: (variantId: string, priceCents: number) => Promise<void>;
}

function PriceCell({ variant, currency, onSave }: PriceCellProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(formatPrice(variant.price_cents, currency));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(formatPrice(variant.price_cents, currency));
  }, [variant.price_cents, currency]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.select();
    }
  }, [editing]);

  async function handleBlur() {
    setEditing(false);
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0) {
      setValue(formatPrice(variant.price_cents, currency));
      return;
    }
    const newCents = Math.round(parsed * 100);
    if (newCents === variant.price_cents) return;

    setSaving(true);
    try {
      await onSave(variant.id, newCents);
    } finally {
      setSaving(false);
    }
  }

  async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setValue(formatPrice(variant.price_cents, currency));
      setEditing(false);
    }
  }

  if (saving) {
    return (
      <div className="flex items-center justify-center h-7">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (editing) {
    return (
      <div className="relative flex items-center">
        <span className="absolute left-1.5 text-xs text-muted-foreground pointer-events-none select-none">
          {currency === 'EUR' ? '€' : currency === 'USD' ? '$' : '£'}
        </span>
        <input
          ref={inputRef}
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full pl-5 pr-1 py-0.5 text-xs text-right border border-primary rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="w-full text-xs text-right px-1 py-0.5 rounded hover:bg-muted/60 transition-colors cursor-text font-mono"
      title="Click to edit price"
    >
      {currency === 'EUR' ? '€' : currency === 'USD' ? '$' : '£'}{formatPrice(variant.price_cents, currency)}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface VariantMatrixProps {
  productId: string;
  currency?: string;
}

export function VariantMatrix({ productId, currency = 'EUR' }: VariantMatrixProps) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVariants();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function fetchVariants() {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/products/${productId}/variants`);
      if (res.ok) {
        const data = await res.json();
        setVariants(data.variants ?? []);
      } else {
        toast.error('Failed to load variants');
      }
    } catch {
      toast.error('Failed to load variants');
    } finally {
      setLoading(false);
    }
  }

  const handlePriceSave = useCallback(async (variantId: string, priceCents: number) => {
    const res = await adminFetch(`/api/products/${productId}/variants?variantId=${variantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price_cents: priceCents }),
    });
    if (res.ok) {
      const data = await res.json();
      setVariants((prev) =>
        prev.map((v) => (v.id === variantId ? { ...v, price_cents: data.variant.price_cents } : v))
      );
      toast.success('Price updated');
    } else {
      toast.error('Failed to update price');
      throw new Error('save failed');
    }
  }, [productId]);

  const handleToggleEnabled = useCallback(async (variantId: string, enabled: boolean) => {
    setVariants((prev) =>
      prev.map((v) => (v.id === variantId ? { ...v, is_enabled: enabled } : v))
    );
    const res = await adminFetch(`/api/products/${productId}/variants?variantId=${variantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_enabled: enabled }),
    });
    if (!res.ok) {
      setVariants((prev) =>
        prev.map((v) => (v.id === variantId ? { ...v, is_enabled: !enabled } : v))
      );
      toast.error('Failed to update variant');
    } else {
      toast.success(enabled ? 'Variant enabled' : 'Variant disabled');
    }
  }, [productId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading variants…</span>
      </div>
    );
  }

  if (variants.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-sm font-medium text-muted-foreground">No variants found for this product</p>
      </div>
    );
  }

  // Build matrix: unique colors (rows) × unique sizes (columns)
  const colors = [...new Set(variants.map((v) => v.color))].sort();
  const sizes = sortSizes([...new Set(variants.map((v) => v.size))]);

  // Lookup map: `${color}|${size}` → variant
  const lookup = new Map<string, ProductVariant>();
  for (const v of variants) {
    lookup.set(`${v.color}|${v.size}`, v);
  }

  const enabledCount = variants.filter((v) => v.is_enabled).length;
  const totalCount = variants.length;

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="outline">{totalCount} variants</Badge>
        <Badge variant={enabledCount > 0 ? 'default' : 'secondary'}>{enabledCount} enabled</Badge>
        <span className="ml-auto text-xs">Click price to edit · Toggle to enable/disable</span>
      </div>

      {/* Matrix table (horizontally scrollable on small screens) */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2 text-left font-medium text-xs text-muted-foreground min-w-[120px]">
                Color
              </th>
              {sizes.map((size) => (
                <th
                  key={size}
                  className="px-2 py-2 text-center font-medium text-xs text-muted-foreground whitespace-nowrap min-w-[80px]"
                >
                  {size}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {colors.map((color, colorIdx) => {
              const colorVariant = variants.find((v) => v.color === color);
              const colorHex = colorVariant?.color_hex ?? null;

              return (
                <tr
                  key={color}
                  className={colorIdx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
                >
                  {/* Color label */}
                  <td className="sticky left-0 z-10 bg-inherit px-3 py-2 border-r border-border">
                    <div className="flex items-center gap-2">
                      {colorHex && (
                        <span
                          className="inline-block w-3 h-3 rounded-full border border-border flex-shrink-0"
                          style={{ backgroundColor: colorHex }}
                        />
                      )}
                      <span className="font-medium text-xs truncate max-w-[90px]" title={color}>
                        {color}
                      </span>
                    </div>
                  </td>

                  {/* Size cells */}
                  {sizes.map((size) => {
                    const variant = lookup.get(`${color}|${size}`);

                    if (!variant) {
                      return (
                        <td
                          key={size}
                          className="px-2 py-2 text-center border-r border-border/50 last:border-r-0"
                        >
                          <span className="text-xs text-muted-foreground/40">—</span>
                        </td>
                      );
                    }

                    return (
                      <td
                        key={size}
                        className={`px-2 py-1.5 border-r border-border/50 last:border-r-0 ${
                          !variant.is_enabled ? 'opacity-40' : ''
                        }`}
                      >
                        <div className="space-y-1">
                          <PriceCell
                            variant={variant}
                            currency={currency}
                            onSave={handlePriceSave}
                          />
                          <div className="flex items-center justify-center">
                            <Switch
                              checked={variant.is_enabled}
                              onCheckedChange={(checked) => handleToggleEnabled(variant.id, checked)}
                              className="scale-75"
                            />
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        {colors.length} color{colors.length !== 1 ? 's' : ''} × {sizes.length} size{sizes.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
