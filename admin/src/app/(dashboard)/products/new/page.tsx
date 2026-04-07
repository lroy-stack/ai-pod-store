'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ProductTypeSelector, type ProductType } from '@/components/products/ProductTypeSelector';
import { ProductBasicFields } from '@/components/products/ProductBasicFields';
import { PhysicalProductFields } from '@/components/products/PhysicalProductFields';
import { DigitalProductFields } from '@/components/products/DigitalProductFields';
import { GpsrFields } from '@/components/products/GpsrFields';
import { SeoFields } from '@/components/products/SeoFields';

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [productType, setProductType] = useState<ProductType>('pod');
  const [fields, setFields] = useState({
    title: '',
    description: '',
    price_eur: '',
    currency: 'EUR',
    category: 'apparel',
    seo_title: '',
    seo_description: '',
    material: '',
    care_instructions: '',
    print_technique: 'dtg',
    manufacturing_country: 'LV',
    sku: '',
    stock_quantity: '',
    shipping_weight: '',
    max_downloads: '5',
  });
  const [trackInventory, setTrackInventory] = useState(false);

  function updateField(field: string, value: string) {
    setFields(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => { const next = { ...prev }; delete next[field]; return next; });
    }
  }

  function handleTypeChange(type: ProductType) {
    if (type === 'pod') {
      router.push('/products/new-pod');
      return;
    }
    setProductType(type);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!fields.title.trim()) e.title = 'Title is required';
    const price = parseFloat(fields.price_eur);
    if (!fields.price_eur || isNaN(price) || price < 0.01) e.price_eur = 'Price must be at least 0.01';
    if (productType === 'physical' && !fields.material.trim()) e.material = 'Material required (GPSR)';
    if (productType === 'physical' && !fields.care_instructions.trim()) e.care_instructions = 'Care instructions required (GPSR)';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) { toast.error('Please fix validation errors'); return; }
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        product_type: productType,
        title: fields.title,
        description: fields.description,
        base_price_cents: Math.round(parseFloat(fields.price_eur) * 100),
        currency: fields.currency,
        category: fields.category,
        seo_title: fields.seo_title || undefined,
        seo_description: fields.seo_description || undefined,
        track_inventory: trackInventory,
      };

      if (productType === 'physical') {
        body.product_details = {
          brand: process.env.NEXT_PUBLIC_STORE_NAME || (process.env.NEXT_PUBLIC_SITE_NAME || 'My Store'),
          manufacturer: process.env.NEXT_PUBLIC_STORE_MANUFACTURER || process.env.STORE_COMPANY_NAME || 'Your Company Name',
          manufacturing_country: fields.manufacturing_country,
          safety_information: 'Conforms to EU Regulation 2023/988 (GPSR)',
          material: fields.material,
          care_instructions: fields.care_instructions,
          print_technique: fields.print_technique,
        };
      }

      const res = await adminFetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success('Product created');
        router.push(`/products/${data.product?.id || ''}`);
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || 'Failed to create product');
      }
    } catch {
      toast.error('Failed to create product');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Create Product</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <ProductTypeSelector value={productType} onChange={handleTypeChange} />

          <ProductBasicFields
            title={fields.title}
            description={fields.description}
            priceEur={fields.price_eur}
            currency={fields.currency}
            category={fields.category}
            errors={errors}
            onFieldChange={updateField}
          />

          {productType === 'physical' && (
            <>
              <PhysicalProductFields
                sku={fields.sku}
                stockQuantity={fields.stock_quantity}
                weight={fields.shipping_weight}
                trackInventory={trackInventory}
                onFieldChange={updateField}
                onToggleInventory={setTrackInventory}
              />
              <GpsrFields
                material={fields.material}
                careInstructions={fields.care_instructions}
                printTechnique={fields.print_technique}
                manufacturingCountry={fields.manufacturing_country}
                errors={errors}
                onFieldChange={updateField}
              />
            </>
          )}

          {productType === 'digital' && (
            <DigitalProductFields
              maxDownloads={fields.max_downloads}
              onFieldChange={updateField}
            />
          )}

          <SeoFields
            seoTitle={fields.seo_title}
            seoDescription={fields.seo_description}
            onFieldChange={updateField}
          />

          <Separator />

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Product'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push('/products')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
