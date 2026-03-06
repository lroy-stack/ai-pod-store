'use client'

/**
 * ProductMockupArtifact - Renders product mockup with AI design overlay
 *
 * Used by generate_design and customize_design tools to show
 * the design applied to a physical product
 */

import { useTranslations } from 'next-intl'
import { Shirt, ShoppingCart, Download } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'

export interface ProductMockupArtifactProps {
  variant?: 'inline' | 'detail'
  mockupUrl?: string
  designUrl?: string
  productType?: string
  productName?: string
  onAddToCart?: () => void
}

export function ProductMockupArtifact({
  variant = 'inline',
  mockupUrl = '',
  designUrl = '',
  productType = 'tshirt',
  productName,
  onAddToCart,
}: ProductMockupArtifactProps) {
  const t = useTranslations('storefront')

  const productTypeLabels: Record<string, string> = {
    tshirt: 'T-Shirt',
    hoodie: 'Hoodie',
    mug: 'Mug',
    'phone-case': 'Phone Case',
    'tote-bag': 'Tote Bag',
  }

  const displayName = productName || productTypeLabels[productType] || 'Product'

  const handleDownload = () => {
    if (mockupUrl) {
      window.open(mockupUrl, '_blank')
    }
  }

  return (
    <Card className={variant === 'inline' ? 'max-w-lg' : 'max-w-2xl mx-auto'}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Shirt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {t('productMockupTitle')}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {displayName}
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="capitalize">
            {productType.replace('-', ' ')}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Mockup Image with Design Overlay */}
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
          {mockupUrl ? (
            <div className="relative h-full w-full">
              {/* Product template (background) */}
              <Image
                src={mockupUrl.split('&overlay=')[0]}
                alt={`${displayName} mockup`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 512px"
              />
              {/* Design overlay (foreground) */}
              {designUrl && (
                <div className="absolute inset-0 flex items-center justify-center p-12">
                  <div className="relative w-full h-full max-w-[60%] max-h-[60%]">
                    <Image
                      src={designUrl}
                      alt="Design overlay"
                      fill
                      className="object-contain"
                      sizes="(max-width: 768px) 60vw, 300px"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">{t('noMockupAvailable')}</p>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t('productType')}
          </p>
          <p className="text-sm text-foreground capitalize">
            {productType.replace('-', ' ')}
          </p>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={handleDownload}
          variant="outline"
          className="w-full sm:flex-1 neu-btn-soft"
          disabled={!mockupUrl}
        >
          <Download className="h-4 w-4 mr-2" />
          {t('mockupDownload')}
        </Button>
        <Button
          onClick={onAddToCart}
          className="w-full sm:flex-1 bg-primary hover:bg-primary/90 neu-btn-accent"
          disabled={!mockupUrl || !onAddToCart}
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          {t('mockupAddToCart')}
        </Button>
      </CardFooter>
    </Card>
  )
}
