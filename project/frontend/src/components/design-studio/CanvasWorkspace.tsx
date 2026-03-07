'use client'

import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useState } from 'react'
import { useDesignEditor, type SelectedObjectInfo } from '@/hooks/useDesignEditor'
import { getCanvasPrintArea } from '@/lib/print-area-config'
import { PRODUCTION_DIMENSIONS } from '@/lib/print-areas'
import {
  drawPrintAreaGuide,
  drawSafeZone,
  clampObjectToPrintArea,
  getCappedDPR,
  calculateCanvasDimensions,
  removeGuides,
  isGuideObject,
  filterGuideObjectsFromJSON,
  GUIDE_DATA_TYPES,
  type PrintAreaRect,
} from '@/lib/canvas-helpers'
import { loadFonts, loadFabric } from '@/lib/fabric-init'
import { colorNameToHex, isLightColor } from '@/lib/color-map'
import { cn } from '@/lib/utils'

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
  getSelectedInfo: () => SelectedObjectInfo | null
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

/** Normalize a variant color name for template file matching */
function normalizeColorForTemplate(color: string): string {
  return color.toLowerCase().trim().replace(/\s+/g, '-')
}

/** Get blank template URL candidates for a product type and color */
function getBlankTemplateUrls(productType: string, color: string, panelId: string): string[] {
  const normalized = normalizeColorForTemplate(color)
  const panelSuffix = panelId !== 'front' ? `-${panelId}` : ''
  return [
    // Try: tshirt-black-front.png (panel-specific)
    `/mockup-templates/${productType}-${normalized}${panelSuffix}.png`,
    // Try: tshirt-black.png (generic)
    `/mockup-templates/${productType}-${normalized}.png`,
    // Try: tshirt-white.png or tshirt-black.png as closest match
    `/mockup-templates/${productType}-${isLightColor(colorNameToHex(color)) ? 'white' : 'black'}${panelSuffix}.png`,
    `/mockup-templates/${productType}-${isLightColor(colorNameToHex(color)) ? 'white' : 'black'}.png`,
  ]
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
    }, [])

    const emitLayersChange = useCallback(() => {
      onLayersChange?.(buildLayers())
    }, [buildLayers, onLayersChange])

    // Extract selection info from a fabric object
    const extractObjectInfo = useCallback((obj: any): SelectedObjectInfo | null => {
      if (!obj || isGuideObject(obj)) return null

      const isText = obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox'
      const shadow = obj.shadow ? {
        color: obj.shadow.color || 'rgba(0,0,0,0.5)',
        blur: obj.shadow.blur ?? 10,
        offsetX: obj.shadow.offsetX ?? 5,
        offsetY: obj.shadow.offsetY ?? 5,
      } : null

      // Detect gradient fill
      let fillMode: 'solid' | 'linear' | 'radial' = 'solid'
      let gradientStartColor: string | undefined
      let gradientEndColor: string | undefined
      let gradientAngle: number | undefined

      if (obj.fill && typeof obj.fill === 'object' && 'colorStops' in obj.fill) {
        const gradient = obj.fill as any
        fillMode = gradient.type === 'radial' ? 'radial' : 'linear'
        gradientStartColor = gradient.colorStops?.[0]?.color
        gradientEndColor = gradient.colorStops?.[1]?.color
        // Calculate angle from linear gradient coords
        if (fillMode === 'linear' && gradient.coords) {
          const { x1, y1, x2, y2 } = gradient.coords
          gradientAngle = Math.round(Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI))
        }
      }

      return {
        type: isText ? 'text' : 'image',
        id: obj.data?.id || obj.id || String(Date.now()),
        text: isText ? obj.text : undefined,
        fontFamily: isText ? obj.fontFamily : undefined,
        fontSize: isText ? obj.fontSize : undefined,
        fill: typeof obj.fill === 'string' ? obj.fill : undefined,
        textAlign: isText ? obj.textAlign : undefined,
        fontWeight: isText ? String(obj.fontWeight) : undefined,
        fontStyle: isText ? obj.fontStyle : undefined,
        shadow,
        stroke: typeof obj.stroke === 'string' ? obj.stroke : undefined,
        strokeWidth: obj.strokeWidth ?? undefined,
        fillMode,
        gradientStartColor,
        gradientEndColor,
        gradientAngle,
        opacity: Math.round((obj.opacity ?? 1) * 100),
        left: obj.left ?? 0,
        top: obj.top ?? 0,
        width: obj.getScaledWidth?.() ?? obj.width ?? 0,
        height: obj.getScaledHeight?.() ?? obj.height ?? 0,
        angle: obj.angle ?? 0,
        scaleX: obj.scaleX ?? 1,
        scaleY: obj.scaleY ?? 1,
      }
    }, [])

    // Initialize canvas
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
        // Ghost template bg → variant hex → named color hex → default grey
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
        // Layer order: bg color → user objects → ghost overlay → print area guide → safe zone
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
          const rect = canvasEl.getBoundingClientRect()
          return {
            x: (t1.clientX + t2.clientX) / 2 - rect.left,
            y: (t1.clientY + t2.clientY) / 2 - rect.top,
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
        setIsReady(true)
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

    // ResizeObserver — adapt canvas to container size changes
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
    }, [productCategory, panelId, aspectRatio, variantColor, variantColorHex, ghostTemplate])

    /**
     * After adding a user object, ensure it sits below the ghost overlay and guides.
     * Layer order: productBackground → user objects → ghostOverlay → guides
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

        // Hide guide/overlay objects — toDataURL doesn't respect excludeFromExport
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

      exportProductionPNG: (productType: string) => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return ''

        const prodDims = PRODUCTION_DIMENSIONS[productType] || PRODUCTION_DIMENSIONS['tshirt']
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

      // Z-order (respects ghost overlay and background boundaries)
      bringForward: () => {
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
      },

      sendBackward: () => {
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
      },

      bringToFront: () => {
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
      },

      sendToBack: () => {
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
      },

      // Layers
      getLayers: buildLayers,

      setObjectVisibility: (id: string, visible: boolean) => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return
        const obj = canvas.getObjects().find((o: any) => o.data?.id === id)
        if (obj) {
          obj.set('visible', visible)
          canvas.renderAll()
          emitLayersChange()
        }
      },

      setObjectLocked: (id: string, locked: boolean) => {
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
      },

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
    }), [setDirty, onHistorySave, extractObjectInfo, setSelectedObject, setZoomLevel, buildLayers, emitLayersChange, reorderAfterAdd]) // eslint-disable-line react-hooks/exhaustive-deps

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
