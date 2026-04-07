/**
 * Canvas helper utilities for Design Studio.
 * Handles print area guides, object boundary clamping, and DPR management.
 */

import type { Canvas, FabricObject } from 'fabric'

export interface PrintAreaRect {
  left: number
  top: number
  width: number
  height: number
}

/** FabricObject with custom data property (used for guides, user objects, etc.) */
type FabricObjectWithData = FabricObject & { data?: { type?: string; id?: string } }

/** Data types that represent non-exportable guide/overlay objects */
export const GUIDE_DATA_TYPES = new Set([
  'printAreaGuide', 'safeZone', 'productBackground', 'ghostOverlay'
])

/**
 * Filter guide objects and backgroundColor from a serialized canvas JSON.
 * Returns a clean JSON containing only user-created objects.
 */
export function filterGuideObjectsFromJSON(
  canvasJson: Record<string, unknown>
): Record<string, unknown> {
  const filtered = { ...canvasJson }
  if (Array.isArray(filtered.objects)) {
    filtered.objects = (filtered.objects as Record<string, unknown>[]).filter((obj) => {
      const data = obj.data as { type?: string } | undefined
      return !data?.type || !GUIDE_DATA_TYPES.has(data.type)
    })
  }
  delete filtered.backgroundColor
  return filtered
}

/**
 * Draw the print area boundary guide on the canvas.
 * Creates a dashed rectangle that is not selectable or exportable.
 */
export async function drawPrintAreaGuide(
  canvas: Canvas,
  area: PrintAreaRect,
  isLightBackground: boolean = false
): Promise<FabricObject> {
  const { Rect } = await import('fabric')
  const guide = new Rect({
    left: area.left,
    top: area.top,
    width: area.width,
    height: area.height,
    fill: 'transparent',
    stroke: isLightBackground ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.6)',
    strokeWidth: 1.5,
    strokeDashArray: [8, 4],
    selectable: false,
    evented: false,
    excludeFromExport: true,
    data: { type: 'printAreaGuide' },
  })
  canvas.add(guide)
  return guide
}

/**
 * Draw the safe zone (10% inset from print area).
 * Content should ideally stay within this zone.
 */
export async function drawSafeZone(
  canvas: Canvas,
  area: PrintAreaRect,
  isLightBackground: boolean = false
): Promise<FabricObject> {
  const { Rect } = await import('fabric')
  const inset = 0.1
  const safeZone = new Rect({
    left: area.left + area.width * inset,
    top: area.top + area.height * inset,
    width: area.width * (1 - 2 * inset),
    height: area.height * (1 - 2 * inset),
    fill: 'transparent',
    stroke: isLightBackground ? 'rgba(22, 163, 74, 0.5)' : 'rgba(34, 197, 94, 0.4)',
    strokeWidth: 1,
    strokeDashArray: [4, 4],
    selectable: false,
    evented: false,
    excludeFromExport: true,
    data: { type: 'safeZone' },
  })
  canvas.add(safeZone)
  return safeZone
}

/**
 * Clamp an object within the print area boundaries.
 * Called on object:moving to prevent designs from going outside the printable area.
 */
export function clampObjectToPrintArea(
  obj: FabricObject,
  area: PrintAreaRect
): void {
  const bound = obj.getBoundingRect()
  let newLeft = obj.left ?? 0
  let newTop = obj.top ?? 0

  if (bound.left < area.left) {
    newLeft = area.left + (newLeft - bound.left)
  }
  if (bound.top < area.top) {
    newTop = area.top + (newTop - bound.top)
  }
  if (bound.left + bound.width > area.left + area.width) {
    newLeft = area.left + area.width - bound.width + (newLeft - bound.left)
  }
  if (bound.top + bound.height > area.top + area.height) {
    newTop = area.top + area.height - bound.height + (newTop - bound.top)
  }

  obj.set({ left: newLeft, top: newTop })
  obj.setCoords()
}

/**
 * Get capped DPR for canvas rendering.
 * iOS Safari has a 256MB canvas memory limit — cap at 2x to prevent crashes.
 */
export function getCappedDPR(): number {
  if (typeof window === 'undefined') return 1
  return Math.min(window.devicePixelRatio || 1, 2)
}

/**
 * Calculate canvas dimensions to fit within a container while maintaining aspect ratio.
 */
export function calculateCanvasDimensions(
  containerWidth: number,
  containerHeight: number,
  aspectRatio: number = 1
): { width: number; height: number } {
  let width = containerWidth
  let height = containerWidth / aspectRatio

  if (height > containerHeight) {
    height = containerHeight
    width = containerHeight * aspectRatio
  }

  return {
    width: Math.floor(width),
    height: Math.floor(height),
  }
}

/**
 * Remove all guide objects (print area + safe zone) from canvas.
 */
export function removeGuides(canvas: Canvas): void {
  const guides = canvas.getObjects().filter(
    obj => (obj as FabricObjectWithData).data?.type === 'printAreaGuide' || (obj as FabricObjectWithData).data?.type === 'safeZone'
  )
  guides.forEach(g => canvas.remove(g))
}

/**
 * Check if an object is a guide (non-exportable helper).
 */
export function isGuideObject(obj: FabricObject): boolean {
  const o = obj as FabricObjectWithData
  return !!o.data?.type && GUIDE_DATA_TYPES.has(o.data.type)
}
