'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { adminFetch } from '@/lib/admin-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Package, Grid3X3, ImageIcon, Search, ShieldCheck, ExternalLink,
} from 'lucide-react';
import { STORE_DOMAIN } from '@/lib/store-defaults';
import { VariantMatrix } from '@/components/products/VariantMatrix';
import { ImageGallery } from '@/components/products/ImageGallery';
import { ProductHealthScorecard } from '@/components/products/ProductHealthScorecard';
import { MarginCalculator } from '@/components/products/MarginCalculator';
import { MockupBadge } from '@/components/products/MockupBadge';
import { PrintfulSyncPanel } from '@/components/products/PrintfulSyncPanel';
import { Truck } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  title: string;
  description: string;
  base_price_cents: number;
  currency: string;
  category: string;
  status: string;
  pod_provider?: string | null;
  provider_product_id?: string | null;
  last_synced_at?: string | null;
  avg_base_cost_cents?: number;
  images?: Array<{ src: string; position?: number; is_primary?: boolean }> | null;
  // SEO
  slug?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  // GPSR
  gpsr_info?: {
    manufacturer_name?: string;
    manufacturer_address?: string;
    manufacturer_contact?: string;
    safety_warnings?: string;
    material_info?: string;
    brand?: string;
    care_instructions?: string;
    manufacturing_country?: string;
    age_restriction?: string;
  } | null;
}

// ─── Save Bar ────────────────────────────────────────────────────────────────

