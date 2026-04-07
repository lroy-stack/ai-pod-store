'use client'

import { useEffect, type MutableRefObject, type RefObject } from 'react'
import { useDesignEditor, type SelectedObjectInfo } from '@/hooks/useDesignEditor'
import { getCanvasPrintArea } from '@/lib/print-area-config'
import {
  drawPrintAreaGuide,
  drawSafeZone,
  clampObjectToPrintArea,
  getCappedDPR,
  calculateCanvasDimensions,
  removeGuides,
  isGuideObject,
  type PrintAreaRect,
} from '@/lib/canvas-helpers'
import { loadFonts, loadFabric } from '@/lib/fabric-init'
import { colorNameToHex, isLightColor } from '@/lib/color-map'
import type { GhostTemplateInfo } from '@/components/design-studio/CanvasWorkspace'

/** Normalize a variant color name for template file matching */
function normalizeColorForTemplate(color: string): string {
  return color.toLowerCase().trim().replace(/\s+/g, '-')
}

/** Get blank template URL candidates for a product type and color */
function getBlankTemplateUrls(productType: string, color: string, panelId: string): string[] {
  const normalized = normalizeColorForTemplate(color)
  const panelSuffix = panelId !== 'front' ? `-${panelId}` : ''
  return [
    `/mockup-templates/${productType}-${normalized}${panelSuffix}.png`,
    `/mockup-templates/${productType}-${normalized}.png`,
    `/mockup-templates/${productType}-${isLightColor(colorNameToHex(color)) ? 'white' : 'black'}${panelSuffix}.png`,
    `/mockup-templates/${productType}-${isLightColor(colorNameToHex(color)) ? 'white' : 'black'}.png`,
  ]
}

interface UseCanvasInitParams {
  containerRef: RefObject<HTMLDivElement | null>
  canvasElRef: RefObject<HTMLCanvasElement | null>
  fabricCanvasRef: MutableRefObject<any>
  printAreaRef: MutableRefObject<PrintAreaRect>
  clipRectRef: MutableRefObject<any>
  alignGuidelinesDispose: MutableRefObject<(() => void) | null>
  productType: string
  variantColor: string
  panelId: string
  productCategory: string
  ghostTemplate?: GhostTemplateInfo
  blankImageUrl?: string
  variantColorHex?: string
  aspectRatio: number
  extractObjectInfo: (obj: any) => SelectedObjectInfo | null
  emitLayersChange: () => void
  reorderAfterAdd: (canvas: any, obj: any) => void
  onHistorySave?: () => void
  onCanvasReady?: () => void
  onReady: () => void
}

/**
 * Hook that handles canvas initialization, event binding, ghost/background loading,
 * resize observation, and cleanup. Includes pinch-to-zoom touch support.
 */
