'use client'

import { useRef, useCallback, forwardRef, useImperativeHandle, useState } from 'react'
import { useDesignEditor } from '@/hooks/useDesignEditor'
import { PRODUCTION_DIMENSIONS } from '@/lib/print-areas'
import {
  isGuideObject,
  filterGuideObjectsFromJSON,
  type PrintAreaRect,
} from '@/lib/canvas-helpers'
import { loadFabric } from '@/lib/fabric-init'
import { cn } from '@/lib/utils'
import { useCanvasInit } from '@/hooks/useCanvasInit'
import { useCanvasSelection } from '@/hooks/useCanvasSelection'
import { useCanvasLayers } from '@/hooks/useCanvasLayers'

export interface CanvasHandle {
  addText: (text: string, opts?: { fontFamily?: string; fontSize?: number; fill?: string }) => void
  addImage: (url: string) => Promise<void>
  addSVG: (svgText: string) => Promise<void>
  removeSelected: () => void
  duplicateSelected: () => void
  exportPNG: (multiplier?: number) => string
  /** Export canvas at production resolution for a given product type */
  exportProductionPNG: (productType: string) => string
  exportJSON: () => object
  loadFromJSON: (json: object) => Promise<void>
  getSelectedInfo: () => import('@/hooks/useDesignEditor').SelectedObjectInfo | null
  getCanvas: () => any | null
  // Z-order API
  bringForward: () => void
  sendBackward: () => void
  bringToFront: () => void
  sendToBack: () => void
  // Layers API
  getLayers: () => LayerInfo[]
  setObjectVisibility: (id: string, visible: boolean) => void
  setObjectLocked: (id: string, locked: boolean) => void
  // Zoom/Pan API
  zoomTo: (level: number) => void
  resetZoom: () => void
  setObjectOpacity: (opacity: number) => void
  // Transform API
  flipHorizontal: () => void
  flipVertical: () => void
  setRotation: (angle: number) => void
}

export interface LayerInfo {
  id: string
  type: string
  name: string
  visible: boolean
  locked: boolean
}

/** Ghost template data resolved from Printful's mockup-generator/templates API */
export interface GhostTemplateInfo {
  ghostImageUrl: string | null
  backgroundColor: string | null
  printArea: {
    left: number
    top: number
    width: number
    height: number
    templateWidth: number
    templateHeight: number
  }
}

interface CanvasWorkspaceProps {
  productType: string
  variantColor: string
  panelId: string
  productCategory: string
  /** Printful ghost template with exact print area coordinates */
  ghostTemplate?: GhostTemplateInfo
  /** Fallback: blank image URL from Printful catalog (model photos) */
  blankImageUrl?: string
  variantColorHex?: string
  aspectRatio?: number
  onHistorySave?: () => void
  onLayersChange?: (layers: LayerInfo[]) => void
  onCanvasReady?: () => void
  className?: string
}

