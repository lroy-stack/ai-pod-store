/**
 * Canvas history hook for undo/redo functionality.
 * Stores JSON snapshots of canvas state, debounced to avoid capturing every pixel of a drag.
 * Guide objects (printAreaGuide, safeZone, productBackground) are excluded from snapshots.
 */

import { useCallback, useRef } from 'react'
import type { Canvas, FabricObject } from 'fabric'
import { GUIDE_DATA_TYPES, filterGuideObjectsFromJSON } from '@/lib/canvas-helpers'

const MAX_STATES = 20
const DEBOUNCE_MS = 300

interface CanvasHistoryReturn {
  saveState: () => void
  undo: () => Promise<void>
  redo: () => Promise<void>
  canUndo: boolean
  canRedo: boolean
  clear: () => void
}

type FabricObjectWithData = FabricObject & { data?: { type?: string } }

export function useCanvasHistory(
  canvasRef: React.RefObject<Canvas | null>,
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void,
  onAfterRestore?: () => void
): CanvasHistoryReturn {
  const states = useRef<string[]>([])
  const currentIndex = useRef(-1)
  const isRestoring = useRef(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const getCanUndo = () => currentIndex.current > 0
  const getCanRedo = () => currentIndex.current < states.current.length - 1

  const notifyChange = useCallback(() => {
    onHistoryChange?.(getCanUndo(), getCanRedo())
  }, [onHistoryChange])

  const saveState = useCallback(() => {
    if (isRestoring.current) return
    const canvas = canvasRef.current
    if (!canvas) return

    // Debounce rapid changes (e.g., during drag)
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(() => {
      const rawJson = canvas.toObject(['data'])
      // Filter out guide objects so they don't duplicate on undo/redo
      const filtered = filterGuideObjectsFromJSON(rawJson)
      const json = JSON.stringify(filtered)

      // Truncate redo history when new action is taken
      if (currentIndex.current < states.current.length - 1) {
        states.current = states.current.slice(0, currentIndex.current + 1)
      }

      states.current.push(json)

      // Cap at MAX_STATES
      if (states.current.length > MAX_STATES) {
        states.current.shift()
      } else {
        currentIndex.current++
      }

      notifyChange()
    }, DEBOUNCE_MS)
  }, [canvasRef, notifyChange])

  const undo = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || !getCanUndo()) return

    isRestoring.current = true
    currentIndex.current--
    const json = JSON.parse(states.current[currentIndex.current])

    // Remove user objects (keep guides/ghost/bg)
    canvas.getObjects()
      .filter((obj) => {
        const o = obj as FabricObjectWithData
        return !o.data?.type || !GUIDE_DATA_TYPES.has(o.data.type)
      })
      .forEach((obj) => canvas.remove(obj))

    // Additively restore user objects from snapshot
    const objectsArray = Array.isArray(json.objects) ? json.objects : []
    if (objectsArray.length > 0) {
      const { util } = await import('fabric')
      const enlivened = await util.enlivenObjects(objectsArray)
      for (const obj of enlivened) canvas.add(obj as any)
      // Reorder: user objects below ghost overlay
      const ghostObj = canvas.getObjects().find((o: any) => o.data?.type === 'ghostOverlay')
      if (ghostObj) {
        const ghostIdx = canvas.getObjects().indexOf(ghostObj)
        canvas.getObjects().forEach((o: any) => {
          if (!o.data?.type || !GUIDE_DATA_TYPES.has(o.data.type)) {
            if (canvas.getObjects().indexOf(o) > ghostIdx)
              canvas.moveObjectTo(o, ghostIdx)
          }
        })
      }
    }

    canvas.renderAll()
    isRestoring.current = false
    onAfterRestore?.()
    notifyChange()
  }, [canvasRef, notifyChange, onAfterRestore])

  const redo = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || !getCanRedo()) return

    isRestoring.current = true
    currentIndex.current++
    const json = JSON.parse(states.current[currentIndex.current])

    // Remove user objects, keep guides/ghost/bg
    canvas.getObjects()
      .filter((obj) => {
        const o = obj as FabricObjectWithData
        return !o.data?.type || !GUIDE_DATA_TYPES.has(o.data.type)
      })
      .forEach((obj) => canvas.remove(obj))

    // Additively restore user objects from snapshot
    const objectsArray = Array.isArray(json.objects) ? json.objects : []
    if (objectsArray.length > 0) {
      const { util } = await import('fabric')
      const enlivened = await util.enlivenObjects(objectsArray)
      for (const obj of enlivened) canvas.add(obj as any)
      // Reorder: user objects below ghost overlay
      const ghostObj = canvas.getObjects().find((o: any) => o.data?.type === 'ghostOverlay')
      if (ghostObj) {
        const ghostIdx = canvas.getObjects().indexOf(ghostObj)
        canvas.getObjects().forEach((o: any) => {
          if (!o.data?.type || !GUIDE_DATA_TYPES.has(o.data.type)) {
            if (canvas.getObjects().indexOf(o) > ghostIdx)
              canvas.moveObjectTo(o, ghostIdx)
          }
        })
      }
    }

    canvas.renderAll()
    isRestoring.current = false
    onAfterRestore?.()
    notifyChange()
  }, [canvasRef, notifyChange, onAfterRestore])

  const clear = useCallback(() => {
    states.current = []
    currentIndex.current = -1
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }
    notifyChange()
  }, [notifyChange])

  return {
    saveState,
    undo,
    redo,
    canUndo: getCanUndo(),
    canRedo: getCanRedo(),
    clear,
  }
}
