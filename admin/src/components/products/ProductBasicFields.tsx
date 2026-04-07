'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  title: string;
  description: string;
  priceEur: string;
  currency: string;
  category: string;
  errors: Record<string, string>;
  onFieldChange: (field: string, value: string) => void;
}

export function ProductBasicFields({
  title, description, priceEur, currency, category, errors, onFieldChange,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => onFieldChange('title', e.target.value)}
            placeholder="Product title"
          />
          {errors.title && <p className="text-sm text-destructive mt-1">{errors.title}</p>}
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => onFieldChange('description', e.target.value)}
            placeholder="Product description"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="price">Price ({currency}) *</Label>
            <Input
              id="price"
              type="number"
              min="0.01"
              step="0.01"
              value={priceEur}
              onChange={(e) => onFieldChange('price_eur', e.target.value)}
              placeholder="24.99"
            />
            {errors.price_eur && <p className="text-sm text-destructive mt-1">{errors.price_eur}</p>}
          </div>

          <div>
            <Label>Currency</Label>
            <Select value={currency} onValueChange={(v) => onFieldChange('currency', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Category</Label>
          <Select value={category} onValueChange={(v) => onFieldChange('category', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="apparel">Apparel</SelectItem>
              <SelectItem value="headwear">Headwear</SelectItem>
              <SelectItem value="accessories">Accessories</SelectItem>
              <SelectItem value="home">Home</SelectItem>
              <SelectItem value="drinkware">Drinkware</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
