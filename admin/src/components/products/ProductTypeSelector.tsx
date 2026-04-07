'use client';

import { Package, Box, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export type ProductType = 'pod' | 'physical' | 'digital';

const PRODUCT_TYPES: Array<{
  value: ProductType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: 'pod', label: 'Print-on-Demand', description: 'Fulfilled by Printful. Variants and mockups auto-synced.', icon: Package },
  { value: 'physical', label: 'Physical Product', description: 'Your own stock. Manual variant and inventory management.', icon: Box },
  { value: 'digital', label: 'Digital Download', description: 'Downloadable files. No shipping required.', icon: Download },
];

interface Props {
  value: ProductType;
  onChange: (type: ProductType) => void;
}

export function ProductTypeSelector({ value, onChange }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Type</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PRODUCT_TYPES.map((type) => {
            const Icon = type.icon;
            const isSelected = value === type.value;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => onChange(type.value)}
                className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-colors min-h-[44px] ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                <div>
                  <p className="font-medium text-sm">{type.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{type.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