/** Convert a blob: URL to a data: URL so it survives serialization */
async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
  const response = await fetch(blobUrl)
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export const CanvasWorkspace = forwardRef<CanvasHandle, CanvasWorkspaceProps>(
  function CanvasWorkspace({ productType, variantColor, panelId, productCategory, ghostTemplate, blankImageUrl, variantColorHex, aspectRatio = 1, onHistorySave, onLayersChange, onCanvasReady, className }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasElRef = useRef<HTMLCanvasElement>(null)
    const fabricCanvasRef = useRef<any>(null)
    const printAreaRef = useRef<PrintAreaRect>({ left: 0, top: 0, width: 0, height: 0 })
    const clipRectRef = useRef<any>(null)
    const alignGuidelinesDispose = useRef<(() => void) | null>(null)
    const [isReady, setIsReady] = useState(false)
    const { setSelectedObject, setDirty, setZoomLevel } = useDesignEditor()

    // Extracted hooks
    const { extractObjectInfo } = useCanvasSelection()
    const {
      buildLayers,
      emitLayersChange,
      reorderAfterAdd,
      bringForward,
      sendBackward,
      bringToFront,
      sendToBack,
      setObjectVisibility,
      setObjectLocked,
    } = useCanvasLayers(fabricCanvasRef, onLayersChange)

    // Canvas initialization, event binding, resize observation
    useCanvasInit({
      containerRef,
      canvasElRef,
      fabricCanvasRef,
      printAreaRef,
      clipRectRef,
      alignGuidelinesDispose,
      productType,
      variantColor,
      panelId,
      productCategory,
      ghostTemplate,
      blankImageUrl,
      variantColorHex,
      aspectRatio,
      extractObjectInfo,
      emitLayersChange,
      reorderAfterAdd,
      onHistorySave,
      onCanvasReady,
      onReady: () => setIsReady(true),
    })

    // Expose imperative API
    useImperativeHandle(ref, () => ({
      addText: (text, opts = {}) => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return

        loadFabric().then(({ IText }) => {
          const area = printAreaRef.current
          const itext = new IText(text, {
            left: area.left + area.width / 2,
            top: area.top + area.height / 2,
            originX: 'center',
            originY: 'center',
            fontFamily: opts.fontFamily || 'Inter',
            fontSize: opts.fontSize || 32,
            fill: opts.fill || '#000000',
            editable: true,
            snapAngle: 15,
            snapThreshold: 5,
            data: { id: `text-${Date.now()}`, type: 'userText' },
          })
          if (clipRectRef.current) itext.clipPath = clipRectRef.current
          canvas.add(itext)
          reorderAfterAdd(canvas, itext)
          canvas.setActiveObject(itext)
          canvas.renderAll()
          setDirty(true)
          onHistorySave?.()
        })
      },

      addImage: async (url) => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return

        // Convert blob URLs to data URLs so images survive JSON serialization
        let imageUrl = url
        if (url.startsWith('blob:')) {
          try { imageUrl = await blobUrlToDataUrl(url) } catch { /* fallback to blob */ }
        }

        const fabric = await loadFabric()
        const img = await fabric.FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' })
        const area = printAreaRef.current

        // Scale to fit within 60% of print area
        const maxW = area.width * 0.6
        const maxH = area.height * 0.6
        const scale = Math.min(maxW / (img.width || 1), maxH / (img.height || 1), 1)

        img.set({
          left: area.left + area.width / 2,
          top: area.top + area.height / 2,
          originX: 'center',
          originY: 'center',
          scaleX: scale,
          scaleY: scale,
          snapAngle: 15,
          snapThreshold: 5,
          data: { id: `img-${Date.now()}`, type: 'userImage' },
        })
        if (clipRectRef.current) img.clipPath = clipRectRef.current
        canvas.add(img)
        reorderAfterAdd(canvas, img)
        canvas.setActiveObject(img)
        canvas.renderAll()
        setDirty(true)
        onHistorySave?.()
      },

      addSVG: async (svgText) => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return

        const { loadSVGFromString, util } = await loadFabric()
        const { objects, options } = await loadSVGFromString(svgText)
        const validObjects = objects.filter((o): o is NonNullable<typeof o> => o != null)
        if (validObjects.length === 0) return

        const group = util.groupSVGElements(validObjects, options)
        const area = printAreaRef.current

        // Scale to fit within 60% of print area
        const maxW = area.width * 0.6
        const maxH = area.height * 0.6
        const scale = Math.min(maxW / (group.width || 1), maxH / (group.height || 1), 1)

        group.set({
          left: area.left + area.width / 2,
          top: area.top + area.height / 2,
          originX: 'center',
          originY: 'center',
          scaleX: scale,
          scaleY: scale,
          snapAngle: 15,
          snapThreshold: 5,
          data: { id: `svg-${Date.now()}`, type: 'userSVG' },
        })
        if (clipRectRef.current) group.clipPath = clipRectRef.current
        canvas.add(group)
        reorderAfterAdd(canvas, group)
        canvas.setActiveObject(group)
        canvas.renderAll()
        setDirty(true)
        onHistorySave?.()
      },

      removeSelected: () => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return
        const active = canvas.getActiveObject()
        if (active && !isGuideObject(active)) {
          canvas.remove(active)
          canvas.discardActiveObject()
          canvas.renderAll()
          setDirty(true)
          onHistorySave?.()
        }
      },

      duplicateSelected: () => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return
        const active = canvas.getActiveObject()
        if (active && !isGuideObject(active)) {
          active.clone().then((cloned: any) => {
            cloned.set({
              left: (active.left ?? 0) + 20,
              top: (active.top ?? 0) + 20,
              data: { ...active.data, id: `clone-${Date.now()}` },
            })
            if (clipRectRef.current) cloned.clipPath = clipRectRef.current
            canvas.add(cloned)
            canvas.setActiveObject(cloned)
            canvas.renderAll()
            setDirty(true)
            onHistorySave?.()
          })
        }
      },

      exportPNG: (multiplier = 2) => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return ''

        // Hide guide/overlay objects -- toDataURL doesn't respect excludeFromExport
        const hiddenObjs: any[] = []
        canvas.getObjects().forEach((obj: any) => {
          if (isGuideObject(obj) && obj.visible !== false) {
            obj.visible = false
            hiddenObjs.push(obj)
          }
        })

        const origBg = canvas.backgroundColor
        canvas.backgroundColor = 'transparent'
        canvas.renderAll()

        // Temporarily dispose alignment guidelines to prevent crash:
        // initAligningGuidelines registers a before:render listener that calls
        // canvas.clearContext(canvas.contextTop). During toDataURL(), Fabric.js v6
        // Canvas.toCanvasElement() sets upper.ctx = undefined, so the before:render
        // listener crashes with "Cannot read properties of undefined (reading 'clearRect')".
        const hadGuidelines = !!alignGuidelinesDispose.current
        if (hadGuidelines) {
          alignGuidelinesDispose.current!()
          alignGuidelinesDispose.current = null
        }

        const dataUrl = canvas.toDataURL({ format: 'png', quality: 1, multiplier })

        // Re-initialize alignment guidelines after export
        if (hadGuidelines) {
          import('fabric/extensions').then(({ initAligningGuidelines }) => {
            if (fabricCanvasRef.current) {
              alignGuidelinesDispose.current = initAligningGuidelines(fabricCanvasRef.current, {
                margin: 4, width: 1, color: 'rgba(255, 0, 0, 0.75)',
              })
            }
          }).catch(() => { /* extension unavailable */ })
        }

        // Restore visibility and background
        hiddenObjs.forEach((obj) => { obj.visible = true })
        canvas.backgroundColor = origBg
        canvas.renderAll()

        return dataUrl
      },

      exportProductionPNG: (pt: string) => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return ''

        const prodDims = PRODUCTION_DIMENSIONS[pt] || PRODUCTION_DIMENSIONS['tshirt']
        const printArea = printAreaRef.current
        if (!printArea) return ''

        // Calculate multiplier to reach production resolution from print area size
        const multiplier = prodDims.w / printArea.width

        // Hide guide/overlay objects
        const hiddenObjs: any[] = []
        canvas.getObjects().forEach((obj: any) => {
          if (isGuideObject(obj) && obj.visible !== false) {
            obj.visible = false
            hiddenObjs.push(obj)
          }
        })

        // Reset viewport transform (zoom/pan) for clean export
        const savedVPT = canvas.viewportTransform
          ? ([...canvas.viewportTransform] as [number, number, number, number, number, number])
          : ([1, 0, 0, 1, 0, 0] as [number, number, number, number, number, number])
        canvas.viewportTransform = [1, 0, 0, 1, 0, 0] as any

        const origBg = canvas.backgroundColor
        canvas.backgroundColor = 'transparent'

        // Temporarily dispose alignment guidelines (same reason as exportPNG)
        const hadGuidelines = !!alignGuidelinesDispose.current
        if (hadGuidelines) {
          alignGuidelinesDispose.current!()
          alignGuidelinesDispose.current = null
        }

        // Export only the print area region at production resolution
        const dataUrl = canvas.toDataURL({
          format: 'png',
          quality: 1,
          multiplier,
          left: printArea.left,
          top: printArea.top,
          width: printArea.width,
          height: printArea.height,
        })

        // Re-initialize alignment guidelines after export
        if (hadGuidelines) {
          import('fabric/extensions').then(({ initAligningGuidelines }) => {
            if (fabricCanvasRef.current) {
              alignGuidelinesDispose.current = initAligningGuidelines(fabricCanvasRef.current, {
                margin: 4, width: 1, color: 'rgba(255, 0, 0, 0.75)',
              })
            }
          }).catch(() => { /* extension unavailable */ })
        }

        // Restore visibility, background, and viewport
        hiddenObjs.forEach((obj) => { obj.visible = true })
        canvas.backgroundColor = origBg
        canvas.viewportTransform = savedVPT as any
        canvas.renderAll()

        return dataUrl
      },

      exportJSON: () => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return {}
        return filterGuideObjectsFromJSON(canvas.toObject(['data']))
      },

      loadFromJSON: async (json) => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return
        const filtered = filterGuideObjectsFromJSON(json as Record<string, unknown>)
        const objectsArray = Array.isArray(filtered.objects) ? filtered.objects : []
        if (objectsArray.length > 0) {
          const { util } = await loadFabric()
          const enlivened = await util.enlivenObjects(objectsArray)
          for (const obj of enlivened) {
            if (clipRectRef.current) (obj as any).clipPath = clipRectRef.current
            canvas.add(obj as any)
            reorderAfterAdd(canvas, obj as any)
          }
          canvas.renderAll()
        }
      },

      getSelectedInfo: () => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return null
        const active = canvas.getActiveObject()
        return active ? extractObjectInfo(active) : null
      },

      getCanvas: () => fabricCanvasRef.current,

      // Z-order (delegated to useCanvasLayers)
      bringForward,
      sendBackward,
      bringToFront,
      sendToBack,

      // Layers (delegated to useCanvasLayers)
      getLayers: buildLayers,
      setObjectVisibility,
      setObjectLocked,

      // Zoom/Pan
      zoomTo: (level: number) => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return
        const zoom = Math.max(0.25, Math.min(5, level))
        const center = { x: canvas.getWidth() / 2, y: canvas.getHeight() / 2 }
        canvas.zoomToPoint(center, zoom)
        setZoomLevel(zoom)
      },

      resetZoom: () => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
        setZoomLevel(1)
      },

      setObjectOpacity: (opacity: number) => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return
        const active = canvas.getActiveObject()
        if (active && !isGuideObject(active)) {
          active.set('opacity', opacity)
          canvas.renderAll()
          setDirty(true)
          onHistorySave?.()
          setSelectedObject(extractObjectInfo(active))
        }
      },

      flipHorizontal: () => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return
        const active = canvas.getActiveObject()
        if (active && !isGuideObject(active)) {
          active.set('flipX', !active.flipX)
          canvas.requestRenderAll()
          setDirty(true)
          onHistorySave?.()
        }
      },

      flipVertical: () => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return
        const active = canvas.getActiveObject()
        if (active && !isGuideObject(active)) {
          active.set('flipY', !active.flipY)
          canvas.requestRenderAll()
          setDirty(true)
          onHistorySave?.()
        }
      },

      setRotation: (angle: number) => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return
        const active = canvas.getActiveObject()
        if (active && !isGuideObject(active)) {
          active.set('angle', angle)
          active.setCoords()
          canvas.requestRenderAll()
          setDirty(true)
          onHistorySave?.()
          setSelectedObject(extractObjectInfo(active))
        }
      },
    }), [setDirty, onHistorySave, extractObjectInfo, setSelectedObject, setZoomLevel, buildLayers, emitLayersChange, reorderAfterAdd, bringForward, sendBackward, bringToFront, sendToBack, setObjectVisibility, setObjectLocked]) // eslint-disable-line react-hooks/exhaustive-deps

    return (
      <div
        ref={containerRef}
        className={cn(
          'relative flex items-center justify-center bg-muted/50 overflow-hidden',
          className
        )}
        style={{ touchAction: 'none' }}
      >
        <canvas ref={canvasElRef} />
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" />
          </div>
        )}
      </div>
    )
  }
)
