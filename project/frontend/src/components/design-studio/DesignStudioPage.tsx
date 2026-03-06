'use client'

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import { useDesignEditor } from '@/hooks/useDesignEditor'
import { useCanvasHistory } from '@/hooks/useCanvasHistory'
import { useDesignPersistence } from '@/hooks/useDesignPersistence'
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
import type { FillMode } from './tools/GradientEditor'
import type { VariantInfo, DesignTemplateData } from '@/app/[locale]/(editor)/design/[productId]/DesignEditorClient'

interface DesignStudioPageProps {
  product: {
    id: string
    title: string
    category: string
    base_price_cents: number
    productType: string
  }
  variants?: VariantInfo
  designTemplates?: DesignTemplateData | null
  compositionId?: string
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

export function DesignStudioPage({ product, variants, designTemplates, compositionId: initialCompositionId }: DesignStudioPageProps) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('designEditor')
  const canvasRef = useRef<CanvasHandle>(null)
  const fabricCanvasRef = useRef<any>(null)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedHashRef = useRef<string>('')
  const isSavingRef = useRef(false)

  // Auth state
  const { user, authenticated } = useAuth()
  const [showAuthWall, setShowAuthWall] = useState(false)
  const [pendingAction, setPendingAction] = useState<'save' | 'cart' | null>(null)
  const [showDraftRestore, setShowDraftRestore] = useState(false)

