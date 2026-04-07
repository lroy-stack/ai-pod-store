'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminFetch } from '@/lib/admin-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface CatalogVariant {
  id: number;
  name: string;
  size: string;
  color: string;
  color_code: string;
  price: string;
  image: string;
  in_stock: boolean;
}

export interface SelectedVariant {
  variant_id: number;
  name: string;
  size: string;
  color: string;
  retail_price: string;
  cost: string;
}

interface Props {
  catalogProductId: number;
  defaultMargin?: number;
  onVariantsChange: (variants: SelectedVariant[]) => void;
}

export function VariantSelector({ catalogProductId, defaultMargin = 1.8, onVariantsChange }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [priceOverrides, setPriceOverrides] = useState<Record<number, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['printful-catalog-product', catalogProductId],
    queryFn: async () => {
      const res = await adminFetch(`/api/printful/catalog/${catalogProductId}`);
      if (!res.ok) throw new Error('Failed to fetch product');
      return res.json();
    },
  });

  const variants: CatalogVariant[] = useMemo(() => {
    if (!data?.variants) return [];
    return data.variants.map((v: any) => ({
      id: v.id,
      name: v.name,
      size: v.size || '',
      color: v.color || '',
      color_code: v.color_code || '#000',
      price: v.price || '0',
      image: v.image || '',
      in_stock: v.in_stock !== false,
    }));
  }, [data]);

  // Group by color
  const colors = useMemo(() => {
    const map = new Map<string, CatalogVariant[]>();
    for (const v of variants) {
      const key = v.color || 'Default';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    }
    return map;
  }, [variants]);

  function toggleVariant(variantId: number) {
    const next = new Set(selected);
    if (next.has(variantId)) {
      next.delete(variantId);
    } else {
      next.add(variantId);
    }
    setSelected(next);
    emitChange(next, priceOverrides);
  }

  function toggleColor(colorVariants: CatalogVariant[]) {
    const ids = colorVariants.map(v => v.id);
    const allSelected = ids.every(id => selected.has(id));
    const next = new Set(selected);
    for (const id of ids) {
      if (allSelected) next.delete(id); else next.add(id);
    }
    setSelected(next);
    emitChange(next, priceOverrides);
  }

  function updatePrice(variantId: number, price: string) {
    const next = { ...priceOverrides, [variantId]: price };
    setPriceOverrides(next);
    emitChange(selected, next);
  }

  function emitChange(sel: Set<number>, prices: Record<number, string>) {
    const result: SelectedVariant[] = [];
    for (const v of variants) {
      if (!sel.has(v.id)) continue;
      const cost = parseFloat(v.price);
      const defaultPrice = (cost * defaultMargin).toFixed(2);
      result.push({
        variant_id: v.id,
        name: v.name,
        size: v.size,
        color: v.color,
        retail_price: prices[v.id] || defaultPrice,
        cost: v.price,
      });
    }
    onVariantsChange(result);
  }

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading variants...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{variants.length} variants available</p>
        <Badge>{selected.size} selected</Badge>
      </div>

      {Array.from(colors.entries()).map(([color, colorVariants]) => (
        <Card key={color}>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={colorVariants.every(v => selected.has(v.id))}
                onCheckedChange={() => toggleColor(colorVariants)}
              />
              {colorVariants[0]?.color_code && (
                <div
                  className="w-5 h-5 rounded-full border border-border"
                  style={{ backgroundColor: colorVariants[0].color_code }}
                />
              )}
              <CardTitle className="text-sm">{color}</CardTitle>
              <Badge variant="outline" className="text-xs">{colorVariants.length} sizes</Badge>
            </div>
          </CardHeader>
          <CardContent className="py-2 px-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {colorVariants.map((v) => {
                const isSelected = selected.has(v.id);
                const cost = parseFloat(v.price);
                const defaultPrice = (cost * defaultMargin).toFixed(2);
                const retailPrice = priceOverrides[v.id] || defaultPrice;
                const margin = ((parseFloat(retailPrice) - cost) / parseFloat(retailPrice) * 100).toFixed(0);

                return (
                  <div
                    key={v.id}
                    className={`flex items-center gap-2 p-2 rounded border text-sm min-h-[44px] ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-border'
                    } ${!v.in_stock ? 'opacity-50' : ''}`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleVariant(v.id)}
                      disabled={!v.in_stock}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{v.size || 'One size'}</p>
                      <p className="text-xs text-muted-foreground">Cost: {v.price} EUR</p>
                    </div>
                    {isSelected && (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={retailPrice}
                          onChange={(e) => updatePrice(v.id, e.target.value)}
                          className="w-20 h-7 text-xs"
                        />
                        <span className="text-xs text-muted-foreground">{margin}%</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
