'use client';

import { PackageSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DataTableEmptyProps {
  title?: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function DataTableEmpty({
  title = 'No results found',
  description = 'Try adjusting your search or filter to find what you\'re looking for.',
  ctaLabel,
  onCta,
}: DataTableEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <PackageSearch className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      {ctaLabel && onCta && (
        <Button onClick={onCta} variant="outline">
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}
