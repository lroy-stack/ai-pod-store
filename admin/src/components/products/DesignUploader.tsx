'use client';

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { adminFetch } from '@/lib/admin-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Upload, Image as ImageIcon, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface UploadedFile {
  id: number;
  url: string;
  filename: string;
  preview_url: string;
}

interface Props {
  onFileUploaded: (file: UploadedFile, placement: string) => void;
  uploadedFiles: Array<{ file: UploadedFile; placement: string }>;
}

const PLACEMENTS = [
  { id: 'default', label: 'Front (Default)' },
  { id: 'back', label: 'Back' },
  { id: 'front_large', label: 'Front Large' },
  { id: 'label_outside', label: 'Outside Label' },
];

export function DesignUploader({ onFileUploaded, uploadedFiles }: Props) {
  const [imageUrl, setImageUrl] = useState('');
  const [selectedPlacement, setSelectedPlacement] = useState('default');

  const uploadMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await adminFetch('/api/printful/files', {
        method: 'POST',
        body: JSON.stringify({ url, filename: `design-${Date.now()}.png` }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Upload failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      onFileUploaded(data, selectedPlacement);
      setImageUrl('');
      toast.success('Design uploaded to Printful');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    },
  });

  function handleUpload() {
    if (!imageUrl.trim()) {
      toast.error('Please enter an image URL');
      return;
    }
    uploadMutation.mutate(imageUrl.trim());
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload Design
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Image URL</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Enter a public URL of your design image (PNG recommended, minimum 2000x2000px for print quality)
            </p>
            <Input
              placeholder="https://your-supabase-url.supabase.co/storage/v1/object/public/designs/..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </div>

          <div>
            <Label>Placement</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {PLACEMENTS.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  variant={selectedPlacement === p.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedPlacement(p.id)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleUpload}
            disabled={uploadMutation.isPending || !imageUrl.trim()}
            className="w-full"
          >
            {uploadMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</>
            ) : (
              <><Upload className="h-4 w-4 mr-2" />Upload to Printful</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Uploaded files */}
      {uploadedFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Uploaded Designs ({uploadedFiles.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {uploadedFiles.map((uf, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2">
                  {uf.file.preview_url ? (
                    <img src={uf.file.preview_url} alt="" className="aspect-square object-contain rounded bg-muted" />
                  ) : (
                    <div className="aspect-square bg-muted rounded flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">{uf.placement}</Badge>
                    <Check className="h-4 w-4 text-success" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
