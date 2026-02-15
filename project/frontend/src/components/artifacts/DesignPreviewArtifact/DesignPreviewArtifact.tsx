'use client'

/**
 * DesignPreviewArtifact - Renders AI-generated design preview
 *
 * Used by generate_design tool to show the generated artwork
 * Displays the image with prompt info and customization options
 */

import { useTranslations } from 'next-intl'
import { Sparkles, Download, ShoppingCart, Shirt, Eraser } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'
import { useState } from 'react'

export interface DesignPreviewArtifactProps {
  variant?: 'inline' | 'detail'
  imageUrl?: string
  prompt?: string
  style?: string
  designId?: string | null
  provider?: string
  onCustomize?: () => void
  onAddToProduct?: () => void
  onViewMockup?: (mockupUrl: string) => void
}

export function DesignPreviewArtifact({
  variant = 'inline',
  imageUrl: initialImageUrl = '',
  prompt = '',
  style = 'default',
  designId,
  provider,
  onCustomize,
  onAddToProduct,
  onViewMockup,
}: DesignPreviewArtifactProps) {
  const t = useTranslations('storefront')
  const [generatingMockup, setGeneratingMockup] = useState(false)
  const [removingBg, setRemovingBg] = useState(false)
  const [imageUrl, setImageUrl] = useState(initialImageUrl)
  const [bgRemoved, setBgRemoved] = useState(false)

  const handleDownload = () => {
    if (imageUrl) {
      window.open(imageUrl, '_blank')
    }
  }

  const handleRemoveBg = async () => {
    if (!imageUrl || removingBg) return

    setRemovingBg(true)
    try {
      const response = await fetch('/api/designs/remove-bg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          designId: designId || undefined,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.imageUrl) {
          setImageUrl(data.imageUrl)
          setBgRemoved(true)
        }
      }
    } catch (error) {
      console.error('Failed to remove background:', error)
    } finally {
      setRemovingBg(false)
    }
  }

  const handleViewMockup = async () => {
    if (!imageUrl || !onViewMockup) return

    setGeneratingMockup(true)
    try {
      const response = await fetch('/api/designs/mockup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designUrl: imageUrl,
          productType: 'tshirt',
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.mockupUrl) {
          onViewMockup(data.mockupUrl)
        }
      }
    } catch (error) {
      console.error('Failed to generate mockup:', error)
    } finally {
      setGeneratingMockup(false)
    }
  }

  return (
    <Card className={variant === 'inline' ? 'max-w-lg' : 'max-w-2xl mx-auto'}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {t('designPreviewTitle')}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t('designPreviewSubtitle')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {bgRemoved && (
              <Badge variant="outline" className="text-xs">
                Transparent
              </Badge>
            )}
            {provider && provider !== 'placeholder' && (
              <Badge variant="secondary" className="text-xs">
                {provider}
              </Badge>
            )}
            {style && style !== 'default' && (
              <Badge variant="secondary" className="capitalize">
                {style}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Design Image */}
        <div className={`relative aspect-square w-full overflow-hidden rounded-lg ${bgRemoved ? 'bg-[url(/checkerboard.svg)] bg-repeat bg-[length:20px_20px]' : 'bg-muted'}`}>
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={prompt || 'Generated design'}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 512px"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">{t('noImageAvailable')}</p>
            </div>
          )}
        </div>

        {/* Prompt Display */}
        {prompt && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('prompt')}
            </p>
            <p className="text-sm text-foreground leading-relaxed">{prompt}</p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row w-full">
          <Button
            onClick={handleDownload}
            variant="outline"
            className="w-full sm:flex-1"
            disabled={!imageUrl}
          >
            <Download className="h-4 w-4 mr-2" />
            {t('designPreviewDownload')}
          </Button>
          <Button
            onClick={handleRemoveBg}
            variant="outline"
            className="w-full sm:flex-1"
            disabled={!imageUrl || removingBg || bgRemoved}
          >
            <Eraser className="h-4 w-4 mr-2" />
            {removingBg ? t('generating') : bgRemoved ? 'BG Removed' : 'Remove BG'}
          </Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row w-full">
          <Button
            onClick={handleViewMockup}
            variant="outline"
            className="w-full sm:flex-1"
            disabled={!imageUrl || !onViewMockup || generatingMockup}
          >
            <Shirt className="h-4 w-4 mr-2" />
            {generatingMockup ? t('generating') : t('designPreviewViewMockup')}
          </Button>
          <Button
            onClick={onAddToProduct}
            className="w-full sm:flex-1 bg-primary hover:bg-primary/90"
            disabled={!imageUrl || !onAddToProduct}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            {t('designPreviewAddToProduct')}
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
