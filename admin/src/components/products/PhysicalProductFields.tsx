'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

interface Props {
  sku: string;
  stockQuantity: string;
  weight: string;
  trackInventory: boolean;
  onFieldChange: (field: string, value: string) => void;
  onToggleInventory: (enabled: boolean) => void;
}

export function PhysicalProductFields({
  sku, stockQuantity, weight, trackInventory, onFieldChange, onToggleInventory,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory & Shipping</CardTitle>
        <p className="text-sm text-muted-foreground">Manage your own stock and shipping details</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="sku">SKU</Label>
          <Input
            id="sku"
            value={sku}
            onChange={(e) => onFieldChange('sku', e.target.value)}
            placeholder="e.g. TSHIRT-BLK-M-001"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Track Inventory</Label>
            <p className="text-xs text-muted-foreground">Enable stock quantity tracking</p>
          </div>
          <Switch checked={trackInventory} onCheckedChange={onToggleInventory} />
        </div>

        {trackInventory && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="stock">Stock Quantity</Label>
              <Input
                id="stock"
                type="number"
                min="0"
                value={stockQuantity}
                onChange={(e) => onFieldChange('stock_quantity', e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="weight">Shipping Weight (grams)</Label>
              <Input
                id="weight"
                type="number"
                min="0"
                value={weight}
                onChange={(e) => onFieldChange('shipping_weight', e.target.value)}
                placeholder="250"
              />
            </div>
          </div>
        )}

        <Separator />

        <p className="text-xs text-muted-foreground">
          After creating the product, add variants (sizes, colors) from the product detail page.
        </p>
      </CardContent>
    </Card>
  );
}