export function useCanvasInit({
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
  onReady,
}: UseCanvasInitParams) {
  const { setSelectedObject, setDirty, setZoomLevel } = useDesignEditor()

  // === Main canvas initialization ===
  useEffect(() => {
    let destroyed = false
    let canvas: any = null

    async function init() {
      if (!containerRef.current || !canvasElRef.current) return

      await loadFonts()
      const fabric = await loadFabric()

      if (destroyed) return

      const container = containerRef.current!
      const rect = container.getBoundingClientRect()

      // If ghost template available, use its aspect ratio (typically 1:1 = 3000x3000)
      const effectiveAspectRatio = ghostTemplate
        ? ghostTemplate.printArea.templateWidth / ghostTemplate.printArea.templateHeight
        : aspectRatio

      const dims = calculateCanvasDimensions(rect.width, rect.height, effectiveAspectRatio)
      const dpr = getCappedDPR()

      // Fabric.js v6: DPR must be set via config before canvas creation
      fabric.config.configure({ devicePixelRatio: dpr })

      // Determine background color:
      // Ghost template bg -> variant hex -> named color hex -> default grey
      const bgColor = ghostTemplate?.backgroundColor
        || variantColorHex
        || colorNameToHex(variantColor)
        || '#f5f5f5'

      canvas = new fabric.Canvas(canvasElRef.current!, {
        width: dims.width,
        height: dims.height,
        backgroundColor: bgColor,
        selection: true,
        preserveObjectStacking: true,
        enableRetinaScaling: true,
      })

      fabricCanvasRef.current = canvas

      // === Calculate print area ===
      let printArea: PrintAreaRect

      if (ghostTemplate) {
        // EXACT coordinates from Printful templates API, scaled to canvas
        const scale = dims.width / ghostTemplate.printArea.templateWidth
        printArea = {
          left: Math.round(ghostTemplate.printArea.left * scale),
          top: Math.round(ghostTemplate.printArea.top * scale),
          width: Math.round(ghostTemplate.printArea.width * scale),
          height: Math.round(ghostTemplate.printArea.height * scale),
        }
      } else {
        // Fallback: percentage-based padding
        printArea = getCanvasPrintArea(productCategory, dims.width, dims.height, panelId)
      }
      printAreaRef.current = printArea

      // Create clipPath rect for visual clipping of user objects to print area
      clipRectRef.current = new fabric.Rect({
        left: printArea.left,
        top: printArea.top,
        width: printArea.width,
        height: printArea.height,
        absolutePositioned: true,
      })

      // === Load ghost image as OVERLAY (above user objects, below guides) ===
      if (ghostTemplate?.ghostImageUrl && !destroyed) {
        try {
          const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(ghostTemplate.ghostImageUrl)}`
          const ghostImg = await fabric.FabricImage.fromURL(proxyUrl, { crossOrigin: 'anonymous' })
          if (!destroyed) {
            // Scale ghost to fill canvas exactly
            const scaleX = dims.width / (ghostImg.width || dims.width)
            const scaleY = dims.height / (ghostImg.height || dims.height)
            ghostImg.set({
              scaleX,
              scaleY,
              left: 0,
              top: 0,
              selectable: false,
              evented: false,
              excludeFromExport: true,
              data: { type: 'ghostOverlay' },
            })
            canvas.add(ghostImg)
            // Ghost goes on top — we'll re-order after adding guides
          }
        } catch {
          // Ghost image unavailable — continue without it
        }
      } else if (!destroyed) {
        // Fallback: try blank image or local templates as BACKGROUND
        let templateLoaded = false

        const addBackground = (img: any) => {
          const scaleX = dims.width / (img.width || dims.width)
          const scaleY = dims.height / (img.height || dims.height)
          const scale = Math.max(scaleX, scaleY)
          img.set({
            scaleX: scale,
            scaleY: scale,
            left: (dims.width - (img.width || 0) * scale) / 2,
            top: (dims.height - (img.height || 0) * scale) / 2,
            selectable: false,
            evented: false,
            excludeFromExport: true,
            data: { type: 'productBackground' },
          })
          canvas.add(img)
          canvas.sendObjectToBack(img)
          templateLoaded = true
        }

        if (blankImageUrl) {
          try {
            const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(blankImageUrl)}`
            const img = await fabric.FabricImage.fromURL(proxyUrl, { crossOrigin: 'anonymous' })
            if (!destroyed) addBackground(img)
          } catch { /* fall through */ }
        }

        if (!templateLoaded && !destroyed) {
          const templateUrls = getBlankTemplateUrls(productType, variantColor, panelId)
          for (const url of templateUrls) {
            if (destroyed || templateLoaded) break
            try {
              const img = await fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
              if (!destroyed) addBackground(img)
            } catch { /* next */ }
          }
        }
      }

      // Draw print area and safe zone guides
      const garmentIsLight = isLightColor(ghostTemplate?.backgroundColor || variantColorHex || colorNameToHex(variantColor))
      await drawPrintAreaGuide(canvas, printArea, garmentIsLight)
      await drawSafeZone(canvas, printArea, garmentIsLight)

      // Ensure ghost overlay is on top of everything (including guides)
      // Layer order: bg color -> user objects -> ghost overlay -> print area guide -> safe zone
      const ghostObj = canvas.getObjects().find((o: any) => o.data?.type === 'ghostOverlay')
      if (ghostObj) {
        // Move ghost BELOW the guide lines but ABOVE everything else
        const guideObjects = canvas.getObjects().filter(
          (o: any) => o.data?.type === 'printAreaGuide' || o.data?.type === 'safeZone'
        )
        if (guideObjects.length > 0) {
          // Ghost should be just below the first guide
          const firstGuideIdx = canvas.getObjects().indexOf(guideObjects[0])
          canvas.moveObjectTo(ghostObj, firstGuideIdx)
        }
      }

      // Initialize alignment guidelines (built-in Fabric.js v6 extension)
      try {
        const { initAligningGuidelines } = await import('fabric/extensions')
        alignGuidelinesDispose.current = initAligningGuidelines(canvas, {
          margin: 4,
          width: 1,
          color: 'rgba(255, 0, 0, 0.75)',
        })
      } catch {
        // Extension not available — skip snap guides
      }

      // Event listeners
      canvas.on('selection:created', (e: any) => {
        const obj = e.selected?.[0]
        if (obj) setSelectedObject(extractObjectInfo(obj))
      })

      canvas.on('selection:updated', (e: any) => {
        const obj = e.selected?.[0]
        if (obj) setSelectedObject(extractObjectInfo(obj))
      })

      canvas.on('selection:cleared', () => {
        setSelectedObject(null)
      })

      canvas.on('object:modified', (e: any) => {
        setDirty(true)
        onHistorySave?.()
        const obj = e.target
        if (obj) {
          setSelectedObject(extractObjectInfo(obj))
          // Check if object exceeds print area bounds
          if (!isGuideObject(obj)) {
            const pa = printAreaRef.current
            const bound = obj.getBoundingRect()
            const outsidePrintArea = (
              bound.left < pa.left ||
              bound.top < pa.top ||
              bound.left + bound.width > pa.left + pa.width ||
              bound.top + bound.height > pa.top + pa.height
            )
            useDesignEditor.getState().setPrintAreaWarning(outsidePrintArea ? 'outsidePrintArea' : null)
          }
        }
        emitLayersChange()
      })

      canvas.on('object:moving', (e: any) => {
        const obj = e.target
        if (obj && !isGuideObject(obj)) {
          clampObjectToPrintArea(obj, printAreaRef.current)
        }
      })

      canvas.on('text:changed', () => {
        setDirty(true)
        onHistorySave?.()
        const active = canvas.getActiveObject()
        if (active) setSelectedObject(extractObjectInfo(active))
      })

      canvas.on('object:added', () => emitLayersChange())
      canvas.on('object:removed', () => emitLayersChange())

      // --- Zoom: mouse wheel ---
      canvas.on('mouse:wheel', (opt: any) => {
        const e = opt.e as WheelEvent
        const delta = e.deltaY
        let zoom = canvas.getZoom() * (0.999 ** delta)
        zoom = Math.max(0.25, Math.min(5, zoom))
        canvas.zoomToPoint({ x: e.offsetX, y: e.offsetY }, zoom)
        e.preventDefault()
        e.stopPropagation()
        setZoomLevel(zoom)
      })

      // --- Touch: pinch-to-zoom ---
      let touchStartDistance = 0
      let touchStartZoom = 1
      let isTouchPinching = false

      const getTouchDistance = (t1: Touch, t2: Touch) => {
        const dx = t1.clientX - t2.clientX
        const dy = t1.clientY - t2.clientY
        return Math.sqrt(dx * dx + dy * dy)
      }

      const getTouchCenter = (t1: Touch, t2: Touch): { x: number; y: number } => {
        const canvasEl = canvasElRef.current
        if (!canvasEl) return { x: 0, y: 0 }
        const elRect = canvasEl.getBoundingClientRect()
        return {
          x: (t1.clientX + t2.clientX) / 2 - elRect.left,
          y: (t1.clientY + t2.clientY) / 2 - elRect.top,
        }
      }

      const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 2) {
          isTouchPinching = true
          touchStartDistance = getTouchDistance(e.touches[0], e.touches[1])
          touchStartZoom = canvas.getZoom()
          e.preventDefault()
        }
      }

      const handleTouchMove = (e: TouchEvent) => {
        if (!isTouchPinching || e.touches.length !== 2) return
        e.preventDefault()
        const currentDistance = getTouchDistance(e.touches[0], e.touches[1])
        const scale = currentDistance / touchStartDistance
        let zoom = Math.max(0.25, Math.min(5, touchStartZoom * scale))
        const center = getTouchCenter(e.touches[0], e.touches[1])
        canvas.zoomToPoint(center, zoom)
        setZoomLevel(zoom)
      }

      const handleTouchEnd = (e: TouchEvent) => {
        if (e.touches.length < 2) {
          isTouchPinching = false
        }
      }

      const canvasEl = canvasElRef.current
      if (canvasEl) {
        canvasEl.addEventListener('touchstart', handleTouchStart, { passive: false })
        canvasEl.addEventListener('touchmove', handleTouchMove, { passive: false })
        canvasEl.addEventListener('touchend', handleTouchEnd)
      }

      // Store touch cleanup ref
      ;(canvas as any).__touchCleanup = () => {
        if (canvasEl) {
          canvasEl.removeEventListener('touchstart', handleTouchStart)
          canvasEl.removeEventListener('touchmove', handleTouchMove)
          canvasEl.removeEventListener('touchend', handleTouchEnd)
        }
      }

      // --- Pan: space+drag ---
      let isPanning = false
      let panStart = { x: 0, y: 0 }

      const handleKeyDownForPan = (e: KeyboardEvent) => {
        if (e.code === 'Space' && !e.repeat) {
          e.preventDefault()
          canvas.defaultCursor = 'grab'
          canvas.selection = false
        }
      }
      const handleKeyUpForPan = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
          canvas.defaultCursor = 'default'
          canvas.selection = true
          isPanning = false
        }
      }
      document.addEventListener('keydown', handleKeyDownForPan)
      document.addEventListener('keyup', handleKeyUpForPan)

      canvas.on('mouse:down', (opt: any) => {
        // Only pan if space is held (check cursor style as proxy)
        if (canvas.defaultCursor === 'grab') {
          isPanning = true
          canvas.defaultCursor = 'grabbing'
          const e = opt.e as MouseEvent
          panStart = { x: e.clientX, y: e.clientY }
        }
      })
      canvas.on('mouse:move', (opt: any) => {
        if (!isPanning) return
        const e = opt.e as MouseEvent
        const vpt = canvas.viewportTransform!
        vpt[4] += e.clientX - panStart.x
        vpt[5] += e.clientY - panStart.y
        panStart = { x: e.clientX, y: e.clientY }
        canvas.requestRenderAll()
      })
      canvas.on('mouse:up', () => {
        if (isPanning) {
          isPanning = false
          canvas.defaultCursor = 'grab'
        }
      })

      // Store cleanup refs for pan keyboard listeners
      ;(canvas as any).__panCleanup = () => {
        document.removeEventListener('keydown', handleKeyDownForPan)
        document.removeEventListener('keyup', handleKeyUpForPan)
      }

      // Restore saved panel state from Zustand (if switching panels)
      // Uses additive restore: enlivenObjects + canvas.add() to avoid
      // destroying background color, ghost overlay, and guide objects
      const savedPanelState = useDesignEditor.getState().panelStates[panelId]
      if (savedPanelState?.fabricJson) {
        try {
          const json = savedPanelState.fabricJson as Record<string, unknown>
          const objectsArray = Array.isArray(json.objects) ? json.objects : []
          if (objectsArray.length > 0) {
            const enlivened = await fabric.util.enlivenObjects(objectsArray)
            for (const obj of enlivened) {
              if (clipRectRef.current) (obj as any).clipPath = clipRectRef.current
              canvas.add(obj as any)
              reorderAfterAdd(canvas, obj as any)
            }
            canvas.renderAll()
          }
        } catch {
          // Failed to restore — start fresh
        }
      }

      // Save initial state
      onHistorySave?.()
      onReady()
      onCanvasReady?.()
    }

    init()

    return () => {
      destroyed = true
      if (alignGuidelinesDispose.current) {
        alignGuidelinesDispose.current()
        alignGuidelinesDispose.current = null
      }
      if (canvas) {
        // Clean up touch and pan keyboard listeners
        ;(canvas as any).__touchCleanup?.()
        ;(canvas as any).__panCleanup?.()
        canvas.dispose()
        fabricCanvasRef.current = null
      }
      // Reset zoom level on panel switch / unmount
      setZoomLevel(1)
    }
  }, [productType, variantColor, panelId, productCategory, ghostTemplate, blankImageUrl, variantColorHex, aspectRatio]) // eslint-disable-line react-hooks/exhaustive-deps

  // === ResizeObserver — adapt canvas to container size changes ===
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let resizeTimer: ReturnType<typeof setTimeout> | null = null

    const observer = new ResizeObserver((entries) => {
      const canvas = fabricCanvasRef.current
      if (!canvas) return

      const entry = entries[0]
      if (!entry) return

      const { width, height } = entry.contentRect
      if (width <= 0 || height <= 0) return

      // Debounce resize to avoid rapid guide redraws
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(async () => {
        const effectiveAspectRatio = ghostTemplate
          ? ghostTemplate.printArea.templateWidth / ghostTemplate.printArea.templateHeight
          : aspectRatio

        const dims = calculateCanvasDimensions(width, height, effectiveAspectRatio)
        canvas.setDimensions({ width: dims.width, height: dims.height })

        // Recalculate print area
        let printArea: PrintAreaRect
        if (ghostTemplate) {
          const scale = dims.width / ghostTemplate.printArea.templateWidth
          printArea = {
            left: Math.round(ghostTemplate.printArea.left * scale),
            top: Math.round(ghostTemplate.printArea.top * scale),
            width: Math.round(ghostTemplate.printArea.width * scale),
            height: Math.round(ghostTemplate.printArea.height * scale),
          }
        } else {
          printArea = getCanvasPrintArea(productCategory, dims.width, dims.height, panelId)
        }
        printAreaRef.current = printArea

        // Update clipPath rect dimensions
        if (clipRectRef.current) {
          clipRectRef.current.set({
            left: printArea.left,
            top: printArea.top,
            width: printArea.width,
            height: printArea.height,
          })
        }

        // Remove old guides, redraw
        removeGuides(canvas)
        const garmentIsLight = isLightColor(ghostTemplate?.backgroundColor || variantColorHex || colorNameToHex(variantColor))
        await drawPrintAreaGuide(canvas, printArea, garmentIsLight)
        await drawSafeZone(canvas, printArea, garmentIsLight)

        // Rescale ghost overlay if present
        const ghostObj = canvas.getObjects().find((o: any) => o.data?.type === 'ghostOverlay')
        if (ghostObj) {
          ghostObj.set({
            scaleX: dims.width / (ghostObj.width || dims.width),
            scaleY: dims.height / (ghostObj.height || dims.height),
          })
          // Reorder: ghost below guides, above user objects
          const guideObjects = canvas.getObjects().filter(
            (o: any) => o.data?.type === 'printAreaGuide' || o.data?.type === 'safeZone'
          )
          if (guideObjects.length > 0) {
            const firstGuideIdx = canvas.getObjects().indexOf(guideObjects[0])
            canvas.moveObjectTo(ghostObj, firstGuideIdx)
          }
        }

        // Rescale background image if present
        const bgObj = canvas.getObjects().find((o: any) => o.data?.type === 'productBackground')
        if (bgObj) {
          const bgScaleX = dims.width / (bgObj.width || dims.width)
          const bgScaleY = dims.height / (bgObj.height || dims.height)
          const bgScale = Math.max(bgScaleX, bgScaleY)
          bgObj.set({
            scaleX: bgScale,
            scaleY: bgScale,
            left: (dims.width - (bgObj.width || 0) * bgScale) / 2,
            top: (dims.height - (bgObj.height || 0) * bgScale) / 2,
          })
        }

        canvas.renderAll()
      }, 50)
    })

    observer.observe(container)
    return () => {
      if (resizeTimer) clearTimeout(resizeTimer)
      observer.disconnect()
    }
  }, [productCategory, panelId, aspectRatio, variantColor, variantColorHex, ghostTemplate]) // eslint-disable-line react-hooks/exhaustive-deps
}
