'use client'

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import { useDesignEditor } from '@/hooks/useDesignEditor'
import { useCanvasHistory } from '@/hooks/useCanvasHistory'
import { useCanvasObjectProperties } from '@/hooks/useCanvasObjectProperties'
import { useDesignSave } from '@/hooks/useDesignSave'
import { useAuth } from '@/hooks/useAuth'
import { getAvailablePanels } from '@/lib/print-area-config'
import { TEMPLATE_COLORS, getProductAspectRatio } from '@/lib/print-areas'
import { colorNameToHex, isLightColor } from '@/lib/color-map'
import { Plus, Minus, Maximize2, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CanvasWorkspace, type CanvasHandle, type LayerInfo } from './CanvasWorkspace'
import { EditorHeader } from './EditorHeader'
import { CanvasToolbar } from './CanvasToolbar'
import { CanvasProperties } from './CanvasProperties'
import { PanelSwitcher } from './PanelSwitcher'
import { AuthWallModal } from '@/components/engagement/AuthWallModal'
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
import type { VariantInfo, DesignTemplateData } from '@/app/[locale]/(editor)/design/[slug]/DesignEditorClient'

interface DesignStudioPageProps {
  product: {
    id: string
    slug: string
    title: string
    category: string
    base_price_cents: number
    productType: string
  }
  variants?: VariantInfo
  designTemplates?: DesignTemplateData | null
  compositionId?: string
  designId?: string
}

/** Map panel IDs to Printful placement names where they differ */
const PANEL_TO_PRINTFUL: Record<string, string> = {
  'left_sleeve': 'sleeve_left',
  'right_sleeve': 'sleeve_right',
}

/**
 * Resolve the ghost template for a given color + placement from designTemplates.
 * Returns { ghostImageUrl, backgroundColor, printArea } or null.
 */
function resolveGhostTemplate(
  designTemplates: DesignTemplateData | null | undefined,
  color: string,
  placement: string
): { ghostImageUrl: string | null; backgroundColor: string | null; printArea: { left: number; top: number; width: number; height: number; templateWidth: number; templateHeight: number } } | null {
  if (!designTemplates) return null

  // Find variant_id for this color
  const variantId = designTemplates.color_to_variant_id[color.toLowerCase()]
  if (!variantId) return null

  // Find template_id for this variant + placement
  const variantMap = designTemplates.variant_mapping[String(variantId)]
  if (!variantMap) return null

  const printfulPlacement = PANEL_TO_PRINTFUL[placement] || placement
  const templateId = variantMap[placement] ?? variantMap[printfulPlacement]
  if (!templateId) return null

  // Get template data
  const template = designTemplates.templates[String(templateId)]
  if (!template) return null

  return {
    ghostImageUrl: template.image_url,
    backgroundColor: template.background_color,
    printArea: {
      left: template.print_area_left,
      top: template.print_area_top,
      width: template.print_area_width,
      height: template.print_area_height,
      templateWidth: template.template_width,
      templateHeight: template.template_height,
    },
  }
}

