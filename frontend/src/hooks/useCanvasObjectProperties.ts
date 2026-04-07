'use client'

import { useCallback, type RefObject } from 'react'
import type { CanvasHandle } from '@/components/design-studio/CanvasWorkspace'
import type { FillMode } from '@/components/design-studio/tools/GradientEditor'

/**
 * Hook that provides all text/object property change handlers for the design studio.
 * Encapsulates font, shadow, outline, gradient, and opacity operations.
 */
export function useCanvasObjectProperties(
  canvasRef: RefObject<CanvasHandle | null>,
  setDirty: (dirty: boolean) => void,
  saveState: () => void
) {
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
  }, [canvasRef, setDirty, saveState])

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
  }, [canvasRef, setDirty, saveState])

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
  }, [canvasRef, setDirty, saveState])

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
  }, [canvasRef, setDirty, saveState])

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
  }, [canvasRef, setDirty, saveState])

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
  }, [canvasRef, setDirty, saveState])

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
  }, [canvasRef, setDirty, saveState])

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
  }, [canvasRef, setDirty, saveState])

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
  }, [canvasRef, setDirty, saveState])

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
  }, [canvasRef, setDirty, saveState])

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
  }, [canvasRef, setDirty, saveState])

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
  }, [canvasRef, setDirty, saveState])

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
  }, [canvasRef, setDirty, saveState])

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
  }, [canvasRef, setDirty, saveState])

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
  }, [canvasRef, setDirty, saveState])

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
  }, [canvasRef, setDirty, saveState])

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
  }, [canvasRef, setDirty, saveState])

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
  }, [canvasRef, setDirty, saveState])

  const handleOpacityChange = useCallback((opacity: number) => {
    canvasRef.current?.setObjectOpacity(opacity)
  }, [canvasRef])

  return {
    handleFontChange,
    handleFontSizeChange,
    handleTextColorChange,
    handleAlignChange,
    handleBoldToggle,
    handleItalicToggle,
    handleShadowToggle,
    handleShadowColorChange,
    handleShadowBlurChange,
    handleShadowOffsetXChange,
    handleShadowOffsetYChange,
    handleOutlineToggle,
    handleOutlineColorChange,
    handleOutlineWidthChange,
    handleFillModeChange,
    handleGradientStartColorChange,
    handleGradientEndColorChange,
    handleGradientAngleChange,
    handleOpacityChange,
  }
}
