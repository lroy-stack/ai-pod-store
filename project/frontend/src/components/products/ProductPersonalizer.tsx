'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Paintbrush, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, X, Zap, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getPreviewZone } from '@/lib/print-areas'
import { containsProfanity, getProfanityErrorMessage } from '@/lib/profanity-filter'

const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Oswald', label: 'Oswald' },
  { value: 'Lato', label: 'Lato' },
]

export interface PersonalizationData {
  text: string
  font: string
  fontColor: string
  fontSize: 'small' | 'medium' | 'large'
  position: 'top' | 'center' | 'bottom'
  surcharge?: number | null
}

/** CSS top% → Printify y-coordinate mapping */
export const POSITION_MAP = { top: 0.15, center: 0.50, bottom: 0.85 } as const
/** fontSize preset → Printify font_size mapping */
export const SIZE_MAP = { small: 16, medium: 24, large: 36 } as const

/** CSS font-size for preview overlay (relative to print area height) */
const CSS_SIZE_MAP = { small: 'clamp(7px, 1.8vw, 11px)', medium: 'clamp(9px, 2.5vw, 14px)', large: 'clamp(12px, 3.5vw, 20px)' } as const

interface ProductPersonalizerProps {
  productId: string
  productTitle: string
  productImage?: string
  /** Product category (e.g. "bags", "mugs") — used to determine print area */
  category?: string
  onPersonalized?: (data: PersonalizationData) => void
  onClear?: () => void
  /** Pre-fill values (e.g. from chat suggestions) */
  initialData?: Partial<PersonalizationData>
  /** Render as icon-only button (for compact layouts like DetailPanel footer) */
  iconOnly?: boolean
}