export function DesignStudioPage({ product, variants, designTemplates, compositionId: initialCompositionId, designId }: DesignStudioPageProps) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('designEditor')
  const canvasRef = useRef<CanvasHandle>(null)
  const fabricCanvasRef = useRef<any>(null)
  const clipboardRef = useRef<any>(null)

  const {
    initProduct,
    setHistoryState,
    setDirty,
    setAvailablePanels,
    setActivePanel,
    setPanelState,
    setLayers,
    setVariantColor,
    setCompositionId,
    selectedObject,
    isDirty,
    compositionId,
    activePanel,
    availablePanels,
    productType,
    variantColor,
    zoomLevel,
    lastSavedAt,
  } = useDesignEditor()

  const { saveState, undo, redo, clear: clearHistory } = useCanvasHistory(
    fabricCanvasRef,
    (canUndo, canRedo) => setHistoryState(canUndo, canRedo)
  )

  // Extracted hooks
  const propertyHandlers = useCanvasObjectProperties(canvasRef, setDirty, saveState)

  const {
    handleSave,
    handleSaveDraft,
    getCompositionIdForCart,
    handleRestoreDraft,
    handleDiscardDraft,
    showAuthWall,
    setShowAuthWall,
    showDraftRestore,
    setShowDraftRestore,
  } = useDesignSave({
    canvasRef,
    productId: product.id,
    productType: product.productType,
    initialCompositionId,
    t,
  })

  // Determine available colors: from real variants if available, else from templates
  const availableColors = (variants?.colors && variants.colors.length > 0)
    ? variants.colors
    : (TEMPLATE_COLORS[product.productType] || ['white'])

  // Memoize ghost template to prevent referential instability
  const ghostTemplate = useMemo(
    () => resolveGhostTemplate(designTemplates, variantColor, activePanel) ?? undefined,
    [designTemplates, variantColor, activePanel]
  )

  // Initialize product in store
  useEffect(() => {
    initProduct({
      id: product.id,
      title: product.title,
      category: product.category,
      image: '', // No product image -- using blank templates
      basePriceCents: product.base_price_cents,
      productType: product.productType,
    })

    // Set available panels based on product type
    const panels = getAvailablePanels(product.productType)
    setAvailablePanels(panels)
    setActivePanel('front')

    // Set default color -- first available variant color
    if (availableColors.length > 0) {
      setVariantColor(availableColors[0])
    }

    if (initialCompositionId) {
      setCompositionId(initialCompositionId)
    }
  }, [product.id])

  // Sync fabricCanvasRef when canvas is ready (replaces 200ms polling)
  const designIdLoadedRef = useRef(false)
  const handleCanvasReady = useCallback(() => {
    const canvas = canvasRef.current?.getCanvas?.()
    if (canvas) {
      fabricCanvasRef.current = canvas
    }

    // Pre-load design from ?designId= query param (once)
    if (designId && !designIdLoadedRef.current) {
      designIdLoadedRef.current = true
      fetch(`/api/designs?id=${designId}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          const imageUrl = data?.image_url || data?.bg_removed_url
          if (imageUrl && canvasRef.current) {
            canvasRef.current.addImage(imageUrl)
            toast.success(t('designLoaded'))
          }
        })
        .catch(() => { /* silently fail */ })
    }
  }, [designId, t])

  // Panel switching logic -- serialize current, switch panel (canvas re-inits via useEffect)
  const handlePanelChange = useCallback((newPanel: string) => {
    if (!canvasRef.current || newPanel === activePanel) return

    // Serialize current panel state before switching
    const currentJson = canvasRef.current.exportJSON()
    setPanelState(activePanel, {
      fabricJson: currentJson,
      isDirty: isDirty,
    })

    // Clear undo/redo history -- each panel has independent history
    clearHistory()

    // Switch panel -- CanvasWorkspace will re-init with new panelId
    setActivePanel(newPanel)
  }, [activePanel, isDirty, setActivePanel, setPanelState, clearHistory])

  // Copy current panel design to another panel
  const handleCopyPanel = useCallback((fromPanel: string, toPanel: string) => {
    let sourceJson: object | null = null
    if (fromPanel === activePanel && canvasRef.current) {
      sourceJson = canvasRef.current.exportJSON()
    } else {
      const currentPanelStates = useDesignEditor.getState().panelStates
      sourceJson = currentPanelStates[fromPanel]?.fabricJson ?? null
    }

    if (!sourceJson) {
      toast.error(t('copyPanelEmpty'))
      return
    }

    setPanelState(toPanel, {
      fabricJson: sourceJson,
      isDirty: true,
    })
    toast.success(t('copiedToPanel', { panel: toPanel }))
  }, [activePanel, setPanelState, t])

  // Garment color change
  const handleColorChange = useCallback((color: string) => {
    if (canvasRef.current) {
      const currentJson = canvasRef.current.exportJSON()
      setPanelState(activePanel, {
        fabricJson: currentJson,
        isDirty: isDirty,
      })
    }
    setVariantColor(color)
  }, [activePanel, isDirty, setPanelState, setVariantColor])

  // History save handler
  const handleHistorySave = useCallback(() => {
    saveState()
  }, [saveState])

  // Layers change handler
  const handleLayersChange = useCallback((layers: LayerInfo[]) => {
    setLayers(layers)
  }, [setLayers])

  // Apply to cart
  const handleApplyToCart = useCallback(async () => {
    const cid = await getCompositionIdForCart()
    if (cid) {
      router.push(`/${locale}/shop/${product.slug}?compositionId=${cid}`)
    } else {
      toast.error(t('applyToCartFailed'))
    }
  }, [getCompositionIdForCart, router, locale, product.id, t])

  // Preview modal
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const handlePreview = useCallback(() => {
    if (!canvasRef.current) return
    const dataUrl = canvasRef.current.exportPNG(2)
    setPreviewUrl(dataUrl)
    setPreviewOpen(true)
  }, [])

  const handlePreviewApplyToCart = useCallback(() => {
    setPreviewOpen(false)
    handleApplyToCart()
  }, [handleApplyToCart])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in DOM inputs
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      const mod = e.metaKey || e.ctrlKey

      // Ctrl/Cmd+Z -> Undo
      if (mod && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo(); return }
      // Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y -> Redo
      if ((mod && e.shiftKey && e.key === 'z') || (mod && e.key === 'y')) { e.preventDefault(); redo(); return }
      // Ctrl/Cmd+S -> Save
      if (mod && e.key === 's') { e.preventDefault(); handleSave(); return }
      // Ctrl/Cmd+D -> Duplicate
      if (mod && e.key === 'd') { e.preventDefault(); canvasRef.current?.duplicateSelected(); return }

      // Ctrl/Cmd+C -> Copy
      if (mod && e.key === 'c') {
        const canvas = canvasRef.current?.getCanvas()
        const active = canvas?.getActiveObject?.()
        if (active && !(active as any).name?.startsWith('__')) {
          e.preventDefault()
          active.clone((cloned: any) => { clipboardRef.current = cloned })
        }
        return
      }

      // Ctrl/Cmd+V -> Paste
      if (mod && e.key === 'v') {
        if (!clipboardRef.current) return
        e.preventDefault()
        clipboardRef.current.clone((cloned: any) => {
          const canvas = canvasRef.current?.getCanvas()
          if (!canvas) return
          cloned.set({ left: (cloned.left ?? 0) + 20, top: (cloned.top ?? 0) + 20, evented: true })
          canvas.add(cloned)
          canvas.setActiveObject(cloned)
          canvas.requestRenderAll()
          setDirty(true)
          saveState()
        })
        return
      }

      // Delete/Backspace -> Remove selected (unless editing text in canvas)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const canvas = canvasRef.current?.getCanvas()
        const active = canvas?.getActiveObject?.()
        if (active && (active as any).isEditing) return
        if (active) { e.preventDefault(); canvasRef.current?.removeSelected() }
        return
      }

      // Escape -> Deselect
      if (e.key === 'Escape') {
        const canvas = canvasRef.current?.getCanvas()
        if (canvas) { canvas.discardActiveObject(); canvas.renderAll() }
        return
      }

      // Arrow keys -> Nudge (1px, 10px with Shift)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const canvas = canvasRef.current?.getCanvas()
        const active = canvas?.getActiveObject?.()
        if (active && !(active as any).isEditing) {
          e.preventDefault()
          const step = e.shiftKey ? 10 : 1
          switch (e.key) {
            case 'ArrowLeft': active.set('left', (active.left ?? 0) - step); break
            case 'ArrowRight': active.set('left', (active.left ?? 0) + step); break
            case 'ArrowUp': active.set('top', (active.top ?? 0) - step); break
            case 'ArrowDown': active.set('top', (active.top ?? 0) + step); break
          }
          active.setCoords()
          canvas.renderAll()
          setDirty(true)
          saveState()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, handleSave, setDirty, saveState])

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    canvasRef.current?.zoomTo(zoomLevel * 1.25)
  }, [zoomLevel])

  const handleZoomOut = useCallback(() => {
    canvasRef.current?.zoomTo(zoomLevel / 1.25)
  }, [zoomLevel])

  const handleZoomReset = useCallback(() => {
    canvasRef.current?.resetZoom()
  }, [])

  // Build shared CanvasProperties props
  const propertiesProps = {
    onAddText: (text: string) => canvasRef.current?.addText(text),
    onAddImage: (url: string) => canvasRef.current?.addImage(url) ?? Promise.resolve(),
    onAddSVG: (svgText: string) => canvasRef.current?.addSVG(svgText) ?? Promise.resolve(),
    onRemoveSelected: () => canvasRef.current?.removeSelected(),
    onDuplicateSelected: () => canvasRef.current?.duplicateSelected(),
    onFontChange: propertyHandlers.handleFontChange,
    onFontSizeChange: propertyHandlers.handleFontSizeChange,
    onColorChange: propertyHandlers.handleTextColorChange,
    onAlignChange: propertyHandlers.handleAlignChange,
    onBoldToggle: propertyHandlers.handleBoldToggle,
    onItalicToggle: propertyHandlers.handleItalicToggle,
    onShadowToggle: propertyHandlers.handleShadowToggle,
    onShadowColorChange: propertyHandlers.handleShadowColorChange,
    onShadowBlurChange: propertyHandlers.handleShadowBlurChange,
    onShadowOffsetXChange: propertyHandlers.handleShadowOffsetXChange,
    onShadowOffsetYChange: propertyHandlers.handleShadowOffsetYChange,
    onOutlineToggle: propertyHandlers.handleOutlineToggle,
    onOutlineColorChange: propertyHandlers.handleOutlineColorChange,
    onOutlineWidthChange: propertyHandlers.handleOutlineWidthChange,
    onFillModeChange: propertyHandlers.handleFillModeChange,
    onGradientStartColorChange: propertyHandlers.handleGradientStartColorChange,
    onGradientEndColorChange: propertyHandlers.handleGradientEndColorChange,
    onGradientAngleChange: propertyHandlers.handleGradientAngleChange,
    onOpacityChange: propertyHandlers.handleOpacityChange,
    onFlipH: () => canvasRef.current?.flipHorizontal(),
    onFlipV: () => canvasRef.current?.flipVertical(),
    onRotate: (angle: number) => canvasRef.current?.setRotation(angle),
    onBringForward: () => canvasRef.current?.bringForward(),
    onSendBackward: () => canvasRef.current?.sendBackward(),
    onBringToFront: () => canvasRef.current?.bringToFront(),
    onSendToBack: () => canvasRef.current?.sendToBack(),
    onToggleVisibility: (id: string, visible: boolean) => canvasRef.current?.setObjectVisibility(id, visible),
    onToggleLock: (id: string, locked: boolean) => canvasRef.current?.setObjectLocked(id, locked),
    onApplyTemplate: (fabricJson: object) => canvasRef.current?.loadFromJSON(fabricJson),
    productType: product.productType,
  }

  return (
    <div className="flex flex-col h-full">
      <EditorHeader
        onSave={handleSave}
        onApplyToCart={handleApplyToCart}
        onPreview={handlePreview}
        onUndo={undo}
        onRedo={redo}
        productSlug={product.slug}
        locale={locale}
        onSaveDraft={handleSaveDraft}
      />

      {/* Panel switcher + garment color + sizes */}
      <div className="flex items-center border-b border-border bg-card shrink-0 overflow-x-auto">
        <PanelSwitcher onPanelChange={handlePanelChange} onCopyPanel={handleCopyPanel} />
        {availableColors.length > 1 && (
          <div className="flex items-center gap-1.5 px-3 ml-auto">
            <span className="text-xs text-muted-foreground whitespace-nowrap">{t('garmentColor.label')}:</span>
            <div className="flex items-center gap-1 overflow-x-auto">
              {availableColors.map((color) => {
                const hex = variants?.colorHexMap?.[color] || colorNameToHex(color)
                const light = isLightColor(hex)
                return (
                  <button
                    key={color}
                    onClick={() => handleColorChange(color)}
                    className={`size-9 rounded-full border-2 transition-all shrink-0 ${
                      variantColor === color ? 'border-primary ring-1 ring-primary/30 scale-110' : 'border-border hover:border-primary/50'
                    }`}
                    style={{ backgroundColor: hex }}
                    title={color}
                  >
                    {/* Checkmark for selected light colors */}
                    {variantColor === color && light && (
                      <span className="text-[10px] text-black/60">✓</span>
                    )}
                    {variantColor === color && !light && (
                      <span className="text-[10px] text-white/60">✓</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Main workspace: toolbar + canvas + properties */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        {/* Desktop: left toolbar (CanvasToolbar handles its own lg:flex/hidden) */}
        <CanvasToolbar onUndo={undo} onRedo={redo} />

        {/* Center: canvas takes all available space */}
        <div className="relative flex-1 min-h-0">
          <CanvasWorkspace
            ref={canvasRef}
            productType={product.productType}
            variantColor={variantColor}
            panelId={activePanel}
            productCategory={product.category}
            ghostTemplate={ghostTemplate}
            blankImageUrl={variants?.blankImages?.[variantColor]}
            variantColorHex={variants?.colorHexMap?.[variantColor]}
            aspectRatio={getProductAspectRatio(product.productType, activePanel)}
            onHistorySave={handleHistorySave}
            onLayersChange={handleLayersChange}
            onCanvasReady={handleCanvasReady}
            className="w-full h-full"
          />
          {/* Floating zoom controls */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-card/90 backdrop-blur-sm border border-border rounded-lg px-2 py-1 shadow-sm">
            <Button variant="ghost" size="icon" className="size-9" onClick={handleZoomOut} title={t('zoom.out')}>
              <Minus className="size-4" />
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums min-w-[3ch] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <Button variant="ghost" size="icon" className="size-9" onClick={handleZoomIn} title={t('zoom.in')}>
              <Plus className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-9" onClick={handleZoomReset} title={t('zoom.fit')}>
              <Maximize2 className="size-4" />
            </Button>
          </div>
        </div>

        {/* Desktop: right properties panel */}
        <div className="hidden lg:block lg:w-64 shrink-0 min-h-0 overflow-y-auto">
          <CanvasProperties {...propertiesProps} />
        </div>
      </div>

      {/* Mobile: bottom properties panel (Sheet-style, height-constrained) */}
      <div className="lg:hidden max-h-[45vh] overflow-y-auto border-t border-border bg-card shrink-0">
        <CanvasProperties {...propertiesProps} />
      </div>

      {/* Preview mockup modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('previewTitle')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {previewUrl && (
              <div className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden">
                <img
                  src={previewUrl}
                  alt="Design preview"
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            <Button onClick={handlePreviewApplyToCart} className="w-full gap-1.5">
              <ShoppingCart className="size-4" />
              {t('applyToCart')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Auth wall modal -- shown when guest tries to save/cart */}
      <AuthWallModal
        open={showAuthWall}
        onOpenChange={setShowAuthWall}
        reason={t('authRequired')}
        variant="subtle"
      />

      {/* Draft restoration dialog */}
      <AlertDialog open={showDraftRestore} onOpenChange={setShowDraftRestore}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('restoreDraftTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('restoreDraftDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscardDraft}>{t('discardDraft')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreDraft}>{t('restoreDraft')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
