'use client'

import { useCallback, type MutableRefObject } from 'react'
import { isGuideObject } from '@/lib/canvas-helpers'
import type { LayerInfo } from '@/components/design-studio/CanvasWorkspace'

/**
 * Hook for layer management: building layer lists, z-ordering, visibility, and lock/unlock.
 * Operates on the Fabric.js canvas via a ref.
 */
export function useCanvasLayers(
  fabricCanvasRef: MutableRefObject<any>,
  onLayersChange?: (layers: LayerInfo[]) => void
) {
  // Build layers list from canvas objects, excluding guides
  const buildLayers = useCallback((): LayerInfo[] => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return []
    return canvas.getObjects()
      .filter((obj: any) => !isGuideObject(obj) && obj.data?.type !== 'productBackground')
      .map((obj: any, i: number) => ({
        id: obj.data?.id || `layer-${i}`,
        type: obj.type === 'i-text' || obj.type === 'textbox' ? 'text' : 'image',
        name: obj.data?.name || (obj.type === 'i-text' || obj.type === 'textbox' ? `Text ${i + 1}` : `Image ${i + 1}`),
        visible: obj.visible !== false,
        locked: !obj.selectable,
      }))
  }, [fabricCanvasRef])

  const emitLayersChange = useCallback(() => {
    onLayersChange?.(buildLayers())
  }, [buildLayers, onLayersChange])

  /**
   * After adding a user object, ensure it sits below the ghost overlay and guides.
   * Layer order: productBackground -> user objects -> ghostOverlay -> guides
   */
  const reorderAfterAdd = useCallback((canvas: any, obj: any) => {
    const ghostObj = canvas.getObjects().find((o: any) => o.data?.type === 'ghostOverlay')
    if (ghostObj) {
      const ghostIdx = canvas.getObjects().indexOf(ghostObj)
      const objIdx = canvas.getObjects().indexOf(obj)
      if (objIdx > ghostIdx) {
        // Move user object just below ghost
        canvas.moveObjectTo(obj, ghostIdx)
      }
    }
  }, [])

  // Z-order operations (respects ghost overlay and background boundaries)
  const bringForward = useCallback(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (active && !isGuideObject(active)) {
      const objs = canvas.getObjects()
      const activeIdx = objs.indexOf(active)
      // Don't move past ghost overlay
      const ghostIdx = objs.findIndex((o: any) => o.data?.type === 'ghostOverlay')
      if (ghostIdx >= 0 && activeIdx + 1 >= ghostIdx) return
      canvas.bringObjectForward(active)
      canvas.renderAll()
      emitLayersChange()
    }
  }, [fabricCanvasRef, emitLayersChange])

  const sendBackward = useCallback(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (active && !isGuideObject(active)) {
      const objs = canvas.getObjects()
      const activeIdx = objs.indexOf(active)
      // Don't move below productBackground
      const bgIdx = objs.findIndex((o: any) => o.data?.type === 'productBackground')
      if (bgIdx >= 0 && activeIdx - 1 <= bgIdx) return
      canvas.sendObjectBackwards(active)
      canvas.renderAll()
      emitLayersChange()
    }
  }, [fabricCanvasRef, emitLayersChange])

  const bringToFront = useCallback(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (active && !isGuideObject(active)) {
      // Move to just below ghost overlay (or guides if no ghost)
      const ghostObj = canvas.getObjects().find((o: any) => o.data?.type === 'ghostOverlay')
      if (ghostObj) {
        const ghostIdx = canvas.getObjects().indexOf(ghostObj)
        canvas.moveObjectTo(active, ghostIdx)
      } else {
        canvas.bringObjectToFront(active)
      }
      canvas.renderAll()
      emitLayersChange()
    }
  }, [fabricCanvasRef, emitLayersChange])

  const sendToBack = useCallback(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (active && !isGuideObject(active)) {
      // Send to back but keep above productBackground
      const bgObjects = canvas.getObjects().filter(
        (obj: any) => obj.data?.type === 'productBackground'
      )
      const targetIndex = bgObjects.length // just above all backgrounds
      canvas.moveObjectTo(active, targetIndex)
      canvas.renderAll()
      emitLayersChange()
    }
  }, [fabricCanvasRef, emitLayersChange])

  const setObjectVisibility = useCallback((id: string, visible: boolean) => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    const obj = canvas.getObjects().find((o: any) => o.data?.id === id)
    if (obj) {
      obj.set('visible', visible)
      canvas.renderAll()
      emitLayersChange()
    }
  }, [fabricCanvasRef, emitLayersChange])

  const setObjectLocked = useCallback((id: string, locked: boolean) => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    const obj = canvas.getObjects().find((o: any) => o.data?.id === id)
    if (obj) {
      obj.set({
        selectable: !locked,
        evented: !locked,
      })
      canvas.renderAll()
      emitLayersChange()
    }
  }, [fabricCanvasRef, emitLayersChange])

  return {
    buildLayers,
    emitLayersChange,
    reorderAfterAdd,
    bringForward,
    sendBackward,
    bringToFront,
    sendToBack,
    setObjectVisibility,
    setObjectLocked,
  }
}
