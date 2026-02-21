'use client'

/**
 * PersonalizationSuggestionsArtifact — Renders AI-suggested personalization text
 *
 * Displayed when the `personalize_product` tool returns suggestions.
 * Shows product image, clickable suggestion chips, and a custom text input.
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Paintbrush, Type } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import Image from 'next/image'

export interface PersonalizationSuggestionsArtifactProps {
  variant?: 'inline' | 'detail'
  productId?: string
  productTitle?: string
  productImage?: string | null
  category?: string
  suggestions?: string[]
  recommendedFont?: string
  recommendedPosition?: 'top' | 'center' | 'bottom'
  success?: boolean
  error?: string
}

export function PersonalizationSuggestionsArtifact({
  variant = 'inline',
  productTitle = '',
  productImage,
  category = '',
  suggestions = [],
  recommendedFont = 'Inter',
  recommendedPosition = 'bottom',
}: PersonalizationSuggestionsArtifactProps) {
  const t = useTranslations('product')
  const [selectedText, setSelectedText] = useState<string | null>(null)
  const [customText, setCustomText] = useState('')

  const activeText = selectedText || customText

  // CSS position mapping for preview
  const positionCss = {
    top: '15%',
    center: '45%',
    bottom: '78%',
  }

  return (
    <Card className={variant === 'inline' ? 'max-w-lg' : 'max-w-2xl mx-auto'}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Paintbrush className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {t('personalize')}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {productTitle}
              </p>
            </div>
          </div>
          {category && (
            <Badge variant="secondary" className="capitalize text-xs">
              {category}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Product image with text preview */}
        <div className="relative aspect-square w-full max-w-[280px] mx-auto overflow-hidden rounded-lg bg-muted">
          {productImage ? (
            <Image
              src={productImage}
              alt={productTitle}
              fill
              className="object-cover"
              sizes="280px"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              {productTitle}
            </div>
          )}
          {/* Text overlay preview */}
          {activeText && (
            <div
              className="absolute left-[10%] right-[10%] text-center pointer-events-none drop-shadow-sm"
              style={{
                top: positionCss[recommendedPosition],
                fontFamily: recommendedFont,
                color: 'var(--color-foreground)',
                fontSize: 'clamp(10px, 3vw, 16px)',
                lineHeight: 1.2,
                wordBreak: 'break-word',
                transform: 'translateY(-50%)',
              }}
            >
              {activeText}
            </div>
          )}
        </div>

        {/* Suggestion chips */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Suggestions
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <Button
                key={suggestion}
                variant={selectedText === suggestion ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setSelectedText(selectedText === suggestion ? null : suggestion)
                  setCustomText('')
                }}
              >
                <Type className="size-3" />
                {suggestion}
              </Button>
            ))}
          </div>
        </div>

        {/* Custom text input */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t('personalizeText')}
          </p>
          <Input
            placeholder={t('personalizeTextPlaceholder')}
            value={customText}
            onChange={(e) => {
              setCustomText(e.target.value)
              setSelectedText(null)
            }}
            maxLength={50}
          />
        </div>
      </CardContent>

      <CardFooter>
        <Button
          className="w-full"
          disabled={!activeText}
        >
          <Paintbrush className="h-4 w-4 mr-2" />
          {t('personalize')}
        </Button>
      </CardFooter>
    </Card>
  )
}
