'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { toast } from 'sonner'
import { useDesignEditor } from '@/hooks/useDesignEditor'
import { useDesignPersistence } from '@/hooks/useDesignPersistence'
import { useAuth } from '@/hooks/useAuth'
import type { CanvasHandle } from '@/components/design-studio/CanvasWorkspace'

interface UseDesignSaveParams {
  canvasRef: RefObject<CanvasHandle | null>
  productId: string
  productType: string
  initialCompositionId?: string
  t: (key: string, values?: Record<string, string>) => string
}

/**
 * Hook that manages save/load/auto-save/draft functionality for the design studio.
 * Handles authenticated cloud saves, guest localStorage drafts, draft restoration,
 * auto-save debouncing, and tab-close draft preservation.
 */
export function useDesignSave({
  canvasRef,
  productId,
  productType,
  initialCompositionId,
  t,
}: UseDesignSaveParams) {
  const { authenticated } = useAuth()
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedHashRef = useRef<string>('')
  const isSavingRef = useRef(false)

  const {
    setDirty,
    setSaving,
    setCompositionId,
    setPanelState,
    setLastSavedAt,
    isDirty,
    compositionId,
    activePanel,
  } = useDesignEditor()

  const { save, load, saveDraft, loadDraft, clearDraft } = useDesignPersistence()

  // UI state for auth wall and draft restoration
  const [showAuthWall, setShowAuthWall] = useState(false)
  const [pendingAction, setPendingAction] = useState<'save' | 'cart' | null>(null)
  const [showDraftRestore, setShowDraftRestore] = useState(false)

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
  }, [canvasRef, activePanel])

  // Save to localStorage draft (for guests or auto-save fallback)
  const handleSaveDraft = useCallback(() => {
    const panels = serializePanels()
    if (!panels) return
    saveDraft(productId, panels)
  }, [serializePanels, saveDraft, productId])

  // Save composition (multi-panel) with production export -- returns success boolean
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
      const activeProdPng = canvasRef.current.exportProductionPNG(productType)
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
        productType: productType,
        productId: productId,
        compositionId: compositionId || undefined,
        productionPanels: Object.keys(productionPanels).length > 0 ? productionPanels : undefined,
      })

      if (result) {
        setCompositionId(result.composition_id)
        setDirty(false)
        setLastSavedAt(Date.now())
        setPanelState(activePanel, { productionDataUrl: activeProdPng || null })
        // Clear localStorage draft on successful cloud save
        clearDraft(productId)
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
  }, [canvasRef, productId, productType, compositionId, activePanel, authenticated, setCompositionId, setDirty, setSaving, setLastSavedAt, setPanelState, save, clearDraft, handleSaveDraft, t])

  // Apply to cart -- returns compositionId if successful, null otherwise
  const getCompositionIdForCart = useCallback(async (): Promise<string | null> => {
    if (!canvasRef.current) return null

    // Auth gate: must be authenticated for cart
    if (!authenticated) {
      handleSaveDraft()
      setPendingAction('cart')
      setShowAuthWall(true)
      return null
    }

    if (isDirty || !compositionId) {
      const saved = await handleSave()
      if (!saved) {
        toast.error(t('applyToCartFailed'))
        return null
      }
    }

    return useDesignEditor.getState().compositionId
  }, [canvasRef, isDirty, compositionId, authenticated, handleSave, handleSaveDraft, t])

  // Auto-save: 2s debounce after dirty state changes
  useEffect(() => {
    if (!isDirty) return

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    autoSaveTimerRef.current = setTimeout(() => {
      if (!canvasRef.current) return

      // Check if content actually changed (avoid redundant saves)
      const currentJson = JSON.stringify(canvasRef.current.exportJSON())
      if (currentJson === lastSavedHashRef.current) return

      if (authenticated) {
        handleSave()
      } else {
        handleSaveDraft()
      }
    }, 2000)

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [isDirty, authenticated, handleSave, handleSaveDraft, canvasRef])

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
    if (initialCompositionId) return
    const draft = loadDraft(productId)
    if (draft && draft.panels && Object.keys(draft.panels).length > 0) {
      setShowDraftRestore(true)
    }
  }, [productId, initialCompositionId, loadDraft])

  const handleRestoreDraft = useCallback(async () => {
    setShowDraftRestore(false)
    const draft = loadDraft(productId)
    if (!draft?.panels) return

    // Restore panels into Zustand
    for (const [panel, state] of Object.entries(draft.panels)) {
      setPanelState(panel, { fabricJson: state.fabricJson, isDirty: false })
    }
    // Load front panel into canvas
    if (draft.panels.front?.fabricJson && canvasRef.current) {
      await canvasRef.current.loadFromJSON(draft.panels.front.fabricJson)
    }
    clearDraft(productId)
    toast.success(t('draftRestored'))
  }, [productId, loadDraft, clearDraft, setPanelState, canvasRef, t])

  const handleDiscardDraft = useCallback(() => {
    setShowDraftRestore(false)
    clearDraft(productId)
  }, [clearDraft, productId])

  // Handle pending action after auth modal closes (user may have logged in)
  useEffect(() => {
    if (authenticated && pendingAction) {
      const action = pendingAction
      setPendingAction(null)
      if (action === 'save') {
        handleSave()
      } else if (action === 'cart') {
        // Will be handled by caller via getCompositionIdForCart
        getCompositionIdForCart()
      }
    }
  }, [authenticated, pendingAction, handleSave, getCompositionIdForCart])

  // Load existing composition
  useEffect(() => {
    if (!initialCompositionId) return

    async function loadComposition() {
      const data = await load(initialCompositionId!)
      if (!data) return

      if (data.schema_version === 3 && data.layers && typeof data.layers === 'object' && 'panels' in (data.layers as Record<string, unknown>)) {
        const panels = (data.layers as { panels: Record<string, { fabricJson: object }> }).panels
        for (const [panel, state] of Object.entries(panels)) {
          setPanelState(panel, { fabricJson: state.fabricJson, isDirty: false, compositionId: initialCompositionId })
        }
        if (panels.front && canvasRef.current) {
          await canvasRef.current.loadFromJSON(panels.front.fabricJson)
        }
      } else if (data.schema_version === 2 && data.layers) {
        if (canvasRef.current) {
          await canvasRef.current.loadFromJSON(data.layers)
        }
      }
    }

    const timer = setTimeout(loadComposition, 500)
    return () => clearTimeout(timer)
  }, [initialCompositionId, load, setPanelState, canvasRef])

  return {
    handleSave,
    handleSaveDraft,
    getCompositionIdForCart,
    handleRestoreDraft,
    handleDiscardDraft,
    showAuthWall,
    setShowAuthWall,
    showDraftRestore,
    setShowDraftRestore,
    pendingAction,
    setPendingAction,
  }
}
