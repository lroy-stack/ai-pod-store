'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { adminFetch } from '@/lib/admin-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { CatalogBrowser } from '@/components/products/CatalogBrowser';
import { VariantSelector, type SelectedVariant } from '@/components/products/VariantSelector';
import { DesignUploader } from '@/components/products/DesignUploader';

const STEPS = ['Select Product', 'Choose Variants', 'Upload Design', 'Review & Create'];

interface UploadedFile {
  id: number;
  url: string;
  filename: string;
  preview_url: string;
}

export default function NewPodProductPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Step 1: Selected catalog product
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // Step 2: Selected variants
  const [selectedVariants, setSelectedVariants] = useState<SelectedVariant[]>([]);

  // Step 3: Uploaded designs
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ file: UploadedFile; placement: string }>>([]);

  // Step 4: Product details
  const [productName, setProductName] = useState('');
  const [material, setMaterial] = useState('');
  const [careInstructions, setCareInstructions] = useState('');

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await adminFetch('/api/printful/products', {
        method: 'POST',
        body: JSON.stringify({
          name: productName || selectedProduct?.title || 'New Product',
          variants: selectedVariants.map(v => ({
            variant_id: v.variant_id,
            retail_price: v.retail_price,
            files: uploadedFiles.map(uf => ({
              placement: uf.placement,
              url: uf.file.url,
            })),
          })),
          gpsr: {
            material: material || 'See product label',
            care_instructions: careInstructions || 'See product label',
            print_technique: 'dtg',
            manufacturing_country: 'LV',
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Failed to create product');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Product created with ${data.variants_synced} variants`);
      router.push('/products');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Creation failed');
    },
  });

  function handleProductSelect(product: any) {
    setSelectedProduct(product);
    setProductName(product.title || '');
    setStep(1);
  }

  function handleFileUploaded(file: UploadedFile, placement: string) {
    setUploadedFiles(prev => [...prev, { file, placement }]);
  }

  const canProceed = [
    !!selectedProduct,
    selectedVariants.length > 0,
    true, // Design upload is optional
    !!productName && selectedVariants.length > 0,
  ];

  const totalCost = selectedVariants.reduce((sum, v) => sum + parseFloat(v.cost), 0);
  const totalRevenue = selectedVariants.reduce((sum, v) => sum + parseFloat(v.retail_price), 0);

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Create POD Product</h1>
          <p className="text-muted-foreground">Create a product from Printful catalog</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/products')}>Cancel</Button>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
                i === step
                  ? 'bg-primary text-primary-foreground'
                  : i < step
                  ? 'bg-primary/20 text-primary cursor-pointer'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : <><span className="md:hidden">{i + 1}/{STEPS.length}</span><span className="hidden md:inline">{i + 1}</span></>}
              <span className="hidden md:inline">{label}</span>
            </button>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {step === 0 && (
        <CatalogBrowser onSelect={handleProductSelect} />
      )}

      {step === 1 && selectedProduct && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <img src={selectedProduct.image} alt={selectedProduct.title || 'Product'} className="h-12 w-12 rounded object-contain bg-muted" />
            <div>
              <h2 className="font-semibold">{selectedProduct.title}</h2>
              <Badge variant="outline">{selectedProduct.type_name}</Badge>
            </div>
          </div>
          <VariantSelector
            catalogProductId={selectedProduct.id}
            onVariantsChange={setSelectedVariants}
          />
        </div>
      )}

      {step === 2 && (
        <DesignUploader
          onFileUploaded={handleFileUploaded}
          uploadedFiles={uploadedFiles}
        />
      )}

      {step === 3 && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Product Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Product Name *</Label>
                <Input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="My Custom Product"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Material (GPSR)</Label>
                  <Input
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    placeholder="100% organic cotton"
                  />
                </div>
                <div>
                  <Label>Care Instructions (GPSR)</Label>
                  <Input
                    value={careInstructions}
                    onChange={(e) => setCareInstructions(e.target.value)}
                    placeholder="Machine wash cold"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Blueprint</p>
                  <p className="font-medium">{selectedProduct?.title}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Variants</p>
                  <p className="font-medium">{selectedVariants.length} selected</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Designs</p>
                  <p className="font-medium">{uploadedFiles.length} uploaded</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Avg. Margin</p>
                  <p className="font-medium">
                    {totalRevenue > 0 ? ((1 - totalCost / totalRevenue) * 100).toFixed(0) : 0}%
                  </p>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="space-y-1 text-sm">
                {selectedVariants.slice(0, 5).map((v) => (
                  <div key={v.variant_id} className="flex justify-between">
                    <span className="text-muted-foreground">{v.name}</span>
                    <span>Cost {v.cost} → Retail {v.retail_price} EUR</span>
                  </div>
                ))}
                {selectedVariants.length > 5 && (
                  <p className="text-muted-foreground">...and {selectedVariants.length - 5} more</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <Button
          variant="outline"
          onClick={() => setStep(step - 1)}
          disabled={step === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {step < 3 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed[step]}
          >
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !canProceed[3]}
          >
            {createMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</>
            ) : (
              <><Check className="h-4 w-4 mr-2" />Create Product</>
            )}
          </Button>
        )}
      </div>
    </main>
  );
}
