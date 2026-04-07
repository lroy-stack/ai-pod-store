'use client'

import { useCallback } from 'react'
import { isGuideObject } from '@/lib/canvas-helpers'
import type { SelectedObjectInfo } from '@/hooks/useDesignEditor'

/**
 * Hook to extract selection info from Fabric.js canvas objects.
 * Handles gradient detection, shadow parsing, and coordinate extraction.
 */
export function useCanvasSelection() {
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
      src: !isText ? (obj.getSrc?.() || obj._element?.src) : undefined,
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

  return { extractObjectInfo }
}
