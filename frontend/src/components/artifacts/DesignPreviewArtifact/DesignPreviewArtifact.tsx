'use client'

/**
 * DesignPreviewArtifact - Renders AI-generated design preview
 *
 * Used by generate_design tool to show the generated artwork.
 * Features:
 * - Clickable image → fullscreen lightbox
 * - "Apply to Product" → sends message to chat (conversational flow)
 * - BG Remove → intelligent: hidden if already transparent
 * - Premium upsell badge for free users
 */

import { useTranslations } from 'next-intl'
import { Wand2, Download, Eraser, Paintbrush2, Maximize2, ShoppingBag } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import Image from 'next/image'
import { useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import { useLocale } from 'next-intl'
import Link from 'next/link'

export interface DesignPreviewArtifactProps {
  variant?: 'inline' | 'detail'
  imageUrl?: string
  prompt?: string
  style?: string
  designId?: string | null
  provider?: string
  bgRemovedUrl?: string | null
  onSendMessage?: (_text: string) => void
  onCustomize?: () => void
  onAddToProduct?: () => void
  onViewMockup?: (_mockupUrl: string) => void
}

export function DesignPreviewArtifact({
  variant = 'inline',
  imageUrl: initialImageUrl = '',
  prompt = '',
  style: _style = 'default',
  designId,
  provider: _provider,
  bgRemovedUrl,
  onSendMessage,
  onCustomize: _onCustomize,
  onAddToProduct,
  onViewMockup: _onViewMockup,
}: DesignPreviewArtifactProps) {
  const t = useTranslations('storefront')
  const locale = useLocale()
  const [removingBg, setRemovingBg] = useState(false)
  const [imageUrl, setImageUrl] = useState(bgRemovedUrl || initialImageUrl)
  const [bgRemoved, setBgRemoved] = useState(!!bgRemovedUrl)
  const [fullscreen, setFullscreen] = useState(false)

  const handleDownload = () => {
    if (imageUrl) {
      window.open(imageUrl, '_blank')
    }
  }

  const handleRemoveBg = async () => {
    if (!imageUrl || removingBg) return

    setRemovingBg(true)
    try {
      const response = await apiFetch('/api/designs/remove-bg', {
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

  const handleApplyToProduct = () => {
    if (onSendMessage) {
      // System command — AI responds in the user's locale, not in English
      onSendMessage(`[system:apply_design] designId=${designId || 'latest'}`)
    } else if (onAddToProduct) {
      onAddToProduct()
    }
  }

  return (
    <>
      <Card className={variant === 'inline' ? 'max-w-lg w-full' : 'max-w-2xl mx-auto w-full'}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Wand2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">
                  {t('designPreviewTitle')}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('designPreviewSubtitle')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {bgRemoved && (
                <Badge variant="outline" className="text-[10px]">
                  Transparent
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Design Image — clickable for fullscreen */}
          <button
            onClick={() => imageUrl && setFullscreen(true)}
            className={`relative aspect-square w-full overflow-hidden rounded-lg cursor-zoom-in group ${bgRemoved ? 'bg-[url(/checkerboard.svg)] bg-repeat bg-[length:20px_20px]' : 'bg-muted'}`}
          >
            {imageUrl ? (
              <>
                <Image
                  src={imageUrl}
                  alt={prompt || 'Generated design'}
                  fill
                  className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  sizes="(max-width: 768px) 100vw, 512px"
                />
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-background/80 backdrop-blur-sm rounded-full p-1.5">
                    <Maximize2 className="h-4 w-4 text-foreground" />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">{t('noImageAvailable')}</p>
              </div>
            )}
          </button>

          {/* Prompt Display */}
          {prompt && prompt !== 'custom design' && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                {t('prompt')}
              </p>
              <p className="text-xs text-foreground leading-relaxed line-clamp-2">{prompt}</p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-2 pt-0">
          <div className="flex gap-2 w-full">
            <Button
              onClick={handleDownload}
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={!imageUrl}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {t('designPreviewDownload')}
            </Button>
            {!bgRemoved && (
              <Button
                onClick={handleRemoveBg}
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={!imageUrl || removingBg}
              >
                <Eraser className="h-3.5 w-3.5 mr-1.5" />
                {removingBg ? t('generating') : 'Remove BG'}
              </Button>
            )}
          </div>
          <Button
            onClick={handleApplyToProduct}
            size="sm"
            className="w-full bg-primary hover:bg-primary/90"
            disabled={!imageUrl || (!onSendMessage && !onAddToProduct)}
          >
            <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />
            {t('designPreviewAddToProduct')}
          </Button>
          {designId && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              asChild
            >
              <Link href={`/${locale}/design/three-models?designId=${designId}`}>
                <Paintbrush2 className="h-3 w-3 mr-1.5" />
                {t('designPreviewEditInStudio')}
              </Link>
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Fullscreen Lightbox */}
      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-background/80 backdrop-blur-sm border-0">
          <div className="relative w-full h-[90vh] flex items-center justify-center p-4">
            <Image
              src={imageUrl}
              alt={prompt || 'Generated design'}
              fill
              className="object-contain rounded-lg"
              sizes="95vw"
              unoptimized
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