export function ProductPersonalizer({
  productId,
  productTitle,
  productImage,
  category,
  onPersonalized,
  onClear,
  initialData,
  iconOnly = false,
}: ProductPersonalizerProps) {
  const t = useTranslations('product')
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(initialData?.text || '')
  const [font, setFont] = useState(initialData?.font || 'Inter')
  const [fontColor, setFontColor] = useState(initialData?.fontColor || '#000000')
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>(initialData?.fontSize || 'medium')
  const [position, setPosition] = useState<'top' | 'center' | 'bottom'>(initialData?.position || 'bottom')

  // Personalization surcharge state
  const [surcharge, setSurcharge] = useState<number | null>(null)
  const [isFetchingSurcharge, setIsFetchingSurcharge] = useState(false)

  // Preview mode: 'quick' (CSS overlay, instant) or 'accurate' (server mockup, 1-2s)
  const [previewMode, setPreviewMode] = useState<'quick' | 'accurate'>('quick')
  const [serverPreview, setServerPreview] = useState<string | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  // Debounced preview state (updates 500ms after user stops typing)
  const [debouncedText, setDebouncedText] = useState(text)
  const [debouncedFont, setDebouncedFont] = useState(font)
  const [debouncedFontColor, setDebouncedFontColor] = useState(fontColor)
  const [debouncedFontSize, setDebouncedFontSize] = useState(fontSize)
  const [debouncedPosition, setDebouncedPosition] = useState(position)

  // Debounce preview updates (500ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedText(text)
      setDebouncedFont(font)
      setDebouncedFontColor(fontColor)
      setDebouncedFontSize(fontSize)
      setDebouncedPosition(position)
    }, 500)

    return () => clearTimeout(timer)
  }, [text, font, fontColor, fontSize, position])

  // Fetch personalization surcharge when dialog opens
  useEffect(() => {
    if (!open) return

    const fetchSurcharge = async () => {
      setIsFetchingSurcharge(true)
      try {
        const response = await fetch('/api/storefront/personalization-surcharge')
        if (response.ok) {
          const data = await response.json()
          setSurcharge(data.surcharge)
        }
      } catch (error) {
        console.error('Error fetching surcharge:', error)
      } finally {
        setIsFetchingSurcharge(false)
      }
    }

    fetchSurcharge()
  }, [open])

  // Fetch server-generated preview when in 'accurate' mode
  useEffect(() => {
    // Only fetch if in accurate mode, dialog is open, and there's text
    if (previewMode !== 'accurate' || !open || !debouncedText.trim()) {
      setServerPreview(null)
      return
    }

    const fetchServerPreview = async () => {
      setIsLoadingPreview(true)
      try {
        // Map productType and color from category
        const productType = category === 'bags' ? 'tote-bag' : 'tshirt'
        const color = category === 'bags' ? 'natural' : 'white'

        const response = await fetch('/api/designs/preview-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productType,
            color,
            text: debouncedText,
            font: debouncedFont,
            fontColor: debouncedFontColor,
            fontSize: SIZE_MAP[debouncedFontSize],
            position: debouncedPosition,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to generate preview')
        }

        const data = await response.json()
        setServerPreview(data.preview)
      } catch (error) {
        console.error('Error fetching server preview:', error)
        toast.error('Failed to generate accurate preview')
        setPreviewMode('quick') // Fall back to quick mode
      } finally {
        setIsLoadingPreview(false)
      }
    }

    fetchServerPreview()
  }, [previewMode, open, debouncedText, debouncedFont, debouncedFontColor, debouncedFontSize, debouncedPosition, category])

  // Get the CSS preview zone calibrated for real product photos
  const previewZone = useMemo(() => getPreviewZone(category), [category])

  const handleApply = () => {
    if (!text.trim()) {
      toast.error(t('personalizeRequired'))
      return
    }

    // Final profanity check before submission
    if (containsProfanity(text)) {
      toast.error(getProfanityErrorMessage())
      return
    }

    const data: PersonalizationData = {
      text: text.trim(),
      font,
      fontColor,
      fontSize,
      position,
      surcharge,
    }
    onPersonalized?.(data)
    setOpen(false)
    toast.success(t('personalizeSuccess'))
  }

  const handleClear = () => {
    setText('')
    setFont('Inter')
    setFontColor('#000000')
    setFontSize('medium')
    setPosition('bottom')
    onClear?.()
    setOpen(false)
  }

  const hasText = text.trim().length > 0
  const hasDebouncedText = debouncedText.trim().length > 0

  // Helper to get line counts and validate multi-line input
  const getLineInfo = (value: string) => {
    const lines = value.split('\n')
    return {
      lineCount: lines.length,
      lines,
      isValid: lines.length <= 3 && lines.every((line) => line.length <= 50),
    }
  }

  const lineInfo = getLineInfo(text)

  const handleTextChange = (value: string) => {
    const info = getLineInfo(value)

    // Check for profanity first
    if (containsProfanity(value)) {
      toast.error(getProfanityErrorMessage())
      return
    }

    // Block if more than 3 lines
    if (info.lineCount > 3) {
      toast.error('Maximum 3 lines allowed')
      return
    }

    // Block if any line exceeds 50 characters
    if (info.lines.some((line) => line.length > 50)) {
      toast.error('Maximum 50 characters per line')
      return
    }

    setText(value)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {iconOnly ? (
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 flex-shrink-0 rounded-lg"
            title={t('personalize')}
          >
            <Paintbrush className="h-4 w-4 text-muted-foreground" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-2">
            <Paintbrush className="size-4" />
            {t('personalize')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md md:max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-lg">{t('personalizeTitle')}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {productTitle}
          </DialogDescription>
        </DialogHeader>

        <Separator />

        {/* Preview Mode Toggle */}
        <div className="px-5 py-3 bg-muted/20">
          <RadioGroup
            value={previewMode}
            onValueChange={(value) => setPreviewMode(value as 'quick' | 'accurate')}
            className="flex items-center gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="quick" id="quick" />
              <Label htmlFor="quick" className="flex items-center gap-1.5 cursor-pointer font-normal text-sm">
                <Zap className="size-3.5" />
                Quick Preview
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="accurate" id="accurate" />
              <Label htmlFor="accurate" className="flex items-center gap-1.5 cursor-pointer font-normal text-sm">
                <Sparkles className="size-3.5" />
                Accurate Preview
              </Label>
            </div>
          </RadioGroup>
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {/* Preview — left side on desktop, top on mobile */}
          <div className="relative bg-muted/30 flex items-center justify-center p-6 md:p-8 min-h-[200px] md:min-h-[320px]">
            {/* Loading skeleton (accurate mode only) */}
            {isLoadingPreview && previewMode === 'accurate' && (
              <div className="relative w-full max-w-[280px] aspect-square">
                <Skeleton className="w-full h-full rounded-md" />
                <p className="absolute bottom-2 left-2 right-2 text-[10px] text-muted-foreground text-center">
                  Generating accurate preview...
                </p>
              </div>
            )}

            {/* Server-generated preview (accurate mode) */}
            {!isLoadingPreview && previewMode === 'accurate' && serverPreview && (
              <div className="relative w-full max-w-[280px] aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={serverPreview}
                  alt="Accurate preview"
                  className="w-full h-full object-contain rounded-md"
                />
                <p className="absolute bottom-2 left-2 right-2 text-[10px] text-muted-foreground text-center">
                  {t('personalizePreviewDisclaimer')}
                </p>
              </div>
            )}

            {/* CSS overlay preview (quick mode) */}
            {(previewMode === 'quick' || (!isLoadingPreview && previewMode === 'accurate' && !serverPreview)) && (
              <div className="relative w-full max-w-[280px] aspect-square">
                {productImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={productImage}
                    alt={productTitle}
                    className="w-full h-full object-contain rounded-md"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center rounded-md bg-muted text-muted-foreground text-sm">
                    {productTitle}
                  </div>
                )}

                {/* Print area guide + text overlay — positioned within product's visible print zone */}
                <div
                  className={cn(
                    'absolute pointer-events-none transition-all duration-200',
                    hasText && 'border border-dashed border-primary/30 rounded-sm'
                  )}
                  style={{
                    left: previewZone.left,
                    top: previewZone.top,
                    width: previewZone.width,
                    height: previewZone.height,
                  }}
                >
                  {/* Text positioned within the print area (uses debounced values for 500ms delay) */}
                  {hasDebouncedText && (
                    <div
                      className={cn(
                        'absolute left-0 right-0 text-center px-[5%] drop-shadow-sm transition-all duration-200',
                        debouncedPosition === 'top' && 'top-[10%]',
                        debouncedPosition === 'center' && 'top-1/2 -translate-y-1/2',
                        debouncedPosition === 'bottom' && 'bottom-[10%]',
                      )}
                      style={{
                        fontFamily: debouncedFont,
                        color: debouncedFontColor,
                        fontSize: CSS_SIZE_MAP[debouncedFontSize],
                        lineHeight: 1.2,
                        wordBreak: 'break-word',
                      }}
                    >
                      {debouncedText.split('\n').map((line, idx) => (
                        <React.Fragment key={idx}>
                          {line}
                          {idx < debouncedText.split('\n').length - 1 && <br />}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>

                {/* Disclaimer */}
                {hasDebouncedText && (
                  <p className="absolute bottom-2 left-4 right-4 text-[10px] text-muted-foreground text-center">
                    {t('personalizePreviewDisclaimer')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Controls — right side on desktop, bottom on mobile */}
          <div className="flex flex-col p-5 gap-4">
            {/* Text input (multi-line, max 3 lines, 50 chars/line) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('personalizeTextLabel')}
              </Label>
              <Textarea
                placeholder={t('personalizeTextPlaceholder')}
                value={text}
                onChange={(e) => handleTextChange(e.target.value)}
                className="resize-none min-h-[72px]"
                rows={3}
              />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{lineInfo.lineCount} {lineInfo.lineCount === 1 ? 'line' : 'lines'}</span>
                <div className="flex gap-2">
                  {lineInfo.lines.map((line, idx) => (
                    <span key={idx} className={cn(line.length > 50 && 'text-destructive')}>
                      L{idx + 1}: {line.length}/50
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Font + Color row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('personalizeFont')}
                </Label>
                <Select value={font} onValueChange={setFont}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        <span style={{ fontFamily: f.value }}>{f.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('personalizeColor')}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={fontColor}
                    onChange={(e) => setFontColor(e.target.value)}
                    className="h-9 w-12 p-0.5 cursor-pointer border-border"
                  />
                  <Input
                    value={fontColor}
                    onChange={(e) => setFontColor(e.target.value)}
                    className="h-9 flex-1 font-mono text-xs"
                    maxLength={7}
                  />
                </div>
              </div>
            </div>

            {/* Position selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('personalizePosition')}
              </Label>
              <div className="flex gap-2">
                {(['top', 'center', 'bottom'] as const).map((pos) => (
                  <Button
                    key={pos}
                    variant={position === pos ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => setPosition(pos)}
                  >
                    {pos === 'top' && <AlignVerticalJustifyStart className="size-3.5" />}
                    {pos === 'center' && <AlignVerticalJustifyCenter className="size-3.5" />}
                    {pos === 'bottom' && <AlignVerticalJustifyEnd className="size-3.5" />}
                    {t(`personalizePosition${pos.charAt(0).toUpperCase() + pos.slice(1)}` as any)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Size selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('personalizeFontSize')}
              </Label>
              <div className="flex gap-2">
                {(['small', 'medium', 'large'] as const).map((size) => (
                  <Button
                    key={size}
                    variant={fontSize === size ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setFontSize(size)}
                  >
                    {t(`personalizeFontSize${size.charAt(0).toUpperCase() + size.slice(1)}` as any)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Surcharge display */}
            {surcharge !== null && surcharge > 0 && (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Personalization fee</span>
                  <span className="font-medium">+€{surcharge.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 mt-auto">
              <Button
                variant="ghost"
                onClick={handleClear}
                disabled={!hasText}
                className="gap-1.5"
              >
                <X className="size-3.5" />
                {t('personalizeClear')}
              </Button>
              <Button
                onClick={handleApply}
                disabled={!hasText}
                className="flex-1 h-11"
              >
                <Paintbrush className="size-4 mr-2" />
                {t('personalizeApply')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
