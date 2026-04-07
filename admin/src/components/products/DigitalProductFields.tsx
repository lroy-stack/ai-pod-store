'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText } from 'lucide-react';

interface Props {
  maxDownloads: string;
  onFieldChange: (field: string, value: string) => void;
}

export function DigitalProductFields({ maxDownloads, onFieldChange }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Digital Delivery
        </CardTitle>
        <p className="text-sm text-muted-foreground">Configure download settings. Files are uploaded after product creation.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Digital files (PDF, ZIP, images) can be uploaded from the product detail page after creation.
          </p>
        </div>

        <div>
          <Label htmlFor="max_downloads">Max Downloads per Purchase</Label>
          <Input
            id="max_downloads"
            type="number"
            min="1"
            value={maxDownloads}
            onChange={(e) => onFieldChange('max_downloads', e.target.value)}
            placeholder="5"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Number of times a customer can download after purchase
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