  const {
    initProduct,
    setHistoryState,
    setDirty,
    setSaving,
    setCompositionId,
    setAvailablePanels,
    setActivePanel,
    setPanelState,
    setLayers,
    setVariantColor,
    setLastSavedAt,
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

  const { save, load, saveDraft, loadDraft, clearDraft } = useDesignPersistence()

  const { saveState, undo, redo, clear: clearHistory } = useCanvasHistory(
    fabricCanvasRef,
    (canUndo, canRedo) => setHistoryState(canUndo, canRedo)
  )

  // Determine available colors: from real variants if available, else from templates
  const availableColors = (variants?.colors && variants.colors.length > 0)
    ? variants.colors
    : (TEMPLATE_COLORS[product.productType] || ['white'])

  // Memoize ghost template to prevent referential instability
  // (resolveGhostTemplate returns a new object each call → would re-init canvas every render)
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
      image: '', // No product image — using blank templates
      basePriceCents: product.base_price_cents,
      productType: product.productType,
    })

    // Set available panels based on product type
    const panels = getAvailablePanels(product.productType)
    setAvailablePanels(panels)
    setActivePanel('front')

    // Set default color — first available variant color
    if (availableColors.length > 0) {
      setVariantColor(availableColors[0])
    }

    if (initialCompositionId) {
      setCompositionId(initialCompositionId)
    }
  }, [product.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync fabricCanvasRef when canvas is ready (replaces 200ms polling)
  const handleCanvasReady = useCallback(() => {
    const canvas = canvasRef.current?.getCanvas?.()
    if (canvas) {
      fabricCanvasRef.current = canvas
    }
  }, [])

  // Load existing composition
  useEffect(() => {
    if (!initialCompositionId) return

    async function loadComposition() {
      const data = await load(initialCompositionId!)
      if (!data) return

      // Multi-panel (schema_version 3) or single (schema_version 2)
      if (data.schema_version === 3 && data.layers && typeof data.layers === 'object' && 'panels' in (data.layers as Record<string, unknown>)) {
        const panels = (data.layers as { panels: Record<string, { fabricJson: object }> }).panels
        for (const [panel, state] of Object.entries(panels)) {
          setPanelState(panel, { fabricJson: state.fabricJson, isDirty: false, compositionId: initialCompositionId })
        }
        // Load front panel
        if (panels.front && canvasRef.current) {
          await canvasRef.current.loadFromJSON(panels.front.fabricJson)
        }
      } else if (data.schema_version === 2 && data.layers) {
        // Legacy single-panel
        if (canvasRef.current) {
          await canvasRef.current.loadFromJSON(data.layers)
        }
      }
    }

    // Delay to ensure canvas is initialized
    const timer = setTimeout(loadComposition, 500)
    return () => clearTimeout(timer)
  }, [initialCompositionId, load, setPanelState])

  // Panel switching logic — serialize current, switch panel (canvas re-inits via useEffect)
  const handlePanelChange = useCallback((newPanel: string) => {
    if (!canvasRef.current || newPanel === activePanel) return

    // Serialize current panel state before switching
    const currentJson = canvasRef.current.exportJSON()
    setPanelState(activePanel, {
      fabricJson: currentJson,
      isDirty: isDirty,
    })

    // Clear undo/redo history — each panel has independent history
    clearHistory()

    // Switch panel — CanvasWorkspace will re-init with new panelId
    // and load saved state from Zustand during its init
    setActivePanel(newPanel)
  }, [activePanel, isDirty, setActivePanel, setPanelState, clearHistory])

  // Copy current panel design to another panel
  const handleCopyPanel = useCallback((fromPanel: string, toPanel: string) => {
    // Get the source panel JSON (either from canvas if active, or from store)
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
    // Serialize current panel before color change (canvas will re-init)
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

  // Build panels payload from current canvas state (reused by save and draft)
  const serializePanels = useCallback(() => {
    if (!canvasRef.current) return null
    const currentJson = canvasRef.current.exportJSON()
    const currentPanelStates = useDesignEditor.getState().panelStates
    return {
      ...Object.fromEntries(
        Object.entries(currentPanelStates).map(([panel, state]) => [
          panel,
          { fabricJson: state.fabricJson || {} },
        ])
      ),
      [activePanel]: { fabricJson: currentJson },
    }
  }, [activePanel])

  // Save to localStorage draft (for guests or auto-save fallback)
  const handleSaveDraft = useCallback(() => {
    const panels = serializePanels()
    if (!panels) return
    saveDraft(product.id, panels)
  }, [serializePanels, saveDraft, product.id])

  // Save composition (multi-panel) with production export — returns success boolean
  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!canvasRef.current) return false

    // Auth gate: if not authenticated, save draft + show auth wall
    if (!authenticated) {
      handleSaveDraft()
      setPendingAction('save')
      setShowAuthWall(true)
      return false
    }

    if (isSavingRef.current) return false
    isSavingRef.current = true
    setSaving(true)
    try {
      const currentJson = canvasRef.current.exportJSON()
      const currentPanelStates = useDesignEditor.getState().panelStates

      const panels: Record<string, { fabricJson: object; previewDataUrl?: string }> = {
        ...Object.fromEntries(
          Object.entries(currentPanelStates).map(([panel, state]) => [
            panel,
            { fabricJson: state.fabricJson || {} },
          ])
        ),
        [activePanel]: {
          fabricJson: currentJson,
          previewDataUrl: canvasRef.current.exportPNG(1),
        },
      }

      // Export production PNG for active panel
      const productionPanels: Record<string, string> = {}
      const activeProdPng = canvasRef.current.exportProductionPNG(product.productType)
      if (activeProdPng) {
        productionPanels[activePanel] = activeProdPng
      }
      for (const [panel, state] of Object.entries(currentPanelStates)) {
        if (panel !== activePanel && state.productionDataUrl) {
          productionPanels[panel] = state.productionDataUrl
        }
      }

      const result = await save({
        fabricJson: { panels, schema_version: 3 },
        previewDataUrl: canvasRef.current.exportPNG(1),
        productType: product.productType,
        productId: product.id,
        compositionId: compositionId || undefined,
        productionPanels: Object.keys(productionPanels).length > 0 ? productionPanels : undefined,
      })

      if (result) {
        setCompositionId(result.composition_id)
        setDirty(false)
        setLastSavedAt(Date.now())
        setPanelState(activePanel, { productionDataUrl: activeProdPng || null })
        // Clear localStorage draft on successful cloud save
        clearDraft(product.id)
        lastSavedHashRef.current = JSON.stringify(currentJson)
        toast.success(t('saved'))
        return true
      } else {
        toast.error(t('saveFailed'))
        return false
      }
    } catch {
      toast.error(t('saveFailed'))
      return false
    } finally {
      isSavingRef.current = false
      setSaving(false)
    }
  }, [product.id, product.productType, compositionId, activePanel, authenticated, setCompositionId, setDirty, setSaving, setLastSavedAt, setPanelState, save, clearDraft, handleSaveDraft, t])

  // Apply to cart
  const handleApplyToCart = useCallback(async () => {
    if (!canvasRef.current) return

    // Auth gate: must be authenticated for cart
    if (!authenticated) {
      handleSaveDraft()
      setPendingAction('cart')
      setShowAuthWall(true)
      return
    }

    if (isDirty || !compositionId) {
      const saved = await handleSave()
      if (!saved) {
        toast.error(t('applyToCartFailed'))
        return
      }
    }

    const cid = useDesignEditor.getState().compositionId
    if (cid) {
      router.push(`/${locale}/shop/${product.id}?compositionId=${cid}`)
    } else {
      toast.error(t('applyToCartFailed'))
    }
  }, [isDirty, compositionId, authenticated, handleSave, handleSaveDraft, router, locale, product.id, t])

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

      // Ctrl/Cmd+Z → Undo
      if (mod && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo(); return }
      // Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y → Redo
      if ((mod && e.shiftKey && e.key === 'z') || (mod && e.key === 'y')) { e.preventDefault(); redo(); return }
      // Ctrl/Cmd+S → Save
      if (mod && e.key === 's') { e.preventDefault(); handleSave(); return }
      // Ctrl/Cmd+D → Duplicate
      if (mod && e.key === 'd') { e.preventDefault(); canvasRef.current?.duplicateSelected(); return }

      // Delete/Backspace → Remove selected (unless editing text in canvas)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const canvas = canvasRef.current?.getCanvas()
        const active = canvas?.getActiveObject?.()
        if (active && (active as any).isEditing) return
        if (active) { e.preventDefault(); canvasRef.current?.removeSelected() }
        return
      }

      // Escape → Deselect
      if (e.key === 'Escape') {
        const canvas = canvasRef.current?.getCanvas()
        if (canvas) { canvas.discardActiveObject(); canvas.renderAll() }
        return
      }

      // Arrow keys → Nudge (1px, 10px with Shift)
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

  // Auto-save: 2s debounce after dirty state changes
  useEffect(() => {
    if (!isDirty) return

    // Clear previous timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    autoSaveTimerRef.current = setTimeout(() => {
      if (!canvasRef.current) return

      // Check if content actually changed (avoid redundant saves)
      const currentJson = JSON.stringify(canvasRef.current.exportJSON())
      if (currentJson === lastSavedHashRef.current) return

      if (authenticated) {
        // Cloud save for authenticated users
        handleSave()
      } else {
        // localStorage draft for guests
        handleSaveDraft()
      }
    }, 2000)

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [isDirty, authenticated, handleSave, handleSaveDraft])

  // Save draft on tab close / visibility change (prevent work loss)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isDirty) handleSaveDraft()
    }
    const handleVisibilityChange = () => {
      if (document.hidden && isDirty) handleSaveDraft()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isDirty, handleSaveDraft])

  // Draft restoration: check localStorage on mount
  useEffect(() => {
    // Only prompt if no existing composition loaded
    if (initialCompositionId) return
    const draft = loadDraft(product.id)
    if (draft && draft.panels && Object.keys(draft.panels).length > 0) {
      setShowDraftRestore(true)
    }
  }, [product.id, initialCompositionId, loadDraft])

  const handleRestoreDraft = useCallback(async () => {
    setShowDraftRestore(false)
    const draft = loadDraft(product.id)
    if (!draft?.panels) return

    // Restore panels into Zustand
    for (const [panel, state] of Object.entries(draft.panels)) {
      setPanelState(panel, { fabricJson: state.fabricJson, isDirty: false })
    }
    // Load front panel into canvas
    if (draft.panels.front?.fabricJson && canvasRef.current) {
      await canvasRef.current.loadFromJSON(draft.panels.front.fabricJson)
    }
    clearDraft(product.id)
    toast.success(t('draftRestored'))
  }, [product.id, loadDraft, clearDraft, setPanelState, t])

  const handleDiscardDraft = useCallback(() => {
    setShowDraftRestore(false)
    clearDraft(product.id)
  }, [clearDraft, product.id])

  // Handle pending action after auth modal closes (user may have logged in via another tab)
  useEffect(() => {
    if (authenticated && pendingAction) {
      const action = pendingAction
      setPendingAction(null)
      if (action === 'save') {
        handleSave()
      } else if (action === 'cart') {
        handleApplyToCart()
      }
    }
  }, [authenticated, pendingAction, handleSave, handleApplyToCart])

  // === Text property change handlers ===

  const handleFontChange = useCallback((font: string) => {
    const canvas = canvasRef.current?.getCanvas()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (active && (active.type === 'i-text' || active.type === 'textbox')) {
      active.set('fontFamily', font)
      canvas.renderAll()
      setDirty(true)
      saveState()
    }
  }, [setDirty, saveState])

  const handleFontSizeChange = useCallback((size: number) => {
    const canvas = canvasRef.current?.getCanvas()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (active && (active.type === 'i-text' || active.type === 'textbox')) {
      active.set('fontSize', size)
      canvas.renderAll()
      setDirty(true)
      saveState()
    }
  }, [setDirty, saveState])

  const handleTextColorChange = useCallback((color: string) => {
    const canvas = canvasRef.current?.getCanvas()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (active) {
      active.set('fill', color)
      canvas.renderAll()
      setDirty(true)
      saveState()
    }
  }, [setDirty, saveState])

  const handleAlignChange = useCallback((align: string) => {
    const canvas = canvasRef.current?.getCanvas()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (active && (active.type === 'i-text' || active.type === 'textbox')) {
      active.set('textAlign', align)
      canvas.renderAll()
      setDirty(true)
      saveState()
    }
  }, [setDirty, saveState])

  const handleBoldToggle = useCallback(() => {
    const canvas = canvasRef.current?.getCanvas()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (active && (active.type === 'i-text' || active.type === 'textbox')) {
      active.set('fontWeight', active.fontWeight === 'bold' ? 'normal' : 'bold')
      canvas.renderAll()
      setDirty(true)
      saveState()
    }
  }, [setDirty, saveState])

  const handleItalicToggle = useCallback(() => {
    const canvas = canvasRef.current?.getCanvas()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (active && (active.type === 'i-text' || active.type === 'textbox')) {
      active.set('fontStyle', active.fontStyle === 'italic' ? 'normal' : 'italic')
      canvas.renderAll()
      setDirty(true)
      saveState()
    }
  }, [setDirty, saveState])

  // === Text effect handlers ===

  const handleShadowToggle = useCallback(async (enabled: boolean) => {
    const canvas = canvasRef.current?.getCanvas()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (!active) return

    if (enabled) {
      const { Shadow } = await import('fabric')
      active.set('shadow', new Shadow({
        color: 'rgba(0,0,0,0.5)',
        blur: 10,
        offsetX: 5,
        offsetY: 5,
      }))
    } else {
      active.set('shadow', null)
    }
    canvas.renderAll()
    setDirty(true)
    saveState()
  }, [setDirty, saveState])

  const handleShadowColorChange = useCallback((color: string) => {
    const canvas = canvasRef.current?.getCanvas()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (active?.shadow) {
      (active.shadow as any).color = color
      canvas.renderAll()
      setDirty(true)
      saveState()
    }
  }, [setDirty, saveState])

  const handleShadowBlurChange = useCallback((blur: number) => {
    const canvas = canvasRef.current?.getCanvas()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (active?.shadow) {
      (active.shadow as any).blur = blur
      canvas.renderAll()
      setDirty(true)
      saveState()
    }
  }, [setDirty, saveState])

  const handleShadowOffsetXChange = useCallback((x: number) => {
    const canvas = canvasRef.current?.getCanvas()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (active?.shadow) {
      (active.shadow as any).offsetX = x
      canvas.renderAll()
      setDirty(true)
      saveState()
    }
  }, [setDirty, saveState])

  const handleShadowOffsetYChange = useCallback((y: number) => {
    const canvas = canvasRef.current?.getCanvas()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (active?.shadow) {
      (active.shadow as any).offsetY = y
      canvas.renderAll()
      setDirty(true)
      saveState()
    }
  }, [setDirty, saveState])

  const handleOutlineToggle = useCallback((enabled: boolean) => {
    const canvas = canvasRef.current?.getCanvas()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (!active) return

    if (enabled) {
      active.set({
        stroke: '#000000',
        strokeWidth: 2,
        paintFirst: 'stroke',
      })
    } else {
      active.set({
        stroke: '',
        strokeWidth: 0,
      })
    }
    canvas.renderAll()
    setDirty(true)
    saveState()
  }, [setDirty, saveState])

  const handleOutlineColorChange = useCallback((color: string) => {
    const canvas = canvasRef.current?.getCanvas()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (active) {
      active.set('stroke', color)
      canvas.renderAll()
      setDirty(true)
      saveState()
    }
  }, [setDirty, saveState])

  const handleOutlineWidthChange = useCallback((width: number) => {
    const canvas = canvasRef.current?.getCanvas()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (active) {
      active.set('strokeWidth', width)
      canvas.renderAll()
      setDirty(true)
      saveState()
    }
  }, [setDirty, saveState])

  const handleFillModeChange = useCallback(async (mode: FillMode) => {
    const canvas = canvasRef.current?.getCanvas()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (!active) return

    if (mode === 'solid') {
      active.set('fill', '#000000')
    } else {
      const { Gradient } = await import('fabric')
      const w = active.width || 100
      const h = active.height || 100
      active.set('fill', new Gradient({
        type: mode,
        coords: mode === 'linear'
          ? { x1: 0, y1: 0, x2: w, y2: 0 }
          : { x1: w / 2, y1: h / 2, x2: w / 2, y2: h / 2, r1: 0, r2: w / 2 },
        colorStops: [
          { offset: 0, color: '#ff0000' },
          { offset: 1, color: '#0000ff' },
        ],
      }))
    }
    canvas.renderAll()
    setDirty(true)
    saveState()
  }, [setDirty, saveState])

  const handleGradientStartColorChange = useCallback((color: string) => {
    const canvas = canvasRef.current?.getCanvas()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (active?.fill && typeof active.fill === 'object' && 'colorStops' in active.fill) {
      const gradient = active.fill as any
      gradient.colorStops[0].color = color
      active.set('fill', gradient)
      canvas.renderAll()
      setDirty(true)
      saveState()
    }
  }, [setDirty, saveState])

  const handleGradientEndColorChange = useCallback((color: string) => {
    const canvas = canvasRef.current?.getCanvas()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (active?.fill && typeof active.fill === 'object' && 'colorStops' in active.fill) {
      const gradient = active.fill as any
      gradient.colorStops[1].color = color
      active.set('fill', gradient)
      canvas.renderAll()
      setDirty(true)
      saveState()
    }
  }, [setDirty, saveState])

  const handleGradientAngleChange = useCallback(async (angle: number) => {
    const canvas = canvasRef.current?.getCanvas()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (!active?.fill || typeof active.fill !== 'object' || !('colorStops' in active.fill)) return

    const w = active.width || 100
    const h = active.height || 100
    const rad = (angle * Math.PI) / 180
    const { Gradient } = await import('fabric')
    const oldGradient = active.fill as any
    active.set('fill', new Gradient({
      type: 'linear',
      coords: {
        x1: w / 2 - (Math.cos(rad) * w) / 2,
        y1: h / 2 - (Math.sin(rad) * h) / 2,
        x2: w / 2 + (Math.cos(rad) * w) / 2,
        y2: h / 2 + (Math.sin(rad) * h) / 2,
      },
      colorStops: oldGradient.colorStops,
    }))
    canvas.renderAll()
    setDirty(true)
    saveState()
  }, [setDirty, saveState])

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

  // Opacity handler
  const handleOpacityChange = useCallback((opacity: number) => {
    canvasRef.current?.setObjectOpacity(opacity)
  }, [])

  // Build shared CanvasProperties props
  const propertiesProps = {
    onAddText: (text: string) => canvasRef.current?.addText(text),
    onAddImage: (url: string) => canvasRef.current?.addImage(url) ?? Promise.resolve(),
    onAddSVG: (svgText: string) => canvasRef.current?.addSVG(svgText) ?? Promise.resolve(),
    onRemoveSelected: () => canvasRef.current?.removeSelected(),
    onDuplicateSelected: () => canvasRef.current?.duplicateSelected(),
    onFontChange: handleFontChange,
    onFontSizeChange: handleFontSizeChange,
    onColorChange: handleTextColorChange,
    onAlignChange: handleAlignChange,
    onBoldToggle: handleBoldToggle,
    onItalicToggle: handleItalicToggle,
    onShadowToggle: handleShadowToggle,
    onShadowColorChange: handleShadowColorChange,
    onShadowBlurChange: handleShadowBlurChange,
    onShadowOffsetXChange: handleShadowOffsetXChange,
    onShadowOffsetYChange: handleShadowOffsetYChange,
    onOutlineToggle: handleOutlineToggle,
    onOutlineColorChange: handleOutlineColorChange,
    onOutlineWidthChange: handleOutlineWidthChange,
    onFillModeChange: handleFillModeChange,
    onGradientStartColorChange: handleGradientStartColorChange,
    onGradientEndColorChange: handleGradientEndColorChange,
    onGradientAngleChange: handleGradientAngleChange,
    onOpacityChange: handleOpacityChange,
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
                    className={`size-7 rounded-full border-2 transition-all shrink-0 ${
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
          <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-card/90 backdrop-blur-sm border border-border rounded-lg px-1.5 py-1 shadow-sm">
            <Button variant="ghost" size="icon" className="size-7" onClick={handleZoomOut} title={t('zoom.out')}>
              <Minus className="size-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums min-w-[3ch] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <Button variant="ghost" size="icon" className="size-7" onClick={handleZoomIn} title={t('zoom.in')}>
              <Plus className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7" onClick={handleZoomReset} title={t('zoom.fit')}>
              <Maximize2 className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Desktop: right properties panel */}
        <div className="hidden lg:block lg:w-64 shrink-0 min-h-0 overflow-y-auto">
          <CanvasProperties {...propertiesProps} />
        </div>
      </div>

      {/* Mobile: bottom properties panel (Sheet-style, height-constrained) */}
      <div className="lg:hidden max-h-[35vh] overflow-y-auto border-t border-border bg-card shrink-0">
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
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

      {/* Auth wall modal — shown when guest tries to save/cart */}
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
