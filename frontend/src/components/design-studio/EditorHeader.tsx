'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, ShoppingCart, Undo2, Redo2, Eye, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useDesignEditor } from '@/hooks/useDesignEditor'
import { PRODUCTION_DIMENSIONS, CATEGORY_TO_PRODUCT_TYPE } from '@/lib/print-areas'
import { ProductSwitcher } from './ProductSwitcher'

interface EditorHeaderProps {
  onSave: () => void
  onApplyToCart: () => void
  onPreview: () => void
  onUndo: () => void
  onRedo: () => void
  productSlug?: string
  locale?: string
  onSaveDraft?: () => void
}

export function EditorHeader({ onSave, onApplyToCart, onPreview, onUndo, onRedo, productSlug, locale, onSaveDraft }: EditorHeaderProps) {
  const router = useRouter()
  const t = useTranslations('designEditor')
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const {
    productTitle,
    isDirty,
    isSaving,
    canUndo,
    canRedo,
    compositionId,
    lastSavedAt,
    printAreaWarning,
    selectedObject,
    productType,
    productCategory,
  } = useDesignEditor()

  // Relative time since last save (updates every 10s)
  const [savedAgoText, setSavedAgoText] = useState('')
  useEffect(() => {
    if (!lastSavedAt) { setSavedAgoText(''); return }
    const update = () => {
      const seconds = Math.floor((Date.now() - lastSavedAt) / 1000)
      if (seconds < 10) setSavedAgoText(t('justSaved'))
      else if (seconds < 60) setSavedAgoText(t('savedSecondsAgo', { seconds }))
      else setSavedAgoText(t('savedMinutesAgo', { minutes: Math.floor(seconds / 60) }))
    }
    update()
    const timer = setInterval(update, 10000)
    return () => clearInterval(timer)
  }, [lastSavedAt, t])

  // Print area dimensions in inches (production @ 300 DPI)
  const resolvedType = CATEGORY_TO_PRODUCT_TYPE[productCategory?.toLowerCase()] || productType || 'tshirt'
  const dims = PRODUCTION_DIMENSIONS[resolvedType] || PRODUCTION_DIMENSIONS['tshirt']
  const printWidthIn = (dims.w / 300).toFixed(1)
  const printHeightIn = (dims.h / 300).toFixed(1)
  const printWidthCm = (dims.w / 300 * 2.54).toFixed(1)
  const printHeightCm = (dims.h / 300 * 2.54).toFixed(1)

  const handleBack = () => {
    if (isDirty) {
      setShowUnsavedDialog(true)
    } else {
      router.back()
    }
  }

  return (
    <>
      <header className="flex items-center justify-between h-14 px-4 border-b border-border bg-card shrink-0">
        {/* Left: Back + Product name */}
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0">
            <ArrowLeft className="size-5" />
            <span className="sr-only">{t('back')}</span>
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <span className="text-sm font-medium truncate max-w-[200px] lg:max-w-[400px]">
            {productTitle || t('title')}
          </span>
          {productSlug && locale && (
            <ProductSwitcher
              currentSlug={productSlug}
              locale={locale}
              onBeforeSwitch={onSaveDraft}
            />
          )}
          <span className="hidden lg:inline text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
            {printWidthIn}&times;{printHeightIn} in ({printWidthCm}&times;{printHeightCm} cm)
          </span>
        </div>

        {/* Center: Undo/Redo + Warnings */}
        <div className="hidden md:flex items-center gap-1">
          {printAreaWarning && (
            <Badge variant="destructive" className="gap-1 mr-1 text-xs">
              <AlertTriangle className="size-3" />
              {t('printArea.outsideWarning')}
            </Badge>
          )}
          {selectedObject?.type === 'image' && selectedObject.width < 200 && (
            <Badge variant="secondary" className="text-xs mr-1">
              {t('lowResolution')}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onUndo}
            disabled={!canUndo}
            title={t('history.undo')}
          >
            <Undo2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRedo}
            disabled={!canRedo}
            title={t('history.redo')}
          >
            <Redo2 className="size-4" />
          </Button>
        </div>

        {/* Right: Preview + Save + Apply */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPreview}
            disabled={isSaving}
            className="gap-1.5"
          >
            <Eye className="size-4" />
            <span className="hidden sm:inline">{t('preview')}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onSave}
            disabled={isSaving || !isDirty}
            className="gap-1.5"
          >
            <Save className="size-4" />
            <span className="hidden sm:inline">
              {isSaving ? t('saving') : isDirty ? t('save') : compositionId ? t('saved') : t('save')}
            </span>
          </Button>
          {savedAgoText && !isDirty && (
            <span className="hidden md:inline text-xs text-muted-foreground">{savedAgoText}</span>
          )}
          <Button
            size="sm"
            onClick={onApplyToCart}
            disabled={isSaving}
            className="gap-1.5"
          >
            <ShoppingCart className="size-4" />
            <span className="hidden sm:inline">{t('applyToCart')}</span>
          </Button>
        </div>
      </header>

      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('unsavedTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('unsavedChanges')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => router.back()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('discardChanges')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
