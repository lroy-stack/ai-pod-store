'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  seoTitle: string;
  seoDescription: string;
  onFieldChange: (field: string, value: string) => void;
}

export function SeoFields({ seoTitle, seoDescription, onFieldChange }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>SEO</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="seo_title">SEO Title</Label>
          <Input
            id="seo_title"
            value={seoTitle}
            onChange={(e) => onFieldChange('seo_title', e.target.value)}
            placeholder="Max 60 characters"
            maxLength={60}
          />
          <p className="text-xs text-muted-foreground mt-1">{seoTitle.length}/60</p>
        </div>

        <div>
          <Label htmlFor="seo_description">SEO Description</Label>
          <Input
            id="seo_description"
            value={seoDescription}
            onChange={(e) => onFieldChange('seo_description', e.target.value)}
            placeholder="Max 160 characters"
            maxLength={160}
          />
          <p className="text-xs text-muted-foreground mt-1">{seoDescription.length}/160</p>
        </div>
      </CardContent>
    </Card>
  );
}
