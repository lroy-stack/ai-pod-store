'use client';

import { useState, useRef, useCallback } from 'react';
import { adminFetch } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Star, StarOff, GripVertical, Loader2, Save, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductImage {
  src: string;
  position?: number;
  is_primary?: boolean;
}

interface ImageGalleryProps {
  productId: string;
  images: ProductImage[];
  onImagesChange?: (images: ProductImage[]) => void;
}

// ─── Image Card ───────────────────────────────────────────────────────────────

interface ImageCardProps {
  image: ProductImage;
  index: number;
  isPrimary: boolean;
  dragging: boolean;
  dragOver: boolean;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onDrop: (dropIndex: number) => void;
  onPreview: () => void;
  onSetPrimary: () => void;
}

function ImageCard({
  image,
  index,
  isPrimary,
  dragging,
  dragOver,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onPreview,
  onSetPrimary,
}: ImageCardProps) {
  const src = typeof image === 'string' ? image : image.src;

  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
      onDrop={() => onDrop(index)}
      className={[
        'group relative aspect-square rounded-lg border overflow-hidden bg-muted cursor-grab active:cursor-grabbing transition-all',
        dragging ? 'opacity-50 scale-95' : 'opacity-100 scale-100',
        dragOver ? 'border-primary border-2 ring-2 ring-primary/20' : 'border-border',
      ].join(' ')}
    >
      {/* Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`Product image ${index + 1}`}
        className="w-full h-full object-cover"
        draggable={false}
      />

      {/* Drag handle overlay */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute top-1 left-1 text-white/80 bg-black/40 rounded p-0.5">
          <GripVertical className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* Click overlay to preview */}
      <button
        onClick={onPreview}
        className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors"
        aria-label={`Preview image ${index + 1}`}
      />

      {/* Primary badge */}
      {isPrimary && (
        <Badge className="absolute top-1 right-1 text-xs py-0 px-1.5 pointer-events-none">
          Primary
        </Badge>
      )}

      {/* Star button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onSetPrimary();
        }}
        className={[
          'absolute bottom-1 right-1 rounded-full p-1 transition-all',
          isPrimary
            ? 'text-warning bg-black/40 opacity-100'
            : 'text-white/70 bg-black/40 opacity-0 group-hover:opacity-100',
        ].join(' ')}
        title={isPrimary ? 'Primary image' : 'Set as primary'}
      >
        {isPrimary ? (
          <Star className="h-3.5 w-3.5 fill-yellow-500" />
        ) : (
          <StarOff className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

// ─── Preview Dialog ───────────────────────────────────────────────────────────

function ImagePreviewDialog({
  image,
  index,
  total,
  open,
  onClose,
}: {
  image: ProductImage | null;
  index: number;
  total: number;
  open: boolean;
  onClose: () => void;
}) {
  if (!image) return null;
  const src = typeof image === 'string' ? image : image.src;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Image {index + 1} of {total}
            {image.is_primary && (
              <Badge className="ml-2 text-xs">Primary</Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center bg-muted/50 rounded-lg overflow-hidden min-h-64 max-h-[60vh]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={`Product image ${index + 1}`}
            className="max-w-full max-h-[60vh] object-contain"
          />
        </div>
        <p className="text-xs text-muted-foreground break-all">{src}</p>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ImageGallery({ productId, images: initialImages, onImagesChange }: ImageGalleryProps) {
  const [images, setImages] = useState<ProductImage[]>(initialImages);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const normalizeImages = useCallback((imgs: ProductImage[]): ProductImage[] => {
    return imgs.map((img, i) => ({
      src: typeof img === 'string' ? img : img.src,
      position: i,
      is_primary: i === 0,
    }));
  }, []);

  function handleSetPrimary(index: number) {
    if (index === 0) return;
    const reordered = [
      images[index],
      ...images.slice(0, index),
      ...images.slice(index + 1),
    ];
    const normalized = normalizeImages(reordered);
    setImages(normalized);
    setIsDirty(true);
    onImagesChange?.(normalized);
  }

  function handleDragStart(index: number) {
    setDraggingIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  function handleDragEnd() {
    setDraggingIndex(null);
    setDragOverIndex(null);
  }

  function handleDrop(dropIndex: number) {
    if (draggingIndex === null || draggingIndex === dropIndex) {
      setDraggingIndex(null);
      setDragOverIndex(null);
      return;
    }
    const reordered = [...images];
    const [moved] = reordered.splice(draggingIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    const normalized = normalizeImages(reordered);
    setImages(normalized);
    setIsDirty(true);
    setDraggingIndex(null);
    setDragOverIndex(null);
    onImagesChange?.(normalized);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await adminFetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      });
      if (res.ok) {
        setIsDirty(false);
        toast.success('Image order saved');
      } else {
        toast.error('Failed to save image order');
      }
    } catch {
      toast.error('Failed to save image order');
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    const normalized = normalizeImages(initialImages);
    setImages(normalized);
    setIsDirty(false);
    onImagesChange?.(normalized);
  }

  if (images.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-sm font-medium text-muted-foreground">No images for this product</p>
        <p className="text-xs text-muted-foreground mt-1">Images are synced from Printful</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {images.length} image{images.length !== 1 ? 's' : ''} · Drag to reorder · Click star to set primary
        </p>
        {isDirty && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDiscard} disabled={saving}>
              <X className="h-3.5 w-3.5 mr-1" />
              Discard
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1" />
              )}
              Save Order
            </Button>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((image, idx) => (
          <ImageCard
            key={typeof image === 'string' ? `${image}-${idx}` : `${image.src}-${idx}`}
            image={image}
            index={idx}
            isPrimary={idx === 0 || Boolean(image.is_primary)}
            dragging={draggingIndex === idx}
            dragOver={dragOverIndex === idx}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
            onPreview={() => setPreviewIndex(idx)}
            onSetPrimary={() => handleSetPrimary(idx)}
          />
        ))}
      </div>

      {/* Preview Dialog */}
      <ImagePreviewDialog
        image={previewIndex !== null ? images[previewIndex] : null}
        index={previewIndex ?? 0}
        total={images.length}
        open={previewIndex !== null}
        onClose={() => setPreviewIndex(null)}
      />
    </div>
  );
}