function SaveBar({
  isDirty,
  saving,
  onSave,
  onDiscard,
}: {
  isDirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  if (!isDirty) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm shadow-lg">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">You have unsaved changes</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onDiscard} disabled={saving}>
            Discard
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EditProductPage() {
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const originalProduct = useRef<Product | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    fetchProduct();
  }, [id]); // fetchProduct is stable (defined in component scope)

  async function fetchProduct() {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/products/${id}`);
      if (res.ok) {
        const data = await res.json();
        setProduct(data.product);
        originalProduct.current = data.product;
        setIsDirty(false);
      }
    } catch (error) {
      console.error('Failed to fetch product:', error);
    } finally {
      setLoading(false);
    }
  }

  const updateField = useCallback(
    (updates: Partial<Product>) => {
      setProduct((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, ...updates };
        setIsDirty(JSON.stringify(updated) !== JSON.stringify(originalProduct.current));
        return updated;
      });
    },
    []
  );

  const updateGpsr = useCallback((key: string, value: string) => {
    setProduct((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        gpsr_info: { ...(prev.gpsr_info ?? {}), [key]: value },
      };
      setIsDirty(JSON.stringify(updated) !== JSON.stringify(originalProduct.current));
      return updated;
    });
  }, []);

  const handleSave = async () => {
    if (!product) return;
    setSaving(true);
    try {
      const res = await adminFetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: product.title,
          description: product.description,
          base_price_cents: product.base_price_cents,
          currency: product.currency,
          category: product.category,
          status: product.status,
          slug: product.slug || null,
          meta_title: product.meta_title || null,
          meta_description: product.meta_description || null,
          gpsr_info: product.gpsr_info || {},
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setProduct(data.product);
        originalProduct.current = data.product;
        setIsDirty(false);
        toast.success('Product saved successfully');
      } else {
        toast.error('Failed to save product');
      }
    } catch {
      toast.error('Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (originalProduct.current) {
      setProduct(originalProduct.current);
      setIsDirty(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="h-8 w-48 bg-muted rounded animate-pulse mb-6" />
          <div className="h-12 bg-muted rounded animate-pulse mb-4" />
          <div className="h-64 bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-destructive">Product not found</p>
        </div>
      </div>
    );
  }

  const images = Array.isArray(product.images) ? product.images : [];

  return (
    <div className="p-4 md:p-8 pb-24">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Edit Product</h1>
            <p className="text-muted-foreground text-sm font-mono mt-0.5">{product.id}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={product.status === 'active' ? 'default' : 'secondary'} className="capitalize">
              {product.status}
            </Badge>
            <MockupBadge productId={id} />
            {product.pod_provider === 'printful' && product.provider_product_id && (
              <a
                href={`https://www.printful.com/dashboard/sync/products/${product.provider_product_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="gap-1">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Printful
                </Button>
              </a>
            )}
          </div>
        </div>

        {/* Health Scorecard */}
        <ProductHealthScorecard productId={id} currency={product.currency?.toUpperCase() ?? 'EUR'} />

        {/* Tabs */}
        <Tabs defaultValue="general" className="space-y-4">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="general" className="flex items-center gap-1 text-xs sm:text-sm">
              <Package className="h-3.5 w-3.5 hidden sm:block" />
              General
            </TabsTrigger>
            <TabsTrigger value="variants" className="flex items-center gap-1 text-xs sm:text-sm">
              <Grid3X3 className="h-3.5 w-3.5 hidden sm:block" />
              Variants
            </TabsTrigger>
            <TabsTrigger value="images" className="flex items-center gap-1 text-xs sm:text-sm">
              <ImageIcon className="h-3.5 w-3.5 hidden sm:block" />
              Images
            </TabsTrigger>
            <TabsTrigger value="seo" className="flex items-center gap-1 text-xs sm:text-sm">
              <Search className="h-3.5 w-3.5 hidden sm:block" />
              SEO
            </TabsTrigger>
            <TabsTrigger value="gpsr" className="flex items-center gap-1 text-xs sm:text-sm">
              <ShieldCheck className="h-3.5 w-3.5 hidden sm:block" />
              GPSR
            </TabsTrigger>
            <TabsTrigger value="provider" className="flex items-center gap-1 text-xs sm:text-sm">
              <Truck className="h-3.5 w-3.5 hidden sm:block" />
              Provider
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Product Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={product.title}
                    onChange={(e) => updateField({ title: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    rows={4}
                    value={product.description || ''}
                    onChange={(e) => updateField({ description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price">Price ({product.currency.toUpperCase()})</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={(product.base_price_cents / 100).toFixed(2)}
                      onChange={(e) => updateField({ base_price_cents: Math.round(parseFloat(e.target.value) * 100) || 0 })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                      value={product.currency.toUpperCase()}
                      onValueChange={(v) => updateField({ currency: v })}
                    >
                      <SelectTrigger id="currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      value={product.category || ''}
                      onChange={(e) => updateField({ category: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={product.status}
                      onValueChange={(v) => updateField({ status: v })}
                    >
                      <SelectTrigger id="status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Margin Calculator */}
                {product.base_price_cents > 0 && (
                  <MarginCalculator
                    retailPriceCents={product.base_price_cents}
                    avgBaseCostCents={product.avg_base_cost_cents ?? 0}
                    currency={product.currency?.toUpperCase() ?? 'EUR'}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Variants Tab */}
          <TabsContent value="variants" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Variant Matrix</CardTitle>
              </CardHeader>
              <CardContent>
                <VariantMatrix productId={id} currency={product.currency?.toUpperCase() ?? 'EUR'} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Images Tab */}
          <TabsContent value="images" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Product Images</CardTitle>
              </CardHeader>
              <CardContent>
                <ImageGallery
                  productId={id}
                  images={images}
                  onImagesChange={(updated) => updateField({ images: updated })}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* SEO Tab */}
          <TabsContent value="seo" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Search Engine Optimisation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="slug">URL Slug</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground shrink-0">/en/shop/products/</span>
                    <Input
                      id="slug"
                      placeholder="my-product-name"
                      value={product.slug || ''}
                      onChange={(e) => updateField({ slug: e.target.value || null })}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave blank to auto-generate from title
                  </p>
                </div>
                <div>
                  <Label htmlFor="meta_title">Meta Title</Label>
                  <Input
                    id="meta_title"
                    placeholder={product.title}
                    value={product.meta_title || ''}
                    onChange={(e) => updateField({ meta_title: e.target.value || null })}
                    maxLength={200}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {(product.meta_title || '').length}/200 characters · Recommended: 50–60
                  </p>
                </div>
                <div>
                  <Label htmlFor="meta_description">Meta Description</Label>
                  <Textarea
                    id="meta_description"
                    rows={3}
                    placeholder={product.description?.substring(0, 160) || 'Product description for search engines'}
                    value={product.meta_description || ''}
                    onChange={(e) => updateField({ meta_description: e.target.value || null })}
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {(product.meta_description || '').length}/500 characters · Recommended: 120–160
                  </p>
                </div>
                {/* Preview */}
                <div className="rounded-lg border border-border p-4 bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Search Preview</p>
                  <p className="text-base text-primary dark:text-primary font-medium truncate">
                    {product.meta_title || product.title}
                  </p>
                  <p className="text-xs text-success dark:text-success truncate">
                    {STORE_DOMAIN}/en/shop/products/{product.slug || '[auto-generated]'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {product.meta_description || product.description || 'No description provided.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* GPSR Tab */}
          <TabsContent value="gpsr" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle>GPSR — General Product Safety Regulation</CardTitle>
                  {(() => {
                    const g = product.gpsr_info ?? {};
                    const required = [
                      { key: 'manufacturer_name', label: 'Manufacturer name' },
                      { key: 'manufacturer_address', label: 'Manufacturer address' },
                      { key: 'manufacturer_contact', label: 'Contact details' },
                      { key: 'safety_warnings', label: 'Safety warnings' },
                      { key: 'material_info', label: 'Material info' },
                    ] as const;
                    const missing = required.filter((f) => !g[f.key]?.trim());
                    const complete = missing.length === 0;
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={complete ? 'default' : 'destructive'} className="text-xs">
                          {complete ? '✓ GPSR Complete' : `Incomplete (${missing.length} missing)`}
                        </Badge>
                        {!complete && (
                          <div className="flex flex-wrap gap-1">
                            {missing.map((f) => (
                              <Badge key={f.key} variant="outline" className="text-xs py-0">
                                {f.label}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
                  EU GPSR (effective Dec 13, 2024) requires manufacturer and safety information for all products sold to EU consumers.
                </div>
                <div>
                  <Label htmlFor="manufacturer_name">Manufacturer / Responsible Person</Label>
                  <Input
                    id="manufacturer_name"
                    placeholder="Company name"
                    value={product.gpsr_info?.manufacturer_name || ''}
                    onChange={(e) => updateGpsr('manufacturer_name', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="manufacturer_address">Manufacturer Address</Label>
                  <Textarea
                    id="manufacturer_address"
                    rows={2}
                    placeholder="Street, City, Country"
                    value={product.gpsr_info?.manufacturer_address || ''}
                    onChange={(e) => updateGpsr('manufacturer_address', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="manufacturer_contact">Contact (email or URL)</Label>
                  <Input
                    id="manufacturer_contact"
                    placeholder="safety@example.com or https://example.com/safety"
                    value={product.gpsr_info?.manufacturer_contact || ''}
                    onChange={(e) => updateGpsr('manufacturer_contact', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="safety_warnings">Safety Warnings</Label>
                  <Textarea
                    id="safety_warnings"
                    rows={3}
                    placeholder="e.g. Keep away from children under 3 years. Not suitable for..."
                    value={product.gpsr_info?.safety_warnings || ''}
                    onChange={(e) => updateGpsr('safety_warnings', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="material_info">Material / Composition</Label>
                    <Input
                      id="material_info"
                      placeholder="e.g. 100% organic cotton"
                      value={product.gpsr_info?.material_info || ''}
                      onChange={(e) => updateGpsr('material_info', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="brand">Brand</Label>
                    <Input
                      id="brand"
                      placeholder="e.g. My Store"
                      value={product.gpsr_info?.brand || ''}
                      onChange={(e) => updateGpsr('brand', e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="care_instructions">Care Instructions</Label>
                    <Input
                      id="care_instructions"
                      placeholder="e.g. Machine wash cold, tumble dry low"
                      value={product.gpsr_info?.care_instructions || ''}
                      onChange={(e) => updateGpsr('care_instructions', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="manufacturing_country">Country of Manufacturing</Label>
                    <Input
                      id="manufacturing_country"
                      placeholder="e.g. Latvia, Germany"
                      value={product.gpsr_info?.manufacturing_country || ''}
                      onChange={(e) => updateGpsr('manufacturing_country', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="age_restriction">Age Restriction (optional)</Label>
                  <Input
                    id="age_restriction"
                    placeholder="e.g. 14+ years"
                    value={product.gpsr_info?.age_restriction || ''}
                    onChange={(e) => updateGpsr('age_restriction', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Provider (Printful) Tab */}
          <TabsContent value="provider" className="space-y-4">
            <PrintfulSyncPanel
              productId={id}
              providerProductId={product.provider_product_id ?? null}
              lastSyncedAt={product.last_synced_at ?? null}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Sticky Save Bar */}
      <SaveBar
        isDirty={isDirty}
        saving={saving}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </div>
  );
}
