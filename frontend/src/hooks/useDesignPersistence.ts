/**
 * Hook for saving and loading design compositions to/from Supabase,
 * plus localStorage draft support for guest users and offline fallback.
 */

import { useCallback, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'

interface SaveCompositionParams {
  fabricJson: object
  previewDataUrl: string
  productType: string
  productId: string
  compositionId?: string
  /** Production-resolution PNGs per panel (base64 data URLs) */
  productionPanels?: Record<string, string>
}

interface SaveResult {
  composition_id: string
  preview_url: string
}

interface LoadResult {
  id: string
  schema_version: number
  layers: object
  product_type: string
  product_id: string
  preview_url: string
  status: string
}

interface DraftData {
  panels: Record<string, { fabricJson: object | null; isDirty?: boolean }>
  savedAt: string
  productId: string
}

const DRAFT_PREFIX = 'design-draft-'
const DRAFT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export function useDesignPersistence() {
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const save = useCallback(async (params: SaveCompositionParams): Promise<SaveResult | null> => {
    setIsSaving(true)
    try {
      const res = await apiFetch('/api/designs/compose-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Save failed' }))
        throw new Error(err.error || 'Save failed')
      }

      return await res.json()
    } catch (error) {
      console.error('Failed to save composition:', error)
      return null
    } finally {
      setIsSaving(false)
    }
  }, [])

  const load = useCallback(async (compositionId: string): Promise<LoadResult | null> => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/designs/composition/${compositionId}`)
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  /** Save design panels to localStorage (guest/offline fallback) */
  const saveDraft = useCallback((productId: string, panels: Record<string, { fabricJson: object | null }>) => {
    try {
      const draft: DraftData = {
        panels,
        savedAt: new Date().toISOString(),
        productId,
      }
      localStorage.setItem(`${DRAFT_PREFIX}${productId}`, JSON.stringify(draft))
    } catch (error) {
      console.error('Failed to save draft:', error)
    }
  }, [])

  /** Load design draft from localStorage, returns null if expired or not found */
  const loadDraft = useCallback((productId: string): DraftData | null => {
    try {
      const raw = localStorage.getItem(`${DRAFT_PREFIX}${productId}`)
      if (!raw) return null
      const draft: DraftData = JSON.parse(raw)
      // Check expiry
      const age = Date.now() - new Date(draft.savedAt).getTime()
      if (age > DRAFT_EXPIRY_MS) {
        localStorage.removeItem(`${DRAFT_PREFIX}${productId}`)
        return null
      }
      return draft
    } catch {
      return null
    }
  }, [])

  /** Clear draft from localStorage */
  const clearDraft = useCallback((productId: string) => {
    try {
      localStorage.removeItem(`${DRAFT_PREFIX}${productId}`)
    } catch {
      // Ignore
    }
  }, [])

  return { save, load, isSaving, isLoading, saveDraft, loadDraft, clearDraft }
}
